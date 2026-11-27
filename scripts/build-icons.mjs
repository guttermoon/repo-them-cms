/**
 * Draws the site's mark and icons: lib/brand/mark.ts (the mark as data, for
 * the header, the footer and the share cards), the favicon (SVG and ICO),
 * the PNG sizes, a maskable icon and the Apple touch icon. The web manifest
 * that lists them is app/manifest.ts, which names the site as the copy does.
 *
 * The mark is the generic label in miniature: a rounded square with a dark
 * blue rim, a pale blue ground, and a lowercase "r" in Roboto Slab Bold,
 * sitting low and to the left the way a word sits on a box. The "r" is the
 * font's own outline, read from assets/fonts with opentype.js and written
 * out as a path, so the mark draws the same everywhere without the font. It
 * shares nothing with Notion's cube (Notion's brand rules: no part of its
 * logo in yours).
 *
 * Google's favicon rules this follows: square, multiples of 48px, a stable
 * address (freshness comes from Cache-Control in next.config.mjs).
 *
 *   npm i --no-save opentype.js@2.0.0
 *   npm run icons
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import sharp from "sharp"

let opentype
try {
  const module = await import("opentype.js")
  opentype = module.default ?? module
} catch {
  console.error("This needs opentype.js to read the font. Run:\n  npm i --no-save opentype.js@2.0.0\n")
  process.exit(2)
}

export const BRAND = "#283FA6"
export const TINT = "#E6EAF9"
const VIEW = 512
/** The rim: a 30-unit line whose outer edge has an 86-unit radius. */
const RIM = { stroke: 30, radius: 86 }
/** Where the "r" sits, as the reference mark has it: its ink box, in units. */
const GLYPH = { left: 75, top: 110, bottom: 442 }

const fontFile = await readFile("assets/fonts/roboto-slab-latin-700-normal.woff")
const font = opentype.parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength))
const glyph = font.charToGlyph("r")
const box = glyph.getBoundingBox()
const scale = (GLYPH.bottom - GLYPH.top) / (box.y2 - box.y1)
const fontSize = scale * font.unitsPerEm
const x = GLYPH.left - box.x1 * scale
const baseline = GLYPH.bottom + box.y1 * scale
const R_PATH = glyph.getPath(x, baseline, fontSize).toPathData(1)

const inset = RIM.stroke / 2
const rim = `x="${inset}" y="${inset}" width="${VIEW - RIM.stroke}" height="${VIEW - RIM.stroke}" rx="${RIM.radius - inset}"`

/** The mark as an SVG document. `bleed` fills the whole square (no rounded
 *  corners) and shrinks the art into the middle, for the icons a platform
 *  masks itself: Android's adaptive icons and Apple's touch icon. */
function svg(size, { bleed = false } = {}) {
  const art = `<rect ${rim} fill="${TINT}" stroke="${BRAND}" stroke-width="${RIM.stroke}"/><path d="${R_PATH}" fill="${BRAND}"/>`
  const body = bleed ? `<rect width="${VIEW}" height="${VIEW}" fill="${TINT}"/><g transform="translate(${VIEW * 0.1} ${VIEW * 0.1}) scale(0.8)">${art}</g>` : art
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${size}" height="${size}">${body}</svg>`
}

const png = (size, options) => sharp(Buffer.from(svg(size, options))).png({ compressionLevel: 9 }).toBuffer()

/** PNGs packed into a multi-size .ico, which Google and old browsers fetch. */
function ico(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = 6 + entries.length * 16
  const dir = []
  for (const { size, data } of entries) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    dir.push(e)
  }
  return Buffer.concat([header, ...dir, ...entries.map((e) => e.data)])
}

await mkdir("lib/brand", { recursive: true })
await writeFile(
  "lib/brand/mark.ts",
  `/**
 * The mark, as data: written by scripts/build-icons.mjs from the "r" in
 * Roboto Slab Bold (assets/fonts). Do not edit by hand; run \`npm run icons\`.
 * components/ui/mark.tsx draws it; lib/og-card.tsx draws it on share cards.
 * Imports nothing, so the tests and the share cards load it as it is.
 */
export const MARK_VIEWBOX = ${VIEW}
export const MARK_BRAND = "${BRAND}"
export const MARK_TINT = "${TINT}"
/** The rim: a rounded square, stroked, centred on the square's edge. */
export const MARK_RIM = { x: ${inset}, y: ${inset}, size: ${VIEW - RIM.stroke}, radius: ${RIM.radius - inset}, stroke: ${RIM.stroke} } as const
/** The lowercase "r", as the font draws it. */
export const MARK_R_PATH =
  "${R_PATH}"
`,
)
await writeFile("public/favicon.svg", svg(VIEW))
await writeFile("public/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })))))
for (const size of [192, 512]) await writeFile(`public/icon-${size}.png`, await png(size))
await writeFile("public/icon-maskable-512.png", await png(512, { bleed: true }))
await writeFile("public/apple-touch-icon.png", await png(180, { bleed: true }))
console.log("mark written to lib/brand/mark.ts; icons written to public/")
