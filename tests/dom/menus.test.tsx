// Menus from Notion, drawn (lib/menus.ts): the header, the phone menu and
// the footer show the links their Menu rows give them, in their order, and
// keep every rule a page keeps. tests/menus.test.mjs holds the ordering.
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { themeIcons } from "@/components/ui/theme-icons"
import { siteMenus, type MenuRow } from "@/lib/menus"
import { checkEverything } from "./support/checks"

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }) }))

let n = 0
const row = (page: string, props: Partial<MenuRow> = {}): MenuRow => ({ id: `r${++n}`, page, on: true, ...props })
const pages = [{ href: "/our-story", title: "Our story", order: 1 }]

const header = (rows: MenuRow[], content: Record<string, string> = {}) =>
  render(
    <CartProvider>
      <SiteHeader brand="Acme" getHref="/pricing" shop={false} themeIcons={themeIcons()} content={content} menus={siteMenus(rows, pages)} />
    </CartProvider>,
  )

const sides = () => {
  const nav = screen.getByRole("navigation", { name: "Main" })
  const [left, , right] = [...nav.children] as HTMLElement[]
  const names = (el: HTMLElement) => [...el.querySelectorAll("a")].map((a) => a.textContent?.trim()).filter((t) => t && t !== "Get started")
  return { left: names(left), right: names(right) }
}

describe("the header's links, as Notion's Menu rows have them", () => {
  test("as designed with no rows; turned off, reordered and added with them, and still a header that keeps every rule", () => {
    const designed = header([])
    expect(sides()).toEqual({ left: ["Features", "Pricing", "Shop", "About"], right: ["Blog", "Resources"] })
    designed.unmount()

    const { container } = header([
      row("shop", { menu: "header", on: false }),
      row("about", { menu: "header", order: 1 }),
      row("our-story", { menu: "header-side", order: 1 }),
    ])
    expect(sides()).toEqual({ left: ["About", "Features", "Pricing"], right: ["Our story", "Blog"] })
    // a Notion page's link goes to its address, named by its title
    expect(screen.getByRole("link", { name: "Our story" }).getAttribute("href")).toBe("/our-story")
    checkEverything(container, "header from Menu rows", ["/our-story"])
  })

  test("a designed page's words are still its nav slot, wherever its row puts it", () => {
    header([row("pricing", { menu: "header-side", order: 1 })], { "nav.pricing": "Plans" })
    expect(sides().right).toEqual(["Plans", "Blog"])
  })

  test("the phone menu is every menu's links, each once, and a page off every menu is off it too", async () => {
    const user = userEvent.setup()
    header([row("shop", { on: false })])
    await user.click(screen.getByRole("button", { name: "Menu" }))
    const menu = await screen.findByRole("dialog", { name: "Menu" })
    const names = within(menu).getAllByRole("link").map((a) => a.textContent?.trim())
    expect(names).not.toContain("Shop")
    expect(names.slice(0, 5)).toEqual(["Features", "Pricing", "About", "Blog", "Resources"])
    expect(names).toContain("Our story")
    expect(new Set(names).size).toBe(names.length)
    await user.click(within(menu).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})

describe("the footer's columns, as Notion's Menu rows have them", () => {
  const footer = (rows: MenuRow[], cookies = false) => render(<SiteFooter content={{}} columns={siteMenus(rows, pages).footer} cookies={cookies} />)
  const column = (name: string) => within(screen.getByRole("navigation", { name })).getAllByRole("link").map((a) => a.textContent?.trim())

  test("a column's links reordered, turned off and added, and the Notion pages with an Order after them", () => {
    const { container } = footer([row("changelog", { menu: "footer-product", order: 1 }), row("team", { menu: "footer-company", on: false }), row("security", { menu: "footer-product" })])
    expect(column("Product")).toEqual(["Changelog", "Features", "Pricing", "Shop", "Security"])
    expect(column("Company")).toEqual(["About", "Blog", "Contact", "Our story"])
    checkEverything(container, "footer from Menu rows", ["/our-story"])
  })

  test("a column its rows empty goes, heading and all; the help column stays while Cookie settings is in it", () => {
    const off = ["features", "pricing", "shop", "changelog"].map((page) => row(page, { menu: "footer-product", on: false }))
    const help = ["questions", "resources", "security", "privacy"].map((page) => row(page, { menu: "footer-help", on: false }))
    const first = footer([...off, ...help])
    expect(screen.queryByRole("navigation", { name: "Product" })).toBeNull()
    expect(screen.queryByRole("navigation", { name: "Help" })).toBeNull()
    expect(screen.getByRole("navigation", { name: "Company" })).toBeTruthy()
    first.unmount()
    footer(help, true)
    expect(within(screen.getByRole("navigation", { name: "Help" })).getByRole("button", { name: "Cookie settings" })).toBeTruthy()
  })
})
