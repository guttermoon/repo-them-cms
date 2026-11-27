// The packs as drawn (components/illustrations/packs.tsx): matte, so the
// shading over a round pack only darkens and nothing shines; the words on a
// round pack drawn once and shown slice by slice round it; and every id in a
// picture its own. The geometry itself is held by tests/packs.test.mjs.
import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, test } from "vitest"

import { STILL_LIFE_WORDS, StillLife } from "@/components/illustrations/still-life"
import { Bag, Can, Cup, INK, MATTE, PackDefs, POUCH } from "@/components/illustrations/packs"

function drawn(children: ReactNode) {
  return render(
    <svg viewBox="0 0 1200 1200">
      <PackDefs uid="t" />
      {children}
    </svg>,
  ).container.querySelector("svg") as SVGSVGElement
}

const byId = (svg: SVGSVGElement, id: string) => svg.querySelector(`[id="${id}"]`)

const ROUND = (
  <>
    <Can uid="t" name="can" x={100} top={300} w={300} h={500} ry={30} pull bands={[{ y: 600, h: 40 }]}>
      <text x={250} y={560} textAnchor="middle">
        tin
      </text>
    </Can>
    <Cup uid="t" name="cup" cx={700} top={300} wTop={300} wBottom={220} h={400} ry={36} band={{ y: 500, h: 40 }} lines={[{ at: 420, label: <text x={700} y={430}>cup</text> }]} />
    <Bag uid="t" name="bag" x={900} y={300} w={250} h={420} band={{ y: 500, h: 40 }}>
      <text x={920} y={420}>bag</text>
    </Bag>
  </>
)

describe("matte packs", () => {
  test("the shading over a round pack and a pouch only darkens: ink, at a strength no more than a box's side", () => {
    for (const stops of [MATTE, POUCH]) {
      for (const [offset, strength] of stops) {
        expect(offset).toBeGreaterThanOrEqual(0)
        expect(offset).toBeLessThanOrEqual(1)
        expect(strength).toBeGreaterThanOrEqual(0)
        expect(strength).toBeLessThanOrEqual(0.2)
      }
    }
  })

  test("nothing over a pack is light: every see-through gradient is ink, and no white line catches the light on a round pack", () => {
    const svg = drawn(ROUND)
    for (const gradient of svg.querySelectorAll("linearGradient, radialGradient")) {
      const stops = [...gradient.querySelectorAll("stop")]
      const seeThrough = stops.some((stop) => Number(stop.getAttribute("stop-opacity") ?? 1) < 1)
      if (seeThrough) for (const stop of stops) expect(stop.getAttribute("stop-color"), `#${gradient.id}`).toBe(INK)
    }
    expect(svg.querySelectorAll('[stroke="#FFFFFF"], [stroke="#fff"], [stroke="white"]')).toHaveLength(0)
  })
})

describe("words round a round pack", () => {
  test("drawn once, then shown slice by slice, each slice cut out by a mask of its own", () => {
    const svg = drawn(ROUND)
    expect(svg.textContent?.match(/tin/g)).toHaveLength(1)
    expect(svg.textContent?.match(/cup/g)).toHaveLength(1)
    for (const label of ["t-can-label", "t-cup-line0"]) {
      const uses = [...svg.querySelectorAll(`use[href="#${label}"]`)]
      expect(uses.length, label).toBeGreaterThanOrEqual(24)
      expect(byId(svg, label)?.closest("defs"), `${label} is drawn only through its slices`).toBeTruthy()
      for (const use of uses) {
        const mask = use.getAttribute("mask")?.match(/^url\(#(.+)\)$/)?.[1]
        expect(byId(svg, mask ?? "")?.tagName.toLowerCase(), "a slice is cut out by a mask").toBe("mask")
        expect(use.getAttribute("clip-path"), "a clip path would let what lies under the words show at each slice's edge").toBeNull()
        expect(use.getAttribute("transform")).toMatch(/^matrix\(/)
      }
    }
  })

  test("a bag's words run straight: its face is near flat, its band straight", () => {
    const svg = drawn(ROUND)
    expect(svg.querySelectorAll('use[href^="#t-bag"]')).toHaveLength(0)
    expect(svg.textContent).toContain("bag")
  })
})

describe("the still life", () => {
  test("its words are on the page once, wrapped or not, and every id in it is its own", () => {
    const { container } = render(<StillLife label="Generic packs on a shelf" words={STILL_LIFE_WORDS} brand="Repo Them" />)
    const svg = container.querySelector("svg") as SVGSVGElement
    for (const words of Object.values(STILL_LIFE_WORDS)) expect(svg.textContent?.split(words).length, words).toBe(2)
    const ids = [...svg.querySelectorAll("[id]")].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const use of svg.querySelectorAll("use")) expect(ids, use.getAttribute("href") ?? "").toContain(use.getAttribute("href")?.slice(1))
  })
})
