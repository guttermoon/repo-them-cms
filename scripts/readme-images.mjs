/**
 * The pictures the repository's own page shows, drawn from a running site:
 *
 * - docs/images/home-light.webp and home-dark.webp: the homepage's first
 *   screen, at the top of the README (GitHub picks the one for its reader's
 *   theme);
 * - docs/images/four-looks.webp: the same screen in light, dark, mono and
 *   rainbow, two by two, under the README's "Four looks";
 * - .github/social-preview.png: the homepage's share card (/og), for the
 *   repository's Settings → General → Social preview, which only takes an
 *   upload.
 *
 * Each is drawn at twice the size the README shows it (README_WIDTH), so a
 * retina screen never stretches it, as the site's own pictures are.
 *
 *   npm run build && npm start               # in one terminal
 *   npm run readme-images                     # in another
 *   npm run readme-images -- http://localhost:3000
 *
 * A copy renamed in Notion draws its own: point it at a site connected to
 * the copy's database.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"

import { launch, presets, target } from "./audit-browser.mjs"

const require = createRequire(import.meta.url)
const sharp = require("sharp")

/** How wide the README shows a picture: GitHub's column, in CSS pixels. */
const README_WIDTH = 830
/** The window the homepage is drawn in: a laptop's. */
const VIEW = { width: 1280, height: 800 }
/** The gap between the four looks, left clear so either GitHub theme shows through. */
const GAP = 24

const { base: BASE } = target()
const IMAGES = path.resolve("docs/images")
const PREVIEW = path.resolve(".github/social-preview.png")

const browser = await launch()

/** The homepage's first screen in a look, as PNG bytes at twice its pixels. */
async function shoot(theme) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, reducedMotion: "reduce" })
  // the cookie question answered, so it covers nothing
  await presets(ctx, { consent: "rejected", theme })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" })
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot()
  await ctx.close()
  return png
}

const webp = (input) => sharp(input).webp({ quality: 86, effort: 6 })

/** Corners and hairline, in the pictures' own pixels (twice CSS's): a white
 *  page on GitHub's white would otherwise have no edge. Mid-grey, so the
 *  line shows on either GitHub theme. */
const RADIUS = 16
const LINE = 2

/** A screen, cut to rounded corners and drawn round with a hairline. */
async function framed(png, width) {
  const resized = await sharp(png).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = resized.info
  const inset = LINE / 2
  const shape = (fill, stroke) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${inset}" y="${inset}" width="${w - LINE}" height="${h - LINE}" rx="${RADIUS}" ry="${RADIUS}" fill="${fill}" ${stroke}/></svg>`,
    )
  return sharp(resized.data, { raw: resized.info })
    .composite([
      { input: shape("#fff", ""), blend: "dest-in" },
      { input: shape("none", `stroke="rgb(128,128,128)" stroke-opacity="0.55" stroke-width="${LINE}"`) },
    ])
    .png()
    .toBuffer()
}

try {
  await mkdir(IMAGES, { recursive: true })
  const shots = {}
  for (const theme of ["light", "dark", "mono", "rainbow"]) shots[theme] = await shoot(theme)

  // one look a picture: the README's width, twice over
  const full = README_WIDTH * 2
  for (const theme of ["light", "dark"]) {
    await webp(await framed(shots[theme], full)).toFile(path.join(IMAGES, `home-${theme}.webp`))
  }

  // four looks, two by two: each cell half the column, less half the gap
  const cell = Math.round((full - GAP) / 2)
  const cellHeight = Math.round((cell * VIEW.height) / VIEW.width)
  const cells = await Promise.all(["light", "dark", "mono", "rainbow"].map((theme) => framed(shots[theme], cell)))
  await webp({
    create: { width: cell * 2 + GAP, height: cellHeight * 2 + GAP, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(cells.map((input, i) => ({ input, left: (i % 2) * (cell + GAP), top: Math.floor(i / 2) * (cellHeight + GAP) })))
    .toFile(path.join(IMAGES, "four-looks.webp"))

  // the share card, as the site draws it for its homepage
  const card = await fetch(`${BASE}/og`)
  if (!card.ok) throw new Error(`${BASE}/og answered ${card.status}`)
  await writeFile(PREVIEW, await sharp(Buffer.from(await card.arrayBuffer())).png({ compressionLevel: 9 }).toBuffer())

  for (const file of ["home-light.webp", "home-dark.webp", "four-looks.webp"]) console.log(path.relative(process.cwd(), path.join(IMAGES, file)))
  console.log(path.relative(process.cwd(), PREVIEW), "(upload it: Settings → General → Social preview)")
} finally {
  await browser.close()
}
