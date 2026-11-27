// Sections from Notion, drawn (components/sections/lineup, lib/sections.ts):
// a section turned off, moved, reordered or shown twice still keeps every
// rule a page keeps. tests/sections.test.mjs holds where each goes.
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { Lineup, pageQuestions } from "@/components/sections/lineup"
import { liveQuestions } from "@/lib/content/select"
import { STARTER_DATA } from "@/lib/demo/starter"
import type { SiteData } from "@/lib/notion/rows"
import { lineup, SECTION_PAGES, SECTIONS, type SectionKey, type SectionPage, type SectionRow } from "@/lib/sections"
import { checkEverything } from "./support/checks"

let n = 0
const row = (key: string, props: Partial<SectionRow> = {}): SectionRow => ({ id: `r${++n}`, key, on: true, ...props })
const withRows = (sections: SectionRow[]): SiteData => ({ ...STARTER_DATA, sections })
/** A database from before Section rows: the pages as designed. */
const NO_ROWS: SiteData = { ...STARTER_DATA, sections: undefined }

/** A page's sections under a title standing in for its hero. */
function draw(page: SectionPage, data: SiteData) {
  return render(
    <CartProvider>
      <main>
        <h1>the page</h1>
        <Lineup page={page} data={data} />
      </main>
    </CartProvider>,
  )
}

const headings = (root: HTMLElement) => [...root.querySelectorAll("h2")].map((h) => h.textContent?.trim())
const ids = (root: HTMLElement) => [...root.querySelectorAll("[id]")].map((el) => el.id)

describe("sections from Notion", () => {
  test("the starter's Section rows are the pages as designed, one row for every section", () => {
    expect(STARTER_DATA.sections?.length).toBe(Object.keys(SECTIONS).length)
    for (const page of SECTION_PAGES) expect(lineup(STARTER_DATA.sections, page), page).toEqual(lineup(undefined, page))
  })

  test("with no Section rows, a page draws its sections as designed", () => {
    const { container } = draw("/about", NO_ROWS)
    expect(headings(container)).toEqual(["one product, one plain label", "by the numbers", "the people behind the shelf", "say hello"])
    checkEverything(container, "/about, as designed")
  })

  test("an unticked row takes a section off; a moved one shows on its new page and not its old", () => {
    const off = draw("/", withRows([row("home.reviews", { on: false })]))
    expect(within(off.container).queryByText("what people say")).toBeNull()
    off.unmount()

    const rows = [row("home.reviews", { page: "about", order: 25 })]
    const home = draw("/", withRows(rows))
    expect(within(home.container).queryByText("what people say")).toBeNull()
    home.unmount()
    const about = draw("/about", withRows(rows))
    const order = headings(about.container)
    expect(order.indexOf("what people say")).toBe(order.indexOf("by the numbers") + 1)
    checkEverything(about.container, "/about, with the reviews moved in")
  })

  test("a section shown twice is drawn twice, its heading named by a different id each time", () => {
    const { container } = draw("/", withRows([row("home.final", { order: 1 }), row("home.final")]))
    const finals = screen.getAllByRole("heading", { level: 2, name: "get the generic, call it whatever you like" })
    expect(finals).toHaveLength(2)
    expect(finals.map((h) => h.id)).toEqual(["final-title", "final-title-2"])
    // each section is named by its own heading
    for (const h of finals) expect(container.querySelector(`[aria-labelledby="${h.id}"]`)).not.toBeNull()
    checkEverything(container, "/ with its last word twice")
  })

  test("every section, twice, on every page, keeps every rule a page keeps: unique ids, heading order, rhythm, names", () => {
    const keys = Object.keys(SECTIONS) as SectionKey[]
    for (const page of SECTION_PAGES) {
      const rows = keys.flatMap((key, i) => [row(key, { page: page === "/" ? "home" : page, order: i * 2 }), row(key, { page, order: i * 2 + 1 })])
      const { container, unmount } = draw(page, withRows(rows))
      const all = ids(container)
      expect(all.length, page).toBeGreaterThan(30)
      expect(all.filter((id, i) => all.indexOf(id) !== i), `${page}: an id used twice`).toEqual([])
      checkEverything(container, `${page} with every section twice`)
      unmount()
    }
  })

  test("a panel never runs on from another: the second of two sits on the page's ground", () => {
    // why generic and the plans are both panels; put them side by side
    const { container } = draw("/", withRows([row("home.why", { order: 1 }), row("home.plans", { order: 2 })]))
    const why = container.querySelector('[aria-labelledby="why-title"]') as HTMLElement
    const plans = container.querySelector('[aria-labelledby="plans-title"]') as HTMLElement
    expect(why.classList.contains("bg-panel")).toBe(true)
    expect(plans.classList.contains("bg-panel")).toBe(false)
    // as designed, apart, both are panels
    const apart = draw("/", STARTER_DATA)
    expect(apart.container.querySelector('[aria-labelledby="plans-title"]')?.classList.contains("bg-panel")).toBe(true)
  })

  test("a section first under the hero is spaced by the hero; anywhere else it keeps the rhythm", () => {
    const first = draw("/team", STARTER_DATA)
    const people = first.container.querySelector("main > section") as HTMLElement
    expect(people.className).toContain("pt-0")
    first.unmount()
    const moved = draw("/about", withRows([row("team.people", { page: "about" })]))
    const last = [...moved.container.querySelectorAll("main > section")].find((s) => s.querySelector("ul.arrive-each li h2")) as HTMLElement
    expect(last.className).not.toContain("pt-0")
    checkEverything(moved.container, "/about with the team")
  })

  test("structured data goes with its section: the questions a page shows, the people wherever they are", () => {
    const pricing = liveQuestions(STARTER_DATA, "Pricing").map((r) => r.id)
    expect(pricing.length).toBeGreaterThan(0)
    expect(pageQuestions(STARTER_DATA, "/pricing").map((r) => r.id)).toEqual(pricing)
    expect(pageQuestions(STARTER_DATA, "/about")).toEqual([])
    // the pricing questions moved to /about: /about names them, /pricing doesn't
    const moved = withRows([row("pricing.faq", { page: "about" })])
    expect(pageQuestions(moved, "/about").map((r) => r.id)).toEqual(pricing)
    expect(pageQuestions(moved, "/pricing")).toEqual([])
    // the people's data is drawn by the section that shows them
    const about = draw("/about", withRows([row("team.people", { page: "about" })]))
    const ld = [...about.container.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "")
    expect(ld.some((json) => json.includes('"Person"'))).toBe(true)
    about.unmount()
    const team = draw("/team", withRows([row("team.people", { on: false })]))
    expect(team.container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0)
  })
})
