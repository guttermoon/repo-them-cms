// The homepage's buttons go where their rows say (slotHref, docs/notion.md,
// "Text slots"): a link in a button's row is its address, else the code's.
// The hero's "Shop the shelf" (home.cta.shop) and the last call's
// (home.final.shop) are two rows, so a link on one moves that button alone.
import { render, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import type { SiteData } from "@/lib/notion/rows"
import { STARTER_DATA } from "@/lib/demo/starter"

let data: SiteData = STARTER_DATA
vi.mock("@/lib/content/store", async (original) => {
  const real = await original<typeof import("@/lib/content/store")>()
  return { ...real, getSiteData: async () => data }
})

async function home(copy: Record<string, string>) {
  data = { ...STARTER_DATA, copy: { ...STARTER_DATA.copy, ...copy } }
  const { default: HomePage } = await import("@/app/page")
  const { container } = render(<CartProvider>{await HomePage()}</CartProvider>)
  const section = (id: string) => container.querySelector(`section[aria-labelledby='${id}']`) as HTMLElement
  const shop = (id: string) => within(section(id)).getByRole("link", { name: "Shop the shelf" }).getAttribute("href")
  return { hero: shop("hero-title"), final: shop("final-title") }
}

describe("the homepage's two shop buttons", () => {
  test("with no link in their rows, both start with the shelf", async () => {
    expect(await home({})).toEqual({ hero: "/shop", final: "/shop" })
  })

  test("a link in the hero's row moves the hero's button, and only it", async () => {
    expect(await home({ "home.cta.shop": "[Shop the shelf](https://app.notion.com/features)" })).toEqual({ hero: "/features", final: "/shop" })
  })

  test("the last call's button has a row of its own", async () => {
    expect(await home({ "home.final.shop": "[Shop the shelf](https://app.notion.com/pricing)" })).toEqual({ hero: "/shop", final: "/pricing" })
  })
})
