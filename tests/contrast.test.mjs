// WCAG 2.2 AAA contrast, for every pairing of text and ground the design
// uses, in every look (lib/theme.ts), read from the tokens in
// app/globals.css: 7:1 for text and 4.5:1 for the titles, which are large
// text (TEXT_MIN and LARGE_TEXT_MIN in lib/contrast.ts), and 3:1 for the
// edges of controls and for focus rings on every ground a control sits on.
// A colour changed in the stylesheet that drops a pairing below its line
// fails here, not in a reader's eyes. So does a look added to lib/theme.ts
// without its block of tokens, and a mono that lets a hue in.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { MARK_BRAND, MARK_TINT } from "../lib/brand/mark.ts"
import { EDGE_MIN, LARGE_TEXT_MIN, TEXT_MIN, blend, hexToRgb, luminance, ratio, readable } from "../lib/contrast.ts"
import { BUNDLED_LANGUAGES, CODE_COLOUR, CODE_GROUNDS, highlight, lookOf, readableColours } from "../lib/highlight.ts"
import { THEMES } from "../lib/theme.ts"
import { sources } from "./support/sources.mjs"

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")

/** The body of the first block that opens with `selector {`. */
function block(selector) {
  const start = css.indexOf(`${selector} {`)
  assert.ok(start >= 0, `no ${selector} block`)
  return css.slice(start, css.indexOf("\n}", start))
}

/** The custom properties declared in a block. */
const tokens = (selector) => Object.fromEntries([...block(selector).matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))

const selectorOf = (theme) => (theme === "light" ? ":root" : `:root[data-theme="${theme}"]`)
const light = tokens(":root")
/** Each look's tokens: light's, with the look's own block over them. */
const LOOKS = Object.fromEntries(THEMES.map((theme) => [theme, theme === "light" ? light : { ...light, ...tokens(selectorOf(theme)) }]))

/** A token as [r, g, b]: "40 63 166" channels or a #hex. */
function rgb(theme, name) {
  const value = theme[name]
  assert.ok(value, `--${name} is not set`)
  if (value.startsWith("#")) return hexToRgb(value)
  const parts = value.split(/\s+/).map(Number)
  assert.equal(parts.length, 3, `--${name} is not a colour: ${value}`)
  return parts
}

/** Hue (0–360) and HSL saturation (0–1) of a colour. */
function hueSat([r, g, b]) {
  const [x, y, z] = [r / 255, g / 255, b / 255]
  const max = Math.max(x, y, z)
  const min = Math.min(x, y, z)
  const d = max - min
  const l = (max + min) / 2
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  if (d === 0) return [0, 0]
  const h = max === x ? ((y - z) / d) % 6 : max === y ? (z - x) / d + 2 : (x - y) / d + 4
  return [(h * 60 + 360) % 360, sat]
}

/** Text on grounds, as the components use them. */
const TEXT = [
  ["c-ink", "c-page"],
  ["c-sub", "c-page"],
  ["c-ink", "c-wash"],
  ["c-sub", "c-wash"],
  ["c-ink", "c-card"],
  ["c-sub", "c-card"],
  ["c-ink", "c-panel"],
  ["c-sub", "c-panel"],
  ["c-ink", "c-panel-strong"],
  ["c-sub", "c-panel-strong"],
  ["c-strong", "c-page"],
  ["c-strong", "c-wash"],
  ["c-strong", "c-card"],
  ["c-strong", "c-panel"],
  ["c-strong", "c-panel-strong"],
  ["c-heading", "c-page"],
  ["c-heading", "c-panel"],
  ["c-heading", "c-panel-strong"],
  ["c-accent", "c-page"],
  ["c-accent", "c-wash"],
  ["c-accent", "c-panel"],
  ["c-btn-ink", "c-btn"],
  ["c-btn-ink", "c-btn-hover"],
  ["c-cta-ink", "c-cta"],
  ["c-cta-ink", "c-cta-hover"],
  ["c-brand", "c-tint"],
]
/** Every ground a control sits on, so a focus ring is seen round it there. */
const CONTROL_GROUNDS = ["c-page", "c-wash", "c-card", "c-panel", "c-panel-strong"]
/** Edges that must be seen: the focus ring on every ground a control sits
 *  on, the secondary button's edge and the main button against the page. */
const EDGES = [
  ...CONTROL_GROUNDS.map((ground) => ["c-accent", ground]),
  ["c-strong", "c-page"],
  ["c-btn", "c-page"],
]
/** Where a title can sit: the page, a card, a panel of either strength, a wash. */
const TITLE_GROUNDS = ["c-page", "c-card", "c-panel", "c-panel-strong", "c-wash"]
const NOTION = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]

test("every look in lib/theme.ts has its block of tokens, and every block is a look", () => {
  const blocks = [...css.matchAll(/^:root\[data-theme="([\w-]+)"\] \{/gm)].map(([, name]) => name)
  assert.deepEqual(blocks.sort(), THEMES.filter((t) => t !== "light").sort())
  assert.equal(THEMES[0], "light", "light is :root, the look before any script runs")
})

for (const [theme, values] of Object.entries(LOOKS)) {
  test(`${theme}: every text colour on every ground it sits on is at least 7:1`, () => {
    for (const [fg, bg] of TEXT) {
      const r = ratio(rgb(values, fg), rgb(values, bg))
      assert.ok(r >= TEXT_MIN, `${theme}: --${fg} on --${bg} is ${r.toFixed(2)}:1`)
    }
  })

  test(`${theme}: focus rings stand out on every ground a control sits on, and the buttons from the page, at 3:1`, () => {
    for (const [fg, bg] of EDGES) {
      const r = ratio(rgb(values, fg), rgb(values, bg))
      assert.ok(r >= EDGE_MIN, `${theme}: --${fg} against --${bg} is ${r.toFixed(2)}:1`)
    }
  })

  test(`${theme}: Notion's nine colours read on the page, and the ink reads on their backgrounds and tags`, () => {
    for (const colour of NOTION) {
      const text = ratio(rgb(values, `n-${colour}`), rgb(values, "c-page"))
      assert.ok(text >= TEXT_MIN, `${theme}: --n-${colour} on the page is ${text.toFixed(2)}:1`)
      const back = ratio(rgb(values, "c-ink"), rgb(values, `n-${colour}-bg`))
      assert.ok(back >= TEXT_MIN, `${theme}: the ink on --n-${colour}-bg is ${back.toFixed(2)}:1`)
      const tag = ratio(rgb(values, "c-ink"), rgb(values, `n-${colour}-tag`))
      assert.ok(tag >= TEXT_MIN, `${theme}: the ink on --n-${colour}-tag is ${tag.toFixed(2)}:1`)
    }
  })

  test(`${theme}: inline code's red reads on its tint`, () => {
    // .n-code-inline: rgba(135, 131, 120, 0.15) over the page
    const tint = blend([135, 131, 120], 0.15, rgb(values, "c-page"))
    const r = ratio(rgb(values, "n-code-ink"), tint)
    assert.ok(r >= TEXT_MIN, `${theme}: inline code is ${r.toFixed(2)}:1`)
  })
}

test("words on a picture read in every look: on the veil over the lightest picture there is, and the buttons stand out on the darkest", () => {
  // .on-picture's tokens are declared on the hero itself, so they win over
  // every look's; the picture, not the look, is the ground there
  const onPicture = { ...light, ...tokens(".on-picture") }
  const alpha = Number(/\.picture-veil\s*\{\s*background:\s*rgb\(var\(--c-veil\)\s*\/\s*([\d.]+)\)/.exec(css)?.[1])
  assert.ok(alpha > 0 && alpha < 1, `the veil's alpha: ${alpha}`)
  const veil = rgb(onPicture, "c-veil")
  const lightest = blend(veil, alpha, [255, 255, 255])
  const darkest = blend(veil, alpha, [0, 0, 0])
  for (const name of ["c-ink", "c-sub", "c-strong", "c-heading"]) {
    const r = ratio(rgb(onPicture, name), lightest)
    assert.ok(r >= TEXT_MIN, `--${name} on the veil over white is ${r.toFixed(2)}:1`)
  }
  // the focus ring, and a button's edge, on the lightest picture and the darkest
  for (const name of ["c-accent", "c-btn", "c-cta", "c-strong"]) {
    for (const [ground, what] of [[lightest, "white"], [darkest, "black"]]) {
      const r = ratio(rgb(onPicture, name), ground)
      assert.ok(r >= EDGE_MIN, `--${name} against the veil over ${what} is ${r.toFixed(2)}:1`)
    }
  }
  for (const [fg, bg] of [["c-btn-ink", "c-btn"], ["c-btn-ink", "c-btn-hover"], ["c-cta-ink", "c-cta"], ["c-cta-ink", "c-cta-hover"], ["c-ink", "c-wash"]]) {
    const r = ratio(rgb(onPicture, fg), rgb(onPicture, bg))
    assert.ok(r >= TEXT_MIN, `--${fg} on --${bg} on a picture is ${r.toFixed(2)}:1`)
  }
  // every colour a look gives the words and buttons is set again on a
  // picture, so no look's own colour reaches a word there
  for (const name of ["c-ink", "c-sub", "c-strong", "c-heading", "c-accent", "c-wash", "c-btn", "c-btn-hover", "c-btn-ink", "c-cta", "c-cta-hover", "c-cta-ink"]) {
    assert.ok(Object.hasOwn(tokens(".on-picture"), name), `--${name} is not set in .on-picture`)
  }
})

test("every focus ring is the one width, at least 2px, in the accent: in the stylesheet and in every component that draws its own", async () => {
  const width = /--focus-ring:\s*(\d+(?:\.\d+)?)px;/.exec(block(":root"))?.[1]
  assert.ok(Number(width) >= 2, `--focus-ring is ${width}px; WCAG 2.4.13 asks for 2px at least`)
  const outlines = [...css.matchAll(/outline:\s*([^;]+);/g)].map(([, value]) => value.trim())
  assert.ok(outlines.length >= 2, "the rings were not found")
  for (const value of outlines.filter((v) => !/^none$|transparent/.test(v))) {
    assert.equal(value, "var(--focus-ring) solid rgb(var(--c-accent))", `a ring of its own: outline: ${value}`)
  }
  for (const { path: file, text: source } of sources(["components", "app"], /\.tsx$/)) {
    // a width typed into a component's ring, rather than the one token
    for (const [utility] of source.matchAll(/(?:focus|focus-visible|focus-within|peer-focus-visible|group-focus-visible):outline-(?:\d+|\[[^\]]*px\])(?=[\s"'`])/g)) {
      assert.fail(`${file}: ${utility} is a ring of its own width; use outline-focus`)
    }
  }
})

test("inline code is drawn on its tint", () => {
  assert.match(css, /\.n-code-inline \{[^}]*color: var\(--n-code-ink\);[^}]*background: rgba\(135, 131, 120, 0\.15\);/)
})

test("the label's two blues are the ones the brand names, and the mark on the page in light is the favicon's", () => {
  assert.deepEqual(rgb(LOOKS.light, "c-brand"), [0x28, 0x3f, 0xa6])
  assert.deepEqual(rgb(LOOKS.light, "c-tint"), [0xe6, 0xea, 0xf9])
  // components/ui/label.tsx draws the mark with the tokens; the favicon and
  // the share cards with MARK_BRAND and MARK_TINT
  assert.deepEqual(rgb(LOOKS.light, "c-brand"), hexToRgb(MARK_BRAND))
  assert.deepEqual(rgb(LOOKS.light, "c-tint"), hexToRgb(MARK_TINT))
  const label = readFileSync(new URL("../components/ui/label.tsx", import.meta.url), "utf8")
  assert.match(label, /className="fill-tint stroke-brand"/)
  assert.match(label, /d=\{MARK_R_PATH\} className="fill-brand"/)
})

test("dark glows in the dark: a green-black page, and the band, the mark, the titles and the buttons in one phosphor green", () => {
  const glow = rgb(LOOKS.dark, "c-glow")
  const [hue, sat] = hueSat(glow)
  assert.ok(hue > 120 && hue < 160 && sat > 0.8, `the glow is not a green (hue ${hue.toFixed(0)}, saturation ${sat.toFixed(2)})`)
  for (const name of ["c-brand", "c-heading", "c-btn"]) assert.deepEqual(rgb(LOOKS.dark, name), glow, `--${name} is not the glow`)
  const [pageHue] = hueSat(rgb(LOOKS.dark, "c-page"))
  assert.ok(pageHue > 100 && pageHue < 170, "the page is not a dark green")
  assert.ok(luminance(rgb(LOOKS.dark, "c-page")) < 0.01, "the page is not dark")
  // each thing that glows has its rule, and Notion's badge is never tinted
  for (const selector of [".title-slab", ".stripe", ".mark", ".bg-btn", ".bg-cta", ".text-accent", ".cookie-bag-shadow"]) {
    assert.ok(css.includes(`:root[data-theme="dark"] ${selector} {`), `nothing glows on ${selector}`)
  }
  // pictures glow green, but never the goods for sale: a buyer sees what they would buy
  assert.match(css, /:root\[data-theme="dark"\] :is\(img, video, svg\[role="img"\]\):not\(\[data-badge\] \*, \[data-goods\], \[data-goods\] \*, \.cover-tint \*, \[data-untinted\] \*, \.dark\\:invert\) \{\s*filter:[^;]*hue-rotate/)
  assert.match(css, /:root\[data-theme="dark"\] img\.dark\\:invert \{\s*filter: invert\(1\)/, "an inverted logo loses its inversion")
})

test("light has one temperature: every ground it fills with leans to the label's blue, none to Notion's warm grey", () => {
  for (const name of ["c-wash", "c-well", "c-panel", "c-panel-strong", "c-tint"]) {
    const [r, , b] = rgb(LOOKS.light, name)
    assert.ok(b > r, `--${name} is warm (${rgb(LOOKS.light, name).join(" ")})`)
  }
})

test("light's words are two inks far apart: near-black to read, and the lightest grey that still passes beside it", () => {
  const ink = rgb(LOOKS.light, "c-ink")
  const sub = rgb(LOOKS.light, "c-sub")
  assert.ok(luminance(ink) < 0.012, `the words are not black enough (${ink.join(" ")})`)
  // the grey's darkest ground decides it: 7:1 there, and not much more
  const worst = Math.min(...["c-page", "c-wash", "c-card", "c-panel", "c-panel-strong"].map((ground) => ratio(sub, rgb(LOOKS.light, ground))))
  assert.ok(worst >= TEXT_MIN, `the grey reads at ${worst.toFixed(2)}:1 on its darkest ground`)
  assert.ok(worst < TEXT_MIN + 0.25, `the grey is darker than it needs to be (${worst.toFixed(2)}:1 where ${TEXT_MIN} is enough), so it reads as heavy beside the black`)
  // and the two stay two tiers: the black reads well past the grey
  assert.ok(ratio(ink, rgb(LOOKS.light, "c-page")) > 2 * TEXT_MIN, "the black is not far enough from the grey")
})

test("dark keeps a little of the label's blue: the accent is the main blue lifted to read, the accent button the main blue itself", () => {
  const main = rgb(LOOKS.light, "c-brand")
  assert.deepEqual(rgb(LOOKS.dark, "c-cta"), main, "the accent button is not the main blue")
  const [mainHue] = hueSat(main)
  const [hue, sat] = hueSat(rgb(LOOKS.dark, "c-accent"))
  assert.ok(Math.abs(hue - mainHue) < 3 && sat > 0.8, `the accent is not the main blue's hue (${hue.toFixed(0)} against ${mainHue.toFixed(0)})`)
  // a little: the titles, the band, the mark and the main button stay green
  const blue = (name) => Math.abs(hueSat(rgb(LOOKS.dark, name))[0] - mainHue) < 30
  assert.deepEqual(
    ["c-accent", "c-cta", "c-brand", "c-heading", "c-btn", "c-strong", "c-ink"].filter(blue),
    ["c-accent", "c-cta"],
  )
  // its halo is its own colour, not the green
  assert.match(css, /:root\[data-theme="dark"\] \.bg-cta \{\s*box-shadow:[^;]*--c-accent/)
})

test("mono is black, white and grey: every colour in its block has r = g = b", () => {
  const body = block(selectorOf("mono"))
  const colours = [
    ...[...body.matchAll(/--[\w-]+:\s*(\d+) (\d+) (\d+);/g)].map(([, r, g, b]) => [r, g, b].map(Number)),
    ...[...body.matchAll(/#([0-9a-f]{6})\b/gi)].map(([hex]) => hexToRgb(hex)),
    ...[...body.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map(([, r, g, b]) => [r, g, b].map(Number)),
  ]
  assert.ok(colours.length >= 40, `only ${colours.length} colours found to check`)
  for (const [r, g, b] of colours) assert.ok(r === g && g === b, `mono has a hue: ${r} ${g} ${b}`)
  // and every token light sets that carries a colour is set again here, so none leaks through from light
  for (const [name, value] of Object.entries(light)) {
    if (/^(c|n)-/.test(name) && !value.startsWith("var(") && name !== "c-surface") assert.ok(name in tokens(selectorOf("mono")), `mono inherits --${name} from light`)
  }
  // its pictures are drawn in grey, all but Notion's badge and the goods for sale, which are left unaltered
  assert.match(css, /:root\[data-theme="mono"\] :is\(img, svg, video\):not\(\[data-badge\] \*, \[data-goods\], \[data-goods\] \*, \.cover-tint \*\) \{\s*filter: grayscale\(1\);/)
})

test("a cover is printed in its look's one ink: the label's blue, the deep green, grey, the accent", () => {
  const tone = { light: "var(--c-brand)", dark: "var(--c-tint)", mono: "var(--c-ink)", rainbow: "var(--c-accent)" }
  for (const [look, value] of Object.entries(tone)) assert.equal(LOOKS[look]["c-tone"], value, `${look}'s covers are not printed in ${value}`)
  // the photograph's light and dark, the look's colour: and nothing else's filter on top
  assert.match(css, /\.cover-tint \{\s*background: rgb\(var\(--c-tone\)\);/)
  assert.match(css, /\.cover-tint > img:not\(\[data-goods\], \[data-goods\] \*\) \{\s*mix-blend-mode: luminosity;/)
  assert.match(css, /@media \(forced-colors: active\) \{\s*\.cover-tint > img:not\(\[data-goods\], \[data-goods\] \*\) \{\s*mix-blend-mode: normal;/)
})

test("the goods for sale are shown as uploaded in every look: no rule that changes a picture's colours reaches one", () => {
  // every rule that sets a filter on pictures, in any look: one that alters
  // colour (anything but a shadow) must pass by data-goods and what is in it
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])
  const tinting = rules.filter(([selector, body]) => /(^|[\s(,])(img|video|svg)\b/.test(selector) && /filter:\s*(?!drop-shadow\([^)]*\)\s*;)(?!none)[^;]*(grayscale|sepia|hue-rotate|saturate|invert|brightness|contrast)/.test(body))
  assert.ok(tinting.length >= 2, "the looks' picture rules were not found")
  for (const [selector] of tinting) {
    // a logo drawn inverted is a class of its own, never goods
    if (/^:root\[data-theme="\w+"\] img\.dark\\:invert$/.test(selector)) continue
    assert.match(selector, /:not\([^)]*\[data-goods\], \[data-goods\] \*/, `${selector} tints the goods for sale`)
  }
})

test("rainbow is a rainbow: the band's stops go round the colour wheel, bright", () => {
  const band = Object.keys(LOOKS.rainbow)
    .filter((name) => /^c-band-\d+$/.test(name))
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)))
    .map((name) => hueSat(rgb(LOOKS.rainbow, name)))
  assert.ok(band.length >= 6, `${band.length} stops in the band`)
  for (const [hue, sat] of band) assert.ok(sat >= 0.6, `a band stop is washed out (hue ${hue.toFixed(0)}, saturation ${sat.toFixed(2)})`)
  const hues = band.map(([hue]) => Math.round(hue / 30))
  assert.ok(new Set(hues).size >= 6, "at least six different hues")
  // the rule draws every stop, in order
  const rule = css.slice(css.indexOf(':root[data-theme="rainbow"] .stripe {'), css.indexOf("}", css.indexOf(':root[data-theme="rainbow"] .stripe {')))
  assert.deepEqual([...rule.matchAll(/--c-band-(\d+)/g)].map(([, n]) => Number(n)), band.map((_, i) => i + 1))
})

/** sRGB channels → OKLCH, and back (clipped into sRGB as a browser draws it). */
const toLinear = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4)
const fromLinear = (c) => Math.round(Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)) * 255)
function toOklch(colour) {
  const [r, g, b] = colour.map(toLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const [L, A, B] = [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360]
}
function fromOklch([L, C, H]) {
  const [A, B] = [C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(fromLinear)
}
/** The colours a browser paints between two stops: mixed in sRGB, and in OKLCH the shorter way round. */
function* between(a, b, steps = 50) {
  const [p, q] = [toOklch(a), toOklch(b)]
  const turn = ((q[2] - p[2] + 540) % 360) - 180
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    yield a.map((c, k) => Math.round(c + (b[k] - c) * t))
    yield fromOklch([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, (p[2] + turn * t + 360) % 360])
  }
}

test("rainbow's titles: every colour of the rainbow a title is cut from, stops and the mix between them, reads on every ground a title sits on, as large text", () => {
  const at = css.indexOf(':root[data-theme="rainbow"] .title-slab:not(.title-solid) {')
  assert.ok(at > 0, "the rainbow title rule")
  const rule = css.slice(at, css.indexOf("}", at))
  // two gradients, sRGB first and OKLCH over it where the browser can, with the same stops
  const gradients = rule.split("background-image:").slice(1)
  assert.equal(gradients.length, 2)
  assert.match(gradients[1], /^\s*linear-gradient\(\s*to right in oklch,/)
  const sequence = gradients.map((gradient) => [...gradient.matchAll(/var\(--(c-title-\d+)\)/g)].map(([, name]) => name))
  assert.deepEqual(sequence[1], sequence[0])
  const stops = sequence[0]
  const declared = Object.keys(LOOKS.rainbow).filter((name) => /^c-title-\d+$/.test(name))
  assert.ok(declared.length >= 5, `${declared.length} stops`)
  assert.deepEqual([...new Set(stops)].sort(), declared.sort(), "every stop declared is drawn")
  // the tile ends where it starts, so repeated it has no seam
  assert.equal(stops.at(-1), stops[0])
  assert.match(rule, /background-repeat: repeat-x;/)
  for (const ground of TITLE_GROUNDS) {
    const floor = rgb(LOOKS.rainbow, ground)
    for (let i = 0; i < stops.length - 1; i++) {
      for (const colour of between(rgb(LOOKS.rainbow, stops[i]), rgb(LOOKS.rainbow, stops[i + 1]))) {
        const r = ratio(colour, floor)
        assert.ok(r >= LARGE_TEXT_MIN, `rainbow: between --${stops[i]} and --${stops[i + 1]}, ${colour.join(" ")} on --${ground} is ${r.toFixed(2)}:1`)
      }
    }
  }
  assert.match(css.slice(css.lastIndexOf("@media", at), at), /^@media \(forced-colors: none\) \{\s*$/)
  // the logo strip's names claim one colour, so they opt out
  assert.match(readFileSync(new URL("../components/sections/marketing/proof.tsx", import.meta.url), "utf8"), /title-slab title-solid/)
})

test("the highlighter knows each look's code ground: its --c-wash", () => {
  for (const theme of THEMES) assert.deepEqual(CODE_GROUNDS[theme], rgb(LOOKS[theme], "c-wash"), theme)
  assert.match(css, /\.n-code \{[^}]*bg-wash/)
  // every look but light (whose colours are inline) switches to its own
  for (const theme of THEMES.filter((t) => t !== "light")) {
    assert.ok(css.includes(`[data-theme="${theme}"] .n-code .shiki span {\n    color: var(--shiki-${theme}) !important;`), `no code colours for ${theme}`)
  }
})

test("a faint colour is lifted only as far as it must be, away from its ground; a readable one is left alone", () => {
  const faintRed = hexToRgb("#d73a49")
  const lifted = readable(faintRed, CODE_GROUNDS.light)
  assert.ok(ratio(lifted, CODE_GROUNDS.light) >= TEXT_MIN)
  assert.ok(ratio(lifted, CODE_GROUNDS.light) < TEXT_MIN + 0.4, "darkened no further than it takes")
  assert.ok(lifted[0] < faintRed[0], "towards black on a light ground")
  const greyOnDark = readable(hexToRgb("#6a737d"), CODE_GROUNDS.dark)
  assert.ok(greyOnDark[0] > 0x6a, "towards white on a dark ground")
  assert.deepEqual(readable([0, 0, 0], CODE_GROUNDS.light), [0, 0, 0])
  // only colours are touched: a background, and each look's background, are not
  const pre = '<pre style="background-color:#fff;--shiki-dark-bg:#24292e;--shiki-mono-bg:#f2f2f2;--shiki-rainbow-bg:#fafbfc">'
  assert.equal(readableColours(pre), pre)
})

test("every colour the highlighter prints, in every language it knows, reads on its ground in every look", async () => {
  const SAMPLE = `// a comment\nconst name = "value" + 42 // another\nfunction go(x) { return x ? true : null }\n# heading\n<tag attr="1">text</tag>\nSELECT * FROM t WHERE a = 'b';`
  for (const language of BUNDLED_LANGUAGES) {
    const html = await highlight(SAMPLE, language)
    assert.ok(html, `${language} was not highlighted`)
    const colours = [...html.matchAll(CODE_COLOUR)]
    const looks = new Set(colours.map(([, , prop]) => lookOf(prop)))
    // a pattern that matched nothing would pass this test while checking nothing
    assert.deepEqual([...looks].sort(), [...THEMES].sort(), `${language}: colours for every look`)
    assert.ok(colours.length >= 4 * THEMES.length, `${language}: only ${colours.length} colours found to check`)
    for (const [, , prop, hex] of colours) {
      const look = lookOf(prop)
      const r = ratio(hexToRgb(hex), CODE_GROUNDS[look])
      assert.ok(r >= TEXT_MIN, `${language}: ${prop} ${hex} is ${r.toFixed(2)}:1`)
      if (look === "mono") {
        const [red, green, blue] = hexToRgb(hex)
        assert.ok(red === green && green === blue, `${language}: mono's code has a hue: ${hex}`)
      }
    }
  }
})

test("the code's own words are never recoloured: a colour the code says is what it says", async () => {
  const html = await highlight(`.note { color:#fff; }\nconst css = "color:#ffffff"`, "css")
  assert.ok(html)
  assert.ok(html.includes("#fff;") || html.includes("#fff<"), "the code's #fff is still in it")
  const words = html.replace(/<[^>]*>/g, "")
  assert.ok(words.includes("color:#fff;"), words)
  assert.ok(words.includes('"color:#ffffff"') || words.includes("&#x22;color:#ffffff&#x22;") || words.includes("&quot;color:#ffffff&quot;"), words)
})

test("the arithmetic is WCAG's", () => {
  assert.equal(ratio([0, 0, 0], [255, 255, 255]).toFixed(1), "21.0")
  assert.equal(ratio([255, 255, 255], [255, 255, 255]), 1)
  assert.equal(ratio([0x28, 0x3f, 0xa6], [255, 255, 255]).toFixed(2), "8.93")
})
