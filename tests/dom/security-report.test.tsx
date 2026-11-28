// /security's "found a problem?" button goes where its row says (slotHref,
// docs/notion.md, "Text slots"): a link in security.report.contact is its
// address, so the template's own demo can send bugs to its issue forms,
// while a copy with no link keeps the reader on its own contact form. The
// row's link is the button's, never a second link inside it.
import { render, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import type { SiteData } from "@/lib/notion/rows"
import { STARTER_DATA } from "@/lib/demo/starter"
import { REPO_URL } from "@/lib/site"

let data: SiteData = STARTER_DATA
vi.mock("@/lib/content/store", async (original) => {
  const real = await original<typeof import("@/lib/content/store")>()
  return { ...real, getSiteData: async () => data }
})

async function reportButton(copy: Record<string, string>, name: string) {
  data = { ...STARTER_DATA, copy: { ...STARTER_DATA.copy, ...copy } }
  const { default: SecurityPage } = await import("@/app/security/page")
  const { container } = render(await SecurityPage())
  const section = container.querySelector("section[aria-labelledby='security-report']") as HTMLElement
  expect(section).not.toBeNull()
  const button = within(section).getByRole("link", { name })
  // the words are the button's: no link drawn inside it
  expect(button.querySelector("a")).toBeNull()
  return button
}

describe("/security's report button", () => {
  test("with no link in its row, it goes to the site's own contact form", async () => {
    const button = await reportButton({}, "Report it privately")
    expect(button.getAttribute("href")).toBe("/contact?type=problem")
    expect(button.getAttribute("target")).toBeNull()
  })

  test("a link to the issue forms in its row sends it there, in a new tab", async () => {
    const forms = `${REPO_URL}/issues/new/choose`
    const button = await reportButton({ "security.report.contact": `[Report a bug](${forms})` }, "Report a bug")
    expect(button.getAttribute("href")).toBe(forms)
    expect(button.getAttribute("target")).toBe("_blank")
    expect(button.getAttribute("rel")).toBe("noopener noreferrer")
  })

  test("a link to one of the site's own pages stays a path", async () => {
    const button = await reportButton({ "security.report.contact": "[Ask us](https://app.notion.com/contact?type=question)" }, "Ask us")
    expect(button.getAttribute("href")).toBe("/contact?type=question")
  })
})
