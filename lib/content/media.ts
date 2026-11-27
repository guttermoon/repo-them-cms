/**
 * Addresses on this site for the pictures and files in Notion.
 *
 * Notion's own file addresses expire after an hour and live on a third
 * party's host, and this site's rule is that a reader's browser contacts
 * nobody but the site. So every picture and file is printed as
 * `/media/<token>/<name>`: the token names where the file lives (a block, a
 * page's cover, icon or files property, or an outside address) and is signed,
 * so the media route (app/media/[...parts]/route.ts) serves only files this
 * site printed and cannot be used to fetch anything else.
 *
 * The signing key is MEDIA_SIGNING_KEY when it is set, and otherwise
 * derived from NOTION_TOKEN, so there is nothing more to configure; a new
 * key retires every old address (pages refresh within a minute and print
 * new ones). With neither, no address verifies at all: a key anybody could
 * work out would let anybody sign an outside address and use the site to
 * fetch it, an open proxy on the site's bandwidth and reputation.
 *
 * Node's crypto only, so `npm test` loads it (tests/media.test.mjs).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto"

import type { MediaRef } from "../notion/rows"

const SIG_BYTES = 16

/** The signing key, or null when the site has no secret to make one from. */
function key(): Buffer | null {
  const secret = process.env.MEDIA_SIGNING_KEY?.trim() || process.env.NOTION_TOKEN?.trim()
  return secret ? createHash("sha256").update(`media-v1:${secret}`).digest() : null
}

const b64 = (data: Buffer | string) => Buffer.from(data).toString("base64url")

type Payload = { o: "p" | "b"; i: string; f: "c" | "i" | "p" | "b"; p?: string; n?: number; v: string; x?: string }

const FIELD = { cover: "c", icon: "i", prop: "p", block: "b" } as const
const FIELD_BACK = { c: "cover", i: "icon", p: "prop", b: "block" } as const

/** A reference as a signed token. */
export function signMedia(ref: MediaRef): string {
  const payload: Payload = {
    o: ref.owner === "page" ? "p" : "b",
    i: ref.id.replace(/-/g, ""),
    f: FIELD[ref.field],
    v: ref.v,
    ...(ref.prop ? { p: ref.prop } : {}),
    ...(ref.index !== undefined ? { n: ref.index } : {}),
    ...(ref.external ? { x: ref.external } : {}),
  }
  const body = b64(JSON.stringify(payload))
  const secret = key()
  // with no key there is nothing to sign with: the address is printed, and
  // the media route refuses it
  if (!secret) return `${body}.`
  const sig = createHmac("sha256", secret).update(body).digest().subarray(0, SIG_BYTES)
  return `${body}.${b64(sig)}`
}

/** A token back as a reference, or null when it is not one this site signed. */
export function verifyMedia(token: string): MediaRef | null {
  const secret = key()
  const [body, sig] = token.split(".")
  if (!secret || !body || !sig || token.length > 4096) return null
  const expected = createHmac("sha256", secret).update(body).digest().subarray(0, SIG_BYTES)
  const given = Buffer.from(sig, "base64url")
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload
    if (!/^[0-9a-f]{32}$/.test(p.i) || !(p.f in FIELD_BACK) || (p.o !== "p" && p.o !== "b")) return null
    const id = `${p.i.slice(0, 8)}-${p.i.slice(8, 12)}-${p.i.slice(12, 16)}-${p.i.slice(16, 20)}-${p.i.slice(20)}`
    return {
      owner: p.o === "p" ? "page" : "block",
      id,
      field: FIELD_BACK[p.f],
      v: String(p.v ?? ""),
      ...(p.p ? { prop: p.p } : {}),
      ...(typeof p.n === "number" ? { index: p.n } : {}),
      ...(p.x ? { external: p.x } : {}),
    }
  } catch {
    return null
  }
}

/** A file name for the end of the address: what a reader sees when they
 *  save the file, and what an image search reads. */
export function mediaName(ref: MediaRef, fallback = "file"): string {
  let fromExternal = ""
  if (ref.external) {
    try {
      fromExternal = new URL(ref.external, "https://x.invalid").pathname.split("/").pop() ?? ""
      fromExternal = decodeURIComponent(fromExternal)
    } catch {
      // an address that is not one, or a "%" that escapes nothing: the name as it came, or none
    }
  }
  const raw = ref.name || fromExternal || fallback
  const dot = raw.lastIndexOf(".")
  const ext = dot > 0 ? raw.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : ""
  const stem = (dot > 0 ? raw.slice(0, dot) : raw)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${stem || fallback}${ext ? `.${ext}` : ""}`
}

/**
 * This site's own pictures (public/demo, the starter content's), printed as
 * they are: they are already here, so there is nothing to proxy or sign.
 * Only a plain path under /demo/ counts; anything else, `//host/…` included,
 * goes through the signed route like every outside address.
 */
export const OWN_FILES = "/demo/"
const OWN_FILE = /^\/demo\/[\w-]+(\.[\w]+)?$/

/** The site address for a file in Notion. */
export function mediaUrl(ref: MediaRef, fallbackName?: string): string {
  if (ref.external && OWN_FILE.test(ref.external)) return ref.external
  return `/media/${signMedia(ref)}/${mediaName(ref, fallbackName)}`
}

/** How long the media route uses an answer from Notion: 50 minutes of the
 *  hour its addresses last (app/media). */
export const FRESH_MS = 50 * 60 * 1000

/** An answer is let go this long before the soonest of its addresses
 *  expires, so a file is never fetched with one about to die. */
export const EXPIRY_MARGIN_MS = 60 * 1000

/** Whether the media route may still use an answer Notion gave at `at`,
 *  whose first address expires at `until` (none given: the hour holds). */
export function stillFresh(at: number, until: number | undefined, now: number = Date.now()): boolean {
  return now - at < FRESH_MS && (until === undefined || now < until - EXPIRY_MARGIN_MS)
}
