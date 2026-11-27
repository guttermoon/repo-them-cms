// A Notion page's body, drawn (components/notion/blocks.tsx): the starter
// content's "every block" page, read as the site reads it (the block tree
// through lib/notion/blocks.ts) and drawn as a reader gets it. Every block
// type the page holds is on screen, the headings make an outline with no gaps,
// the renderer's own words are Site Copy slots, a video loads nothing until
// asked, and a code block is highlighted on the server.
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, test, vi } from "vitest"

import { blockLabels, collectHeadings, makeContext } from "@/components/notion/context"
import { DEMO_ROWS } from "@/lib/demo/content"
import { fakeDatabase, hostedFiles } from "@/lib/demo/notion-shape"
import { fetchBlockTree, type ListChildren, type NBlock } from "@/lib/notion/blocks"
import { checkEverything, checkHeadingOrder } from "./support/checks"

// React cannot render an async component outside a server: the code block is
// drawn unhighlighted here, and highlighted in its own test below
vi.mock("@/components/notion/code", async (original) => (await import("./support/mocks")).plainCode(original))

const { Blocks } = await import("@/components/notion/blocks")

/** The every-block page's tree, as the site fetches it from Notion. */
async function everyBlock(): Promise<NBlock[]> {
  const { pages, tree } = fakeDatabase(DEMO_ROWS, hostedFiles("http://files.example"))
  const list: ListChildren = async (id, cursor) => {
    const start = Number(cursor ?? 0)
    const ids = tree[id].children.slice(start, start + 100)
    const more = start + 100 < tree[id].children.length
    return { results: ids.map((child) => tree[child].block), has_more: more, next_cursor: more ? String(start + 100) : null }
  }
  const page = pages.find((p) => (p.properties.Slug as { rich_text: { plain_text: string }[] }).rich_text[0]?.plain_text === "every-block")!
  return fetchBlockTree(page.id, list)
}

const typesIn = (blocks: NBlock[]): Set<string> => new Set(blocks.flatMap((b) => [b.type, ...typesIn(b.children ?? [])]))

/** A run of Notion's rich text: its words, formatted as `annotations` say,
 *  and a link to `href` when it has one. */
const run = (text: string, { href, annotations = {} }: { href?: string; annotations?: Record<string, boolean> } = {}) => ({
  type: "text",
  plain_text: text,
  href: href ?? null,
  text: { content: text, link: href ? { url: href } : null },
  annotations,
})

/** Blocks drawn as a page's body, with the renderer's built-in words. */
const drawBlocks = (blocks: NBlock[]) => render(<Blocks blocks={blocks} ctx={makeContext(blocks, () => undefined, blockLabels({}))} />).container

describe("the every-block page", () => {
  let blocks: NBlock[]
  let body: HTMLElement
  beforeAll(async () => {
    blocks = await everyBlock()
  })

  const draw = (copy: Record<string, string> = {}) => {
    const { container } = render(
      <article>
        <h1>Every block</h1>
        <Blocks blocks={blocks} ctx={makeContext(blocks, () => undefined, blockLabels(copy))} />
      </article>,
    )
    body = container.firstElementChild as HTMLElement
    return body
  }

  test("holds every kind of block the renderer draws", () => {
    for (const type of ["paragraph", "heading_1", "heading_2", "heading_3", "bulleted_list_item", "numbered_list_item", "to_do", "toggle", "quote", "callout", "divider", "column_list", "code", "equation", "table", "image", "video", "bookmark", "table_of_contents"]) {
      expect(typesIn(blocks).has(type), type).toBe(true)
    }
  })

  test("draws each of them, held to the site-wide rules", () => {
    draw()
    checkEverything(body, "/every-block")
    expect(body.querySelectorAll("ul").length).toBeGreaterThan(1)
    expect(body.querySelector("ol")).not.toBeNull()
    expect(body.querySelector("blockquote")?.textContent).toContain("A quote.")
    expect(body.querySelector('[role="separator"]')).not.toBeNull()
    expect(body.querySelectorAll("details").length).toBeGreaterThanOrEqual(2)
    expect(body.querySelectorAll('th[scope="col"]')).toHaveLength(3)
    expect(body.querySelector(".katex")).not.toBeNull()
    expect(body.querySelector("figure.n-code pre code")?.textContent).toContain("getSiteData")
    // the caption's "Alt:" line is the picture's alt text, and is not shown
    const picture = body.querySelector("img[src^='/media/']")!
    expect(picture.getAttribute("alt")).toBe("The word “picture” over a blue band, above the words “served from this site, not from Notion”")
    expect(picture.closest("figure")?.querySelector("figcaption")?.textContent).toBe("A picture uploaded to Notion, served from this site's own address.")
    expect(within(body).getByRole("link", { name: /developers\.notion\.com/ }).getAttribute("rel")).toMatch(/noopener/)
  })

  test("the headings make an outline with no gaps, whatever levels the author used", () => {
    draw()
    checkHeadingOrder(body)
    // Notion's Heading 3 inside a column, after a Heading 1, is drawn as an
    // h3, styled as Notion's third level
    const left = screen.getByRole("heading", { name: "Left column" })
    expect(left.tagName).toBe("H3")
    expect(left.className).toContain("n-h3")
  })

  test("the table of contents links every heading's anchor", () => {
    draw()
    const contents = screen.getByRole("navigation", { name: "Contents" })
    const links = within(contents).getAllByRole("link")
    expect(links.length).toBe(collectHeadings(blocks).length)
    for (const a of links) expect(body.querySelector(`[id="${a.getAttribute("href")!.slice(1)}"]`), a.getAttribute("href")!).not.toBeNull()
  })

  test("the renderer's own words are Site Copy slots", () => {
    draw({ "blocks.contents": "On this page", "blocks.play": "Play the film", "blocks.copy": "Copy code" })
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Play the film/ })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Copy code" }).length).toBe(2)
  })

  test("a video loads nothing until the reader presses play", async () => {
    const user = userEvent.setup()
    draw()
    expect(body.querySelector("iframe")).toBeNull()
    const play = screen.getByRole("button", { name: /Play video/ })
    expect(play.textContent).toContain("Nothing loads from YouTube until you press play.")
    expect(screen.getByRole("link", { name: "Watch on YouTube" }).getAttribute("target")).toBe("_blank")
    await user.click(play)
    const frame = document.querySelector("iframe")!
    expect(frame.getAttribute("src")).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//)
    expect(frame.getAttribute("title")).toContain("Big Buck Bunny")
  })
})

describe("heading levels", () => {
  const heading = (type: string, text: string, children?: NBlock[]): NBlock =>
    ({ id: `${type}-${text}`, type, [type]: { rich_text: [{ plain_text: text }] }, ...(children ? { children } : {}) }) as NBlock

  test("a page that starts at Heading 2 starts at <h2>; a level is never skipped going down; going up is free", () => {
    const tags = collectHeadings([heading("heading_2", "a"), heading("heading_3", "b"), heading("heading_1", "c"), heading("heading_3", "d")]).map((h) => h.tag)
    expect(tags).toEqual(["h2", "h3", "h2", "h3"])
  })

  test("a body under a section's <h2> starts at <h3>", () => {
    expect(collectHeadings([heading("heading_1", "a"), heading("heading_2", "b")], 2).map((h) => h.tag)).toEqual(["h3", "h4"])
  })

  test("anchors are made from the words, numbered when they repeat", () => {
    expect(collectHeadings([heading("heading_1", "Set up"), heading("heading_2", "Set up")]).map((h) => h.anchor)).toEqual(["set-up", "set-up-2"])
  })
})

describe("a code block, highlighted on the server", () => {
  test("arrives as coloured HTML with no script, and copies the code as written", async () => {
    const { CodeBlock } = await vi.importActual<typeof import("@/components/notion/code")>("@/components/notion/code")
    render(await CodeBlock({ code: 'const site = "notion"', language: "typescript", labels: { copy: "Copy", copied: "Copied", failed: "Select and copy" } }))
    const figure = document.querySelector("figure.n-code")!
    expect(figure.querySelector("script")).toBeNull()
    expect(figure.querySelector("span[style]")).not.toBeNull()
    expect(figure.textContent).toContain('const site = "notion"')
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy()
  })

  test("a language the site does not bundle is shown as plain code, not an error", async () => {
    const { CodeBlock } = await vi.importActual<typeof import("@/components/notion/code")>("@/components/notion/code")
    render(await CodeBlock({ code: "10 PRINT HELLO", language: "basic", labels: { copy: "Copy", copied: "Copied", failed: "Select and copy" } }))
    expect(document.querySelector("figure.n-code pre code")?.textContent).toBe("10 PRINT HELLO")
  })
})

describe("links in a page's text", () => {

  test("a link to this site, as its full address or as a path Notion kept on its app, stays on the site and in the tab", () => {
    // vitest.config.mts sets the site's address to https://site.example
    const blocks: NBlock[] = [
      {
        id: "p1",
        type: "paragraph",
        paragraph: {
          rich_text: [
            run("the plans", { href: "https://app.notion.com/pricing" }),
            run(", "),
            run("the team", { href: "https://www.site.example/about#team" }),
            run(", "),
            run("the docs", { href: "https://developers.notion.com/" }),
          ],
        },
      },
    ]
    drawBlocks(blocks)
    const plans = screen.getByRole("link", { name: "the plans" })
    expect(plans.getAttribute("href")).toBe("/pricing")
    expect(plans.getAttribute("target")).toBeNull()
    const team = screen.getByRole("link", { name: "the team" })
    expect(team.getAttribute("href")).toBe("/about#team")
    expect(team.getAttribute("target")).toBeNull()
    const docs = screen.getByRole("link", { name: "the docs" })
    expect(docs.getAttribute("href")).toBe("https://developers.notion.com/")
    expect(docs.getAttribute("target")).toBe("_blank")
  })
})

describe("icons from Notion", () => {
  const callout = (icon: unknown): NBlock => ({ id: "c1", type: "callout", callout: { rich_text: [run("A callout.")], icon, color: "gray_background" } } as NBlock)
  const draw = (block: NBlock) => drawBlocks([block])

  test("one of Notion's own icons is drawn with the site's icon of that name, in Notion's colour for it", () => {
    const svg = draw(callout({ type: "icon", icon: { name: "light-bulb", color: "blue" } })).querySelector("svg[data-icon]")
    expect(svg?.getAttribute("data-icon")).toBe("lightbulb")
    expect(svg?.getAttribute("class")).toContain("n-c-blue")
    expect(svg?.getAttribute("aria-hidden")).toBe("true")
  })

  test("one the site has no drawing of comes through /media/ as Notion draws it, never from Notion's own address", () => {
    const img = draw(callout({ type: "icon", icon: { name: "pizza", color: "red" } })).querySelector("img")
    expect(img?.getAttribute("src")).toMatch(/^\/media\//)
    expect(img?.getAttribute("alt")).toBe("")
  })

  test("an emoji stays the emoji its writer chose, and a callout with no icon gets the lightbulb", () => {
    expect(draw(callout({ type: "emoji", emoji: "🥨" })).textContent).toContain("🥨")
    expect(draw(callout(null)).querySelector("svg[data-icon]")?.getAttribute("data-icon")).toBe("lightbulb")
  })
})


describe("a picture's alt text, written in its caption", () => {
  const picture = (caption: ReturnType<typeof run>[]): NBlock =>
    ({ id: "i1", type: "image", image: { caption, source: "file", external: null, name: null, media: { owner: "block", id: "i1", field: "block", v: "" } } }) as NBlock
  const draw = (caption: ReturnType<typeof run>[]) => {
    const block = picture(caption)
    const box = drawBlocks([block])
    return { img: box.querySelector("img")!, caption: box.querySelector("figcaption") }
  }

  test("an Alt: line is what a screen reader reads, and the rest is shown", () => {
    const { img, caption } = draw([run("Our shop on opening day\nAlt: A green shopfront with bread stacked in the window")])
    expect(img.getAttribute("alt")).toBe("A green shopfront with bread stacked in the window")
    expect(caption?.textContent).toBe("Our shop on opening day")
  })

  test("the line can come first, be written Alt text:, in any case", () => {
    const { img, caption } = draw([run("ALT TEXT: A loaf cut open\nThe crumb after 36 hours")])
    expect(img.getAttribute("alt")).toBe("A loaf cut open")
    expect(caption?.textContent).toBe("The crumb after 36 hours")
  })

  test("a caption with no Alt: line describes the picture once, under it, so the picture is not announced again", () => {
    const { img, caption } = draw([run("Three bakers and one oven")])
    expect(img.getAttribute("alt")).toBe("")
    expect(caption?.textContent).toBe("Three bakers and one oven")
  })

  test("a bare Alt: marks a picture as decoration, with nothing shown", () => {
    const { img, caption } = draw([run("Alt:")])
    expect(img.getAttribute("alt")).toBe("")
    expect(caption).toBeNull()
  })

  test("the caption keeps its formatting when its Alt: line is taken out", () => {
    const { img, caption } = draw([run("Fresh", { annotations: { bold: true } }), run(" every morning\nAlt: Rolls on a tray")])
    expect(img.getAttribute("alt")).toBe("Rolls on a tray")
    expect(caption?.textContent).toBe("Fresh every morning")
    expect(caption?.querySelector("strong")?.textContent).toBe("Fresh")
  })
})

describe("columns", () => {
  const column = (id: string, ratio: unknown): NBlock =>
    ({ id, type: "column", column: { width_ratio: ratio }, children: [{ id: `${id}-p`, type: "paragraph", paragraph: { rich_text: [run(id)] } }] } as NBlock)
  const draw = (...columns: NBlock[]) => {
    const list = { id: "cols", type: "column_list", column_list: {}, children: columns } as NBlock
    return drawBlocks([list])
  }

  test("a column is as wide as Notion's ratio says, and a ratio that is not a number is no CSS of its own", () => {
    const [wide, hostile, none] = [...draw(column("a", 0.7), column("b", "1;background:url(https://evil.example/x)"), column("c", undefined)).querySelectorAll<HTMLElement>(".min-w-0")]
    expect(wide.style.flex).toBe("0.7 1 0%")
    expect(hostile.getAttribute("style")).not.toContain("evil.example")
    expect(hostile.style.flex).toBe("1 1 0%")
    expect(none.style.flex).toBe("1 1 0%")
  })
})
