import type { NextRequest } from "next/server"

import { blockLabels } from "@/components/notion/context"
import { productView } from "@/components/commerce/product"
import { commerce, shopIsLive } from "@/lib/commerce/config"
import { notionConfigured } from "@/lib/config"
import { getBlocks } from "@/lib/content/blocks"
import { canonicalLink, entryMarkdown, markdownEntry } from "@/lib/content/markdown"
import { mediaUrl } from "@/lib/content/media"
import { urlFor, urlForNotionId } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { rateLimit } from "@/lib/rate-limit"
import { absoluteUrl } from "@/lib/seo"
import { siteName } from "@/lib/slots"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * `<address>.md`: a page, post or product written in Notion as Markdown
 * (lib/content/markdown.ts), for whoever reads a page without drawing it.
 * next.config.mjs sends every address that ends in .md here, without it.
 *
 * Read as the page is read: the content from the one cached query, the body
 * from the cache its page uses (lib/content/blocks.ts), so a copy costs
 * Notion nothing its page has not already cost.
 *
 * It names its page as the canonical address in a `Link` header, so a
 * search engine files the words under the page and never lists the copy
 * beside it; with no Notion connected it is kept out of search, like every
 * page of the starter content.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const limit = await rateLimit(request, { key: "markdown", max: 120, windowMs: 60_000 })
  if (!limit.ok) return limit.response

  const data = await getSiteData()
  const entry = markdownEntry(data, (await params).path ?? [], shopIsLive(commerce()))
  if (!entry) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })

  const body = await getBlocks(entry)
  const images = entry.kind === "Product" ? productView(entry).images : entry.kind === "Post" && entry.cover ? [mediaUrl(entry.cover, "cover")] : []
  const text = entryMarkdown(
    entry,
    body,
    { absolute: absoluteUrl, pageUrl: (id) => urlForNotionId(data, id), media: mediaUrl, labels: blockLabels(data.copy) },
    { site: siteName(data.copy), images },
  )
  return new Response(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: canonicalLink(absoluteUrl(urlFor(entry) ?? "/")),
      // as long as its page: a minute, then refreshed behind the reader
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
      ...(notionConfigured() ? {} : { "X-Robots-Tag": "noindex" }),
    },
  })
}
