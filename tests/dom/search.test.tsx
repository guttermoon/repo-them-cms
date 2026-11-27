// Search on the shop and the blog (components/system/search-box): a real,
// labelled search field that filters the list on the page, says what it
// found, and keeps the words in the address.
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test } from "vitest"

import { ProductGrid } from "@/components/commerce/product-grid"
import type { ProductView } from "@/components/commerce/product"
import { PostGallery, postText } from "@/components/notion/post-card"
import type { Entry } from "@/lib/notion/rows"

import { checkEverything } from "./support/checks"

const LABELS = { label: "Search the shelf", placeholder: "search the shelf", found: "found", none: "Nothing matches." }
const GRID = { sort: "Sort by", featured: "Featured", priceLow: "Low", priceHigh: "High", newest: "Newest", soldOut: "Sold out", lowStock: "Few left", was: "Was", empty: "Empty." }

const product = (title: string, description: string, collection?: string): ProductView => ({
  id: title,
  slug: title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-"),
  title,
  description,
  currency: "GBP",
  price: 1,
  images: [],
  alts: [],
  collection: collection ? { name: collection, slug: collection.toLowerCase() } : undefined,
  variants: [],
  featured: false,
  created: "2026-11-01",
})
const SHELF = [product("corn flakes", "Toasted flakes of corn.", "Breakfast"), product("crispy rice", "It snaps, mostly.", "Breakfast"), product("café crème", "Coffee, ground.", "Drinks")]

afterEach(() => window.history.replaceState(null, "", "/"))

const field = () => screen.getByRole("searchbox", { name: "Search the shelf" })
const shelfNames = () => screen.queryAllByRole("heading", { level: 3 }).map((h) => h.textContent)

describe("search on the shop's shelf", () => {
  test("is a labelled search field in a search landmark, and the page keeps the site's rules", () => {
    const { container } = render(<ProductGrid products={SHELF} labels={GRID} search={{ labels: LABELS }} />)
    expect(screen.getByRole("search")).toBeTruthy()
    expect(field().getAttribute("type")).toBe("search")
    expect(field().getAttribute("placeholder")).toBe("search the shelf")
    checkEverything(container, "search")
  })

  test("filters as the reader types: every word must be found, accents and case set aside", () => {
    render(<ProductGrid products={SHELF} labels={GRID} search={{ labels: LABELS }} />)
    expect(shelfNames()).toHaveLength(3)
    fireEvent.change(field(), { target: { value: "Cafe" } })
    expect(shelfNames()).toEqual(["café crème"])
    fireEvent.change(field(), { target: { value: "breakfast snaps" } })
    expect(shelfNames()).toEqual(["crispy rice"])
    expect(screen.getByRole("status").textContent).toBe("1 found")
  })

  test("says when nothing matches, and the address keeps the words, so a search can be shared", () => {
    render(<ProductGrid products={SHELF} labels={GRID} search={{ labels: LABELS }} />)
    fireEvent.change(field(), { target: { value: "tinned peaches" } })
    expect(shelfNames()).toEqual([])
    expect(screen.getByRole("status").textContent).toBe("Nothing matches.")
    expect(new URLSearchParams(window.location.search).get("q")).toBe("tinned peaches")
    fireEvent.change(field(), { target: { value: "" } })
    expect(window.location.search).toBe("")
    expect(shelfNames()).toHaveLength(3)
  })

  test("starts from the words in the address", async () => {
    window.history.replaceState(null, "", "/shop?q=corn")
    render(<ProductGrid products={SHELF} labels={GRID} search={{ labels: LABELS }} />)
    await act(async () => {})
    expect((field() as HTMLInputElement).value).toBe("corn")
    expect(shelfNames()).toEqual(["corn flakes"])
  })

  test("a shelf with no search field has none", () => {
    render(<ProductGrid products={SHELF} labels={GRID} />)
    expect(screen.queryByRole("search")).toBeNull()
  })
})

describe("search on the blog", () => {
  const post = (id: string, title: string, description: string, tag: string) =>
    ({ id, kind: "Post", title, description, slug: id, tags: [{ name: tag, color: "blue" }], date: "2026-11-01" }) as unknown as Entry
  const POSTS = [post("a", "Introducing generic", "A shop with nothing to hide.", "News"), post("b", "Five questions", "Before you buy anything.", "Guides")]

  test("each post is searched by its title, description, category, tags and author", () => {
    expect(postText(POSTS[1])).toContain("Guides")
    render(<PostGallery posts={POSTS} label="Post" search={{ labels: { ...LABELS, label: "Search the posts" } }} />)
    const box = screen.getByRole("searchbox", { name: "Search the posts" })
    fireEvent.change(box, { target: { value: "guides" } })
    const shown = screen.getAllByRole("heading", { level: 3 }).filter((h) => !h.closest(".hidden"))
    expect(shown.map((h) => h.textContent)).toEqual(["Five questions"])
    expect(screen.getByRole("status").textContent).toBe("1 found")
  })
})
