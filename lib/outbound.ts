/**
 * Fetching an address somebody else chose, for the media route.
 *
 * The media route fetches only addresses this site signed
 * (lib/content/media.ts), and those come from Notion: its own file host, or
 * an outside picture an editor embedded. So a stranger cannot name an
 * address. But an address an editor pasted is still not the site's own, and
 * the host it names decides where the request finally lands: it can answer
 * with a redirect, or its name can resolve to a machine inside the network
 * the site runs in (a cloud's metadata service, a database, localhost),
 * which the site can reach and the wider internet cannot.
 *
 * So, for every address and every redirect on the way to a file:
 * - https only (plain http only to the stand-in Notion under test);
 * - never a host that is, or resolves to, a private, loopback or link-local
 *   address;
 * - redirects are followed here, one at a time, each checked the same way,
 *   and at most three;
 * - the connection is made to an address that was checked: the name is
 *   looked up as the socket opens (`checkedLookup`), and refused there if
 *   any address it has is private. A hostile DNS server that answers with a
 *   public address for the check and a private one for the connection, or
 *   that answers nothing the first time, gets nowhere: what the socket
 *   connects to is what was checked. `fetch` cannot be told where to
 *   connect, so the request is Node's own (`pinnedFetch`), answered as a
 *   `Response` as fetch would answer it.
 *
 * Node only (dns, https, net); tested in tests/outbound.test.mjs.
 */
import { lookup } from "node:dns/promises"
import type { IncomingMessage } from "node:http"
import { Agent, request } from "node:https"
import { isIP } from "node:net"
import { Readable } from "node:stream"
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib"

const MAX_REDIRECTS = 3

/** An IPv4 address that is not on the public internet. */
function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number)
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local: the cloud metadata services
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || // protocol assignments, documentation
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  )
}

/** An IP address, v4 or v6, that is not on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, "").toLowerCase()
  if (isIP(address) === 4) return privateV4(address)
  if (isIP(address) !== 6) return true // not an address at all: refuse
  // An IPv4 address carried inside an IPv6 one, dotted or in hex: mapped
  // (::ffff:), compatible (::), NAT64 (64:ff9b::) and 6to4 (2002:). A
  // gateway would deliver each to the IPv4 address it names.
  const dotted = address.match(/^(?:::ffff:|::|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) return privateV4(dotted[1])
  const hex = address.match(/^(?:::ffff:|::|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/) ?? address.match(/^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/)
  if (hex) {
    const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)]
    return privateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }
  return (
    address === "::" ||
    address === "::1" ||
    /^f[cd]/.test(address) || // unique local
    /^fe[89ab]/.test(address) || // link-local
    /^ff/.test(address) // multicast
  )
}

type Resolve = (host: string) => Promise<string[]>

const resolveAll: Resolve = async (host) => (await lookup(host, { all: true })).map((found) => found.address)

/**
 * Whether an address may be fetched: https, to a host on the public
 * internet. `standIn` is the origin of a stand-in Notion (NOTION_API_BASE_URL),
 * the one place plain http and a local address are let through.
 *
 * A name that does not resolve is let through here: there is nothing to
 * reach, and the connection, which looks it up again and checks that
 * answer (`checkedLookup`), fails on its own.
 */
export async function fetchable(raw: string, standIn?: string, resolve: Resolve = resolveAll): Promise<boolean> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (standIn) {
    try {
      if (url.origin === new URL(standIn).origin) return true
    } catch {
      // a stand-in that is not an address lets nothing through
    }
  }
  if (url.protocol !== "https:" || url.username || url.password) return false
  const host = url.hostname.replace(/^\[|\]$/g, "")
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false
  if (isIP(host)) return !isPrivateAddress(host)
  let addresses: string[]
  try {
    addresses = await resolve(host)
  } catch {
    return true
  }
  return !addresses.some(isPrivateAddress)
}

const sameOrigin = (url: string, other: string): boolean => {
  try {
    return new URL(url).origin === new URL(other).origin
  } catch {
    return false
  }
}

/** Why a connection was refused at the moment it was made. */
export const NOT_PUBLIC = "EADDRNOTPUBLIC"

type LookupCallback = (error: NodeJS.ErrnoException | null, address?: string | { address: string; family: number }[], family?: number) => void

/**
 * `dns.lookup` as a socket calls it, answering only with addresses that are
 * all public: a name with any private address is refused (`NOT_PUBLIC`), so
 * the address a connection is made to is one that passed the check.
 */
export function checkedLookup(resolve: Resolve = resolveAll) {
  return (hostname: string, options: { all?: boolean; family?: number | string } | number | undefined, callback: LookupCallback) => {
    const family = typeof options === "number" ? options : Number(options?.family) || 0
    const all = typeof options === "object" && options !== null && Boolean(options.all)
    resolve(hostname)
      .then((addresses) => {
        if (addresses.some(isPrivateAddress)) throw Object.assign(new Error(`${hostname} has an address that is not public`), { code: NOT_PUBLIC })
        const found = addresses.map((address) => ({ address, family: isIP(address) })).filter((a) => !family || a.family === family)
        if (!found.length) throw Object.assign(new Error(`${hostname} has no address`), { code: "ENOTFOUND" })
        if (all) callback(null, found)
        else callback(null, found[0].address, found[0].family)
      })
      .catch((error: NodeJS.ErrnoException) => callback(error))
  }
}

/** Statuses a Response may not carry a body with. */
const NO_BODY = new Set([101, 204, 205, 304])

/**
 * Node's answer as fetch's: the same status and headers, and the body as a
 * stream, uncompressed as fetch would uncompress it (the content-encoding
 * header kept, as fetch keeps it). Cancelling the body lets the
 * connection go.
 */
export function responseFrom(res: IncomingMessage, method = "GET"): Response {
  const status = res.statusCode ?? 0
  if (status < 200 || status > 599) {
    res.destroy()
    throw new Error(`an answer with status ${status}`)
  }
  const headers = new Headers()
  for (let i = 0; i + 1 < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1])
  if (NO_BODY.has(status) || method === "HEAD") {
    res.resume()
    return new Response(null, { status, headers })
  }
  const encoding = (headers.get("content-encoding") ?? "").trim().toLowerCase()
  const decoder = encoding === "gzip" || encoding === "x-gzip" ? createGunzip() : encoding === "deflate" ? createInflate() : encoding === "br" ? createBrotliDecompress() : null
  let stream: Readable = res
  if (decoder) {
    res.on("error", (error) => decoder.destroy(error))
    decoder.on("close", () => res.destroy())
    stream = res.pipe(decoder)
  }
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers })
}

/** One pool of connections, each made through `checkedLookup`. */
const pinnedAgent = new Agent({ keepAlive: true, maxSockets: 16 })

/**
 * One https request, connected to a checked address (`checkedLookup`) and
 * never redirected on its own. What `fetchPublic` sends with.
 */
export function pinnedFetch(raw: string, init: Omit<RequestInit, "redirect"> = {}, resolve: Resolve = resolveAll): Promise<Response> {
  const url = new URL(raw)
  if (url.protocol !== "https:") return Promise.reject(new TypeError(`${url.protocol} is not fetched`))
  const method = (init.method ?? "GET").toUpperCase()
  if (method !== "GET" && method !== "HEAD") return Promise.reject(new TypeError(`${method} is not sent`))
  const headers: Record<string, string> = { "accept-encoding": "gzip, deflate, br" }
  for (const [name, value] of new Headers(init.headers ?? {})) headers[name] = value
  return new Promise((resolveAnswer, reject) => {
    const req = request(url, { method, headers, agent: resolve === resolveAll ? pinnedAgent : undefined, lookup: checkedLookup(resolve) as never, signal: init.signal ?? undefined }, (res) => {
      try {
        resolveAnswer(responseFrom(res, method))
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
    req.end()
  })
}

/** A sender, as `fetch` is called. */
export type Send = (url: string, init: Omit<RequestInit, "redirect"> & { redirect: "manual" }) => Promise<Response>

/**
 * The sender `fetchPublic` uses for every address but the stand-in's:
 * `pinnedFetch`. Tests set `send` here to answer for a host of their own.
 */
export const outbound: { send: Send | null } = { send: null }

/**
 * A GET to an address that passes `fetchable`, following at most three
 * redirects that each pass it too, each connected to a checked address.
 * Null when the address, anywhere it redirects to, or what its name
 * resolves to as the connection is made, is refused.
 */
export async function fetchPublic(
  raw: string,
  init: Omit<RequestInit, "redirect">,
  { standIn, resolve, send }: { standIn?: string; resolve?: Resolve; send?: Send } = {},
): Promise<Response | null> {
  let url = raw
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await fetchable(url, standIn, resolve))) return null
    // the stand-in Notion under test is local by design, and fetched as it is
    const toStandIn = standIn !== undefined && sameOrigin(url, standIn)
    const sender: Send = toStandIn ? (u, i) => fetch(u, i) : (send ?? outbound.send ?? ((u, i) => pinnedFetch(u, i, resolve)))
    let response: Response
    try {
      response = await sender(url, { ...init, redirect: "manual" })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === NOT_PUBLIC) return null
      throw error
    }
    const location = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null
    if (!location) return response
    // the redirect's own body is not wanted; let the connection go
    await response.body?.cancel().catch(() => {})
    try {
      url = new URL(location, url).toString()
    } catch {
      return null
    }
  }
  return null
}
