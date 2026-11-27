/**
 * The site's own map, in one place. The header, the footer, the phone menu,
 * the sitemap, /llms.txt, the copy dump and the audits all read from here,
 * so a page cannot be in the navigation and missing from the sitemap. Adding
 * a designed page means adding a line here (tests/nav.test.mjs fails until
 * it is), an entry in lib/page-meta.ts and a `pageLd()` on the page.
 *
 * Pages, posts and products written in Notion are not listed here: they
 * come from the database (lib/content/select.ts) and join the sitemap and
 * the footer on their own.
 *
 * Imports nothing but lib/inline-text.ts (which imports nothing of its own
 * but lib/inline-links.ts), so the tests and the scripts load it as it is.
 */
import { inlineWords } from "./inline-text"

export type NavItem = {
  name: string
  href: string
  /** sitemap weighting: 1 is the homepage, 0.3 is housekeeping */
  priority?: number
}

/** The header's links on the left of the mark, as one group. A fifth link
 *  means deciding which of these four it replaces. */
export const MAIN_NAV: NavItem[] = [
  { name: "Features", href: "/features", priority: 0.9 },
  { name: "Pricing", href: "/pricing", priority: 0.9 },
  { name: "Shop", href: "/shop", priority: 0.8 },
  { name: "About", href: "/about", priority: 0.7 },
]

/** The rest of the designed pages, in the footer and the phone menu. */
export const MORE_NAV: NavItem[] = [
  { name: "Team", href: "/team", priority: 0.6 },
  { name: "Blog", href: "/blog", priority: 0.8 },
  { name: "Changelog", href: "/changelog", priority: 0.5 },
  { name: "Contact", href: "/contact", priority: 0.5 },
  { name: "Questions", href: "/questions", priority: 0.7 },
  { name: "Resources", href: "/resources", priority: 0.6 },
  { name: "Security", href: "/security", priority: 0.5 },
  { name: "Privacy", href: "/privacy", priority: 0.3 },
]

/** Designed pages that stand under another and are reached from it, so
 *  they are in no menu: the template's full list of ingredients, a resource. */
export const SUB_PAGES: NavItem[] = [{ name: "Ingredients", href: "/resources/ingredients", priority: 0.5 }]

/** Every designed page a search engine should have, homepage first. */
export const INDEXED_PAGES: NavItem[] = [{ name: "Home", href: "/", priority: 1 }, ...MAIN_NAV, ...MORE_NAV, ...SUB_PAGES]

/** The header's links on the right of the mark, before the cart, the
 *  look's switch and the button, as Notion keeps a pair of its own there: so
 *  the row weighs about the same on either side of the mark. Taken from
 *  MORE_NAV, so each page is listed once. */
export const SIDE_NAV: NavItem[] = ["/blog", "/resources"].map((href) => {
  const found = MORE_NAV.find((item) => item.href === href)
  if (!found) throw new Error(`lib/nav.ts: no entry for ${href}`)
  return found
})

/** Pages that exist but carry noindex of their own: the double opt-in
 *  landing, and the cart (one reader's, and nothing to search for). */
export const UNINDEXED_PAGES: string[] = ["/subscribed", "/cart"]

/** One entry by URL. By href rather than by index: a wrong href throws, where
 *  an index survives a reorder and quietly picks the wrong page. */
export function navItem(href: string): NavItem {
  const found = INDEXED_PAGES.find((item) => item.href === href)
  if (!found) throw new Error(`lib/nav.ts: no entry for ${href}`)
  return found
}

/** A page's Site Copy row in the navigation: `nav.features` for /features. */
export const navKey = (href: string) => `nav.${href === "/" ? "home" : href.slice(1)}`

/**
 * A page's name as the navigation prints it: the published `nav.<page>` row,
 * or the name above. For the places that need it as words (a breadcrumb in
 * structured data); a row published blank falls back, as a name must.
 */
export function navName(copy: Readonly<Record<string, string>>, href: string): string {
  return inlineWords(copy[navKey(href)] ?? "").trim() || navItem(href).name
}

export type NavColumn = { key: string; heading: string; items: NavItem[] }

/** The footer's columns. Their headings are Notion slots (`footer.col.<key>`). */
export const FOOTER_COLUMNS: NavColumn[] = [
  { key: "product", heading: "Product", items: [navItem("/features"), navItem("/pricing"), navItem("/shop"), navItem("/changelog")] },
  { key: "company", heading: "Company", items: [navItem("/about"), navItem("/team"), navItem("/blog"), navItem("/contact")] },
  { key: "help", heading: "Help", items: [navItem("/questions"), navItem("/resources"), navItem("/security"), navItem("/privacy")] },
]

/**
 * Links that go nowhere on purpose, so a reader meets the 404, which is drawn
 * with as much care as any page (app/not-found.tsx): "see the 404", and the
 * small print there is none of. They carry rel="nofollow", so a search
 * engine does not count them as broken, and the link check in the tests
 * (tests/dom/support/checks.ts) knows them.
 */
export const NOT_FOUND_LINKS = { notFound: "/404", smallPrint: "/small-print" } as const
