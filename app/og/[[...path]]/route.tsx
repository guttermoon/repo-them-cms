import type { NextRequest } from "next/server"

import { ogCard } from "@/lib/og-card"
import { drawnOnce } from "@/lib/og-once"
import { ogWords } from "@/lib/og-words"
import { rateLimit } from "@/lib/rate-limit"

/**
 * `/og/<path>`: the share card for the page at <path>, drawn in the label
 * style with the page's own words (lib/og-words.ts, lib/og-card.tsx). Every
 * page's metadata points here (lib/seo.ts), so a page written in Notion gets
 * a card the moment it is published. A post with a cover uses the cover
 * instead.
 *
 * A page's card is kept by the CDN for a day (its Cache-Control), so the
 * server draws it about once a day. Anybody can ask for any address, so a
 * caller is limited like every other route, and an address that is no page
 * gets the one card all such addresses share, drawn once (lib/og-once.ts),
 * never a drawing of its own.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const missingCard = drawnOnce(ogCard)

/** A segment as its words; one that is not valid percent-encoding, as it came. */
function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const limit = await rateLimit(request, { key: "og", max: 60, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const path = `/${((await params).path ?? []).map(decoded).join("/")}`
  const words = await ogWords(path)
  return words.missing ? missingCard(words) : ogCard(words)
}
