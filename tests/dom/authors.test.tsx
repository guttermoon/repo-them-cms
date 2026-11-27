// Authors are Person rows (docs/notion.md, "Authors"), drawn: a post's byline
// shows its author's portrait, job title and bio from their one row, the
// team card shows the same portrait, and Team Page Off keeps a person to
// their byline. tests/authors.test.mjs holds the reading.
import { render, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { Lineup } from "@/components/sections/lineup"
import { TEAM } from "@/lib/demo/content"
import { STARTER_DATA } from "@/lib/demo/starter"
import { withAuthors, type SiteData } from "@/lib/notion/rows"

vi.mock("@/components/notion/code", async (original) => (await import("./support/mocks")).plainCode(original))

// a test may change the starter's rows the post page reads
let swap: ((data: SiteData) => SiteData) | undefined
vi.mock("@/lib/content/store", async (original) => {
  const real = await original<typeof import("@/lib/content/store")>()
  return { ...real, getSiteData: async () => (swap ? swap(await real.getSiteData()) : real.getSiteData()) }
})

for (const key of ["NOTION_TOKEN", "NOTION_DATABASE_ID", "NOTION_API_BASE_URL"]) delete process.env[key]

const byJo = STARTER_DATA.entries.find((e) => e.kind === "Post" && e.author?.name === TEAM.support.name)!

describe("authors are Person rows", () => {
  test("a post's byline shows its author's portrait, job title and bio from their Person row", async () => {
    expect(byJo, "a starter post by Jo Regular").toBeTruthy()
    const { default: Post } = await import("@/app/blog/[slug]/page")
    const { container } = render(<CartProvider>{await Post({ params: Promise.resolve({ slug: byJo.slug }) })}</CartProvider>)
    const byline = container.querySelector("aside") as HTMLElement
    within(byline).getByText(TEAM.support.name)
    within(byline).getByText(TEAM.support.role)
    within(byline).getByText(TEAM.support.bio)
    expect(byline.querySelector("img")?.getAttribute("src")).toBe(`/demo/${TEAM.support.portrait}`)
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "").join("\n")
    expect(ld).toContain(`"jobTitle":"${TEAM.support.role}"`)
  })

  test("the byline's portrait is cut where the Person row's Cover Position says, as the team card's is", async () => {
    const top = (data: SiteData): SiteData => ({ ...data, entries: withAuthors(data.entries.map((e) => (e.kind === "Person" && e.title === TEAM.support.name ? { ...e, coverAt: 0 } : e))) })
    swap = top
    try {
      const { default: Post } = await import("@/app/blog/[slug]/page")
      const post = render(<CartProvider>{await Post({ params: Promise.resolve({ slug: byJo.slug }) })}</CartProvider>)
      expect((post.container.querySelector("aside img") as HTMLImageElement).style.objectPosition).toBe("50% 0%")
      post.unmount()
      const team = render(
        <CartProvider>
          <main>
            <h1>the team</h1>
            <Lineup page="/team" data={top(STARTER_DATA)} />
          </main>
        </CartProvider>,
      )
      const card = within(team.container).getByRole("heading", { name: TEAM.support.name }).closest("li") as HTMLElement
      expect((card.querySelector("img") as HTMLImageElement).style.objectPosition).toBe("50% 0%")
    } finally {
      swap = undefined
    }
  })

  test("the team card shows the same portrait; Team Page Off takes them off the team and leaves the byline", () => {
    const draw = (data: SiteData) =>
      render(
        <CartProvider>
          <main>
            <h1>the team</h1>
            <Lineup page="/team" data={data} />
          </main>
        </CartProvider>,
      )
    const on = draw(STARTER_DATA)
    const card = within(on.container).getByRole("heading", { name: TEAM.support.name }).closest("li") as HTMLElement
    expect(card.querySelector("img")?.getAttribute("src")).toBe(`/demo/${TEAM.support.portrait}`)
    on.unmount()

    const off: SiteData = { ...STARTER_DATA, entries: STARTER_DATA.entries.map((e) => (e.kind === "Person" && e.title === TEAM.support.name ? { ...e, team: false } : e)) }
    const team = draw(off)
    expect(within(team.container).queryByText(TEAM.support.name)).toBeNull()
    within(team.container).getByText(TEAM.founder.name)
    expect(off.entries.find((e) => e.id === byJo.id)?.author?.name).toBe(TEAM.support.name)
  })
})
