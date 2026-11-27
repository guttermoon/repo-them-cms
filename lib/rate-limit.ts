import { createHash, createHmac } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"

/**
 * The public routes' limiter: so many requests a minute from one caller to
 * one route (docs/privacy-and-security.md, "Rate limits").
 *
 * Two counts, asked in turn:
 *
 * 1. This instance's memory, always and first. A caller already over the
 *    limit here is refused at once, with no request anywhere.
 * 2. A shared store, when one is set: a Redis that speaks Upstash's REST
 *    API (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the
 *    `KV_REST_API_URL` and `KV_REST_API_TOKEN` that Vercel's Upstash
 *    integration sets). One count across every instance and every cold
 *    start, so a flood spread over many instances meets the same limit as
 *    one caller in a loop.
 *
 * The store is never told an address: a caller is a keyed hash of it, an
 * HMAC under a key the store does not have (the site's own secret:
 * MEDIA_SIGNING_KEY, else NOTION_TOKEN), so it cannot hash every address
 * there is and match them up. A site with neither counts in memory alone,
 * store or no store: a key the store could work out would undo the hash.
 * Each count expires with its window, and every answer from the store moves
 * this instance's window to end where the store's does, so memory never
 * refuses a caller the store has started afresh. A store that is slow or down is not a site that is down: past
 * STORE_TIMEOUT_MS, or on any error, the memory's answer stands, and the
 * log says so once.
 *
 * The analytics proxies count in memory alone (`shared: false`). PostHog's
 * and Google's keys are public, so a flood can go to them directly anyway,
 * and those routes carry every reader's events: a store asked each time
 * would cost a request per event and buy nothing.
 *
 * Without a store, the counts are per instance and reset on a cold start:
 * enough to stop one client sitting in a loop enrolling addresses, sending
 * the contact form or making the site fan out to Notion, not a distributed
 * flood.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** The most callers remembered at once. */
export const MAX_BUCKETS = 10_000

/** How long the shared store is waited for before the memory's answer stands. */
export const STORE_TIMEOUT_MS = 400

/**
 * Keep the map bounded on a long-lived instance, whoever is calling. At
 * MAX_BUCKETS the spent windows go, and if a flood of new addresses has
 * left too few of those, the oldest go too, down to nine tenths. So the
 * whole map is walked once per thousand new callers at most, never on
 * every request, and its memory has a ceiling.
 */
function sweep(now: number) {
  if (buckets.size < MAX_BUCKETS) return
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k)
  }
  const keep = Math.floor(MAX_BUCKETS * 0.9)
  for (const k of buckets.keys()) {
    if (buckets.size <= keep) break
    buckets.delete(k)
  }
}

/** For tests: how many callers are remembered. */
export const rememberedCallers = (): number => buckets.size

/** For tests: this instance's memory as a cold start finds it. */
export const forgetCallers = (): void => buckets.clear()

/**
 * The caller's address. `x-forwarded-for` is set by the platform's proxy and
 * is spoofable if the app is ever exposed without one in front, so this is a
 * best-effort identifier — good enough to bound accidental and casual abuse,
 * not an authentication signal.
 */
function clientId(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

/** This instance's count for one caller and route, one more. */
function countHere(id: string, now: number, windowMs: number): Bucket {
  sweep(now)
  const bucket = buckets.get(id)
  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs }
    buckets.set(id, fresh)
    return fresh
  }
  bucket.count += 1
  return bucket
}

export type Store = { url: string; token: string; secret: string }

/**
 * The shared store, or null for none. Upstash's own names first, then
 * Vercel's; each pair is taken whole, never one half of each. https only,
 * but for a stand-in on this machine outside production. And only with a
 * secret of the site's own to hash callers with (`callerSecret`).
 */
export function sharedStore(env: Record<string, string | undefined> = process.env): Store | null {
  const secret = callerSecret(env)
  if (!secret) return null
  const pairs = [
    [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN],
    [env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
  ]
  for (const [rawUrl, rawToken] of pairs) {
    const url = rawUrl?.trim().replace(/\/+$/, "")
    const token = rawToken?.trim()
    if (!url || !token) continue
    try {
      const { protocol, hostname } = new URL(url)
      const local = env.NODE_ENV !== "production" && protocol === "http:" && (hostname === "127.0.0.1" || hostname === "localhost")
      if (protocol !== "https:" && !local) return null
    } catch {
      return null
    }
    return { url, token, secret }
  }
  return null
}

/**
 * What a caller's address is hashed with: a key made from the site's own
 * secret, which the store never sees (MEDIA_SIGNING_KEY, else NOTION_TOKEN),
 * or null when the site has neither. Never the store's token: the store has
 * that, and could hash all four billion IPv4 addresses with it.
 */
export function callerSecret(env: Record<string, string | undefined> = process.env): string | null {
  const own = env.MEDIA_SIGNING_KEY?.trim() || env.NOTION_TOKEN?.trim()
  return own ? createHash("sha256").update(`rate-limit-v1:${own}`).digest("base64url") : null
}

/** A caller as the store knows them: a keyed hash, never the address. */
export function storeKey(secret: string, key: string, caller: string): string {
  return `rl:${key}:${createHmac("sha256", secret).update(caller).digest("base64url").slice(0, 22)}`
}

/**
 * One more for `id` in the store's window: the count, and how many
 * milliseconds the window has left. A window starts with its first request
 * (SET … PX … NX), so its end is fixed whatever follows; a count that has
 * lost its expiry somehow is given it again, so no caller is shut out for
 * good.
 */
async function countShared(store: Store, id: string, windowMs: number): Promise<{ count: number; leftMs: number }> {
  const ask = (commands: (string | number)[][]) =>
    fetch(`${store.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${store.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands.map((command) => command.map(String))),
      cache: "no-store",
      signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
    })
  const res = await ask([
    ["SET", id, 0, "PX", windowMs, "NX"],
    ["INCR", id],
    ["PTTL", id],
  ])
  if (!res.ok) throw new Error(`the store answered ${res.status}`)
  const answers = (await res.json()) as { result?: unknown; error?: string }[]
  const count = Number(answers?.[1]?.result)
  const leftMs = Number(answers?.[2]?.result)
  if (!Number.isFinite(count)) throw new Error(answers?.[1]?.error ? `the store said: ${String(answers[1].error).slice(0, 120)}` : "the store's answer was not a count")
  if (leftMs === -1) void ask([["PEXPIRE", id, windowMs]]).catch(() => {})
  return { count, leftMs: leftMs > 0 ? leftMs : windowMs }
}

let warned = false
function warnOnce(error: unknown) {
  if (warned) return
  warned = true
  // the store's trouble, never the caller
  console.warn(`[rate-limit] the shared store could not be asked, so each instance counts alone: ${error instanceof Error ? error.message : "no answer"}`)
}

/** For tests: say the store's trouble again. */
export const forgetWarning = (): void => {
  warned = false
}

function refusal(leftMs: number): { ok: false; response: NextResponse } {
  const retryAfter = Math.max(1, Math.ceil(leftMs / 1000))
  return {
    ok: false,
    response: NextResponse.json(
      { error: "Too many requests. Try again shortly.", code: "busy" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    ),
  }
}

export async function rateLimit(
  request: NextRequest,
  { key, max, windowMs, shared = true }: { key: string; max: number; windowMs: number; shared?: boolean },
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const now = Date.now()
  const caller = clientId(request)
  const here = countHere(`${key}:${caller}`, now, windowMs)
  if (here.count > max) return refusal(here.resetAt - now)

  const store = shared ? sharedStore() : null
  if (!store) return { ok: true }
  try {
    const { count, leftMs } = await countShared(store, storeKey(store.secret, key, caller), windowMs)
    // this instance's window now ends where the store's does, and counts
    // at least what every instance has, so it refuses no sooner or longer
    here.count = Math.max(here.count, count)
    here.resetAt = now + leftMs
    return count > max ? refusal(leftMs) : { ok: true }
  } catch (error) {
    warnOnce(error)
    return { ok: true }
  }
}
