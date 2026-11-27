/**
 * Every page of a running site, on a retina screen (twice as many pixels as
 * points), checked for what makes a page look blurred:
 *
 * - **a picture drawn larger than its pixels**: an <img> whose own width or
 *   height, after its crop (object-fit), is less than twice the size it is
 *   drawn at. On a retina screen the browser stretches it, and it blurs.
 *   An SVG is drawn afresh at any size, so it is never at fault.
 * - **text through a filter, or moved by part of a pixel**: words under a
 *   CSS filter, or under a transform (or a translate, rotate or scale) that
 *   leaves them between pixels, are drawn as a picture of themselves and
 *   blur. A perspective alone moves nothing that lies flat, so a card held
 *   in 3D at rest (`.lit`) passes; leaning, it would not.
 *
 *   npm run build && npm start               # in one terminal
 *   npm run sharpness                         # in another
 *   npm run sharpness -- http://localhost:3000 /about /blog/hello
 *
 * Exits non-zero on any fault.
 */
import "./load-env.mjs"

import { launch, loadPictures, presets, target } from "./audit-browser.mjs"
import { inspect } from "./sharpness-inspect.mjs"

const { base: BASE, pages: PAGES } = target()
const WIDTHS = [390, 1440]
const SCALE = 2

const browser = await launch()
const faults = []
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: SCALE, reducedMotion: "reduce" })
  await presets(ctx, { consent: "rejected" })
  const page = await ctx.newPage()
  for (const p of PAGES) {
    await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 })
    await page.evaluate(() => document.fonts.ready)
    await loadPictures(page)
    for (const fault of await page.evaluate(inspect, SCALE)) {
      faults.push(`${width}px ${p}: ${fault}`)
      console.log(`FAIL ${width}px ${p}: ${fault}`)
    }
  }
  await ctx.close()
}
await browser.close()

if (faults.length) {
  console.log(`${faults.length} fault(s) across ${PAGES.length} pages at ${WIDTHS.length} widths, at ${SCALE}× pixels.`)
  process.exit(1)
}
console.log(`Sharp: ${PAGES.length} pages at ${WIDTHS.join(" and ")} wide, at ${SCALE}× pixels.`)
