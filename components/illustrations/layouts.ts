/**
 * Where the site's own pictures put their packs: the still life on
 * /features (components/illustrations/still-life.tsx) and the pack on
 * /about (components/illustrations/pack.tsx). Numbers only, so
 * tests/packs.test.mjs checks the very layouts the pages draw: the packs
 * evenly spaced on a shelf as deep as they are, and every shadow inside the
 * picture.
 */
import { bounds, grow, shelfLayout, type BagSpec, type BoxSpec, type CanSpec, type CartonSpec, type Rect } from "./geometry"

/** The still life's packs, drawn at the origin: the shelf places them. */
const STILL_PACKS: [BoxSpec, CanSpec, CartonSpec, BagSpec] = [
  { kind: "box", x: 0, y: 0, w: 290, h: 360, d: 110 },
  { kind: "can", x: 0, top: 0, w: 184, h: 214, ry: 17 },
  { kind: "carton", x: 0, y: 0, w: 146, h: 272, d: 84, gable: 50 },
  { kind: "bag", x: 0, y: 0, w: 222, h: 276 },
]

const shelf = shelfLayout(STILL_PACKS, { x: 0, y: 460, inset: 4, margin: 8, minGap: 56, lip: 12, pad: 4 })

/** A website box, a blog can, a pages carton and a copy bag on a shelf. */
export const STILL_LIFE = { ...shelf, packs: shelf.packs as [BoxSpec, CanSpec, CartonSpec, BagSpec] }

/** The About page's one box, and a picture just large enough for it and its shadow. */
export const ABOUT_PACK: BoxSpec = { kind: "box", x: 24, y: 74, w: 262, h: 420, d: 120 }

export const ABOUT_VIEWBOX: Rect = grow(bounds(ABOUT_PACK), 4)
