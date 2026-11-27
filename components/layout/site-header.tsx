"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type React from "react"
import { useEffect, useState } from "react"

import { CartButton } from "@/components/commerce/cart-button"
import { makeT, plainText, type SiteCopy } from "@/components/system/notion-text"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/system/sheet"
import { buttonClass } from "@/components/ui/button"
import { SiteMark, Stripe } from "@/components/ui/label"
import { ThemeToggle } from "@/components/ui/theme-switch"
import { siteMenus, type MenuLink, type SiteMenus } from "@/lib/menus"
import type { SiteLogo } from "@/lib/share"
import type { Theme } from "@/lib/theme"
import { outsideLink } from "@/lib/outside"

/**
 * The header, laid out as Notion lays out its own: the mark alone in the
 * middle (the way home), four links on its left, and on its right two
 * more, the cart (when there is a shop), the look's switch and one button,
 * so the row weighs about the same either side. The band round the tin runs
 * under it. On a phone the mark goes to the left, the links into a drawer,
 * and the menu sits at the right, after the button.
 *
 * The name is not printed here: the mark stands for it, as Notion's does,
 * and the home page's hero carries the name and the descriptor.
 *
 * Its links, and the phone menu's, are the menus Notion's Menu rows make
 * (lib/menus.ts), handed in by the layout; with none, as designed.
 */
export function SiteHeader({
  content = {},
  brand,
  getHref,
  shop,
  themeIcons,
  menus = siteMenus(),
  logo,
}: {
  content?: SiteCopy
  /** the site's name, which the mark stands for: said by a screen reader */
  brand: string
  getHref: string
  /** whether the site has a shop, and so a cart */
  shop: boolean
  /** the switch's icon for each look, drawn on the server (components/ui/theme-icons.tsx) */
  themeIcons: Record<Theme, React.ReactNode>
  /** the header's links either side of the mark, and the phone menu's */
  menus?: Pick<SiteMenus, "header" | "side" | "phone">
  /** the site's own logo from Notion, drawn where the mark stands */
  logo?: SiteLogo
}) {
  const T = makeT(content)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  // Next keeps the layout mounted across routes: close the drawer on navigation
  useEffect(() => setOpen(false), [pathname])
  const isHere = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))
  // a designed page's words are its `nav.<page>` slot; a Notion page's, its title
  const words = (item: MenuLink) => (item.key ? <T k={item.key}>{item.name}</T> : item.name)
  const link = (active: boolean) =>
    `inline-flex min-h-target items-center rounded-full px-3.5 text-ui font-medium tone hover:bg-wash ${active ? "bg-wash text-ink" : "text-sub hover:text-ink"}`

  const menu = (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="lg:hidden">
        <button
          type="button"
          aria-label={plainText(content, "nav.menu", "Menu")}
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink tone hover:bg-wash"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </SheetTrigger>
      <SheetContent closeLabel={plainText(content, "nav.close", "Close")}>
        <SheetTitle className="label text-ui text-sub">
          <T k="nav.menu">Menu</T>
        </SheetTitle>
        {/* a link to the page already open changes no address, so the drawer closes on the press itself */}
        <nav aria-label={plainText(content, "nav.menu", "Menu")} className="mt-6 flex flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          {menus.phone.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isHere(item.href) ? "page" : undefined}
              className={`flex min-h-[44px] items-center rounded-block px-3 text-body font-medium hover:bg-wash ${isHere(item.href) ? "bg-wash" : ""}`}
            >
              {words(item)}
            </Link>
          ))}
        </nav>
        <a href={getHref} onClick={() => setOpen(false)} {...outsideLink(getHref)} className={buttonClass("primary", "mt-6 w-full")}>
          <T k="nav.get" words>
            Get started
          </T>
        </a>
      </SheetContent>
    </Sheet>
  )

  const links = (items: MenuLink[]) =>
    items.map((item) => (
      <Link key={item.href} href={item.href} aria-current={isHere(item.href) ? "page" : undefined} className={link(isHere(item.href))}>
        {words(item)}
      </Link>
    ))

  return (
    <header className="sticky top-0 z-40 bg-page/95 backdrop-blur supports-[backdrop-filter]:bg-page/85">
      {/* three columns from lg up, the middle one as wide as the mark, so the
          mark sits at the centre whatever is either side of it */}
      <nav
        aria-label={plainText(content, "nav.label", "Main")}
        className="mx-auto flex h-[58px] w-full max-w-site items-center gap-2 px-4 sm:px-8 lg:grid lg:grid-cols-[1fr_auto_1fr]"
      >
        <div className="-ml-3 hidden items-center gap-0.5 lg:flex">{links(menus.header)}</div>
        {/* the mark alone, as Notion's is, or the site's own logo: a
            picture, so the link is named in words a screen reader says (the
            name, then "home") */}
        <Link href="/" className="-ml-1.5 inline-flex h-11 min-w-11 items-center justify-center rounded-block lg:ml-0">
          <SiteMark logo={logo} className="h-9 w-9" />
          <span className="sr-only">
            {brand}, {plainText(content, "nav.home", "home")}
          </span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
          <div className="mr-1 hidden items-center gap-0.5 lg:flex">{links(menus.side)}</div>
          {shop ? <CartButton label={plainText(content, "nav.cart", "Cart")} items={plainText(content, "nav.cart.items", "items")} /> : null}
          <ThemeToggle label={plainText(content, "nav.theme", "Change the colours")} icons={themeIcons} />
          <a href={getHref} {...outsideLink(getHref)} className={buttonClass("primary", "ml-1 hidden min-h-target px-4 sm:inline-flex")}>
            <T k="nav.get" words>
              Get started
            </T>
          </a>
          {menu}
        </div>
      </nav>
      <Stripe size="sm" />
    </header>
  )
}
