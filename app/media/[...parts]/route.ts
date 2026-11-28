import { revalidateTag, unstable_cache } from "next/cache"
import type { NextRequest } from "next/server"

import { notionApiBaseUrl, notionConfigured } from "@/lib/config"
import { FRESH_MS, stillFresh, verifyMedia } from "@/lib/content/media"
import { MAX_RESIZE_BYTES, RESIZABLE, resized, sourceAt, squareIcon } from "@/lib/content/media-resize"
import { iconSize, mediaWidth } from "@/lib/media-sizes"
import { retrieveBlock, retrievePage } from "@/lib/notion/client"
import { fileVersion, type MediaRef } from "@/lib/notion/rows"
import { otherName } from "@/lib/notion/schema"
import { fetchPublic } from "@/lib/outbound"
import { pickHeaders, standIn } from "@/lib/proxy"
import { rateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * `/media/<token>/<name>`: a picture or file from Notion, served from this
 * site. With `?w=<width>`, a picture at that width, and with `?icon=<size>`
 * the square PNG icon of that size (both lib/media-sizes.ts).
 *
 * The token is signed by lib/content/media.ts when a page is rendered, so
 * this serves only files the site printed. It asks Notion for the file's
 * current address (Notion's expire after an hour), fetches it here, and
 * sends it on, so a reader's browser never contacts Notion's file host or
 * an image's outside host. The token changes whenever the file does, so the
 * answer is cached for a year, by the browser and by the host's CDN
 * (`s-maxage`).
 *
 * Notion is asked once per page or block, not once per picture: one answer
 * holds the address of every file the page has (its cover, its icon, its
 * gallery), whatever each one's version, is shared by requests that arrive
 * together, and is used for 50
 * minutes of Notion's hour and never longer, nor past the minute before the
 * soonest `expiry_time` Notion gave with it. A file host that refuses an
 * address anyway (Notion's says 403 once one has expired), or can't be
 * reached, is tried once more, with an address Notion is asked for afresh.
 *
 * The file is fetched as lib/outbound.ts allows: https, a public host,
 * every redirect checked the same way, and each connection made to the
 * address that was checked.
 */
const MAX_BYTES = 100 * 1024 * 1024

/** Shown in the browser rather than downloaded. */
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon)|video\/|audio\/|application\/pdf$)/i

/** Never served as themselves from this origin: they could run as a page. */
const DANGEROUS = /^(text\/html|application\/(xhtml\+xml|javascript|ecmascript|x-javascript)|text\/(javascript|ecmascript|xml)|application\/xml)/i

type FileValue = { type?: string; file?: { url?: string; expiry_time?: string }; external?: { url?: string }; custom_emoji?: { url?: string } }

const fileUrl = (value: FileValue | null | undefined): string | undefined =>
  value?.type === "external" ? value.external?.url : value?.type === "custom_emoji" ? value.custom_emoji?.url : value?.file?.url

/** Every file a page or block holds, by where it is held, and when the
 *  first of Notion's addresses among them expires (ms; none: no limit). */
type OwnerFiles = { cover?: string; icon?: string; file?: string; props?: Record<string, (string | undefined)[]>; until?: number }

/** The soonest of the files' `expiry_time`s, as Notion gives them. */
function soonest(values: (FileValue | null | undefined)[]): number | undefined {
  const times = values.map((v) => Date.parse(v?.type === "file" ? (v.file?.expiry_time ?? "") : "")).filter(Number.isFinite)
  return times.length ? Math.min(...times) : undefined
}

/** Where a page's or a block's files are right now: one request to Notion. */
async function ownerFiles(owner: MediaRef["owner"], id: string): Promise<OwnerFiles> {
  if (owner === "block") {
    const block = (await retrieveBlock(id)) as { type?: string; [k: string]: unknown }
    const payload = block.type ? (block[block.type] as (FileValue & { icon?: FileValue | null }) | undefined) : undefined
    // a callout's icon, and the block's own file
    return { icon: fileUrl(payload?.icon), file: fileUrl(payload), until: soonest([payload?.icon, payload]) }
  }
  const page = (await retrievePage(id)) as {
    cover?: FileValue | null
    icon?: FileValue | null
    properties?: Record<string, { files?: (FileValue & { name?: string })[] } | undefined>
  }
  const props: Record<string, (string | undefined)[]> = {}
  const all: (FileValue | null | undefined)[] = [page.cover, page.icon]
  for (const [name, value] of Object.entries(page.properties ?? {})) {
    if (value?.files?.length) {
      props[name] = value.files.map(fileUrl)
      all.push(...value.files)
    }
  }
  return { cover: fileUrl(page.cover), icon: fileUrl(page.icon), props, until: soonest(all) }
}

/** Requests to Notion that are under way, so the pictures of one page asked
 *  for together (a gallery) wait on one answer rather than each asking. */
const asking = new Map<string, Promise<OwnerFiles>>()

const ownerTag = (ref: MediaRef) => `media-owner:${ref.owner}:${ref.id}`

/**
 * The owner's files, remembered across requests and instances. A failure is
 * not remembered: it throws, and is asked again.
 *
 * Next's cache hands back an answer past its time once more while it fetches
 * a new one behind, and an address past its expiry is refused. So each
 * answer carries when it was given, and one no longer `stillFresh` is not
 * used: Notion is asked there and then, and the kept one is let go, so the
 * next request keeps the new. `fresh` skips the kept answer outright.
 */
function cachedOwnerFiles(ref: MediaRef, fresh = false): Promise<OwnerFiles> {
  // one answer for all of an owner's files, whatever each one's version
  const key = `${ref.owner}:${ref.id}${fresh ? ":fresh" : ""}`
  let pending = asking.get(key)
  if (!pending) {
    // an answer asked for in this request is used whatever its expiry:
    // asking again would be told the same
    let asked = false
    const ask = async () => {
      asked = true
      return { at: Date.now(), files: await ownerFiles(ref.owner, ref.id) }
    }
    const now = async () => {
      revalidateTag(ownerTag(ref))
      return (await ask()).files
    }
    pending = (
      fresh
        ? now()
        : unstable_cache(ask, ["media-owner-v4", ref.owner, ref.id], { revalidate: FRESH_MS / 1000, tags: [ownerTag(ref)] })().then((kept) =>
            asked || stillFresh(kept.at, kept.files.until) ? kept.files : now(),
          )
    ).finally(() => asking.delete(key))
    asking.set(key, pending)
  }
  return pending
}

/** The file a reference names among its owner's. */
function fileIn(files: OwnerFiles, ref: MediaRef): string | undefined {
  if (ref.field === "icon") return files.icon
  if (ref.owner === "block") return files.file
  if (ref.field === "cover") return files.cover
  // by either name, so a page drawn before its property was renamed in
  // Notion (FORMER_NAMES) still finds its file after
  if (ref.field === "prop" && ref.prop) return (files.props?.[ref.prop] ?? files.props?.[otherName(ref.prop)])?.[ref.index ?? 0]
  return undefined
}

/** A version made from a file's address (fileVersion), as opposed to the
 *  last edit that stands in where there was none to read. */
const FILE_VERSION = /^[0-9a-f]{16}$/

/**
 * Where the file is right now; `fresh`: as Notion says this moment.
 *
 * The kept answer is the owner's, for all its files, and an address names
 * its own file's version. So a file replaced since the answer was kept (a
 * new cover, uploaded a minute ago) is told apart by its version, and
 * Notion is asked as it is now, once: the new address is never answered
 * with the old picture, which every cache would then keep for a year.
 */
async function upstreamFor(ref: MediaRef, fresh = false): Promise<string | undefined> {
  if (ref.external) return ref.external
  if (!notionConfigured()) return undefined
  const url = fileIn(await cachedOwnerFiles(ref, fresh), ref)
  if (!fresh && url && FILE_VERSION.test(ref.v) && fileVersion(url, "") !== ref.v) return fileIn(await cachedOwnerFiles(ref, true), ref)
  return url
}

/** Whether a file host's answer is worth one more try: it could not be
 *  reached, refused an address (expired, or signed for another moment), or
 *  failed on its side. A 404 is an answer, and so is a fetch not allowed. */
function retryable(upstream: Response | Error | null): boolean {
  if (upstream instanceof Error) return true
  return upstream !== null && (upstream.status === 403 || upstream.status === 400 || upstream.status >= 500)
}

/** A host, for a log line: never the address, whose query holds a signature. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/[^\w.:-]/g, "")
  } catch {
    return "(no host)"
  }
}

/** A refusal, which nothing may cache: the next request may be answered. */
const refuse = (status: number, words: string) => new Response(words, { status, headers: { "Cache-Control": "no-store" } })

/** An answer that will not be read: let its connection go. */
const drop = (response: Response) => response.body?.cancel().catch(() => {})

/**
 * A file passed on as it arrives, and cut off past `max` bytes. A host need
 * not say how long its answer is, and may say less than it sends, so the
 * limit is counted, not taken on trust.
 */
function capped(body: ReadableStream<Uint8Array>, max: number): ReadableStream<Uint8Array> {
  let sent = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        sent += chunk.length
        if (sent > max) controller.error(new Error("the file is larger than this site serves"))
        else controller.enqueue(chunk)
      },
    }),
  )
}
const notFound = () => refuse(404, "Not found")
const badGateway = () => refuse(502, "Bad gateway")

/** A file name safe inside a quoted header: letters, digits, dots, dashes. */
function safeName(raw: string): string {
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    // a name that is not valid percent-encoding is used as it came
  }
  return name.replace(/[^\w.-]+/g, "-").slice(0, 80) || "file"
}

/** What every file is sent with, whatever it is. */
function fileHeaders(type: string, filename: string): Headers {
  return new Headers({
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    "Content-Disposition": `${INLINE.test(type) ? "inline" : "attachment"}; filename="${filename}"`,
    "X-Content-Type-Options": "nosniff",
    // an SVG or a PDF opened on its own runs nothing from this origin
    // the only policy it is sent with (next.config.mjs leaves /media/ out)
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
  })
}

/**
 * A file read into memory, if it is no more than `max` bytes. A host need
 * not say how long its answer is, so the length is found by reading: past
 * `max` the reading stops, and `rest` is the whole file again, what was
 * read and then what was not, to be streamed on.
 */
async function readWhole(body: ReadableStream<Uint8Array>, max: number): Promise<{ whole: Buffer } | { rest: ReadableStream<Uint8Array> }> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size <= max) {
    const { done, value } = await reader.read()
    if (done) return { whole: Buffer.concat(chunks) }
    chunks.push(value)
    size += value.length
  }
  return {
    rest: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
      },
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) controller.close()
        else controller.enqueue(value)
      },
      cancel(reason) {
        return reader.cancel(reason)
      },
    }),
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ parts: string[] }> }) {
  const limit = await rateLimit(req, { key: "media", max: 600, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const [token, name = "file"] = (await params).parts ?? []
  const ref = token ? verifyMedia(token) : null
  if (!ref) return notFound()

  let url: string | undefined
  try {
    url = await upstreamFor(ref)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 404) return notFound()
    console.error("[media] Notion could not be asked for a file:", error instanceof Error ? error.message : error)
    return badGateway()
  }
  if (!url) return notFound()

  const range = req.headers.get("range")
  // the width asked for, if any: a host that sizes its own pictures is asked
  // for it, so the original never crosses the network
  const icon = iconSize(Number(req.nextUrl.searchParams.get("icon") ?? ""))
  const width = icon ? undefined : mediaWidth(Number(req.nextUrl.searchParams.get("w") ?? ""))
  const fetchFrom = (address: string) =>
    fetchPublic(
      range ? address : sourceAt(address, width ?? icon),
      { headers: { Accept: "*/*", ...(range ? { Range: range } : {}) }, signal: AbortSignal.timeout(20_000), cache: "no-store" },
      // a stand-in Notion under test; production has none (lib/proxy.ts)
      { standIn: standIn(notionApiBaseUrl()) },
    ).catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))))

  let upstream = await fetchFrom(url)
  // refused (an address past its time answers 403), failing, or out of
  // reach: once more, with the address as Notion gives it now
  if (retryable(upstream)) {
    if (upstream instanceof Response) void drop(upstream)
    let again: string | undefined = url
    if (!ref.external) {
      try {
        again = await upstreamFor(ref, true)
      } catch {
        again = undefined
      }
    }
    if (again) upstream = await fetchFrom(again)
  }
  if (upstream instanceof Error || (upstream && (!upstream.ok || !upstream.body) && upstream.status !== 404)) {
    console.warn(`[media] the file's host ${upstream instanceof Error ? `could not be reached (${upstream.name})` : `answered ${upstream.status}`}, twice: ${hostOf(url)}`)
  }
  if (upstream instanceof Error) return badGateway()
  // an address, or a redirect from it, that may not be fetched
  if (!upstream) return notFound()
  if (!upstream.ok || !upstream.body) {
    void drop(upstream)
    return upstream.status === 404 ? notFound() : badGateway()
  }

  const length = Number(upstream.headers.get("content-length") ?? "0")
  if (length > MAX_BYTES) {
    void drop(upstream)
    return refuse(413, "Too large")
  }

  let type = (upstream.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim().toLowerCase()
  if (DANGEROUS.test(type)) type = "application/octet-stream"
  const filename = safeName(name)

  // A picture at the width asked for, or an icon at its size. Only a whole
  // picture of a known, bounded size is read into memory; anything else is
  // streamed as it is.
  let body: ReadableStream<Uint8Array> = upstream.body
  if ((width || icon) && !range && upstream.status === 200 && RESIZABLE.test(type) && length <= MAX_RESIZE_BYTES) {
    let read: Awaited<ReturnType<typeof readWhole>>
    try {
      read = await readWhole(upstream.body, MAX_RESIZE_BYTES)
    } catch {
      return badGateway()
    }
    if ("whole" in read) {
      const made = icon ? await squareIcon(read.whole, icon) : width ? await resized(read.whole, width) : null
      const [madeType, extension] = icon ? ["image/png", "png"] : ["image/webp", "webp"]
      const headers = made ? fileHeaders(madeType, `${filename.replace(/\.[a-z0-9]+$/i, "")}.${extension}`) : fileHeaders(type, filename)
      const bytes = made ?? read.whole
      headers.set("Content-Length", String(bytes.length))
      return new Response(new Uint8Array(bytes), { status: 200, headers })
    }
    // larger than it said, or than it should be: sent on as it is
    body = read.rest
  }

  // fetch has already undone a host's compression, so the length it gave
  // is of bytes that are not the ones sent on
  const packed = upstream.headers.has("content-encoding")
  const passed = [...(packed ? [] : ["content-length"]), "content-range", "accept-ranges", "last-modified", "etag"]
  const headers = pickHeaders(upstream.headers, passed, fileHeaders(type, filename))
  return new Response(capped(body, MAX_BYTES), { status: upstream.status, headers })
}
