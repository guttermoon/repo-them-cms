/**
 * WCAG's contrast arithmetic, in one place: the contrast test reads the
 * design's colours with it (tests/contrast.test.mjs), and the code
 * highlighter uses it to lift any colour a theme sets too faint for its
 * ground (lib/highlight.ts).
 *
 * Imports nothing, so `npm test` loads it.
 */
export type Rgb = [number, number, number]

/**
 * The lines the site's colours are held to: WCAG 2.2 at level AAA. Text
 * reads at 7:1 on its ground (1.4.6), and large text (24px, or 19px bold:
 * the titles) at 4.5:1. A control's edge and a focus ring stand out at 3:1
 * from what is round them (1.4.11, 2.4.13).
 */
export const TEXT_MIN = 7
export const LARGE_TEXT_MIN = 4.5
export const EDGE_MIN = 3

/** "#rrggbb", "rrggbb" or "#rgb" as channels; null when it is none of them. */
export function hexToRgb(hex: string): Rgb | null {
  const h = hex.trim().replace(/^#/, "")
  const full = /^[0-9a-f]{3}$/i.test(h) ? h.replace(/./g, (c) => c + c) : h.slice(0, 6)
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb
}

export const rgbToHex = (rgb: Rgb): string => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`

/** Relative luminance, as WCAG defines it. */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** The contrast ratio of two colours, 1 to 21. */
export function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** A colour laid over another at an opacity, as the browser paints it. */
export const blend = (top: Rgb, alpha: number, ground: Rgb): Rgb => top.map((c, i) => c * alpha + ground[i] * (1 - alpha)) as Rgb

/**
 * The colour, moved as little as it takes towards black (on a light ground)
 * or white (on a dark one) to reach `min` against the ground. A colour that
 * already does is returned as it was, so a theme keeps its own look wherever
 * it can.
 */
export function readable(colour: Rgb, ground: Rgb, min = TEXT_MIN): Rgb {
  if (ratio(colour, ground) >= min) return colour
  const target: Rgb = luminance(ground) > 0.18 ? [0, 0, 0] : [255, 255, 255]
  for (let step = 1; step <= 100; step++) {
    const moved = blend(target, step / 100, colour).map(Math.round) as Rgb
    if (ratio(moved, ground) >= min) return moved
  }
  return target
}
