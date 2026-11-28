// The frame round every page (app/layout.tsx): the header and its phone
// menu, the footer with its mailing-list form, the theme controls, the cookie
// question and the link that brings it back. Held to the same site-wide rules
// as the pages (tests/dom/support/checks.ts), and to the behaviour each
// component's own comment promises.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { CookieNotice } from "@/components/layout/cookie-notice"
import { CookieSettingsLink } from "@/components/layout/cookie-settings-link"
import { NewsletterForm } from "@/components/layout/newsletter-form"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { THEME_ICON_NAMES, themeIcons } from "@/components/ui/theme-icons"
import { ThemeSelect, ThemeToggle } from "@/components/ui/theme-switch"
import { CART_KEY } from "@/lib/commerce/cart"
import { EXAMPLE_CONSENT_KEY, onConsentChange, readConsent, writeConsent } from "@/lib/consent"
import { TITLE_FIT } from "@/lib/fit-text"
import { bagBulge, bagOutline } from "@/components/illustrations/geometry"
import { NOT_AN_EMAIL } from "@/lib/email/address"
import type { Entry } from "@/lib/notion/rows"
import { siteMenus } from "@/lib/menus"
import { FOOTER_COLUMNS, MAIN_NAV, MORE_NAV, SIDE_NAV } from "@/lib/nav"
import { MAKER, REPO_URL, SITE_NAME, TEMPLATE_NAME } from "@/lib/site"
import { THEME_CHOICES, THEME_KEY, THEMES } from "@/lib/theme"
import { navigation } from "../support/setup-dom"
import { checkEverything } from "./support/checks"

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  document.documentElement.dataset.theme = "light"
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const answer = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))

const header = (props: Partial<Parameters<typeof SiteHeader>[0]> = {}) => (
  <CartProvider>
    <SiteHeader brand={SITE_NAME} getHref="/pricing" shop={false} themeIcons={themeIcons()} {...props} />
  </CartProvider>
)

describe("the header", () => {
  test("holds to the site-wide rules: the mark, the links either side of it, the theme and the way in", () => {
    const { container } = render(header())
    checkEverything(container, "header")
    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(MAIN_NAV).toHaveLength(4)
    expect(SIDE_NAV.map((item) => item.href)).toEqual(["/blog", "/resources"])
    // in reading order: four links, the way home, two links, the way in
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      ...MAIN_NAV.map((item) => item.href),
      "/",
      ...SIDE_NAV.map((item) => item.href),
      "/pricing",
    ])
    for (const item of [...MAIN_NAV, ...SIDE_NAV]) expect(within(nav).getByRole("link", { name: item.name }).getAttribute("href")).toBe(item.href)
    expect(screen.queryByRole("link", { name: "Services" })).toBeNull()
    expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/pricing")
    expect(screen.getByRole("button", { name: "Change the colours" })).toBeTruthy()
  })

  test("is laid out as Notion's: the mark alone in the middle, links either side of it, the controls on the right", () => {
    render(header())
    const nav = screen.getByRole("navigation", { name: "Main" })
    const home = screen.getByRole("link", { name: new RegExp(`^${SITE_NAME}, home$`) })
    const get = screen.getByRole("link", { name: "Get started" })
    // from lg up, three columns, the middle one as wide as the mark, so the
    // mark sits at the centre whatever is either side of it
    expect(nav.className).toContain("lg:grid-cols-[1fr_auto_1fr]")
    const [left, middle, right] = [...nav.children] as HTMLElement[]
    expect(middle).toBe(home)
    for (const item of MAIN_NAV) expect(left.contains(within(nav).getByRole("link", { name: item.name }))).toBe(true)
    for (const item of SIDE_NAV) expect(right.contains(within(nav).getByRole("link", { name: item.name }))).toBe(true)
    expect(right.contains(get)).toBe(true)
    // the phone's menu sits at the right, after the button, as Notion's does
    expect(right.lastElementChild?.getAttribute("aria-label")).toBe("Menu")
    // the way home is the mark alone: a picture, named in words for a screen reader
    expect(home.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")
    expect(home.querySelector(".sr-only")?.textContent).toBe(`${SITE_NAME}, home`)
    expect([...home.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())).toHaveLength(0)
    // and the name is not printed in the header: the home page's hero has it
    expect(nav.closest("header")?.querySelector("[data-name-line]")).toBeNull()
  })

  test("marks the page the reader is on, and its sections", () => {
    navigation.pathname = "/shop/drink"
    render(header())
    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(within(nav).getByRole("link", { name: "Shop" }).getAttribute("aria-current")).toBe("page")
    expect(within(nav).getByRole("link", { name: "Pricing" }).getAttribute("aria-current")).toBeNull()
  })

  test("a template address elsewhere opens in a new tab that cannot reach back", () => {
    render(header({ getHref: "https://github.example/template" }))
    const get = screen.getByRole("link", { name: "Get started" })
    expect(get.getAttribute("target")).toBe("_blank")
    expect(get.getAttribute("rel")).toMatch(/noopener/)
  })

  test("its words are Site Copy slots", () => {
    render(header({ content: { "nav.pricing": "Plans", "nav.get": "Use the template", "nav.theme": "Colours" } }))
    expect(screen.getByRole("link", { name: "Plans" }).getAttribute("href")).toBe("/pricing")
    expect(screen.getByRole("link", { name: "Use the template" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Colours" })).toBeTruthy()
  })

  test("the cart shows only with a shop, and says how much is in it in words", async () => {
    render(header())
    expect(screen.queryByRole("link", { name: /^Cart/ })).toBeNull()
    window.localStorage.setItem(CART_KEY, JSON.stringify([{ slug: "drink", quantity: 2 }, { slug: "corn-flakes", quantity: 1 }]))
    render(header({ shop: true }))
    expect((await screen.findByRole("link", { name: "Cart, 3 items" })).getAttribute("href")).toBe("/cart")
  })

  test("the phone menu is a named dialog with every page in it, and it closes", async () => {
    const user = userEvent.setup()
    render(header())
    await user.click(screen.getByRole("button", { name: "Menu" }))
    const menu = await screen.findByRole("dialog", { name: "Menu" })
    for (const item of [...MAIN_NAV, ...MORE_NAV]) expect(within(menu).getByRole("link", { name: item.name }).getAttribute("href")).toBe(item.href)
    expect(within(menu).getByRole("link", { name: "Get started" })).toBeTruthy()
    checkEverything(menu, "phone menu")
    await user.click(within(menu).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  test("the menu closes itself when the reader goes to another page", async () => {
    const user = userEvent.setup()
    const { rerender } = render(header())
    await user.click(screen.getByRole("button", { name: "Menu" }))
    await screen.findByRole("dialog", { name: "Menu" })
    navigation.pathname = "/pricing"
    rerender(header())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})

const NAMES = { system: "System", light: "Light", dark: "Dark", mono: "Mono", rainbow: "Rainbow" } as const
const toggle = () => <ThemeToggle label="Change the colours" icons={themeIcons()} />

describe("the four looks", () => {
  test("the header's switch moves through light, dark, mono and rainbow, and remembers each", async () => {
    const user = userEvent.setup()
    render(toggle())
    const button = screen.getByRole("button", { name: "Change the colours" })
    for (const theme of ["dark", "mono", "rainbow", "light"]) {
      await user.click(button)
      expect(document.documentElement.dataset.theme).toBe(theme)
      expect(document.documentElement.style.colorScheme).toBe(theme === "dark" ? "dark" : "light")
      expect(window.localStorage.getItem(THEME_KEY)).toBe(theme)
    }
  })

  test("the switch holds each look's icon, hidden from screen readers; the stylesheet shows the one for the look showing", () => {
    render(toggle())
    const button = screen.getByRole("button", { name: "Change the colours" })
    for (const theme of THEMES) {
      const slot = button.querySelector(`[data-theme-icon="${theme}"]`)
      expect(slot, theme).not.toBeNull()
      const icon = slot?.querySelector("svg")
      expect(icon?.getAttribute("data-icon")).toBe(THEME_ICON_NAMES[theme])
      expect(icon?.getAttribute("aria-hidden")).toBe("true")
    }
    expect(button.textContent).toBe("")
  })

  test("the footer's choice of five: System forgets the choice; the two controls stay in step", async () => {
    const user = userEvent.setup()
    render(
      <>
        {toggle()}
        <ThemeSelect label="Appearance" names={NAMES} />
      </>,
    )
    const group = screen.getByRole("group", { name: "Appearance" })
    expect(within(group).getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual([...THEME_CHOICES])
    expect(within(group).getByRole("radio", { name: "System" })).toHaveProperty("checked", true)
    await user.click(screen.getByRole("button", { name: "Change the colours" }))
    expect(within(group).getByRole("radio", { name: "Dark" })).toHaveProperty("checked", true)
    await user.click(within(group).getByRole("radio", { name: "Rainbow" }))
    expect(document.documentElement.dataset.theme).toBe("rainbow")
    expect(window.localStorage.getItem(THEME_KEY)).toBe("rainbow")
    await user.click(screen.getByRole("button", { name: "Change the colours" }))
    expect(within(group).getByRole("radio", { name: "Light" })).toHaveProperty("checked", true)
    await user.click(within(group).getByRole("radio", { name: "Mono" }))
    expect(document.documentElement.dataset.theme).toBe("mono")
    await user.click(within(group).getByRole("radio", { name: "System" }))
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBe("light")
  })

  test("the footer's choice of five sits in one row on a phone, each look in a column of its own", () => {
    render(<ThemeSelect label="Appearance" names={NAMES} />)
    const group = screen.getByRole("group", { name: "Appearance" })
    const options = group.querySelector("input[type=radio]")!.closest("label")!.parentElement!
    // one column per look, so none is left alone on a line of its own
    expect(options.className).toMatch(new RegExp(`(^|\\s)grid-cols-${THEME_CHOICES.length}(\\s|$)`))
    expect(options.className).toMatch(/(^|\s)grid(\s|$)/)
    // a card holding blocks on a phone, the card's corner less its 6px gap; a row of pills from sm
    expect(options.className).toMatch(/(^|\s)rounded-card(\s|$)/)
    expect(options.className).toMatch(/(^|\s)p-1\.5(\s|$)/)
    expect(options.className).toMatch(/(^|\s)sm:rounded-full(\s|$)/)
    for (const span of group.querySelectorAll("label > span")) {
      expect(span.className).toMatch(/(^|\s)rounded-block(\s|$)/)
      expect(span.className).toMatch(/(^|\s)sm:rounded-full(\s|$)/)
      expect(span.className).toMatch(/(^|\s)min-h-target(\s|$)/)
    }
  })

  test("a look chosen in another tab is followed in this one", async () => {
    render(<ThemeSelect label="Appearance" names={NAMES} />)
    const group = screen.getByRole("group", { name: "Appearance" })
    window.localStorage.setItem(THEME_KEY, "mono")
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: "mono" }))
    })
    expect(document.documentElement.dataset.theme).toBe("mono")
    expect(within(group).getByRole("radio", { name: "Mono" })).toHaveProperty("checked", true)
    // another key changing leaves the look alone
    window.localStorage.setItem(THEME_KEY, "dark")
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: CART_KEY, newValue: "[]" }))
    })
    expect(document.documentElement.dataset.theme).toBe("mono")
  })

  test("the browser's colour round the page follows the look's page colour", async () => {
    const user = userEvent.setup()
    const meta = document.createElement("meta")
    meta.name = "theme-color"
    meta.content = "#ffffff"
    document.head.append(meta)
    try {
      render(toggle())
      // jsdom has no stylesheet: stand in the token the look would set
      document.documentElement.style.setProperty("--c-page", "25 25 25")
      await user.click(screen.getByRole("button", { name: "Change the colours" }))
      expect(meta.content).toBe("rgb(25, 25, 25)")
    } finally {
      meta.remove()
      document.documentElement.style.removeProperty("--c-page")
    }
  })
})

const page = (over: Partial<Entry>): Entry =>
  ({ id: "p1", kind: "Page", title: "About us", slug: "about", description: "", created: "", lastEdited: "", tags: [], featured: false, font: "default", fullWidth: false, layout: "article", order: 1, ...over }) as Entry

describe("the footer", () => {
  test("holds to the site-wide rules, and links every column's pages and the Notion pages that asked for a place", () => {
    const columns = siteMenus(undefined, [{ href: "/our-story", title: "Our story", order: 1 }]).footer
    const { container } = render(<SiteFooter content={{}} columns={columns} cookies={false} />)
    checkEverything(container, "footer", ["/our-story"])
    for (const column of FOOTER_COLUMNS) {
      for (const item of column.items) expect(container.querySelector(`a[href="${item.href}"]`), item.href).not.toBeNull()
    }
    // after the company column's own links
    const company = screen.getByRole("navigation", { name: "Company" })
    expect(within(company).getAllByRole("link").at(-1)?.textContent).toBe("Our story")
  })

  test("credits the maker, with a way to ask for help", () => {
    render(<SiteFooter content={{}} cookies={false} />)
    expect(screen.getByRole("link", { name: MAKER.name }).getAttribute("href")).toBe(MAKER.url)
    const mail = screen.getByRole("link", { name: MAKER.email }).getAttribute("href") ?? ""
    expect(mail.startsWith(`mailto:${MAKER.email}?subject=`)).toBe(true)
  })

  const credit = (content: Record<string, string>) => {
    const { container } = render(<SiteFooter content={content} cookies={false} />)
    const line = container.querySelector('[data-credit="template"]')
    return { text: line?.textContent?.replace(/\s+/g, " "), links: [...(line?.querySelectorAll("a") ?? [])] }
  }

  test("the copyright carries the template's credit, REPO THEM a GitHub template by Denot, with every slot published blank: it is not a slot", () => {
    // every key blank, including any slot added later
    const everySlotBlank = new Proxy({}, { get: (_, key) => (typeof key === "string" ? "" : undefined) }) as Record<string, string>
    const { text, links } = credit(everySlotBlank)
    expect(text).toMatch(new RegExp(`^© \\d{4} ${TEMPLATE_NAME} a GitHub template by ${MAKER.studio}\\. $`))
    // GitHub to the template's repository, Denot to the maker's site, the maker's name on hover
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["GitHub", REPO_URL],
      ["Denot", "https://denot.app"],
    ])
    expect(links[1].getAttribute("title")).toBe(MAKER.name)
    // no nofollow, so the credit counts as a link; another site, so a new tab
    for (const a of links) {
      expect(a.getAttribute("rel") ?? "").not.toMatch(/nofollow/)
      expect(a.getAttribute("target")).toBe("_blank")
    }
  })

  test("a copy renamed in Notion keeps its own name first, and still credits the template", () => {
    const { text, links } = credit({ "site.name": "Acme Goods" })
    expect(text).toMatch(new RegExp(`^© \\d{4} Acme Goods\\. Built on ${TEMPLATE_NAME} a GitHub template by ${MAKER.studio}\\. Free to fork under the MIT licence\\.$`))
    expect(links.map((a) => a.getAttribute("href"))).toEqual([REPO_URL, MAKER.url])
    // the template's own name, however it is capitalised, is not a rename
    expect(credit({ "site.name": "repo them" }).text).toMatch(/^© \d{4} repo them a GitHub template by/)
  })

  test("Notion's attribution is printed whatever the copy says: it is not a slot", () => {
    const { container } = render(<SiteFooter content={{ "footer.smallprint": "", "footer.license": "" }} cookies={false} />)
    expect(container.textContent).toContain("is an independent template, not made, endorsed or maintained by Notion Labs, Inc.")
    expect(container.querySelectorAll('[data-badge="made-for-notion"]')).toHaveLength(1)
  })

  test("Cookie settings is offered only when the cookie question is asked", () => {
    const { rerender } = render(<SiteFooter content={{}} cookies={false} />)
    expect(screen.queryByRole("button", { name: "Cookie settings" })).toBeNull()
    rerender(<SiteFooter content={{}} cookies />)
    expect(screen.getByRole("button", { name: "Cookie settings" })).toBeTruthy()
  })
})

describe("the mailing-list form", () => {
  test("an address that is not one is caught before anything is sent", async () => {
    const user = userEvent.setup()
    render(<NewsletterForm />)
    await user.type(screen.getByLabelText("Email address"), "someone@example")
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    expect(screen.getByRole("alert").textContent).toBe(NOT_AN_EMAIL)
    expect(screen.getByLabelText("Email address").getAttribute("aria-invalid")).toBe("true")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("sends the name, the address and the empty trap field, and says it worked only when the route says so", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, status: "subscribed" }))
    const user = userEvent.setup()
    render(<NewsletterForm />)
    await user.type(screen.getByLabelText("First name (optional)"), "Ada")
    await user.type(screen.getByLabelText("Email address"), "ada@example.com")
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "You are on the list.")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/subscribe")
    expect(JSON.parse(init.body)).toEqual({ email: "ada@example.com", name: "Ada", website: "" })
  })

  test("a platform that confirms first gets 'check your inbox'", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, status: "pending" }))
    const user = userEvent.setup()
    render(<NewsletterForm />)
    await user.type(screen.getByLabelText("Email address"), "ada@example.com")
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    expect((await screen.findByRole("status")).textContent).toMatch(/Check your inbox/)
  })

  test("a refusal is said in the page's own words for its reason; a dropped connection says try again", async () => {
    fetchMock.mockReturnValueOnce(answer(429, { error: "Too many requests.", code: "busy" })).mockRejectedValueOnce(new TypeError("offline"))
    const user = userEvent.setup()
    render(<NewsletterForm content={{ "newsletter.busy": "Easy there. Try again in a minute." }} />)
    await user.type(screen.getByLabelText("Email address"), "ada@example.com")
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    expect((await screen.findByRole("alert")).textContent).toBe("Easy there. Try again in a minute.")
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Try again in a moment/))
  })

  test("the trap field is out of reach of people: hidden from screen readers and the Tab key", () => {
    const { container } = render(<NewsletterForm />)
    const trap = container.querySelector('input[name="website"]')!
    expect(trap.getAttribute("aria-hidden")).toBe("true")
    expect(trap.getAttribute("tabindex")).toBe("-1")
  })
})

describe("the cookie question", () => {
  test("asks a first-time reader, with focus on the card rather than on either answer", () => {
    render(<CookieNotice posthog google={false} />)
    const card = screen.getByRole("dialog")
    expect(document.activeElement).toBe(card)
    expect(card.textContent).toContain("Counted with PostHog, through this site.")
    checkEverything(card, "cookie notice")
  })

  test("is a bag of cookies in the middle of the screen, over the page dimmed behind it", () => {
    render(<CookieNotice posthog google={false} />)
    const card = screen.getByRole("dialog")
    // the dimmed page: the whole screen, the bag centred in it
    const scrim = card.closest(".cookie-scrim") as HTMLElement
    expect(scrim).not.toBeNull()
    for (const name of ["fixed", "inset-0", "flex", "items-center", "justify-center"]) expect(scrim.classList.contains(name), name).toBe(true)
    expect(card.closest('[data-pack="bag"]')).not.toBeNull()
    // its name is the word on the bag, and the dialog itself holds no picture
    expect(card.getAttribute("aria-labelledby")).toBe("cookie-title")
    expect(document.getElementById("cookie-title")?.textContent).toBe("cookies")
    expect(card.querySelectorAll("svg, img")).toHaveLength(0)
    expect(card.textContent).toContain("Net wt: 0 trackers until you say yes.")
  })

  test("in every shape it asks the same words, with the same two answers and the way to what is counted", () => {
    for (const shape of ["bag", "box", "banner"] as const) {
      const { unmount } = render(<CookieNotice shape={shape} posthog google={false} />)
      const card = screen.getByRole("dialog")
      expect(card.getAttribute("data-cookie-shape")).toBe(shape)
      expect(document.getElementById("cookie-title")?.textContent, shape).toBe("cookies")
      expect(card.getAttribute("aria-describedby")).toBe("cookie-body")
      for (const words of ["May we count visits?", "Net wt: 0 trackers until you say yes.", "Counted with PostHog, through this site."]) expect(card.textContent, `${shape}: ${words}`).toContain(words)
      const [yes, no] = within(card).getAllByRole("button")
      expect([yes.textContent, no.textContent], shape).toEqual(["Yes", "No"])
      expect(yes.className, shape).toBe(no.className)
      expect(yes.className.split(" "), shape).toContain("bg-btn")
      expect(within(card).getByRole("link", { name: "What we count" }).getAttribute("href")).toBe("/privacy#cookies")
      // focus goes to the question, never to an answer
      expect(document.activeElement, shape).toBe(card)
      checkEverything(card, `cookie notice (${shape})`)
      unmount()
    }
  })

  test("the pack's own label and drawing are the bag's alone", () => {
    for (const shape of ["box", "banner"] as const) {
      const { unmount } = render(<CookieNotice shape={shape} posthog google={false} />)
      const card = screen.getByRole("dialog")
      expect(card.closest('[data-pack="bag"]'), shape).toBeNull()
      expect(card.textContent, shape).not.toContain("generic, assorted")
      expect(card.querySelector(".stripe"), shape).toBeNull()
      unmount()
    }
  })

  test("the box is a plain panel over the page dimmed behind it, and keeps the keyboard", () => {
    render(<CookieNotice shape="box" posthog google={false} />)
    const card = screen.getByRole("dialog")
    expect(card.getAttribute("aria-modal")).toBe("true")
    expect(card.closest(".cookie-scrim")).not.toBeNull()
    for (const name of ["rounded-panel", "bg-card", "border-line"]) expect(card.classList.contains(name), name).toBe(true)
    const inside = [...card.querySelectorAll<HTMLElement>("a[href], button")]
    inside[inside.length - 1].focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(inside[0])
  })

  test("the banner runs along the bottom, holds nothing back, and leaves the page room under it", () => {
    const tall = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.cookieShape === "banner" ? 132 : 0
      },
    })
    try {
      render(<CookieNotice shape="banner" posthog google={false} />)
      const card = screen.getByRole("dialog")
      for (const name of ["fixed", "inset-x-0", "bottom-0", "border-t"]) expect(card.classList.contains(name), name).toBe(true)
      // no dimmed page, and the page stays the reader's: not modal, Tab goes on
      expect(document.querySelector(".cookie-scrim")).toBeNull()
      expect(card.getAttribute("aria-modal")).toBe("false")
      const inside = [...card.querySelectorAll<HTMLElement>("a[href], button")]
      inside[inside.length - 1].focus()
      expect(fireEvent.keyDown(document, { key: "Tab" }), "Tab was held in the banner").toBe(true)
      // as much room under the page as the bar is tall
      const room = card.nextElementSibling as HTMLElement
      expect(room.getAttribute("aria-hidden")).toBe("true")
      expect(room.style.height).toBe("132px")
      // never taller than the window: a short screen or long words scroll inside it
      for (const name of ["max-h-[100dvh]", "overflow-y-auto"]) expect(card.classList.contains(name), name).toBe(true)
      // and Escape is still no, from the page the banner leaves usable too
      const page = document.createElement("button")
      document.body.append(page)
      page.focus()
      fireEvent.keyDown(page, { key: "Escape" })
      expect(readConsent()).toBe("rejected")
      expect(screen.queryByRole("dialog")).toBeNull()
      page.remove()
    } finally {
      if (tall) Object.defineProperty(HTMLElement.prototype, "offsetHeight", tall)
    }
  })

  test("with the banner up, Escape that closes an open list or menu on the page is not an answer", () => {
    render(<CookieNotice shape="banner" posthog google={false} />)
    const list = document.createElement("ul")
    list.setAttribute("role", "listbox")
    const option = document.createElement("li")
    option.tabIndex = 0
    list.append(option)
    document.body.append(list)
    option.focus()
    fireEvent.keyDown(option, { key: "Escape" })
    expect(readConsent()).toBeNull()
    expect(screen.getByRole("dialog")).toBeTruthy()
    list.remove()
  })

  test("Escape answers no in the box too", () => {
    render(<CookieNotice shape="box" posthog google={false} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(readConsent()).toBe("rejected")
  })

  test("the bag is the shelf's bag, drawn at the size its words make it: the pouch, the crimped seal, the band under the word", () => {
    // jsdom lays nothing out: the bag is given a size, and the band its place
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")
    const rect = Element.prototype.getBoundingClientRect
    const isBag = (el: Element) => el.getAttribute("data-pack") === "bag"
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get(this: HTMLElement) { return isBag(this) ? 400 : 0 } })
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get(this: HTMLElement) { return isBag(this) ? 520 : 0 } })
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const top = this.getAttribute("aria-hidden") === "true" && this.classList.contains("h-[28px]") ? 230 : 0
      return { top, width: 0, height: 0, left: 0, right: 0, bottom: top, x: 0, y: top, toJSON() {} } as DOMRect
    }
    try {
      render(<CookieNotice posthog google={false} />)
      const bag = document.querySelector('[data-pack="bag"]') as HTMLElement
      const drawing = bag.firstElementChild as HTMLElement
      expect(drawing.getAttribute("aria-hidden")).toBe("true")
      // the same outline as the bag on the shelf, set in by its bulge
      const inset = Math.ceil(bagBulge(400))
      const { body, crimps } = bagOutline(inset, 0, 400 - 2 * inset, 520 - inset, 30)
      const edge = drawing.querySelector("svg path.cookie-bag-edge") as SVGPathElement
      expect(edge.getAttribute("d")).toBe(body)
      // the face and its band are clipped to that same pouch
      const face = drawing.querySelector(".cookie-bag-face") as HTMLElement
      expect(face.style.clipPath).toBe(`path("${body}")`)
      const band = face.querySelector(".stripe") as HTMLElement
      expect(band.style.top).toBe("230px")
      // the seal, crimped all the way across
      expect(drawing.querySelector("svg .cookie-bag-seal")).not.toBeNull()
      expect(drawing.querySelectorAll("svg .cookie-bag-crimp path")).toHaveLength(crimps.length)
      expect(crimps.length).toBeGreaterThan(30)
    } finally {
      for (const [name, was] of [["offsetWidth", width], ["offsetHeight", height]] as const) {
        if (was) Object.defineProperty(HTMLElement.prototype, name, was)
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name]
      }
      Element.prototype.getBoundingClientRect = rect
    }
  })

  test("with nothing laid out, the words stand without a drawing rather than a broken one", () => {
    render(<CookieNotice posthog google={false} />)
    const bag = document.querySelector('[data-pack="bag"]') as HTMLElement
    expect(bag.querySelector(".cookie-bag-face")).toBeNull()
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  test("the word fills the face of the bag on one line, and wraps only past the smallest size", () => {
    // jsdom lays nothing out: the line is given a width, and the word a width
    // when set at the largest size, as a browser would measure them
    const room = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")
    const rect = Element.prototype.getBoundingClientRect
    let wordAtMax = 548 // "cookies" in the slab face at 160px
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.id === "cookie-title" ? 340 : 0
      },
    })
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const sized = (this as HTMLElement).style?.fontSize === `${TITLE_FIT.max}px`
      return { width: sized && this.parentElement?.id === "cookie-title" ? wordAtMax : 0 } as DOMRect
    }
    try {
      const { unmount } = render(<CookieNotice posthog google={false} />)
      const word = document.getElementById("cookie-title")?.firstElementChild as HTMLElement
      // 160 × 340 / 548, rounded down so it never spills over the edge
      expect(word.style.fontSize).toBe("99px")
      expect(word.style.whiteSpace).toBe("nowrap")
      unmount()

      // a much longer name, set in Notion: the floor, and it wraps
      wordAtMax = 4000
      render(<CookieNotice posthog google={false} content={{ "cookies.title": "biscuits, crackers and wafers" }} />)
      const long = document.getElementById("cookie-title")?.firstElementChild as HTMLElement
      expect(long.style.fontSize).toBe(`${TITLE_FIT.min}px`)
      expect(long.style.whiteSpace).toBe("normal")
    } finally {
      if (room) Object.defineProperty(HTMLElement.prototype, "clientWidth", room)
      else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
      Element.prototype.getBoundingClientRect = rect
    }
  })

  test("with no analytics set up it is an example: it says so, names no tool, and keeps its answer apart", async () => {
    const user = userEvent.setup()
    render(<CookieNotice posthog={false} google={false} example />)
    const card = screen.getByRole("dialog")
    expect(card.textContent).toContain("An example: this site counts nothing yet, whatever you answer.")
    expect(card.textContent).not.toContain("Counted with")
    await user.click(screen.getByRole("button", { name: "Yes" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    // a yes to the example is never a yes to counting, once analytics is on
    expect(readConsent()).toBeNull()
    expect(readConsent(EXAMPLE_CONSENT_KEY)).toBe("accepted")
  })

  test("the example is asked once, and again from Cookie settings", async () => {
    act(() => writeConsent("rejected", EXAMPLE_CONSENT_KEY))
    const user = userEvent.setup()
    render(
      <>
        <CookieNotice posthog={false} google={false} example />
        <CookieSettingsLink label="Cookie settings" />
      </>,
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Cookie settings" }))
    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(readConsent(EXAMPLE_CONSENT_KEY)).toBeNull()
  })

  test("an answer to one question is never heard by the other's listeners (the analytics loaders listen to the real one)", () => {
    const real = vi.fn()
    const example = vi.fn()
    const stopReal = onConsentChange(real)
    const stopExample = onConsentChange(example, EXAMPLE_CONSENT_KEY)
    act(() => writeConsent("accepted", EXAMPLE_CONSENT_KEY))
    expect(real).not.toHaveBeenCalled()
    expect(example).toHaveBeenCalledWith("accepted")
    act(() => writeConsent("rejected"))
    expect(real).toHaveBeenCalledWith("rejected")
    expect(example).toHaveBeenCalledTimes(1)
    stopReal()
    stopExample()
  })

  test("a real answer stands apart from the example's: the real question is still asked", () => {
    act(() => writeConsent("accepted", EXAMPLE_CONSENT_KEY))
    render(<CookieNotice posthog google={false} />)
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  test("a click on the dimmed page is not an answer, and does not take focus out of the box", () => {
    render(<CookieNotice posthog google={false} />)
    const card = screen.getByRole("dialog")
    const scrim = card.closest(".cookie-scrim") as HTMLElement
    // the browser would move focus to the page; the box keeps it
    expect(fireEvent.mouseDown(scrim)).toBe(false)
    fireEvent.click(scrim)
    expect(readConsent()).toBeNull()
    expect(screen.getByRole("dialog")).toBe(card)
    // a click inside the box is the box's own
    expect(fireEvent.mouseDown(card)).toBe(true)
  })

  test("names each tool this build counts with", () => {
    render(<CookieNotice posthog google />)
    expect(screen.getByRole("dialog").textContent).toContain("PostHog and Google Analytics")
  })

  test("its two answers look exactly alike: both filled, yes first", () => {
    render(<CookieNotice posthog google={false} />)
    const [yes, no] = within(screen.getByRole("dialog")).getAllByRole("button")
    expect(yes.className).toBe(no.className)
    // filled, so each reads as a button and not as a field
    expect(yes.className.split(" ")).toContain("bg-btn")
    // in the order the question asks it, not where the hand goes for OK
    expect(yes.textContent).toBe("Yes")
    expect(no.textContent).toBe("No")
  })

  test("it keeps the keyboard while open: Tab and Shift+Tab cycle inside the card", () => {
    render(<CookieNotice posthog google={false} />)
    const card = screen.getByRole("dialog")
    expect(card.getAttribute("aria-modal")).toBe("true")
    const inside = [...card.querySelectorAll<HTMLElement>("a[href], button")]
    const first = inside[0]
    const last = inside[inside.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  test("Escape answers no: a dismissal is never read as permission", () => {
    render(<CookieNotice posthog google={false} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(readConsent()).toBe("rejected")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  test("yes is stored as given", async () => {
    const user = userEvent.setup()
    render(<CookieNotice posthog google={false} />)
    await user.click(screen.getByRole("button", { name: "Yes" }))
    expect(readConsent()).toBe("accepted")
  })

  test("somebody who has answered is not asked again, until they ask for it", async () => {
    act(() => writeConsent("rejected"))
    const user = userEvent.setup()
    render(
      <>
        <CookieNotice posthog google={false} />
        <CookieSettingsLink label="Cookie settings" />
      </>,
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Cookie settings" }))
    expect(await screen.findByRole("dialog")).toBeTruthy()
    expect(readConsent()).toBeNull()
  })
})

describe("the mailing list before an email platform is set", () => {
  test("says it is an example, sends nothing, and the dialog says so and where to write", async () => {
    const user = userEvent.setup()
    render(<SiteFooter content={{}} cookies={false} emailReady={false} />)
    // obviously a placeholder before anybody types into it
    const list = screen.getByRole("region", { name: /mailing list/ })
    expect(within(list).getByText("example")).toBeTruthy()
    expect(within(list).getByText(/An example form: it sends nothing/)).toBeTruthy()
    await user.type(within(list).getByLabelText("Email address"), "ada@example.com")
    const button = within(list).getByRole("button", { name: "Subscribe" })
    await user.click(button)
    const dialog = await screen.findByRole("dialog", { name: "Just a placeholder" })
    expect(dialog.textContent).toContain("nothing was sent, and nothing was kept")
    expect(within(dialog).getByRole("link", { name: MAKER.email }).getAttribute("href")).toBe(`mailto:${MAKER.email}`)
    expect(fetchMock, "the address went nowhere, not even to this site").not.toHaveBeenCalled()
    // focus is in the dialog, Escape closes it, and focus comes back
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(button)
  })

  test("a published blank title takes the mailing list away", () => {
    render(<SiteFooter content={{ "newsletter.title": "" }} cookies={false} emailReady={false} />)
    expect(screen.queryByRole("region", { name: /mailing list/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull()
  })

  test("once a platform is set, there is no example tag and the form posts", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true, status: "subscribed" }))
    const user = userEvent.setup()
    render(<SiteFooter content={{}} cookies={false} emailReady />)
    expect(screen.queryByText("example")).toBeNull()
    await user.type(screen.getByLabelText("Email address"), "ada@example.com")
    await user.click(screen.getByRole("button", { name: "Subscribe" }))
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "You are on the list.")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
