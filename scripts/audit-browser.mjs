// What the audits (a11y, responsive, sharpness, privacy) share: Playwright
// and its Chromium, the list of pages to visit, a browser set up before a
// page's own scripts run, and a page with every picture loaded.
//
// Playwright is deliberately not a dependency of the project: it needs a
// browser, and making every `npm install` download one for checks nobody runs
// on every commit is a poor trade. Installed locally, or anywhere Node's
// require finds it, it is used.
import { createRequire } from "node:module"

import { CONSENT_KEY, EXAMPLE_CONSENT_KEY } from "../lib/consent.ts"
import { INDEXED_PAGES, UNINDEXED_PAGES } from "../lib/nav.ts"
import { THEME_KEY } from "../lib/theme.ts"

/** Playwright's chromium, or null when it is not installed. */
export async function findChromium() {
  try {
    const mod = await import("playwright").catch(() => createRequire(import.meta.url)("playwright"))
    return mod.chromium ?? mod.default.chromium
  } catch {
    return null
  }
}

/** Playwright's chromium, or a message and exit 2 when it is not installed. */
export async function chromium() {
  const found = await findChromium()
  if (found) return found
  console.error("This needs Playwright and its Chromium:\n  npm i --no-save playwright && npx playwright install chromium")
  process.exit(2)
}

/** Chromium, launched; PLAYWRIGHT_CHROMIUM points at a browser that lives
 *  somewhere Playwright does not look. */
export async function launch(browser) {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM
  return (browser ?? (await chromium())).launch(executablePath ? { executablePath } : {})
}

/** The site's address (the first argument) and every page to visit: the
 *  designed ones, then any given after the address (a Notion page, a post). */
export function target(argv = process.argv.slice(2)) {
  const base = (argv[0] || "http://localhost:3000").replace(/\/+$/, "")
  const pages = [...INDEXED_PAGES.map((page) => page.href), ...UNINDEXED_PAGES, ...argv.slice(1)]
  return { base, pages }
}

/** A path as a file name: "/" is "home", "/blog/hello" is "blog-hello". */
export const fileName = (path) => (path === "/" ? "home" : path.replace(/^\//, "").replace(/[^\w-]+/g, "-"))

/**
 * A browser context where every page opens with the cookie question
 * answered (`consent`: the real question and the example both, so neither
 * covers the page) and in a look (`theme`), set before the page's own
 * scripts run. Either left out is left as a new reader would have it.
 */
export async function presets(ctx, { consent, theme } = {}) {
  await ctx.addInitScript(
    ({ consent, keys, theme, themeKey }) => {
      try {
        if (consent) for (const key of keys) localStorage.setItem(key, consent)
        if (theme) localStorage.setItem(themeKey, theme)
      } catch {}
    },
    { consent, keys: [CONSENT_KEY, EXAMPLE_CONSENT_KEY], theme, themeKey: THEME_KEY },
  )
}

/** The page with every picture loaded: those below the first screen load
 *  lazily, so it is scrolled through first, as a reader would. */
export async function loadPictures(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 15000 }).catch(() => {})
}
