import { type NextRequest, NextResponse } from "next/server"

import { posthogUpstreamFor, shortenIp, POSTHOG_ASSETS, POSTHOG_INGEST } from "@/lib/analytics"
import { pickHeaders, relay, standIn } from "@/lib/proxy"
import { rateLimit } from "@/lib/rate-limit"

/**
 * PostHog's way in, through our own server (lib/analytics.ts, "What keeps
 * names out").
 *
 * The browser sends every event, recording and script request to /ingest on
 * this site; this handler makes a fresh request to PostHog's EU cloud with
 * only what PostHog needs, and returns PostHog's answer. What does not go on:
 * the reader's cookies, the page they came from, and their IP address, which
 * goes on SHORTENED (`shortenIp()`), in the x-forwarded-for PostHog reads for
 * its rough location. A rewrite in next.config would have been simpler and
 * would have passed the platform's x-forwarded-for, the full address,
 * straight through.
 *
 * Only the paths PostHog's library calls are forwarded (`posthogUpstreamFor()`), so
 * this is not an open proxy, and nothing is sent with any credentials: the
 * project key in the events is public and can only write. PostHog's
 * endpoints end in a slash (/e/, /s/), which next.config keeps for this path
 * alone (`skipTrailingSlashRedirect`, and the redirect that does the job for
 * every other page).
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Request headers PostHog uses. Everything else stays here. The support
 *  chat sends its project's public token as `x-conversations-token`, which
 *  PostHog gives every browser in the project's settings and which names no
 *  reader; without it PostHog refuses every message ("Failed to send
 *  message"). tests/analytics.test.mjs holds this list to the headers the
 *  installed posthog-js sends. */
const PASS_REQUEST = ["content-type", "content-encoding", "accept", "accept-language", "user-agent", "x-conversations-token"]

/** PostHog, or a stand-in for testing end to end (lib/proxy.ts). */
function hosts() {
  const posthog = standIn(process.env.POSTHOG_PROXY_UPSTREAM)
  return posthog ? { ingest: posthog, assets: posthog } : { ingest: POSTHOG_INGEST, assets: POSTHOG_ASSETS }
}

async function forward(request: NextRequest): Promise<Response> {
  // generous: a recording sends a batch every few seconds; this bounds a loop
  const limit = await rateLimit(request, { key: "ingest", max: 600, windowMs: 60_000, shared: false })
  if (!limit.ok) return limit.response

  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/ingest\/?/, "")
  const target = posthogUpstreamFor(path, hosts())
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const headers = pickHeaders(request.headers, PASS_REQUEST)
  const ip = shortenIp(request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip"))
  if (ip) headers.set("x-forwarded-for", ip)

  return relay(async () =>
    fetch(`${target}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    }),
  )
}

export const GET = forward
export const POST = forward
