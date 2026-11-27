/**
 * What the routes that pass a request on to another host share (/ingest,
 * /ga, /media): which headers go through, where a stand-in upstream is
 * allowed, and how an analytics host's answer is handed back (`relay`).
 *
 * A proxy that copies every header hands the reader's cookies and the page
 * they came from to the other host, and hands the other host's cookies back
 * under this site's name. So each route names the headers it passes, in
 * each direction, and everything else stays where it was.
 *
 * Imports nothing, so `npm test` loads it (tests/proxy.test.mjs).
 */

/** Response headers worth handing back from an upstream. Not
 *  content-encoding or content-length: fetch has already decoded the body. */
export const PASS_RESPONSE = ["content-type", "cache-control", "etag", "last-modified"] as const

/**
 * A type a browser would open as a page or run as a script of its own, from
 * this site's address. PostHog's and Google's answers are scripts, JSON and
 * pictures; one of these instead is never handed on, whoever sent it.
 */
export const PAGE_TYPES = /^(text\/html|application\/(xhtml\+xml|xml)|text\/(xml|xsl)|image\/svg\+xml|multipart\/)/i

/** Whether an upstream's answer is one of PAGE_TYPES. */
export function pageLike(contentType: string | null): boolean {
  return PAGE_TYPES.test((contentType ?? "").trim())
}

/** The named headers of `from` that are set, added to `into`. */
export function pickHeaders(from: Headers, names: readonly string[], into: Headers = new Headers()): Headers {
  for (const name of names) {
    const value = from.get(name)
    if (value) into.set(name, value)
  }
  return into
}

/**
 * A stand-in upstream for an end-to-end test (POSTHOG_PROXY_UPSTREAM,
 * GA_PROXY_UPSTREAM), or undefined. Ignored in production, so a stray
 * setting can never divert the real thing.
 */
export function standIn(value: string | undefined, nodeEnv: string | undefined = process.env.NODE_ENV): string | undefined {
  return nodeEnv !== "production" ? value?.trim() || undefined : undefined
}

/** What a reader is told when the upstream cannot be reached, or answers
 *  with something that is never handed on. */
const unavailable = () => Response.json({ error: "Upstream unavailable" }, { status: 502 })

/**
 * The upstream's answer to `send()`, as this site hands it back (/ingest,
 * /ga): only the PASS_RESPONSE headers, and never a page (`pageLike`),
 * whose body is let go. An upstream that cannot be reached is a 502 at
 * once: the analytics libraries retry, and the page never waits on them. A
 * 204 or 304 carries no body, and Response refuses one.
 */
export async function relay(send: () => Promise<Response>): Promise<Response> {
  let upstream: Response
  try {
    upstream = await send()
  } catch {
    return unavailable()
  }
  // a page from elsewhere is never served under this site's name
  if (pageLike(upstream.headers.get("content-type"))) {
    await upstream.body?.cancel().catch(() => {})
    return unavailable()
  }
  const empty = upstream.status === 204 || upstream.status === 304
  return new Response(empty ? null : upstream.body, { status: upstream.status, headers: pickHeaders(upstream.headers, PASS_RESPONSE) })
}
