// A hero with a picture under it (HeroCentered's backdrop: the home page's
// home.hero.image row, lib/share.ts): the picture the width of the window,
// fetched with the page, under a veil, printed as its row says, and the
// words and buttons light on it (.on-picture; tests/contrast.test.mjs holds
// the colours). Without one, the hero as designed.
import { render } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { HeroCentered } from "@/components/sections/marketing"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import type { Backdrop } from "@/lib/share"
import { checkEverything } from "./support/checks"

const SRC = "/media/abc.def/field.jpg"

function hero(backdrop?: Backdrop) {
  const { container } = render(
    <main>
      <HeroCentered
        name={{ name: "acme" }}
        eyebrow="generic, on purpose"
        title="everything you need"
        lede="Plain products with plain labels."
        actions={
          <ButtonRow>
            <ButtonLink href="/shop">Shop the shelf</ButtonLink>
            <ButtonLink href="/pricing" tone="secondary">
              See the plans
            </ButtonLink>
          </ButtonRow>
        }
        note="No small print."
        backdrop={backdrop}
      />
    </main>,
  )
  return container.querySelector("section") as HTMLElement
}

describe("a hero on a picture", () => {
  test("without a picture, the hero as designed: no veil, no picture, the look's own colours", () => {
    const section = hero()
    expect(section.classList.contains("on-picture")).toBe(false)
    expect(section.querySelector("img")).toBeNull()
    expect(section.querySelector(".picture-veil")).toBeNull()
  })

  test("with one, the picture fills the hero behind the words, the window's width, fetched with the page, under a veil", () => {
    const section = hero({ src: SRC, alt: "", tint: true })
    checkEverything(section.parentElement as HTMLElement, "a hero on a picture")
    expect(section.classList.contains("on-picture")).toBe(true)
    const img = section.querySelector("img") as HTMLImageElement
    const frame = img.parentElement as HTMLElement
    expect(frame.className).toContain("absolute inset-0 -z-10")
    expect(frame.classList.contains("cover-tint")).toBe(true)
    expect(img.getAttribute("sizes")).toBe("100vw")
    expect(img.getAttribute("loading")).toBe("eager")
    expect(img.getAttribute("srcset")).toContain(`${SRC}?w=1920 1920w`)
    expect(frame.querySelector(".picture-veil"), "the veil over the picture").not.toBeNull()
    // the words come after the picture, so they are drawn over it
    expect(section.lastElementChild?.querySelector("h1")?.textContent).toBe("everything you need")
  })

  test("a picture with no words is decoration; with words, a reader is told what it shows", () => {
    const quiet = hero({ src: SRC, alt: "", tint: true })
    expect(quiet.querySelector("img")?.getAttribute("alt")).toBe("")
    expect(quiet.querySelector("img")?.parentElement?.getAttribute("aria-hidden")).toBe("true")
    const said = hero({ src: SRC, alt: "A wheat field at dawn", tint: true })
    expect(said.querySelector("img")?.getAttribute("alt")).toBe("A wheat field at dawn")
    expect(said.querySelector("img")?.parentElement?.hasAttribute("aria-hidden")).toBe(false)
  })

  test("Cover Tint Off shows it as uploaded, and Cover Position cuts it", () => {
    const section = hero({ src: SRC, alt: "", tint: false, at: 100 })
    const img = section.querySelector("img") as HTMLImageElement
    expect(img.parentElement?.classList.contains("cover-tint")).toBe(false)
    expect(img.parentElement?.hasAttribute("data-untinted")).toBe(true)
    expect(img.style.objectPosition).toBe("50% 100%")
  })
})
