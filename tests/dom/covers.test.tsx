// Cover Tint (docs/notion.md, "Covers"): a cover is printed in the look's ink
// unless its row says Off, and then it is shown as uploaded, on a post's
// card and over its page alike. tests/covers.test.mjs holds the rules that
// draw each.
import { render } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { PostCard, PostGallery } from "@/components/notion/post-card"
import { PageHeader } from "@/components/ui/page"
import type { Entry } from "@/lib/notion/rows"

const post = (coverTint: boolean): Entry =>
  ({
    id: "1",
    kind: "Post",
    title: "A post",
    slug: "a-post",
    description: "",
    created: "2026-01-01",
    lastEdited: "2026-01-01",
    tags: [],
    featured: false,
    font: "default",
    fullWidth: false,
    layout: "article",
    cover: { owner: "page", id: "1", field: "cover", v: "1", external: "/demo/cover-introducing.png" },
    coverTint,
  }) as Entry

const frameOf = (root: HTMLElement) => root.querySelector("img")?.parentElement as HTMLElement

describe("Cover Tint", () => {
  test("a post's card prints its cover in the look's ink, and Off shows it as uploaded", () => {
    const on = frameOf(render(<PostCard post={post(true)} label="Post" />).container)
    expect(on.classList.contains("cover-tint")).toBe(true)
    expect(on.hasAttribute("data-untinted")).toBe(false)

    const off = frameOf(render(<PostCard post={post(false)} label="Post" />).container)
    expect(off.classList.contains("cover-tint")).toBe(false)
    expect(off.hasAttribute("data-untinted")).toBe(true)
    // the same frame either way: only the ink changes
    expect(off.className).toBe(on.className.replace("cover-tint ", ""))
  })

  test("a page's cover follows its row too, and is printed in the ink when nothing says otherwise", () => {
    const cover = { src: "/demo/cover-introducing.png", alt: "" }
    expect(frameOf(render(<PageHeader title="A page" cover={cover} />).container).classList.contains("cover-tint")).toBe(true)
    const off = frameOf(render(<PageHeader title="A page" cover={{ ...cover, tint: false }} />).container)
    expect(off.classList.contains("cover-tint")).toBe(false)
    expect(off.hasAttribute("data-untinted")).toBe(true)
  })
})

describe("the picture the blog opens on", () => {
  // covers Notion hosts, so each is asked for through the media route
  const hosted = (id: string): Entry => ({ ...post(true), id, slug: `post-${id}`, cover: { owner: "page", id, field: "cover", v: `000000000000000${id}` } }) as Entry

  test("the lead post's cover comes with the page, first; every other card's waits until it is near", () => {
    const { container } = render(<PostGallery posts={["1", "2", "3"].map(hosted)} label="Post" lead />)
    const [lead, ...rest] = [...container.querySelectorAll("img")]
    expect(lead.getAttribute("loading")).toBe("eager")
    expect(lead.getAttribute("fetchpriority")).toBe("high")
    for (const img of rest) {
      expect(img.getAttribute("loading")).toBe("lazy")
      expect(img.hasAttribute("fetchpriority")).toBe(false)
    }
  })

  test("a gallery with no lead (the homepage's, at its foot) opens on nothing", () => {
    const { container } = render(<PostGallery posts={["1", "2"].map(hosted)} label="Post" />)
    for (const img of container.querySelectorAll("img")) expect(img.getAttribute("loading")).toBe("lazy")
  })
})
