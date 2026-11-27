import { NextResponse, type NextRequest } from "next/server"

import { redirects } from "@/lib/content/select"
import { safeDestination } from "@/lib/content/redirects"
import { getSiteData } from "@/lib/content/store"
import { normaliseShortSlug } from "@/lib/notion/rows"
import { rateLimit } from "@/lib/rate-limit"

// The Notion client needs Node, not the edge runtime.
export const runtime = "nodejs"
// Never prerendered: today's answer can differ from yesterday's without a deploy.
export const dynamic = "force-dynamic"

/**
 * `/go/<slug>`: the address that goes on printed things.
 *
 * A QR code is permanent once it is printed. So it never carries the real
 * destination: it carries this, and a Redirect row in Notion (Title = the
 * slug, Link = where to) decides where it goes. Change the row and every
 * code already printed follows within a minute.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const limit = await rateLimit(req, { key: "go", max: 60, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  // getSiteData never throws: it falls back to the last good answer
  const table = redirects(await getSiteData())
  const destination = safeDestination(table[normaliseShortSlug((await params).slug)])

  // An unknown or retired slug lands on the homepage, not a 404: somebody is
  // standing in front of a poster with a phone out, and a dead end is the
  // one outcome worth avoiding. A path is resolved against this site.
  const target = destination && /^(mailto|tel):/i.test(destination) ? destination : new URL(destination ?? "/", req.nextUrl.origin).toString()

  // 307, never 301/308: a permanent redirect is cached by browsers more or
  // less forever, which for a link meant to change later strands the people
  // who scanned it first. no-store keeps the CDN out of it too.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: target, "Cache-Control": "no-store" },
  })
}
