/**
 * WCAG 2.2 at level AAA over every page of a running site, at three widths,
 * in every look (light, dark, mono and rainbow, lib/theme.ts), and in the
 * states a page load never shows: the cookie question open, the phone menu
 * open, a question opened, the tabs moved, a cart with something in it.
 *
 * axe-core runs with the A, AA and AAA rules. What axe does not measure is
 * measured in the page (scripts/aaa-checks.mjs): every word's contrast
 * against the colour really behind it (7:1, 4.5:1 for large text), every
 * target at 44 by 44 (a link in a sentence excepted), running text at 1.5
 * line height and at most 80 characters a line, and, Tab by Tab, a focus
 * ring at least 2px wide at 3:1 on what is round it.
 *
 *   npm run build && npm start          # in one terminal
 *   npm run a11y                        # in another
 *   npm run a11y -- http://localhost:3000 /about /blog/hello
 *
 * Exits non-zero if anything fails, so it can gate a deploy. Needs
 * Playwright and axe, which are not dependencies of the project:
 *
 *   npm i --no-save playwright @axe-core/playwright
 *
 * What axe cannot see is tested elsewhere: the cookie question's and the
 * menu's focus traps, the tabs' arrow keys and the select's typeahead are in
 * tests/dom/.
 */
import "./load-env.mjs"
import { THEMES } from "../lib/theme.ts"
import { drawnGround, measure, ring } from "./aaa-checks.mjs"
import { launch, presets, target } from "./audit-browser.mjs"

const { base: BASE, pages: PAGES } = target()

let AxeBuilder
try {
  ;({ AxeBuilder } = await import("@axe-core/playwright"))
} catch {
  console.error("This needs axe:\n  npm i --no-save playwright @axe-core/playwright")
  process.exit(2)
}

/** WCAG 2.0, 2.1 and 2.2 A, AA and AAA, and axe's own best practices. */
const TAGS = ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"]
/** Tab stops a page's rings are checked at: the header, the page's own
 *  controls and the footer's, on any page the site draws. */
const TABS = 80
const WIDTHS = [
  { width: 320, height: 720 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
]

const browser = await launch()
const failures = []
let scans = 0

/**
 * One pass over some pages: a fresh browser context with the theme and the
 * cookie answer set before the page's own scripts run, then, on each page,
 * whatever `act` does to reach a state, then axe.
 */
async function scan(label, { viewport, theme = "light", consent = "rejected", pages = PAGES, act, rings = false } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" })
  await presets(ctx, { consent, theme })
  const page = await ctx.newPage()
  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 })
    if (act && !(await act(page))) {
      console.log(`skip  ${label} ${path}: nothing to do here`)
      continue
    }
    await page.waitForTimeout(150)
    const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
    scans++
    const found = await page.evaluate(measure)
    found.contrast.push(...(await drawnGround(page, found.drawn)))
    for (const [what, items] of [["contrast under AAA", found.contrast], ["target under 44 by 44", found.targets], ["line spacing", found.spacing], ["line over 80 characters", found.length]]) {
      for (const item of items) {
        failures.push(`${what}: ${label} ${path}: ${item}`)
        console.log(`FAIL ${what}: ${label} ${path}\n     • ${item}`)
      }
    }
    if (rings) {
      const seen = new Set()
      for (let i = 0; i < TABS; i++) {
        await page.keyboard.press("Tab")
        const r = await page.evaluate(ring)
        if (!r || seen.has(r.label)) continue
        seen.add(r.label)
        if (!r.ok) {
          failures.push(`focus ring: ${label} ${path}: ${r.label}: ${r.why}`)
          console.log(`FAIL focus ring: ${label} ${path}\n     • ${r.label}: ${r.why}`)
        }
      }
    }
    for (const v of violations) {
      failures.push(`[${v.impact}] ${v.id}: ${label} ${path}`)
      console.log(`FAIL [${v.impact}] ${v.id}: ${v.help}`)
      console.log(`     ${label} ${path}`)
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`     • ${n.target.join(" ").slice(0, 110)}`)
        console.log(`       ${(n.failureSummary || "").replace(/\s+/g, " ").slice(0, 150)}`)
      }
    }
  }
  await ctx.close()
}

for (const theme of THEMES) {
  // the rings are drawn the same at any width: checked once, on the widest
  for (const viewport of WIDTHS) await scan(`${theme} ${viewport.width}px`, { viewport, theme, rings: viewport === WIDTHS.at(-1) })
}

const phone = WIDTHS[0]
const desktop = WIDTHS[2]

await scan("cookie question open", { viewport: phone, consent: null, pages: ["/"] })
await scan("cookie question open, dark", { viewport: desktop, theme: "dark", consent: null, pages: ["/"] })

await scan("phone menu open", {
  viewport: phone,
  pages: ["/", "/pricing"],
  act: async (page) => {
    // the menu's button is a Radix dialog trigger, whatever its words say
    const button = page.locator('header button[aria-haspopup="dialog"]').first()
    if (!(await button.isVisible())) return false
    await button.click()
    await page.getByRole("dialog").waitFor()
    return true
  },
})

await scan("a question open", {
  viewport: desktop,
  pages: ["/questions", "/pricing"],
  act: async (page) => {
    const summary = page.locator("details > summary").first()
    if (!(await summary.count())) return false
    await summary.click()
    return true
  },
})

await scan("tabs moved", {
  viewport: desktop,
  pages: ["/features"],
  act: async (page) => {
    const tab = page.getByRole("tab").first()
    if (!(await tab.count())) return false
    await tab.focus()
    await page.keyboard.press("ArrowRight")
    return true
  },
})

await scan("a cart with something in it", {
  viewport: phone,
  theme: "dark",
  pages: ["/shop"],
  act: async (page) => {
    const product = page.locator('main a[href^="/shop/"]:not([href^="/shop/collection"])').first()
    if (!(await product.count())) return false
    // loaded by its address: a click navigates on the client, and the page
    // would be read before it had drawn
    await page.goto(BASE + (await product.getAttribute("href")), { waitUntil: "networkidle" })
    const add = page.locator('main form button[type="submit"]').first()
    if (!(await add.count())) return false
    await add.click()
    await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" })
    return true
  },
})

await browser.close()

if (failures.length) {
  console.log(`\n${failures.length} failure(s) in ${scans} scans.`)
  process.exit(1)
}
console.log(`\nNo violations in ${scans} scans.`)
