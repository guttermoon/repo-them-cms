import { ogCard } from "@/lib/og-card"
import { ogWords } from "@/lib/og-words"

/**
 * `/og/<path>`: the share card for the page at <path>, drawn in the label
 * style with the page's own words (lib/og-words.ts, lib/og-card.tsx). Every
 * page's metadata points here (lib/seo.ts), so a page written in Notion gets
 * a card the moment it is published. A post with a cover uses the cover
 * instead.
 */
export const runtime = "nodejs"
export const revalidate = 3600

/** A segment as its words; one that is not valid percent-encoding, as it came. */
function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const path = `/${((await params).path ?? []).map(decoded).join("/")}`
  return ogCard(await ogWords(path))
}
