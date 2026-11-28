// A row's Link is typed by a person. Wherever one becomes an href, an
// address that would run a script in a reader's browser is drawn as no link
// at all (lib/inline-links.ts, safeHref). The Plan row's is in
// tests/row-links.test.mjs.
import { render } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { logoItems, LogoStrip } from "@/components/sections/marketing"
import { PersonCard } from "@/components/sections/person-card"
import type { Entry } from "@/lib/notion/rows"

const SCRIPT = "javascript:alert(document.cookie)"
const person = (link?: string): Entry =>
  ({ id: "1", kind: "Person", title: "Pat", slug: "", description: "Founder", created: "", lastEdited: "", tags: [], featured: false, font: "default", fullWidth: false, coverTint: true, layout: "article", link }) as Entry

const hrefs = (root: HTMLElement) => [...root.querySelectorAll("a")].map((a) => a.getAttribute("href"))

describe("a row's link", () => {
  test("a person's profile link is drawn for the web, and not for a script", () => {
    const { container, rerender } = render(<ul><PersonCard person={person("https://example.com/pat")} profile="Profile" /></ul>)
    expect(hrefs(container)).toEqual(["https://example.com/pat"])
    for (const never of [SCRIPT, " JavaScript:alert(1)", "data:text/html,x", "//elsewhere.example"]) {
      rerender(<ul><PersonCard person={person(never)} profile="Profile" /></ul>)
      expect(hrefs(container), never).toEqual([])
    }
  })

  test("a logo's link is drawn for the web, and not for a script", () => {
    const rows = [
      { id: "a", title: "Acme", link: "https://acme.example/" },
      { id: "b", title: "Bad", link: SCRIPT },
    ]
    const items = logoItems(rows, {})
    expect(items.map((i) => i.href)).toEqual(["https://acme.example/", undefined])
    const { container } = render(<LogoStrip items={items} />)
    expect(hrefs(container)).toEqual(["https://acme.example/"])
    expect(container.textContent).toContain("Bad")
  })
})

describe("a no after a yes", () => {
  test("deletes what PostHog kept, on a visit where PostHog never loaded", async () => {
    const { forget } = await import("@/components/layout/posthog-analytics")
    const name = "ph_phc_testkey0000_posthog"
    document.cookie = `${name}=%7B%22distinct_id%22%3A%22abc%22%7D; path=/`
    document.cookie = "theme=dark; path=/"
    localStorage.setItem(name, '{"distinct_id":"abc"}')
    // the support chat's own item: its conversation, and the email typed into it
    localStorage.setItem("ph_conv_phc_testkey0000", '{"ticketId":"t1","userTraits":{"email":"reader@example.com"}}')
    localStorage.setItem("cart", "[]")
    forget("phc_testkey0000")
    expect(document.cookie).not.toContain(name)
    expect(localStorage.getItem(name)).toBeNull()
    expect(localStorage.getItem("ph_conv_phc_testkey0000")).toBeNull()
    expect(document.cookie).toContain("theme=dark")
    expect(localStorage.getItem("cart")).toBe("[]")
  })
})
