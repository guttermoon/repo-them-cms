/**
 * The mark, as data: written by scripts/build-icons.mjs from the "r" in
 * Roboto Slab Bold (assets/fonts). Do not edit by hand; run `npm run icons`.
 * components/ui/mark.tsx draws it; lib/og-card.tsx draws it on share cards.
 * Imports nothing, so the tests and the share cards load it as it is.
 */
export const MARK_VIEWBOX = 512
export const MARK_BRAND = "#283FA6"
export const MARK_TINT = "#E6EAF9"
/** The rim: a rounded square, stroked, centred on the square's edge. */
export const MARK_RIM = { x: 15, y: 15, size: 482, radius: 71, stroke: 30 } as const
/** The lowercase "r", as the font draws it. */
export const MARK_R_PATH =
  "M251.8 442L79.5 442L79.5 389.3L121.7 380.2L121.7 178.1L75 169L75 116L203.6 116L207 156.4L207.6 163.6Q219.6 137.1 237.4 123.6Q255.2 110 279.9 110Q287.7 110 297 111.4Q306.4 112.7 313.6 114.8L304.3 195.9L260.6 193.5Q241.9 192.5 230.3 199.8Q218.7 207 209.7 220.6L209.7 380.2L251.8 389.3"
