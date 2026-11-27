/**
 * Whether a link leaves the site, and the attributes it then takes.
 *
 * A link to another site opens in a new tab, so the reader keeps their
 * place here; `noopener` so the page it opens cannot reach back into this
 * one, and `noreferrer` so the other site is not told which page the
 * reader came from. A path, an anchor, a mail or phone link, and this
 * site's own address stay in the tab. Every link that draws an address it
 * was given uses this, and `checkOutboundLinks` (tests/dom/support/checks.ts)
 * holds every page to it.
 */
import { SITE_URL } from "./site"

/** The attributes a link to another site takes. */
export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const

/** Whether `href` goes to another site: http(s), or protocol-relative, on a
 *  host other than this site's. */
export function leavesSite(href: string): boolean {
  if (!/^(https?:)?\/\//i.test(href.trim())) return false
  try {
    return new URL(href.trim(), SITE_URL).host !== new URL(SITE_URL).host
  } catch {
    return false
  }
}

/** Spread onto an `<a>`: a new tab for another site, nothing otherwise. */
export const outsideLink = (href: string): Partial<typeof NEW_TAB> => (leavesSite(href) ? NEW_TAB : {})
