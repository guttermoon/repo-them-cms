// Sections from Notion (lib/sections.ts, docs/sections.md): where each
// section of a designed page shows, as its Section rows say, and as designed
// where it has none. tests/dom/lineup.test.tsx draws them.
import { test } from "node:test"
import assert from "node:assert/strict"

import { isPanel, lineup, SECTION_PAGES, SECTIONS, sectionPage, sectionProblem } from "../lib/sections.ts"
import { readRow, readRows } from "../lib/notion/rows.ts"
import { checkRows } from "../lib/notion/check.ts"

const row = (key, props = {}) => ({ id: props.id ?? `${key}-${props.page ?? ""}-${props.order ?? ""}`, key, on: props.on ?? true, ...props })
const designed = (page) => Object.entries(SECTIONS).filter(([, s]) => s.page === page).sort((a, b) => a[1].order - b[1].order).map(([key]) => key)

test("with no Section rows, every page shows its own sections in their designed order, and every section is on one page", () => {
  for (const page of SECTION_PAGES) assert.deepEqual(lineup(undefined, page), designed(page), page)
  assert.deepEqual(lineup([], "/"), designed("/"))
  const placed = SECTION_PAGES.flatMap((page) => lineup([], page))
  assert.deepEqual(placed.sort(), Object.keys(SECTIONS).sort())
  // orders on a page are unique, in tens, so a row can go between two
  for (const page of SECTION_PAGES) {
    const orders = designed(page).map((key) => SECTIONS[key].order)
    assert.equal(new Set(orders).size, orders.length, page)
    for (const order of orders) assert.equal(order % 10, 0, `${page}: ${order}`)
  }
})

test("an unticked row takes its section off its page; the others stay where they are", () => {
  const home = lineup([row("home.reviews", { on: false })], "/")
  assert.ok(!home.includes("home.reviews"))
  assert.deepEqual(home, designed("/").filter((key) => key !== "home.reviews"))
})

test("a row with a page moves its section there, after the numbered ones unless it has an Order", () => {
  const rows = [row("home.reviews", { page: "about" })]
  assert.ok(!lineup(rows, "/").includes("home.reviews"))
  assert.deepEqual(lineup(rows, "/about"), [...designed("/about"), "home.reviews"])
  // with an Order, it takes that place among the page's own
  assert.deepEqual(lineup([row("home.reviews", { page: "about", order: 25 })], "/about"), ["about.story", "about.numbers", "home.reviews", "about.team", "about.final"])
})

test("two ticked rows show a section twice, and an Order reorders a page", () => {
  const twice = lineup([row("home.final", { id: "a" }), row("home.final", { id: "b", order: 5 })], "/")
  assert.deepEqual(twice.filter((key) => key === "home.final").length, 2)
  assert.equal(twice[0], "home.final", "Order 5 comes before the statement's 10")
  assert.equal(twice.at(-1), "home.final", "the row with no Order keeps the designed place, last")
  // reordered: the posts first
  assert.equal(lineup([row("home.posts", { order: 1 })], "/")[0], "home.posts")
})

test("ties keep the designed order, then the rows' age, so a page never reshuffles between requests", () => {
  const rows = [row("about.final", { order: 15, created: "2026-02-01", id: "x" }), row("home.final", { page: "about", order: 15, created: "2026-01-01", id: "y" })]
  // both at 15: the designed order breaks the tie (about.final is 40, home.final 120)
  assert.deepEqual(lineup(rows, "/about").slice(0, 3), ["about.story", "about.final", "home.final"])
  // and the rows' order in the database never changes the answer
  assert.deepEqual(lineup(rows, "/about"), lineup([...rows].reverse(), "/about"))
  // two rows for one section at one place: the older first
  const two = [row("home.final", { page: "about", order: 15, created: "2026-02-01", id: "b" }), row("home.final", { page: "about", order: 15, created: "2026-01-01", id: "a" })]
  assert.deepEqual(lineup(two, "/about"), lineup([...two].reverse(), "/about"))
})

test("a page is named as an editor would write it; empty or unknown keeps the section on its own page", () => {
  assert.equal(sectionPage("home"), "/")
  assert.equal(sectionPage("/"), "/")
  assert.equal(sectionPage(" Pricing "), "/pricing")
  assert.equal(sectionPage("/about/"), "/about")
  assert.equal(sectionPage(""), undefined)
  assert.equal(sectionPage("blog"), undefined, "the blog has no sections to place among")
  assert.equal(sectionPage("features"), undefined, "the template's own page keeps its order")
  // a typo never takes a section away: it stays home
  assert.ok(lineup([row("home.reviews", { page: "abuot" })], "/").includes("home.reviews"))
})

test("a row naming no section is ignored, and notion:check says why, as it does a page it can't place on", () => {
  assert.deepEqual(lineup([row("home.nothing")], "/"), designed("/"))
  assert.match(sectionProblem(row("home.nothing")), /"home.nothing" is not a section/)
  assert.match(sectionProblem(row("home.reviews", { page: "blog" })), /"blog" is not a page whose sections can be placed .*home.reviews stays on its own page/)
  assert.equal(sectionProblem(row("home.reviews", { page: "about" })), undefined)
})

test("the panels are the designed ones", () => {
  assert.deepEqual(
    Object.keys(SECTIONS).filter(isPanel).sort(),
    ["about.numbers", "home.plans", "home.service", "home.why", "pricing.promises"].sort(),
  )
})

// ── read from Notion ──

const rt = (text) => ({ plain_text: text, text: { content: text }, annotations: {} })
const notionRow = (props) => ({
  id: props.id ?? "s1",
  created_time: "2026-03-01T00:00:00.000Z",
  properties: {
    Title: { type: "title", title: props.title ? [rt(props.title)] : [] },
    Kind: { type: "select", select: { name: "Section", color: "blue" } },
    Published: { type: "checkbox", checkbox: Boolean(props.published) },
    Slug: { type: "rich_text", rich_text: props.slug ? [rt(props.slug)] : [] },
    Order: { type: "number", number: props.order ?? null },
  },
})

test("a Section row is read ticked or not, with its page and its place", () => {
  assert.deepEqual(readRow(notionRow({ title: "home.reviews", slug: "about", order: 25, published: true })), {
    section: { id: "s1", key: "home.reviews", on: true, page: "about", order: 25, created: "2026-03-01T00:00:00.000Z" },
  })
  // unticked: still read, because that is how a section is turned off
  assert.deepEqual(readRow(notionRow({ title: "home.reviews" })), { section: { id: "s1", key: "home.reviews", on: false, created: "2026-03-01T00:00:00.000Z" } })
  const data = readRows([notionRow({ title: "home.reviews", published: false }), notionRow({ id: "s2", title: "home.final", published: true })])
  assert.deepEqual(data.sections.map((s) => [s.key, s.on]), [["home.reviews", false], ["home.final", true]])
  assert.deepEqual(data.entries, [], "a section is not a page, a post or anything listed")
  // a database with no Section rows carries none
  assert.equal(readRows([]).sections, undefined)
})

test("notion:check counts Section rows and warns on one it can't place", () => {
  const { counts, findings } = checkRows([notionRow({ title: "home.nothing", published: true }), notionRow({ id: "s2", title: "home.reviews", slug: "blog", published: true }), notionRow({ id: "s3", title: "home.final", published: true })])
  assert.equal(counts.Section, 3)
  const said = findings.map((f) => f.message).join("\n")
  assert.match(said, /Section "home.nothing": "home.nothing" is not a section/)
  assert.match(said, /Section "home.reviews": "blog" is not a page/)
  assert.ok(!findings.some((f) => f.message.startsWith('Section "home.final"')), "a row it can place says nothing")
})
