// The service counter on the homepage (components/sections/service-counter.tsx):
// help from the person who made the template. Every offer reaches the maker,
// the only email address on the site is the maker's public one, the credit
// links the maker's site, sharing is plain links, and the star card appears
// only once the repository exists.
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { makeT } from "@/components/system/notion-text"
import { MAKER, SITE_NAME, SITE_URL } from "@/lib/site"
import { checkEverything } from "./support/checks"

async function counter(repo = "") {
  vi.resetModules()
  vi.doMock("@/lib/site", async (original) => ({ ...(await original<typeof import("@/lib/site")>()), REPO_URL: repo }))
  const { ServiceCounter, OFFERS } = await import("@/components/sections/service-counter")
  const { container } = render(<ServiceCounter T={makeT({})} content={{}} />)
  vi.doUnmock("@/lib/site")
  return { container: container as HTMLElement, OFFERS }
}

describe("the service counter", () => {
  test("holds to the site-wide rules", async () => {
    const { container } = await counter()
    checkEverything(container, "service counter")
  })

  test("points at how the template works, and every offer goes to the maker, never this site's form", async () => {
    const { OFFERS } = await counter()
    expect(screen.getByRole("link", { name: "How this template works" }).getAttribute("href")).toBe("/features")
    const { offerHref } = await import("@/components/sections/service-counter")
    for (const offer of OFFERS) {
      // a copy of the template has its own contact form: a request for the maker must not land in it,
      // so an offer is an email to the maker, or the maker's own site
      const href = offerHref({}, offer)
      if (href === MAKER.url) continue
      expect(href.startsWith(`mailto:${MAKER.email}?subject=`), offer.key).toBe(true)
      expect(decodeURIComponent(href)).toContain(`(${SITE_NAME})`)
    }
    expect(OFFERS.some((offer) => offerHref({}, offer) === MAKER.url), "the work, to look at, is the maker's own site").toBe(true)
  })

  test("a published blank title takes the whole counter away, on every page", async () => {
    vi.resetModules()
    const { ServiceCounter } = await import("@/components/sections/service-counter")
    const { container } = render(<ServiceCounter T={makeT({ "service.title": "" })} content={{ "service.title": "" }} />)
    expect(container.innerHTML).toBe("")
  })

  test("the only email address it prints or links is the maker's public one", async () => {
    const { container } = await counter()
    const addresses = new Set([...(container.innerHTML.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [])])
    expect([...addresses]).toEqual([MAKER.email])
  })

  test("credits the maker by name, linked to the maker's site", async () => {
    await counter()
    const credit = screen.getByRole("link", { name: MAKER.name })
    expect(credit.getAttribute("href")).toBe(MAKER.url)
    expect(credit.getAttribute("title")).toContain("Notion website")
  })

  test("each share link opens its platform's composer with a post written for it, every word a slot", async () => {
    vi.resetModules()
    const { shareLinks } = await import("@/components/sections/service-counter")
    const links = Object.fromEntries(shareLinks({}).map((link) => [link.key, decodeURIComponent(link.href)]))
    expect(Object.keys(links)).toEqual(["bluesky", "linkedin", "x", "email"])
    expect(links.bluesky).toMatch(/^https:\/\/bsky\.app\/intent\/compose\?text=/)
    expect(links.bluesky).toContain(`cosmic unconsciousness.\n\n${SITE_NAME}: a free GitHub template → Notion as a CMS`)
    expect(links.x).toContain(`${SITE_NAME}: a free GitHub template → Notion as a CMS`)
    // a post has to fit its platform: Bluesky takes 300 characters, the address among them
    const text = (href: string) => new URL(href.replace(/%(?![0-9a-f]{2})/gi, "%25")).searchParams.get("text") ?? ""
    const raw = Object.fromEntries(shareLinks({}).map((link) => [link.key, link.href]))
    expect(text(raw.bluesky).length - SITE_URL.length + 60, "with an address as long as 60 characters").toBeLessThanOrEqual(300)
    // X takes 280, and counts any address as 23
    expect(text(raw.x).length + 1 + 23).toBeLessThanOrEqual(280)
    expect(links.bluesky).toContain(SITE_URL)
    expect(links.linkedin).toMatch(/^https:\/\/www\.linkedin\.com\/feed\/\?shareActive=true&text=/)
    expect(decodeURIComponent(links.linkedin)).toContain(`cosmic unconsciousness.\n\n${SITE_NAME}. A GitHub repo template`)
    expect(links.linkedin).toContain(SITE_URL)
    expect(links.x).toMatch(/^https:\/\/x\.com\/intent\/post\?text=/)
    expect(links.x).toContain(`&url=${SITE_URL}`)
    expect(links.email).toMatch(/^mailto:\?subject=How about a Notion-powered CMS for free&body=/)
    expect(links.email).toContain("cosmic unconsciousness")
    expect(links.email).toContain(SITE_URL)

    // reworded in Notion, with {site} and {url} filled in; a post that leaves
    // the address out still carries it; a blank name takes the link away
    const copy = { "site.name": "Acme", "service.share.bluesky.post": "Try {site}!", "service.share.linkedin.post": "Have a look at {site}: {url}", "service.share.x": "" }
    const own = Object.fromEntries(shareLinks(copy).map((link) => [link.key, decodeURIComponent(link.href)]))
    expect(own.bluesky).toContain(`text=Try Acme! ${SITE_URL}`)
    expect(own.linkedin).toContain(`text=Have a look at Acme: ${SITE_URL}`)
    expect(own.x, "published blank: no X").toBeUndefined()
  })

  test("on /features the counter leaves out its link to /features", async () => {
    vi.resetModules()
    const { ServiceCounter } = await import("@/components/sections/service-counter")
    render(<ServiceCounter T={makeT({})} content={{}} here />)
    expect(screen.queryByRole("link", { name: "How this template works" })).toBeNull()
  })

  test("sharing is plain links to this site's address, opened safely, with nothing loaded from the services", async () => {
    const { container } = await counter()
    for (const name of ["Bluesky", "LinkedIn", "X"]) {
      const a = screen.getByRole("link", { name })
      expect(decodeURIComponent(a.getAttribute("href")!)).toContain(SITE_URL)
      expect(a.getAttribute("rel")).toMatch(/noopener/)
    }
    expect(container.querySelectorAll("script, iframe, img[src^='http']")).toHaveLength(0)
  })

  test("the star card waits for the repository to exist", async () => {
    await counter()
    expect(screen.queryByRole("link", { name: "Star it on GitHub" })).toBeNull()
    await counter("https://github.example/maker/repo-them")
    expect(screen.getByRole("link", { name: "Star it on GitHub" }).getAttribute("href")).toBe("https://github.example/maker/repo-them")
  })
})
