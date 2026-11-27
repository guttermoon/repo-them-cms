// The site's own logo and icon from Notion (lib/share.ts; docs/notion.md,
// "The logo and the icon"): `site.logo` stands where the mark does, in the
// header and the footer, with `site.logo.dark` for the dark look or else
// inverted there; `site.icon`, else the logo, is the tab's, the home
// screen's and the manifest's icon. With neither, the mark and its icons.
// tests/share.test.mjs holds the choosing, tests/media-resize.test.mjs and
// tests/small-routes.test.mjs the icons the media route makes.
import { render, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { themeIcons } from "@/components/ui/theme-icons"
import { STARTER_DATA } from "@/lib/demo/starter"
import type { MediaRef, SiteData } from "@/lib/notion/rows"
import { ICON_PICTURE, LOGO_DARK_PICTURE, LOGO_PICTURE, siteLogo, type SiteLogo } from "@/lib/share"
import { checkEverything } from "./support/checks"

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }) }))
// next/font runs only in Next's compiler; the layout needs its class names alone
vi.mock("@/app/fonts", () => ({ FONT_VARIABLES: "" }))

// the data the layout and the manifest read, as a test sets it
let data: SiteData = STARTER_DATA
vi.mock("@/lib/content/store", async (original) => {
  const real = await original<typeof import("@/lib/content/store")>()
  return { ...real, getSiteData: async () => data }
})

const ref = (id: string, name = `${id}.png`): MediaRef => ({ owner: "page", id: `00000000-0000-4000-8000-00000000000${id}`, field: "prop", prop: "Image", index: 0, v: "2026-11-26T09:00:00.000Z", name })
const withPictures = (pictures: SiteData["pictures"]): SiteData => ({ ...STARTER_DATA, pictures: { ...STARTER_DATA.pictures, ...pictures } })

const header = (logo?: SiteLogo) =>
  render(
    <CartProvider>
      <SiteHeader brand="Acme" getHref="/pricing" shop={false} themeIcons={themeIcons()} content={{}} logo={logo} />
    </CartProvider>,
  )
const home = (container: HTMLElement) => within(container).getAllByRole("link").find((a) => a.getAttribute("href") === "/" && a.querySelector(".mark, [data-logo]")) as HTMLElement

describe("the site's own logo", () => {
  test("with none, the drawn mark, as designed", () => {
    const { container } = header()
    const link = home(container)
    expect(link.querySelector("svg.mark")).not.toBeNull()
    expect(link.querySelector("img")).toBeNull()
  })

  test("site.logo stands where the mark does, asked for at its size, inverted in the dark look; the link is still named in words", () => {
    const logo = siteLogo(withPictures({ [LOGO_PICTURE]: ref("1") }))!
    const { container } = header(logo)
    const link = home(container)
    expect(link.querySelector("svg.mark")).toBeNull()
    const img = link.querySelector("img") as HTMLImageElement
    expect(img.getAttribute("src")).toMatch(/^\/media\/[^/]+\/1\.png\?w=\d+$/)
    expect(img.getAttribute("srcset")).toContain("2x")
    expect(img.getAttribute("alt"), "decoration: the link says what it is").toBe("")
    expect(img.className).toContain("dark:invert")
    expect(link.textContent).toContain("Acme, home")
    checkEverything(container, "header with a logo", [])
  })

  test("site.logo.dark is shown in the dark look in its place", () => {
    const logo = siteLogo(withPictures({ [LOGO_PICTURE]: ref("1"), [LOGO_DARK_PICTURE]: ref("2") }))!
    const { container } = header(logo)
    const [light, dark] = [...home(container).querySelectorAll("img")]
    expect(light.className).toContain("dark:hidden")
    expect(light.className).not.toContain("dark:invert")
    expect(dark.getAttribute("src")).toMatch(/\/2\.png\?w=/)
    expect(dark.className).toMatch(/(^| )hidden( |$)/)
    expect(dark.className).toContain("dark:block")
  })

  test("in the footer the logo stands alone, the name said in words; without one, the mark and the name", () => {
    const logo = siteLogo(withPictures({ [LOGO_PICTURE]: ref("1") }))!
    const own = render(<SiteFooter content={{ "site.name": "Acme" }} cookies={false} logo={logo} />)
    const link = home(own.container)
    expect(link.querySelector("img[data-logo]")).not.toBeNull()
    expect(link.querySelector(".title-slab")).toBeNull()
    expect(within(link).getByText("Acme").className).toContain("sr-only")
    checkEverything(own.container, "footer with a logo", [])
    own.unmount()
    render(<SiteFooter content={{ "site.name": "Acme" }} cookies={false} />)
    const plain = home(document.body)
    expect(plain.querySelector("svg.mark")).not.toBeNull()
    expect(plain.querySelector(".title-slab")?.textContent).toBe("Acme")
  })
})

describe("the site's own icon", () => {
  const head = async () => (await import("@/app/layout")).generateMetadata()
  const manifest = async () => (await import("@/app/manifest")).default()

  test("with neither icon nor logo, the mark's icons in public/", async () => {
    data = STARTER_DATA
    const icons = (await head()).icons as { icon: { url: string }[]; apple: { url: string }[] }
    expect(icons.icon.map((i) => i.url)).toEqual(["/favicon.svg", "/favicon.ico", "/icon-192.png"])
    expect(icons.apple.map((i) => i.url)).toEqual(["/apple-touch-icon.png"])
    expect((await manifest()).icons?.map((i) => i.src)).toContain("/icon-maskable-512.png")
  })

  test("site.icon is the tab's, the iPhone's and the manifest's, each a square the media route makes", async () => {
    data = withPictures({ [ICON_PICTURE]: ref("3"), [LOGO_PICTURE]: ref("1") })
    try {
      const icons = (await head()).icons as { icon: { url: string; sizes: string }[]; apple: { url: string; sizes: string }[] }
      expect(icons.icon.map((i) => [i.url.replace(/^\/media\/[^/]+\//, ""), i.sizes])).toEqual([
        ["3.png?icon=32", "32x32"],
        ["3.png?icon=192", "192x192"],
      ])
      expect(icons.apple.map((i) => i.url.replace(/^\/media\/[^/]+\//, ""))).toEqual(["3.png?icon=180"])
      const m = await manifest()
      expect(m.icons?.map((i) => [i.src.replace(/^\/media\/[^/]+\//, ""), i.sizes, i.purpose])).toEqual([
        ["3.png?icon=192", "192x192", undefined],
        ["3.png?icon=512", "512x512", undefined],
      ])
      // the logo, when there is no icon
      data = withPictures({ [LOGO_PICTURE]: ref("1") })
      expect(((await head()).icons as { icon: { url: string }[] }).icon[0].url).toMatch(/\/1\.png\?icon=32$/)
    } finally {
      data = STARTER_DATA
    }
  })

  test("the layout hands the logo to the header and the footer", async () => {
    data = withPictures({ [LOGO_PICTURE]: ref("1") })
    try {
      const { default: RootLayout } = await import("@/app/layout")
      const tree = await RootLayout({ children: <p>page</p> })
      // the html element can't be drawn into a test's body: find the header and footer in the tree
      const found: { header?: SiteLogo; footer?: SiteLogo } = {}
      const walk = (node: unknown) => {
        if (!node || typeof node !== "object") return
        if (Array.isArray(node)) return node.forEach(walk)
        const el = node as { type?: unknown; props?: Record<string, unknown> }
        if (el.type === SiteHeader) found.header = el.props?.logo as SiteLogo
        if (el.type === SiteFooter) found.footer = el.props?.logo as SiteLogo
        walk(el.props?.children)
      }
      walk(tree)
      expect(found.header?.src).toMatch(/\/1\.png$/)
      expect(found.footer).toEqual(found.header)
    } finally {
      data = STARTER_DATA
    }
  })
})
