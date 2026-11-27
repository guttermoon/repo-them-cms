import { type NextRequest, NextResponse } from "next/server"

import { GA_HOSTS, GA_MEASUREMENT_ID, gaBody, gaQuery, gaUpstreamFor } from "@/lib/google-analytics"
import { pickHeaders, relay, standIn } from "@/lib/proxy"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Google Analytics 4's way in, through our own server (lib/google-analytics.ts
 * says why, and what is changed on the way).
 *
 * Two jobs. Google's script: fetched from Google for our measurement ID and
 * handed back, so the browser loads it from this site. GA4's hits: passed on to
 * Google with the IP address shortened and the page addresses cleaned. What
 * does not go on: the reader's cookies, the page they came from (the header;
 * GA4's own `dr` parameter is cleaned), and their full IP address. Only those
 * paths, and only our ID's script, are forwarded (`gaUpstreamFor()`), so this
 * is not an open proxy.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Request headers Google uses. Everything else stays here. */
const PASS_REQUEST = ["content-type", "accept", "accept-language", "user-agent"]

/** Google, or a stand-in for testing end to end (lib/proxy.ts). */
function hosts() {
  const google = standIn(process.env.GA_PROXY_UPSTREAM)
  return google ? { script: google, collect: google } : GA_HOSTS
}

async function forward(request: NextRequest): Promise<Response> {
  const limit = await rateLimit(request, { key: "ga", max: 300, windowMs: 60_000, shared: false })
  if (!limit.ok) return limit.response

  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/ga\/?/, "").replace(/\/$/, "")
  const target = gaUpstreamFor(path, url.searchParams, GA_MEASUREMENT_ID, hosts())
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const collecting = path === "g/collect"
  const headers = pickHeaders(request.headers, PASS_REQUEST)
  const forwardedFor = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip")

  return relay(async () =>
    fetch(`${target}${collecting ? gaQuery(url.search, forwardedFor, url.hostname) : url.search}`, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : collecting
            ? gaBody(await request.text(), url.hostname)
            : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    }),
  )
}

export const GET = forward
export const POST = forward
