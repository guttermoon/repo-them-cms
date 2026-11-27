/**
 * Where a link in Notion's text goes on this site, for the page as it is
 * drawn (components/notion/rich-text.tsx) and as Markdown
 * (lib/notion/markdown.ts), so both send a reader to the same place.
 *
 * A link to another Notion page becomes that page's address here when it is
 * live, and no link at all when it is not: a link into somebody's private
 * workspace helps no reader. A link to one of this site's own pages, as its
 * full address or as a path Notion kept on its app, becomes the path
 * (lib/notion/links.ts). Anything else must pass `safeHref` (the web, mail,
 * a phone, this site).
 */
import { safeHref } from "../inline-links"
import { SITE_URL } from "../site"
import { notionPageIdFromHref, sitePathFromHref } from "./links"

/** `pageUrl` gives the address of a live page, post or product by its
 *  Notion ID (lib/content/select.ts, `urlForNotionId`). */
export function notionHref(href: string | null | undefined, pageUrl: (notionId: string) => string | undefined): string | undefined {
  if (!href) return undefined
  const notionId = notionPageIdFromHref(href.trim())
  if (notionId) return pageUrl(notionId)
  return safeHref(sitePathFromHref(href, SITE_URL) ?? href)
}
