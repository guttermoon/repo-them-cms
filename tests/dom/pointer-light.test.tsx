// The light on a card follows the pointer, and the card leans toward it
// (components/system/pointer-light.tsx, `.lit` in app/globals.css).
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"

import { PointerLight } from "@/components/system/pointer-light"
import { motion } from "../support/setup-dom"

function setup() {
  // the next frame, now
  vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => (run(0), 1))
  vi.stubGlobal("cancelAnimationFrame", () => {})
  const { container } = render(
    <>
      <PointerLight />
      <div className="lit" data-testid="card">
        <p>words</p>
      </div>
      <p data-testid="outside">outside</p>
    </>,
  )
  const card = container.querySelector(".lit") as HTMLElement
  card.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200, x: 100, y: 100, toJSON: () => ({}) })
  return { card, inner: card.querySelector("p") as HTMLElement, outside: container.querySelector('[data-testid="outside"]') as HTMLElement }
}
const point = (el: Element, x: number, y: number, pointerType = "mouse") => {
  const event = new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y })
  Object.defineProperty(event, "pointerType", { value: pointerType })
  el.dispatchEvent(event)
}

afterEach(() => {
  vi.unstubAllGlobals()
  motion.reduce = false
})

describe("the light on a card", () => {
  test("is where the pointer is, and the card leans a degree or two toward it", () => {
    const { card, inner } = setup()
    point(inner, 250, 125)
    expect(card.style.getPropertyValue("--mx")).toBe("75.0%")
    expect(card.style.getPropertyValue("--my")).toBe("25.0%")
    const [rx, ry] = ["--rx", "--ry"].map((name) => parseFloat(card.style.getPropertyValue(name)))
    expect(rx).toBeGreaterThan(0)
    expect(ry).toBeGreaterThan(0)
    expect(Math.max(Math.abs(rx), Math.abs(ry))).toBeLessThanOrEqual(2)
  })

  test("the card stands straight again when the pointer goes elsewhere", () => {
    const { card, inner, outside } = setup()
    point(inner, 250, 125)
    point(outside, 10, 10)
    expect(card.style.getPropertyValue("--rx")).toBe("")
    expect(card.style.getPropertyValue("--ry")).toBe("")
  })

  test("a finger moves nothing, and a reader who asked for less motion gets the light without the lean", () => {
    const touch = setup()
    point(touch.inner, 250, 125, "touch")
    expect(touch.card.style.getPropertyValue("--mx")).toBe("")
    // the first page is gone, and its listener with it
    cleanup()
    motion.reduce = true
    const still = setup()
    point(still.inner, 250, 125)
    expect(still.card.style.getPropertyValue("--mx")).toBe("75.0%")
    expect(still.card.style.getPropertyValue("--rx")).toBe("")
  })
})
