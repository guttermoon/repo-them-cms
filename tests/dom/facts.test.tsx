// The nutrition labels on the homepage (home.facts) and /features
// (features.facts): six lines, each a name and a value an editor rewrites in
// Notion, and a line whose name is unticked or blank goes, rule and all.
import { render } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { Lineup } from "@/components/sections/lineup"
import { TemplateFacts } from "@/components/sections/template/how-it-works"
import { makeT, type SiteCopy } from "@/components/system/notion-text"
import { STARTER_DATA } from "@/lib/demo/starter"
import type { SiteData } from "@/lib/notion/rows"

const label = (data: SiteData) => {
  const { container } = render(
    <CartProvider>
      <main>
        <h1>home</h1>
        <Lineup page="/" data={{ ...data, sections: [{ id: "f", key: "home.facts", on: true }] }} />
      </main>
    </CartProvider>,
  )
  return lines(container.querySelector('aside[aria-labelledby="nutrition-title"] dl') as HTMLElement)
}
const lines = (dl: HTMLElement) => [...dl.children].map((line) => [line.querySelector("dt")?.textContent, line.querySelector("dd")?.textContent])

/** /features' label, drawn with the template's own words and `copy`. */
const templateLabel = (copy: SiteCopy) => {
  const { container } = render(<TemplateFacts T={makeT(copy)} content={copy} logos={[]} />)
  return lines(container.querySelector('aside[aria-labelledby="template-facts-title"] dl') as HTMLElement)
}

describe("the nutrition label", () => {
  test("has six lines as designed, each name and value a slot", () => {
    const lines = label(STARTER_DATA)
    expect(lines).toHaveLength(6)
    expect(lines.at(-1)).toEqual(["Words you need a dictionary for", "0"])
    const edited = label({ ...STARTER_DATA, copy: { ...STARTER_DATA.copy, "home.facts.additives": "CSS", "home.facts.additives.value": "3.2%" } })
    expect(edited.at(-1)).toEqual(["CSS", "3.2%"])
  })

  test("a line whose name is blank or unticked goes entirely, and the others stay in order", () => {
    const lines = label({ ...STARTER_DATA, copy: { ...STARTER_DATA.copy, "home.facts.additives": "", "home.facts.fees": "" } })
    expect(lines).toHaveLength(4)
    expect(lines.every(([name, value]) => name && value)).toBe(true)
    expect(lines[0][0]).toBe("Small print")
  })
})

describe("the nutrition label on /features", () => {
  test("has six lines, and one whose name is blank or unticked goes entirely", () => {
    expect(templateLabel({})).toHaveLength(6)
    const hidden = templateLabel({ "features.facts.google": "", "features.facts.cost": "" })
    expect(hidden).toHaveLength(4)
    expect(hidden.every(([name, value]) => name && value)).toBe(true)
    expect(hidden.map(([name]) => name)).not.toContain("Fonts fetched from Google by readers")
  })
})
