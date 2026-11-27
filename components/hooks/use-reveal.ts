"use client"

import { useEffect, type RefObject } from "react"

/**
 * Bring a form's outcome into view once there is one, for the contact form
 * and the newsletter form.
 *
 * Without it the answer is easy to miss: a couple of lines replace a form
 * several screens tall, so the document suddenly gets much shorter while the
 * browser keeps the old scroll offset, now past the end of the content, and
 * the reader is left at the foot of the page to scroll back up and find out
 * what happened. Focus moves too, so a screen reader announces it.
 * `preventScroll` matters: focus() scrolls by default, which would fight the
 * smooth scroll and land the page somewhere else. Under reduced motion it
 * jumps rather than glides.
 *
 * `outcome` is whatever says there is something to show (done, an error);
 * nothing happens while it is empty, or if the element is not on the page.
 */
export function useRevealOutcome(
  ref: RefObject<HTMLElement | null>,
  outcome: unknown,
  error: unknown,
): void {
  useEffect(() => {
    if (!outcome && !error) return
    const el = ref.current
    if (!el) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" })
    el.focus({ preventScroll: true })
  }, [ref, outcome, error])
}
