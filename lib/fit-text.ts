/**
 * Words set as large as their line allows: the cookie bag's "cookies", which
 * fills the front of the box from edge to edge on one line. The size is
 * worked out from the words as drawn, since an editor can change them in
 * Notion and the box narrows on a phone.
 *
 * Pure, so `npm test` holds it; the notice measures and applies it.
 */

/** The bounds: below `min` the words wrap rather than shrink further, and
 *  `max` is the size they are measured at, and never pass. */
export const TITLE_FIT = { min: 40, max: 160 } as const

/**
 * The size (in px) at which words that measured `measured` px wide when set
 * at `at` px fill `room` px, kept within the bounds and rounded down, so
 * they never spill over the edge. null when there is nothing to measure (no
 * words, or no layout, as in a test's document).
 */
export function fitSize(measured: number, at: number, room: number, bounds: { min: number; max: number } = TITLE_FIT): number | null {
  if (!(measured > 0) || !(room > 0) || !(at > 0)) return null
  return Math.max(bounds.min, Math.min(bounds.max, Math.floor((at * room) / measured)))
}
