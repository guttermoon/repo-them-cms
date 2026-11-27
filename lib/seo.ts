import type { Metadata } from "next"

import { notionConfigured } from "./config"
import { inlineWords } from "./inline-text"
import { siteName } from "./slots"
import { PAGE_META, pageWords, type IndexedPath } from "./page-meta"
import { pagePicture, shareImage, type SiteWords } from "./share"
import { SITE_LOCALE, SITE_NAME, SITE_URL } from "./site"

export { SITE_DESCRIPTION, SITE_NAME } from "./site"

/** A page's share card: drawn on demand by app/og/[[...path]]/route.tsx in
 *  the label style, with the page's own title on it. */
export function ogImagePath(path: string): string {
  return path === "/" ? "/og" : `/og${path}`
}

export const OG_SIZE = { width: 1200, height: 630 } as const

/**
 * What a page that is offered to search says about how it may be shown: its
 * picture at full width (Google Discover shows a large picture only for a
 * site that allows one, and a small one is passed over), and its snippet and
 * a video's preview at whatever length a result needs. Google, Bing and the
 * assistants that read through them all honour these.
 */
export const INDEXABLE_ROBOTS = {
  index: true,
  follow: true,
  "max-image-preview": "large",
  "max-snippet": -1,
  "max-video-preview": -1,
} as const

/** The blog's feed, linked from every page so a feed reader finds it. */
export const FEED_LINK = { "application/rss+xml": [{ url: "/blog/rss.xml", title: SITE_NAME }] }

type PageMetaInput = {
  /** Root-relative path, e.g. "/features". The canonical and og:url use it. */
  path: string
  /** Bare page title: " | " and the site's name are added here. On the
   *  homepage the name leads instead. */
  title?: string
  /** The site's name as the copy has it (`siteName` in lib/slots.ts) */
  site: string
  description: string
  type?: "website" | "article"
  /** Overrides the drawn share card, e.g. with a post's cover. */
  image?: { url: string; alt: string }
  keywords?: string[]
  /** articles: when it was published and last changed, and who wrote it */
  publishedTime?: string
  modifiedTime?: string
  authors?: string[]
  /** keep it out of search (the double opt-in landing, the 404) */
  noindex?: boolean
  /** a page written in Notion: it names its Markdown copy, at its address
   *  with .md added (app/markdown), for whoever reads without drawing */
  markdown?: boolean
}

/** A page's Markdown copy: its address with .md added. */
export const markdownPath = (path: string): string => `${path}.md`

/**
 * Every page's metadata, built from one input so the title, canonical, Open
 * Graph and X cards agree. Every page calls this (through `pageMetaFor()`
 * for a designed page) rather than leaning on the root layout: Next merges
 * metadata per top-level key, so a page that declared no `openGraph` would
 * inherit the layout's whole block, its URL included.
 */
export function pageMeta({
  path,
  title,
  description,
  type = "website",
  image,
  keywords,
  publishedTime,
  modifiedTime,
  authors,
  noindex = false,
  markdown = false,
  site,
}: PageMetaInput): Metadata {
  // a description a row gave keeps its words only: no link, no formatting
  // (lib/inline-text.ts), in a search result as in a share card
  description = inlineWords(description).replace(/\s*\n\s*/g, " ").trim()
  // the starter content (no Notion connected) is the same on every copy of
  // the template: it is never offered to search
  const hidden = noindex || !notionConfigured()
  const home = path === "/"
  const fullTitle = !title ? site : home ? `${site} | ${title}` : `${title} | ${site}`
  // og:title carries the bare title: the name is already in og:site_name
  const ogTitle = !title ? site : home ? `${site}: ${title}` : title
  const images = [image ?? { url: ogImagePath(path), alt: ogTitle, ...OG_SIZE }]

  return {
    title: fullTitle,
    description,
    ...(keywords?.length ? { keywords } : {}),
    ...(authors?.length ? { authors: authors.map((name) => ({ name })) } : {}),
    // with the feed's link: a page's `alternates` replaces the layout's whole
    alternates: { canonical: path, types: markdown ? { ...FEED_LINK, "text/markdown": markdownPath(path) } : FEED_LINK },
    robots: hidden ? { index: false, follow: true } : { ...INDEXABLE_ROBOTS },
    openGraph: {
      title: ogTitle,
      description,
      type,
      locale: SITE_LOCALE,
      url: path,
      siteName: site,
      images,
      ...(type === "article" && publishedTime ? { publishedTime } : {}),
      ...(type === "article" && modifiedTime ? { modifiedTime } : {}),
      ...(type === "article" && authors?.length ? { authors } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: images.map((i) => ({ url: i.url, alt: i.alt })),
    },
  }
}

/**
 * A designed page's metadata: its entry in lib/page-meta.ts, or the words
 * the site's owner gave it in Notion (`meta.<page>.title`, `.description`),
 * and the picture they gave it (`meta.<page>.image`, else the site's
 * `meta.site.image`, lib/share.ts). Pages call it from `generateMetadata`,
 * with the data they already read.
 */
export function pageMetaFor(path: IndexedPath, data: SiteWords, extra?: Partial<PageMetaInput>): Metadata {
  const { title, description, keywords } = pageWords(path, data.copy)
  const image = shareImage(data, pagePicture(data, path))
  return pageMeta({ path, title, description, keywords, site: siteName(data.copy), ...(image ? { image } : {}), ...extra })
}

/**
 * The tags Google Search Console and Bing Webmaster Tools look for, from
 * GOOGLE_SITE_VERIFICATION and BING_SITE_VERIFICATION (read at build time).
 * Only a token of the shape the tools issue is printed, so a whole `<meta …>`
 * pasted in by mistake prints nothing rather than markup.
 */
export function siteVerification(env: Record<string, string | undefined> = process.env): Metadata["verification"] {
  const token = (value: string | undefined) => {
    const v = value?.trim()
    return v && /^[A-Za-z0-9_-]{8,128}$/.test(v) ? v : undefined
  }
  const google = token(env.GOOGLE_SITE_VERIFICATION)
  const bing = token(env.BING_SITE_VERIFICATION)
  if (!google && !bing) return undefined
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  }
}

/** A URL made absolute for JSON-LD and feeds, which do not resolve paths
 *  against metadataBase. Absolute URLs pass through untouched. */
export function absoluteUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`
}

export { PAGE_META }
