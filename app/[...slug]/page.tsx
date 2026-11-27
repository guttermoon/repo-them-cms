import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { blockLabels, makeContext } from "@/components/notion/context"
import { EntryPage } from "@/components/notion/entry-page"
import { LandingPage } from "@/components/notion/landing"
import { JsonLd } from "@/components/system/json-ld"
import { fillIn, plainText, siteName } from "@/components/system/notion-text"
import { getBlocks, prerenderable } from "@/lib/content/blocks"
import { mediaUrl } from "@/lib/content/media"
import { livePages, urlForNotionId } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { blocksExcerpt } from "@/lib/notion/blocks"
import type { MediaRef } from "@/lib/notion/rows"
import { pageMeta } from "@/lib/seo"
import { shareImage } from "@/lib/share"
import { notionPageLd } from "@/lib/structured-data"
import { inlineWords } from "@/lib/inline-text"

/**
 * Any page written in Notion: a row with Kind set to Page, at /<its slug>.
 * The site's own routes are matched first, and a Notion page whose address
 * would collide with one is skipped (lib/content/select.ts). Layout
 * "Landing" sets the page as a marketing page (components/notion/landing.tsx);
 * otherwise it is set as Notion sets a page.
 */
export const revalidate = 60

/** The picture a page's link shows: its cover, else the site's (lib/share.ts). */
const pagePicture = (data: Awaited<ReturnType<typeof getSiteData>>, page: { cover?: MediaRef; title: string }) =>
  shareImage(data, page.cover ? { url: mediaUrl(page.cover, "cover"), alt: page.title } : undefined)
export const dynamicParams = true

export async function generateStaticParams() {
  return prerenderable(livePages(await getSiteData())).map((page) => ({ slug: page.slug.split("/") }))
}

async function findPage(slug: string[]) {
  const path = slug.map((s) => decodeURIComponent(s)).join("/").toLowerCase()
  return livePages(await getSiteData()).find((p) => p.slug === path)
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await findPage(slug)
  // the 404's own metadata (app/not-found.tsx)
  if (!page) notFound()
  const data = await getSiteData()
  const { copy } = data
  // read first, so the slot is there to find (npm run copy) whichever is used
  const fallback = fillIn(plainText(copy, "meta.page.description", "{title}, a page on this site."), { title: page.title })
  const image = pagePicture(data, page)
  return pageMeta({
    site: siteName(copy),
    path: `/${page.slug}`,
    title: page.title,
    markdown: true,
    description:
      inlineWords(page.description) || blocksExcerpt(await getBlocks(page)) || fallback,
    ...(image ? { image } : {}),
  })
}

export default async function NotionPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const data = await getSiteData()
  const page = await findPage(slug)
  if (!page) notFound()
  const blocks = await getBlocks(page)
  const content = data.copy
  return (
    <>
      <JsonLd data={notionPageLd(page, data.copy, livePages(data), pagePicture(data, page))} />
      {page.layout === "landing" ? (
        <LandingPage
          entry={page}
          blocks={blocks}
          ctx={makeContext(blocks, (id) => urlForNotionId(data, id), blockLabels(data.copy))}
          labels={{
            yes: plainText(content, "landing.table.yes", "Included"),
            no: plainText(content, "landing.table.no", "Not included"),
            feature: plainText(content, "landing.table.feature", "Feature"),
            region: plainText(content, "landing.table.region", "Comparison table (scrolls sideways on a small screen)"),
          }}
        />
      ) : (
        <EntryPage entry={page} blocks={blocks} data={data} />
      )}
    </>
  )
}
