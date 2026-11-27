/**
 * Draws the starter content's pictures (public/demo): the shop's packshots,
 * the team's portraits (each person a pack, not a face) and the posts'
 * covers. They are drawn by scripts/art/demo-pictures.tsx with
 * the same three-dimensional packs as the site's own illustrations, in the
 * site's own lettering, so a new site has pictures that belong to it and
 * none borrowed from anybody else: no photographs, no real packaging,
 * nothing from Notion's cover gallery.
 *
 * Each is drawn at twice its size (a 1200 box becomes 2400 pixels), so no
 * screen shows it larger than its pixels: npm run sharpness checks.
 * `npm run notion:setup` uploads them to Notion; the stand-in Notion serves
 * them.
 *
 *   npm run demo-images        (needs Playwright's Chromium)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require("playwright"))
} catch {
  console.error("Playwright is needed: npm i --no-save playwright && npx playwright install chromium")
  process.exit(2)
}
const sharp = require("sharp")
const { build } = require("esbuild")
const { renderToStaticMarkup } = require("react-dom/server")

const ROOT = process.cwd()
const OUT = path.resolve("public/demo")
const SCALE = 2

// the pictures, compiled where node_modules is in reach so React resolves to this project's copy
const bundle = path.resolve("node_modules/.cache/repo-them/demo-pictures.mjs")
await mkdir(path.dirname(bundle), { recursive: true })
await build({
  entryPoints: ["scripts/art/demo-pictures.tsx"],
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  outfile: bundle,
  external: ["react", "react-dom"],
  tsconfig: "tsconfig.json",
  logLevel: "silent",
})
const { PICTURES } = await import(`${pathToFileURL(bundle).href}?t=${Date.now()}`)

const font = async (file) => `data:font/woff2;base64,${(await readFile(path.resolve("assets/fonts", file))).toString("base64")}`
const FONTS = `
@font-face { font-family: Slab; font-weight: 700; src: url(${await font("roboto-slab-latin-700-normal.woff2")}) format("woff2"); }
@font-face { font-family: Plex; font-weight: 400; src: url(${await font("ibm-plex-mono-latin-400-normal.woff2")}) format("woff2"); }
@font-face { font-family: Inter; font-weight: 400; src: url(${await font("inter-latin-400-normal.woff2")}) format("woff2"); }
@font-face { font-family: Inter; font-weight: 600; src: url(${await font("inter-latin-600-normal.woff2")}) format("woff2"); }
:root { --font-slab: Slab; --font-mono: Plex; --font-sans: Inter; }
* { margin: 0; }
svg { display: block; width: 100%; height: auto; }
`

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
for (const picture of PICTURES) {
  const page = await browser.newPage({ viewport: { width: picture.width, height: picture.height }, deviceScaleFactor: SCALE })
  await page.setContent(`<!doctype html><html><head><style>${FONTS}</style></head><body>${renderToStaticMarkup(picture.element)}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  const png = await page.screenshot({ type: "png", omitBackground: Boolean(picture.clear) })
  await page.close()
  const image = sharp(png)
  const data = picture.file.endsWith(".webp") ? await image.webp({ quality: 90, effort: 6 }).toBuffer() : await image.png({ compressionLevel: 9, palette: true, quality: 100 }).toBuffer()
  const dir = picture.out ? path.resolve(picture.out) : OUT
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, picture.file), data)
  console.log(`${picture.out ?? "public/demo"}/${picture.file}  ${picture.width * SCALE}×${picture.height * SCALE}  ${Math.round(data.length / 1024)} KB`)
}
await browser.close()
void ROOT
