// A reviewer's photo is their Review row's Image; with none, their initials
// (docs/notion.md, "What a row can be").
import { render, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { Lineup } from "@/components/sections/lineup"
import { mediaUrl } from "@/lib/content/media"
import { STARTER_DATA } from "@/lib/demo/starter"
import type { Entry, MediaRef, SiteData } from "@/lib/notion/rows"

const photo: MediaRef = { owner: "page", id: "11111111-2222-4333-8444-555555555555", field: "prop", prop: "Image", index: 0, v: "1", external: "https://images.example.com/casey.jpg" }

describe("a reviewer's photo", () => {
  test("is their row's Image, at the size it is shown; a reviewer with none shows their initials", () => {
    const withPhoto: SiteData = {
      ...STARTER_DATA,
      entries: STARTER_DATA.entries.map((e): Entry => (e.kind === "Review" && e.title === "Casey Basket" ? { ...e, cover: photo } : e)),
    }
    const { container } = render(
      <CartProvider>
        <main>
          <h1>home</h1>
          <Lineup page="/" data={withPhoto} />
        </main>
      </CartProvider>,
    )
    const card = (name: string) => within(container).getAllByText(name)[0].closest("li") as HTMLElement
    const img = card("Casey Basket").querySelector("img")
    expect(img?.getAttribute("src")).toContain(mediaUrl(photo, "portrait"))
    expect(img?.getAttribute("src")).toMatch(/\?w=\d+$/)
    expect(card("Casey Basket").textContent).not.toContain("CB")
    expect(card("Morgan Aisle").querySelector("img")).toBeNull()
    expect(card("Morgan Aisle").textContent).toContain("MA")
  })
})
