/**
 * The site's menus, and the links each shows (docs/notion.md, "Menus").
 *
 * Five menus: the header's left of the mark (`header`), its right
 * (`header-side`), and the footer's three columns (`footer-product`,
 * `footer-company`, `footer-help`). Each has the links it was designed with
 * (lib/nav.ts); a Notion page whose Order is set joins the footer's company
 * column after them. A Menu row in Notion (Kind: Menu) says otherwise for
 * one link: Title names the page (`features`, `/pricing`, `home`, or a
 * Notion page's address), Slug the menu (empty: every menu the page was
 * designed for), Order its place (smallest first), and Published whether it
 * shows. A link with no row stays where it was designed, so a database with
 * no Menu rows has the menus as designed, and one row changes one link.
 *
 * A row with a Link goes to that address instead of a page, and its Title is
 * the link's words: a way out of the site (a demo's issue forms, a shop on
 * another platform) that a copy adds from Notion, never one in the code. It
 * names its menu in Slug. The address goes through `safeHref`, as every
 * address a person typed does, and one on this site is drawn as its path.
 *
 * The header holds as many links as it was designed for (four, then two),
 * so the row weighs the same either side of the mark; past that, the first
 * by Order show and notion:check names the rest. The phone's menu is every
 * menu's links in turn, each once, so a page taken off every menu leaves
 * the phone's too.
 *
 * Pure: the store hands in the rows (lib/notion/rows.ts reads them ticked or
 * not, as it does Section rows), and the layout draws the links.
 */
import { safeHref } from "./inline-links"
import { FOOTER_COLUMNS, INDEXED_PAGES, MAIN_NAV, navItem, navKey, SIDE_NAV } from "./nav"
import { sitePathFromHref } from "./notion/links"
import { SITE_URL } from "./site"

/** The menus a Menu row's Slug can name. */
export const MENU_NAMES = ["header", "header-side", "footer-product", "footer-company", "footer-help"] as const
export type MenuName = (typeof MENU_NAMES)[number]

type MenuDefault = {
  /** the designed links, in order */
  links: string[]
  /** the most it shows, where its room is fixed */
  max?: number
  /** what it is, for the docs and the Menu rows' guide */
  about: string
}

const column = (key: string) => (FOOTER_COLUMNS.find((c) => c.key === key)?.items ?? []).map((i) => i.href)

export const MENUS: Record<MenuName, MenuDefault> = {
  header: { links: MAIN_NAV.map((i) => i.href), max: MAIN_NAV.length, about: "The header, left of the mark" },
  "header-side": { links: SIDE_NAV.map((i) => i.href), max: SIDE_NAV.length, about: "The header, right of the mark, before the cart" },
  "footer-product": { links: column("product"), about: "The footer's first column (footer.col.product)" },
  "footer-company": { links: column("company"), about: "The footer's second column (footer.col.company), then the Notion pages with an Order" },
  "footer-help": { links: column("help"), about: "The footer's third column (footer.col.help), then Cookie settings" },
}

/** A Menu row as the store keeps it, ticked or not. */
export type MenuRow = {
  id: string
  /** the row's Title: the page it places, or, with a Link, the link's words */
  page: string
  /** the row's Link, as written: an address to go to instead of a page */
  link?: string
  /** the row's Slug, as written: the menu it is in; empty, every menu the page was designed for */
  menu?: string
  /** the row's Order: its place in that menu */
  order?: number
  /** ticked: shown */
  on: boolean
  created?: string
}

/** A Notion page a menu may show: its address, its title, and its Order
 *  (which puts it in the footer's company column). */
export type MenuPage = { href: string; title: string; order?: number }

/** One link as a menu draws it: where it goes, its words, and the Site Copy
 *  slot its words come from (a designed page's `nav.<page>`); a Notion page's
 *  words are its title. */
export type MenuLink = { href: string; name: string; key?: string }

export type FooterColumn = { key: string; heading: string; links: MenuLink[] }

export type SiteMenus = { header: MenuLink[]; side: MenuLink[]; phone: MenuLink[]; footer: FooterColumn[] }

/** The menu a row's Slug names, in any case and with spaces for dashes;
 *  empty or unknown is none. */
export function menuName(slug: string | undefined): MenuName | undefined {
  const written = (slug ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-")
  return (MENU_NAMES as readonly string[]).includes(written) ? (written as MenuName) : undefined
}

/** The address a row's Title names: `features`, `/features`, `Features/`
 *  are /features, and `home` or `/` the homepage. */
export function menuHref(title: string): string {
  const path = title.trim().toLowerCase().replace(/^\/+|\/+$/g, "")
  return !path || path === "home" ? "/" : `/${path}`
}

const DESIGNED_PAGES = new Set(INDEXED_PAGES.map((i) => i.href))

/** Where a row with a Link goes: a path for this site's own address, the
 *  address for another, nothing for one a browser must not follow. */
export function menuLinkHref(link: string): string | undefined {
  return safeHref(sitePathFromHref(link, SITE_URL) ?? link)
}

/** Where a row's link goes: its Link's address, else the page its Title
 *  names. */
function rowHref(row: MenuRow): string | undefined {
  return row.link?.trim() ? menuLinkHref(row.link) : menuHref(row.page)
}

/** Pages pages-with-an-Order are placed after in the footer's company column. */
const PAGE_ORDER_BASE = 1000

/**
 * The addresses a menu shows, in order: its designed links and, for the
 * company column, the Notion pages with an Order, then as its rows say. A
 * row names a page this site has (a designed page or a Notion page) or is
 * passed over; a page is in a menu once, at its first place.
 */
export function menuLinks(rows: readonly MenuRow[] | undefined, menu: MenuName, pages: readonly MenuPage[] = []): string[] {
  const links = orderedLinks(rows, menu, pages)
  const max = MENUS[menu].max
  return max === undefined ? links : links.slice(0, max)
}

/** A menu's addresses in order, before its room cuts them. */
function orderedLinks(rows: readonly MenuRow[] | undefined, menu: MenuName, pages: readonly MenuPage[]): string[] {
  const known = new Set([...DESIGNED_PAGES, ...pages.map((p) => p.href)])
  const designed = new Map<string, number>(MENUS[menu].links.map((href, i) => [href, (i + 1) * 10]))
  if (menu === "footer-company") {
    for (const page of pages) if (page.order !== undefined && !designed.has(page.href)) designed.set(page.href, PAGE_ORDER_BASE + page.order)
  }
  const mine = (rows ?? []).filter((row) => {
    const named = menuName(row.menu)
    // a row with a Link names its menu; a row naming no menu (or one there is
    // not) is for every menu the page was designed for
    if (row.link?.trim()) return named === menu
    return named ? named === menu : designed.has(menuHref(row.page)) && !row.menu?.trim()
  })
  const ruled = new Set(mine.map(rowHref).filter((href): href is string => Boolean(href)))
  const placed: { href: string; order: number; designed: number; age: string }[] = []
  for (const [href, order] of designed) if (!ruled.has(href)) placed.push({ href, order, designed: order, age: "" })
  for (const row of mine) {
    const href = rowHref(row)
    // a Link is its own page; a Title must name one this site has
    if (!row.on || !href || (!row.link?.trim() && !known.has(href)) || (row.link?.trim() && !row.page.trim())) continue
    const own = designed.get(href)
    placed.push({ href, order: row.order ?? own ?? Number.MAX_SAFE_INTEGER, designed: own ?? Number.MAX_SAFE_INTEGER, age: `${row.created ?? ""}${row.id}` })
  }
  placed.sort((a, b) => a.order - b.order || a.designed - b.designed || a.age.localeCompare(b.age))
  const seen = new Set<string>()
  return placed.filter((p) => (seen.has(p.href) ? false : (seen.add(p.href), true))).map((p) => p.href)
}

/** A link's words: a designed page's `nav.<page>` slot (with its built-in
 *  name), a Notion page's title. */
export function menuLink(href: string, pages: readonly MenuPage[] = []): MenuLink {
  if (DESIGNED_PAGES.has(href)) return { href, name: navItem(href).name, key: navKey(href) }
  return { href, name: pages.find((p) => p.href === href)?.title ?? href }
}

/** The words of the links a menu's rows give by address: its Title, by the
 *  address it goes to (the first row by Order, as the menu places it). */
function rowWords(rows: readonly MenuRow[] | undefined, menu: MenuName): Map<string, string> {
  const words = new Map<string, string>()
  const linked = (rows ?? []).filter((row) => row.on && row.link?.trim() && row.page.trim() && menuName(row.menu) === menu)
  for (const row of [...linked].sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))) {
    const href = menuLinkHref(row.link as string)
    if (href && !words.has(href)) words.set(href, row.page.trim())
  }
  return words
}

/** Every menu as the site draws it. With no rows and no pages, the menus as
 *  designed. */
export function siteMenus(rows?: readonly MenuRow[], pages: readonly MenuPage[] = []): SiteMenus {
  const links = (menu: MenuName) => {
    const words = rowWords(rows, menu)
    return menuLinks(rows, menu, pages).map((href) => (words.has(href) ? { href, name: words.get(href) as string } : menuLink(href, pages)))
  }
  const header = links("header")
  const side = links("header-side")
  const footer = FOOTER_COLUMNS.map((c) => ({ key: c.key, heading: c.heading, links: links(`footer-${c.key}` as MenuName) }))
  const seen = new Set<string>()
  const phone = [...header, ...side, ...footer.flatMap((c) => c.links)].filter((l) => (seen.has(l.href) ? false : (seen.add(l.href), true)))
  return { header, side, phone, footer }
}

/** What notion:check says about a Menu row the site can't place as written,
 *  or nothing. */
export function menuProblem(row: MenuRow, pages: readonly MenuPage[] = []): string | undefined {
  if (row.link?.trim()) {
    if (!menuLinkHref(row.link)) return `"${row.link}" is not an address a link can go to: a Menu row's Link is a web address, an email or a path on this site`
    if (!row.page.trim()) return "a Menu row with a Link has no Title: its Title is the link's words"
    if (!menuName(row.menu)) return `a Menu row with a Link names its menu in Slug (${MENU_NAMES.join(", ")}): "${row.page}" is placed nowhere`
    return undefined
  }
  const href = menuHref(row.page)
  const known = DESIGNED_PAGES.has(href) || pages.some((p) => p.href === href)
  if (!known) return `"${row.page}" is not a page on this site: a Menu row's Title names a designed page (features, pricing, blog…) or a published Notion page's address`
  if (row.menu?.trim() && !menuName(row.menu)) return `"${row.menu}" is not a menu (${MENU_NAMES.join(", ")}): the row is ignored`
  if (!row.menu?.trim() && !Object.values(MENUS).some((m) => m.links.includes(href))) {
    return `${href} is in no menu as designed, so a row with no Slug places it nowhere: name a menu in Slug`
  }
  return undefined
}

/** What notion:check says about a menu its rows have filled past its room:
 *  how many links it was given, and how many show. */
export function menuOverflow(rows: readonly MenuRow[] | undefined, pages: readonly MenuPage[] = []): string[] {
  const out: string[] = []
  for (const menu of MENU_NAMES) {
    const max = MENUS[menu].max
    const given = orderedLinks(rows, menu, pages)
    if (max !== undefined && given.length > max) {
      out.push(`The ${menu} menu has room for ${max} links and its rows give it ${given.length}: ${given.slice(max).join(", ")} ${given.length - max === 1 ? "is" : "are"} left out (the first ${max} by Order show)`)
    }
  }
  return out
}
