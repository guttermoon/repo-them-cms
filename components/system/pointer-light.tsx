"use client"

import { useEffect } from "react"

/**
 * Tells a card where the pointer is, so its light can follow it and it can
 * lean toward it (`.lit` in app/globals.css reads --mx, --my, --rx, --ry).
 * One listener for the whole page, on the document: a card needs nothing but
 * its class. Only a mouse or a pen moves the light; touch has no hover, and
 * a reader who asked for less motion gets the light but not the lean.
 */
const LEAN = 1.6 // degrees at a card's edge: enough to feel, too little to bend the words

export function PointerLight() {
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)")
    let lit: HTMLElement | null = null
    let frame = 0

    const rest = (card: HTMLElement) => {
      card.style.removeProperty("--rx")
      card.style.removeProperty("--ry")
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(".lit") ?? null
      if (lit && lit !== card) rest(lit)
      lit = card
      if (!card) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect()
        const x = (event.clientX - box.left) / box.width
        const y = (event.clientY - box.top) / box.height
        card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`)
        card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`)
        if (still.matches) return
        card.style.setProperty("--rx", `${((0.5 - y) * 2 * LEAN).toFixed(2)}deg`)
        card.style.setProperty("--ry", `${((x - 0.5) * 2 * LEAN).toFixed(2)}deg`)
      })
    }
    const leave = () => {
      if (lit) rest(lit)
      lit = null
    }
    document.addEventListener("pointermove", move, { passive: true })
    document.documentElement.addEventListener("pointerleave", leave)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("pointermove", move)
      document.documentElement.removeEventListener("pointerleave", leave)
    }
  }, [])
  return null
}
