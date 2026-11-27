/**
 * Links from Notion's text to this site's own pages.
 *
 * Notion's API takes only a full address for a link, and Notion keeps a link
 * written as a path (/pricing) as one on its own app
 * (https://app.notion.com/pricing). So a link to one of this site's pages
 * reaches the site in one of three forms: the path itself, the path on
 * Notion's app, or the site's own full address. `sitePathFromHref` turns the
 * last two back into the path, which keeps a reader on the deployment they
 * are reading (a preview stays a preview) and in the same tab.
 *
 * No imports, so the build scripts and `npm test` can load it as it is.
 */

/** Where Notion keeps a path written as a link. */
export const NOTION_APP = "https://app.notion.com"

/**
 * The path of a link to this site, or undefined for a link elsewhere. Read
 * after a link to a Notion page has been recognised (a Notion page's address
 * carries its ID; a path kept on Notion's app does not), so a link here is
 * never one to a Notion page.
 */
export function sitePathFromHref(href: string, siteUrl: string): string | undefined {
  let url: URL
  let site: URL
  try {
    url = new URL(href.trim())
    site = new URL(siteUrl)
  } catch {
    return undefined
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined
  const bare = (host: string) => host.toLowerCase().replace(/^www\./, "")
  const own = bare(url.host) === bare(site.host)
  const keptByNotion = url.origin === NOTION_APP
  return own || keptByNotion ? `${url.pathname}${url.search}${url.hash}` : undefined
}

/**
 * A link to a path, as Notion's API will take it when the setup writes the
 * starter pages: on Notion's app, where Notion itself would keep it. Any
 * other address is sent as written.
 */
export function sendableHref(href: string): string {
  return /^\/(?!\/)/.test(href) ? `${NOTION_APP}${href}` : href
}

/** A Notion page ID out of a link Notion wrote: "/1f16…85", a notion.so
 *  address, with or without dashes. */
export function notionPageIdFromHref(href: string): string | undefined {
  const m =
    href.match(/^\/([0-9a-f]{32})(?:[?#].*)?$/i) ??
    href.match(/^https?:\/\/(?:www\.)?(?:app\.)?notion\.(?:so|site|com)\/(?:.*?[-/])?([0-9a-f]{32})(?:[?#].*)?$/i)
  return m?.[1]?.toLowerCase()
}
