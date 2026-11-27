// Menus from Notion (lib/menus.ts, docs/notion.md, "Menus"): which links the
// header, the phone menu and the footer's columns show, in what order, as
// the Menu rows say, and as designed where there are none.
// tests/dom/menus.test.tsx draws them.
import { test } from "node:test"
import assert from "node:assert/strict"

import { FOOTER_COLUMNS, MAIN_NAV, SIDE_NAV } from "../lib/nav.ts"
import { MENU_NAMES, MENUS, menuHref, menuLink, menuLinks, menuName, menuOverflow, menuProblem, siteMenus } from "../lib/menus.ts"
import { readRow, readRows, publishedQuery } from "../lib/notion/rows.ts"
import { checkRows } from "../lib/notion/check.ts"
import { STARTER_DATA } from "../lib/demo/starter.ts"
import { menuPages, menusFor } from "../lib/content/select.ts"

let n = 0
const row = (page, props = {}) => ({ id: `m${++n}`, page, on: true, ...props })
const hrefs = (items) => items.map((i) => i.href)

test("with no Menu rows, every menu is as designed: the header's four and two, the footer's columns", () => {
  const menus = siteMenus()
  assert.deepEqual(hrefs(menus.header), MAIN_NAV.map((i) => i.href))
  assert.deepEqual(hrefs(menus.side), SIDE_NAV.map((i) => i.href))
  assert.deepEqual(
    menus.footer.map((c) => [c.key, hrefs(c.links)]),
    FOOTER_COLUMNS.map((c) => [c.key, c.items.map((i) => i.href)]),
  )
  // the phone's menu is every menu in turn, each page once
  assert.deepEqual(hrefs(menus.phone), [...new Set([...MAIN_NAV, ...SIDE_NAV, ...FOOTER_COLUMNS.flatMap((c) => c.items)].map((i) => i.href))])
})

test("an unticked row takes its link off its menu, and the others keep their places", () => {
  assert.deepEqual(menuLinks([row("shop", { menu: "header", on: false })], "header"), ["/features", "/pricing", "/about"])
  // the footer's product column keeps Shop: the row named the header
  assert.ok(menuLinks([row("shop", { menu: "header", on: false })], "footer-product").includes("/shop"))
})

test("a row with no Slug is for every menu the page was designed for", () => {
  const rows = [row("Shop", { on: false })]
  assert.ok(!menuLinks(rows, "header").includes("/shop"))
  assert.ok(!menuLinks(rows, "footer-product").includes("/shop"))
  assert.ok(!hrefs(siteMenus(rows).phone).includes("/shop"), "off every menu, off the phone's too")
  // and an Order with no Slug moves it first wherever it is
  assert.equal(menuLinks([row("about", { order: 1 })], "header")[0], "/about")
})

test("an Order reorders a menu; a page with no Order keeps its designed place", () => {
  assert.deepEqual(menuLinks([row("about", { menu: "header", order: 15 })], "header"), ["/features", "/about", "/pricing", "/shop"])
  assert.deepEqual(menuLinks([row("features", { menu: "header", order: 99 })], "header"), ["/pricing", "/shop", "/about", "/features"])
})

test("a row adds a page to a menu it was not designed for, after the menu's own unless it has an Order", () => {
  const rows = [row("team", { menu: "footer-product" })]
  assert.equal(menuLinks(rows, "footer-product").at(-1), "/team")
  assert.equal(menuLinks([row("team", { menu: "footer-product", order: 1 })], "footer-product")[0], "/team")
  // and it stays where it was designed too: a page may be in two menus
  assert.ok(menuLinks(rows, "footer-company").includes("/team"))
})

test("the header holds as many links as it was designed for; the first by Order show", () => {
  const rows = [row("team", { menu: "header", order: 15 })]
  assert.deepEqual(menuLinks(rows, "header"), ["/features", "/team", "/pricing", "/shop"])
  assert.equal(MENUS.header.max, 4)
  assert.equal(MENUS["header-side"].max, 2)
  // take one off, and there is room again
  assert.deepEqual(menuLinks([...rows, row("shop", { menu: "header", on: false })], "header"), ["/features", "/team", "/pricing", "/about"])
  // notion:check names what was left out
  assert.deepEqual(menuOverflow(rows), ["The header menu has room for 4 links and its rows give it 5: /about is left out (the first 4 by Order show)"])
  assert.deepEqual(menuOverflow([]), [])
  // the footer's columns grow
  assert.equal(MENUS["footer-help"].max, undefined)
})

test("a Notion page joins the company column by its Order, and a row can put it anywhere", () => {
  const pages = [{ href: "/our-story", title: "Our story", order: 2 }, { href: "/guides/setup", title: "Setting up" }]
  assert.equal(menuLinks([], "footer-company", pages).at(-1), "/our-story")
  assert.ok(!menuLinks([], "footer-company", pages).includes("/guides/setup"), "no Order, no place")
  assert.deepEqual(menuLink("/our-story", pages), { href: "/our-story", name: "Our story" })
  assert.deepEqual(menuLink("/pricing"), { href: "/pricing", name: "Pricing", key: "nav.pricing" })
  const rows = [row("guides/setup", { menu: "header-side", order: 1 })]
  assert.deepEqual(menuLinks(rows, "header-side", pages), ["/guides/setup", "/blog"])
  // a page this site does not have is passed over, never a broken link
  assert.deepEqual(menuLinks([row("nowhere", { menu: "header-side", order: 1 })], "header-side", pages), ["/blog", "/resources"])
})

test("a page is in a menu once, at its first place; ties keep the designed order, then the rows' age", () => {
  const twice = [row("pricing", { menu: "header", order: 5, id: "a" }), row("pricing", { menu: "header", order: 50, id: "b" })]
  assert.deepEqual(menuLinks(twice, "header"), ["/pricing", "/features", "/shop", "/about"])
  assert.deepEqual(menuLinks(twice, "header"), menuLinks([...twice].reverse(), "header"))
})

test("a Title and a Slug are read as an editor would write them", () => {
  assert.equal(menuHref("Features"), "/features")
  assert.equal(menuHref(" /pricing/ "), "/pricing")
  assert.equal(menuHref("home"), "/")
  assert.equal(menuHref("/"), "/")
  assert.equal(menuName(" Header Side "), "header-side")
  assert.equal(menuName("footer_help"), "footer-help")
  assert.equal(menuName("sidebar"), undefined)
  assert.equal(menuName(""), undefined)
  assert.deepEqual([...MENU_NAMES], ["header", "header-side", "footer-product", "footer-company", "footer-help"])
})

test("notion:check names a row it can't place: a page the site lacks, a menu there is not, a page in no menu with no Slug", () => {
  assert.match(menuProblem(row("nowhere")), /"nowhere" is not a page on this site/)
  assert.match(menuProblem(row("pricing", { menu: "sidebar" })), /"sidebar" is not a menu/)
  assert.match(menuProblem(row("resources/ingredients")), /^\/resources\/ingredients is in no menu as designed/)
  assert.equal(menuProblem(row("pricing", { menu: "header" })), undefined)
  assert.equal(menuProblem(row("pricing")), undefined)
})

// ── read from Notion ──

const rt = (text) => ({ plain_text: text, text: { content: text }, annotations: {} })
const notionRow = (props) => ({
  id: props.id ?? "n1",
  created_time: "2026-11-26T00:00:00.000Z",
  properties: {
    Title: { type: "title", title: props.title ? [rt(props.title)] : [] },
    Kind: { type: "select", select: { name: "Menu", color: "green" } },
    Published: { type: "checkbox", checkbox: Boolean(props.published) },
    Slug: { type: "rich_text", rich_text: props.slug ? [rt(props.slug)] : [] },
    Order: { type: "number", number: props.order ?? null },
  },
})

test("a Menu row is read ticked or not, with its menu and its place, and asked for by the store's query", () => {
  assert.deepEqual(readRow(notionRow({ title: "shop", slug: "header", order: 20, published: true })), {
    menu: { id: "n1", page: "shop", on: true, menu: "header", order: 20, created: "2026-11-26T00:00:00.000Z" },
  })
  assert.deepEqual(readRow(notionRow({ title: "shop" })), { menu: { id: "n1", page: "shop", on: false, created: "2026-11-26T00:00:00.000Z" } })
  const data = readRows([notionRow({ title: "shop", published: false }), notionRow({ id: "n2", title: "blog", published: true })])
  assert.deepEqual(data.menus.map((m) => [m.page, m.on]), [["shop", false], ["blog", true]])
  assert.deepEqual(data.entries, [], "a menu's link is not a page or anything listed")
  assert.equal(readRows([]).menus, undefined)
  assert.ok(JSON.stringify(publishedQuery()).includes('"equals":"Menu"'), "unticked Menu rows are fetched, since unticked is how a link is turned off")
})

test("notion:check counts Menu rows and warns on one it can't place, and on a header given too many", () => {
  const { counts, findings } = checkRows([
    notionRow({ id: "a", title: "nowhere", slug: "header", published: true }),
    notionRow({ id: "b", title: "team", slug: "header", order: 1, published: true }),
    notionRow({ id: "c", title: "pricing", slug: "header", published: true }),
  ])
  assert.equal(counts.Menu, 3)
  const said = findings.map((f) => f.message).join("\n")
  assert.match(said, /Menu "nowhere": "nowhere" is not a page on this site/)
  assert.match(said, /The header menu has room for 4 links and its rows give it 5: \/about is left out/)
  assert.ok(!findings.some((f) => f.message.startsWith('Menu "pricing"')), "a row it can place says nothing")
})

test("the starter's Menu rows are the menus as designed, one row for every link", () => {
  assert.equal(STARTER_DATA.menus?.length, MENU_NAMES.reduce((sum, m) => sum + MENUS[m].links.length, 0))
  // the same as no rows at all, with the starter's own Notion pages
  const designed = siteMenus(undefined, menuPages(STARTER_DATA))
  const starter = menusFor(STARTER_DATA)
  assert.deepEqual(hrefs(starter.header), hrefs(designed.header))
  assert.deepEqual(hrefs(starter.side), hrefs(designed.side))
  assert.deepEqual(starter.footer.map((c) => hrefs(c.links)), designed.footer.map((c) => hrefs(c.links)))
  assert.deepEqual(hrefs(starter.phone), hrefs(designed.phone))
})
