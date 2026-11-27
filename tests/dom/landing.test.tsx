// A Notion page with Layout "Landing" (components/notion/landing.tsx): its
// blocks, exactly as the API returns them (through the stand-in Notion's own
// response shapes and the real block fetcher), set as marketing sections.
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { makeContext } from "@/components/notion/context"
import { LandingPage } from "@/components/notion/landing"
import { callout, columns, divider, h1, h3, image, link, p, table, toggle, type Block } from "@/lib/demo/blocks"
import { fakeDatabase, hostedFiles } from "@/lib/demo/notion-shape"
import { fetchBlockTree } from "@/lib/notion/blocks"
import { readRow, type Entry } from "@/lib/notion/rows"

import { checkEverything } from "./support/checks"

const quoteWithSpeaker: Block = {
  type: "quote",
  quote: {
    rich_text: [{ type: "text", text: { content: "Have nothing in your houses that you do not know to be useful, or believe to be beautiful." } }],
    children: [p("William Morris"), p("The Beauty of Life, 1880")],
  },
}

const BLOCKS: Block[] = [
  p("One page, written in Notion, set as a landing page."),
  p(link("Get it", "/pricing"), " ", link("Read the code", "https://example.com/code")),
  image("cover-hello.png", "Generic packs on a shelf\nAlt: Plain packs standing on a shelf"),
  h1("What is in it"),
  p("Everything a page needs."),
  columns([h3("Words"), p("Every word is a row.")], [h3("Pages"), p("Write a page, tick Published.")]),
  callout("📈", ["0\nthird-party requests"]),
  callout("⏱", ["~1 min\nfrom Notion to the site"]),
  h1("Plans compared"),
  table(
    [
      ["Feature", "Free", "Pro"],
      ["Pages", "10", "Unlimited"],
      ["Help", "", ""],
      ["Email support", "✓", "✓"],
      ["Setup call", "—", "1 hour"],
    ],
    true,
    true,
  ),
  h1("Questions"),
  toggle(["What is it?"], [p("A website you write in Notion.")]),
  toggle(["What does it cost?"], [p("Nothing.")]),
  h1("Said before"),
  quoteWithSpeaker,
  divider(),
  p("A paragraph after a divider, in a section with no title."),
  h1("Get a website"),
  p("It takes an afternoon."),
  p(link("Get it free", "/pricing")),
]

async function landing(): Promise<{ entry: Entry; blocks: Awaited<ReturnType<typeof fetchBlockTree>> }> {
  const { pages, tree } = fakeDatabase([{ kind: "Page", title: "Launch", slug: "launch", published: true, layout: "Landing", blocks: BLOCKS }], hostedFiles("http://files.test"))
  const read = readRow(pages[0] as never)
  if (!read || !("entry" in read)) throw new Error("no entry")
  const list = async (id: string) => ({ results: (tree[id]?.children ?? []).map((child) => tree[child].block), has_more: false, next_cursor: null })
  return { entry: read.entry, blocks: await fetchBlockTree(read.entry.id, list as never) }
}

const LABELS = { yes: "Included", no: "Not included", feature: "Feature", region: "Comparison table" }

describe("a landing page written in Notion", () => {
  test("the title is the h1, the first paragraph the lede, a line of links the buttons, a picture the visual", async () => {
    const { entry, blocks } = await landing()
    expect(entry.layout).toBe("landing")
    render(<LandingPage entry={entry} blocks={blocks} ctx={makeContext(blocks, () => undefined)} labels={LABELS} />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Launch")
    expect(screen.getByText("One page, written in Notion, set as a landing page.")).toBeTruthy()
    const primary = screen.getAllByRole("link", { name: "Get it" })[0]
    expect(primary.getAttribute("href")).toBe("/pricing")
    const outside = screen.getByRole("link", { name: "Read the code" })
    expect(outside.getAttribute("target")).toBe("_blank")
    // the caption's "Alt:" line names the picture; the rest is shown under it
    const picture = screen.getByRole("img", { name: "Plain packs standing on a shelf" })
    expect(picture.getAttribute("src")).toMatch(/^\/media\//)
    expect(picture.closest("figure")?.querySelector("figcaption")?.textContent).toBe("Generic packs on a shelf")
  })

  test("each H1 is a section: columns become cards, short callouts figures, a two-header table a comparison", async () => {
    const { entry, blocks } = await landing()
    render(<LandingPage entry={entry} blocks={blocks} ctx={makeContext(blocks, () => undefined)} labels={LABELS} />)
    expect(screen.getByRole("heading", { level: 2, name: "What is in it" })).toBeTruthy()
    expect(screen.getByText("Everything a page needs.")).toBeTruthy()
    expect(screen.getByRole("heading", { level: 3, name: "Words" })).toBeTruthy()
    expect(screen.getByRole("heading", { level: 3, name: "Pages" })).toBeTruthy()
    expect(screen.getByText("~1 min").className).toContain("title-slab")
    expect(screen.getByText("from Notion to the site")).toBeTruthy()

    expect(screen.getByRole("region", { name: "Plans compared" }).tagName, "the section").toBe("SECTION")
    const region = screen.getByRole("region", { name: "Comparison table" })
    expect(region.getAttribute("tabindex"), "the keyboard can scroll it").toBe("0")
    const table = within(region).getByRole("table", { name: "Plans compared" })
    expect(within(table).getByRole("row", { name: /Setup call/ }).textContent).toContain("1 hour")
    expect(within(table).getByRole("row", { name: /Setup call/ }).textContent).toContain("Not included")
    expect(within(table).getByRole("columnheader", { name: "Help" }).getAttribute("scope")).toBe("colgroup")
  })

  test("toggles are questions, a quote names its speaker, and the last words are the call to action", async () => {
    const { entry, blocks } = await landing()
    const { container } = render(<LandingPage entry={entry} blocks={blocks} ctx={makeContext(blocks, () => undefined)} labels={LABELS} />)
    const question = screen.getByRole("heading", { level: 3, name: "What is it?" })
    expect(question.closest("details")).toBeTruthy()
    const figure = screen.getByText(/Have nothing in your houses/).closest("figure") as HTMLElement
    expect(within(figure).getByText("William Morris")).toBeTruthy()
    expect(within(figure).getByText("The Beauty of Life, 1880")).toBeTruthy()
    expect(screen.getByText("A paragraph after a divider, in a section with no title.")).toBeTruthy()
    const cta = screen.getByRole("heading", { level: 2, name: "Get a website" }).closest("section") as HTMLElement
    expect(within(cta).getByText("It takes an afternoon.")).toBeTruthy()
    expect(within(cta).getByRole("link", { name: "Get it free" }).getAttribute("href")).toBe("/pricing")
    checkEverything(container, "landing")
  })
})
