/**
 * Every page of a running site at five widths, from a small phone to a wide
 * desktop, checked for the three faults a layout makes as the screen
 * narrows, with a screenshot of each for a person to look at:
 *
 * - **overflow**: anything wider than the screen, which makes the whole page
 *   scroll sideways (WCAG 1.4.10, reflow). Something that scrolls inside its
 *   own box, as a wide table does, is fine.
 * - **clipped text**: words cut off by a box too small for them. Text cut
 *   short on purpose (an ellipsis, a line clamp) or hidden for screen
 *   readers is fine.
 * - **small targets**: a control smaller than 44 by 44 pixels (WCAG 2.5.5,
 *   level AAA; min-h-target and min-w-target in tailwind.config.ts).
 *   A link inside a sentence is exempt, as the rule says.
 *
 *   npm run build && npm start               # in one terminal
 *   npm run responsive                        # in another
 *   npm run responsive -- http://localhost:3000 /about /blog/hello
 *
 * Screenshots go to audit/responsive/<width>/ (git-ignored), and at the
 * narrowest and widest in every other look too (<width>-dark/, -mono/,
 * -rainbow/). The faults are looked for in light: the layout is the same in
 * every look. Exits non-zero on any fault.
 */
import "./load-env.mjs"
import { mkdir } from "node:fs/promises"
import path from "node:path"

import { THEMES } from "../lib/theme.ts"
import { fileName, launch, loadPictures, presets, target } from "./audit-browser.mjs"

const { base: BASE, pages: PAGES } = target()
const WIDTHS = [320, 375, 768, 1024, 1440]
const OUT = path.resolve("audit/responsive")

const browser = await launch()
const faults = []

/** Runs in the page: what is wrong with the layout at this width. */
function inspect() {
  const width = document.documentElement.clientWidth
  const found = []
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : ""
    const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : ""
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)
    return `<${el.tagName.toLowerCase()}${id}${cls}>${text ? ` "${text}"` : ""}`
  }
  const hidden = (el) => {
    for (let node = el; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.display === "none" || style.visibility === "hidden" || node.getAttribute("aria-hidden") === "true") return true
      // a screen reader's text: one clipped pixel, on purpose
      if (style.position === "absolute" && node.clientWidth <= 1 && node.clientHeight <= 1) return true
    }
    return false
  }
  /** inside a box that scrolls sideways, or a drawer off screen */
  const contained = (el) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) return true
    }
    return false
  }

  if (document.documentElement.scrollWidth > width + 1) {
    const wide = [...document.body.querySelectorAll("*")].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.right > width + 1 || r.left < -1) && !hidden(el) && !contained(el) && getComputedStyle(el).position !== "fixed"
    })
    // the outermost offenders, which explain the rest
    const outer = wide.filter((el) => !wide.some((other) => other !== el && other.contains(el)))
    found.push(...outer.slice(0, 5).map((el) => `overflow: ${describe(el)} reaches ${Math.round(el.getBoundingClientRect().right)}px of ${width}`))
    if (!outer.length) found.push(`overflow: the page is ${document.documentElement.scrollWidth}px wide at ${width}`)
  }

  for (const el of document.body.querySelectorAll("*")) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (!own || hidden(el)) continue
    const style = getComputedStyle(el)
    if (!/(hidden|clip)/.test(style.overflowX + style.overflowY)) continue
    if (style.textOverflow === "ellipsis" || (style.webkitLineClamp && style.webkitLineClamp !== "none")) continue
    if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) found.push(`clipped: ${describe(el)}`)
  }

  const TARGETS = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="checkbox"], [role="radio"]'
  for (const el of document.querySelectorAll(TARGETS)) {
    if (hidden(el) || el.closest("[inert]")) continue
    // a radio or checkbox hidden for a drawn one: its label is the target
    const box = el.matches('input[type="radio"], input[type="checkbox"]') && el.closest("label") ? el.closest("label") : el
    // a card's link whose ::after covers the card is pressed anywhere on it
    const after = getComputedStyle(box, "::after")
    const r = (after.content !== "none" && after.position === "absolute" && box.offsetParent ? box.offsetParent : box).getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const style = getComputedStyle(box)
    // a link in a sentence: exempt (2.5.5's inline exception)
    if (style.display === "inline" && box.parentElement && (box.parentElement.textContent || "").trim().length > (box.textContent || "").trim().length + 2) continue
    if (r.width < 44 || r.height < 44) found.push(`small target: ${describe(box)} is ${Math.round(r.width)}×${Math.round(r.height)}`)
  }
  return [...new Set(found)]
}

for (const width of WIDTHS) {
  for (const theme of width === WIDTHS[0] || width === WIDTHS[WIDTHS.length - 1] ? THEMES : ["light"]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" })
    await presets(ctx, { consent: "rejected", theme })
    const page = await ctx.newPage()
    const dir = path.join(OUT, `${width}${theme === "light" ? "" : `-${theme}`}`)
    await mkdir(dir, { recursive: true })
    for (const p of PAGES) {
      await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 30000 })
      await page.evaluate(() => document.fonts.ready)
      if (theme === "light") {
        for (const fault of await page.evaluate(inspect)) {
          faults.push(`${width}px ${p}: ${fault}`)
          console.log(`FAIL ${width}px ${p}: ${fault}`)
        }
      }
      // so the screenshot shows what a reader scrolling would see
      await loadPictures(page)
      await page.screenshot({ path: path.join(dir, `${fileName(p)}.png`), fullPage: true })
    }
    await ctx.close()
  }
}

await browser.close()
console.log(`\nScreenshots: ${path.relative(process.cwd(), OUT)}/`)
if (faults.length) {
  console.log(`${faults.length} fault(s) across ${PAGES.length} pages at ${WIDTHS.length} widths.`)
  process.exit(1)
}
console.log(`No faults across ${PAGES.length} pages at ${WIDTHS.length} widths.`)
