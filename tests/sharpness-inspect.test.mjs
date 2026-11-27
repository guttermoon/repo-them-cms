// What `npm run sharpness` calls blurred (scripts/sharpness-inspect.mjs),
// held to planted cases in a real browser: a picture drawn larger than its
// pixels on a retina screen, and words a transform leaves between pixels.
// A perspective alone moves nothing that lies flat, so a card held in 3D at
// rest (`.lit`) is sharp; the same card leaning is not.
//
// Playwright is not a dependency of the project (scripts/audit-browser.mjs
// says why): without it, or without its Chromium, this is skipped, and says so.
import { after, test } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"

import { findChromium, launch } from "../scripts/audit-browser.mjs"
import { inspect } from "../scripts/sharpness-inspect.mjs"

const chromium = await findChromium()
const browser = chromium ? await launch(chromium).catch(() => null) : null
const skip = browser ? false : "needs Playwright and its Chromium (npm i --no-save playwright), as npm run sharpness does"
after(() => browser?.close())

/** What inspect finds on a page of `html`, on a screen with two pixels a point. */
async function faults(html) {
  const context = await browser.newContext({ deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.setContent(`<body style="margin:0">${html}</body>`)
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))))
  const found = await page.evaluate(inspect, 2)
  await context.close()
  return found
}

// [what, the CSS on a box of words, whether its words are blurred]
const MOVES = [
  ["a card at rest, held in 3D", "transform: perspective(900px) rotateX(0deg) rotateY(0deg)", false],
  ["a card leaning", "transform: perspective(900px) rotateY(1.6deg)", true],
  ["a card tipped back", "transform: perspective(900px) rotateX(1deg)", true],
  ["half a device pixel along", "transform: translate(0.25px, 0)", true],
  ["whole device pixels along", "transform: translate(1px, 0.5px)", false],
  ["a quarter turn", "transform: rotate(90deg)", false],
  ["grown a little", "transform: scale(1.04)", true],
  ["translate, part of a pixel", "translate: 0.3px 0", true],
  ["translate, whole pixels", "translate: 2px 1px", false],
  ["rotate, a degree", "rotate: 1deg", true],
  ["rotate, a half turn", "rotate: 180deg", false],
  ["rotate, on an axis", "rotate: y 20deg", true],
  ["scale, a little", "scale: 1.04", true],
  ["scale, a flip", "scale: -1 1", false],
  ["translate by half its width, on whole pixels", "translate: 50% 0", false],
  ["translate by a tenth of its width, between pixels", "translate: 10% 0", true],
  ["translate by a quarter of a content box, between pixels", "translate: 0 25%; box-sizing: content-box; padding: 0 0 1px", true],
  ["nothing", "", false],
]

test("words: a transform that leaves them between pixels blurs them; a perspective alone, a whole move, a quarter turn or a flip does not", { skip }, async () => {
  const html = MOVES.map(([, css], i) => `<div style="position:absolute; left:0; top:${i * 40}px; width:301px; height:30px; ${css}"><p>case ${i}</p></div>`).join("")
  const found = await faults(html)
  const wrong = MOVES.flatMap(([what, css, blurred], i) => (found.some((f) => f.includes(`"case ${i}"`)) === blurred ? [] : [`${what} (${css || "none"}) ${blurred ? "was not" : "was"} called blurred`]))
  assert.deepEqual(wrong, [])
})

test("pictures: one drawn larger than half its pixels is blurred on a retina screen; a drawing never is", { skip }, async () => {
  const png = `data:image/png;base64,${(await sharp({ create: { width: 100, height: 100, channels: 3, background: "#283FA6" } }).png().toBuffer()).toString("base64")}`
  const svg = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>').toString("base64")}`
  const found = await faults(
    [
      `<img alt="" src="${png}" style="display:block; width:50px; height:50px">`,
      `<img alt="" src="${png}" style="display:block; width:80px; height:80px">`,
      `<img alt="" src="${svg}" style="display:block; width:400px; height:400px">`,
    ].join(""),
  )
  assert.equal(found.length, 1, found.join("\n"))
  assert.match(found[0], /blurred picture: .* is 100×100, drawn 80×80 \(needs 1\.60× its pixels\)/)
})
