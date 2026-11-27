#!/usr/bin/env node
/**
 * Does any page contact a third party before a visitor has said yes?
 *
 *   npm run build && npm start        (or npm run dev)
 *   npm run privacy                    (or: node scripts/privacy-audit.mjs <base url>)
 *
 * Opens every page in Chromium three times — as a first-time visitor who has
 * not answered the cookie question, as one who said no, and as one who said
 * yes — scrolls it to the foot, and records every request. It fails if any
 * request leaves the site, in any of the three,
 * if a font comes from anywhere but /_next/static/media, if a page loads no
 * font at all (the faces would have fallen back), if the
 * Content-Security-Policy that refuses outside fonts and stylesheets is
 * missing or refuses anything of ours, if anything reaches PostHog's proxy
 * (/ingest) after a no, or if anything reaches Google Analytics' (/ga) before
 * a yes. After a yes, Google Analytics, where it has a measurement ID, must
 * still talk to nobody but this site.
 *
 * PostHog only runs where it has a key: the live domain, or a build with
 * NEXT_PUBLIC_POSTHOG_KEY set. It drops events from a browser that says it is
 * automated, so this one says it is not.
 */
import { CONSENT_KEY } from "../lib/consent.ts"
import { launch, target } from "./audit-browser.mjs"

// the designed pages, plus any extra paths given after the address (a
// Notion page, a post) so content from Notion is audited too
const { base: BASE, pages: PAGES } = target()

const site = new URL(BASE).host
const problems = []
let ingested = 0
let toGoogle = 0
const browser = await launch()
const userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`

const WHO = { null: "before answering", rejected: "after saying no", accepted: "after saying yes" }
for (const answer of [null, "rejected", "accepted"]) {
  const who = WHO[answer]
  for (const path of PAGES) {
    const context = await browser.newContext({ userAgent })
    if (answer) await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [CONSENT_KEY, answer])
    // an ordinary browser, as far as PostHog can tell (it ignores automation)
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      const brands = navigator.userAgentData?.brands?.map((b) => ({ ...b, brand: b.brand.replace("HeadlessChrome", "Google Chrome") }))
      if (brands) Object.defineProperty(navigator.userAgentData, "brands", { get: () => brands })
    })
    const page = await context.newPage()
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (url.protocol === "data:" || url.protocol === "blob:") return
      if (url.host === site && url.pathname.startsWith("/ingest")) {
        // before an answer as after a no: nothing is counted until a yes
        if (answer !== "accepted") problems.push(`${path} (${who}): sent to PostHog: ${url.pathname}`)
        else ingested++
      }
      if (url.host === site && (url.pathname === "/ga" || url.pathname.startsWith("/ga/"))) {
        if (answer !== "accepted") problems.push(`${path} (${who}): sent to Google Analytics: ${url.pathname}`)
        else toGoogle++
      }
      if (url.host !== site) problems.push(`${path} (${who}): ${request.resourceType()} from ${url.host}: ${url.href}`)
      else if (request.resourceType() === "font" && !url.pathname.startsWith("/_next/static/media/")) {
        problems.push(`${path} (${who}): font from ${url.pathname}`)
      }
    })
    // the policy must refuse outside fonts without refusing anything of ours
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text())) problems.push(`${path} (${who}): ${message.text()}`)
    })
    const response = await page.goto(BASE + path, { waitUntil: "networkidle" })
    const csp = response?.headers()["content-security-policy"] ?? ""
    for (const rule of ["font-src 'self'", "style-src 'self'"]) {
      if (!csp.includes(rule)) problems.push(`${path}: no "${rule}" in its Content-Security-Policy`)
    }
    await page.mouse.wheel(0, 20_000)
    await page.waitForTimeout(400)
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready
      return [...document.fonts].filter((face) => face.status === "loaded").length
    })
    if (!loaded) problems.push(`${path} (${who}): no font loaded`)
    await context.close()
  }
}
await browser.close()

if (problems.length) {
  console.error(`${problems.length} problem(s):\n  ${problems.join("\n  ")}`)
  process.exit(1)
}
console.log(`${PAGES.length} pages, three times each: nothing left ${site}, and every font came from it.`)
console.log(
  ingested
    ? `PostHog ran after a yes (${ingested} requests, all to ${site}/ingest) and sent nothing before an answer or after a no.`
    : `PostHog did not run (no key for ${site}).`,
)
console.log(
  toGoogle
    ? `Google Analytics ran only after a yes (${toGoogle} requests, all to ${site}/ga).`
    : `Google Analytics did not run (no measurement ID in this build), and nothing went to /ga.`,
)
