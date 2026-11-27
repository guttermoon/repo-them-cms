/**
 * The site's four looks, and the reader's choice of one:
 * - light and dark, as Notion draws its own;
 * - mono: black and white with light grey, the pictures in grey too;
 * - rainbow: the same layout, loud: a rainbow band, rainbow titles, hot pink
 *   buttons on a cream page.
 *
 * The reader follows the system (light or dark, whichever it prefers) or
 * chooses one. The choice is kept in localStorage under `THEME_KEY` (a
 * preference, named in the privacy notice; it identifies nobody and needs no
 * consent). The look itself is `data-theme` on <html>, which every colour in
 * app/globals.css follows: each look is one block of tokens there, and
 * tests/contrast.test.mjs checks every pairing in each.
 *
 * Imports nothing, so `npm test` loads it.
 */
export const THEMES = ["light", "dark", "mono", "rainbow"] as const
export type Theme = (typeof THEMES)[number]
export type ThemeChoice = "system" | Theme

/** The footer's choices, in the order it offers them. */
export const THEME_CHOICES: readonly ThemeChoice[] = ["system", ...THEMES]

/** The looks drawn on a dark ground: the browser's `color-scheme`, and
 *  Tailwind's `dark:` (the badge in white, the logo strip inverted). */
export const DARK_THEMES: readonly Theme[] = ["dark"]

export const THEME_KEY = "site-theme"

export const isTheme = (value: unknown): value is Theme => (THEMES as readonly unknown[]).includes(value)

/** The stored choice, or "system" when there is none (or storage is blocked). */
export function readThemeChoice(): ThemeChoice {
  try {
    const v = window.localStorage.getItem(THEME_KEY)
    return isTheme(v) ? v : "system"
  } catch {
    return "system"
  }
}

/** What a choice means right now: the system's light or dark for "system". */
export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** The look after this one, in the order of THEMES, round to the first. */
export function nextTheme(current: string | undefined): Theme {
  const at = THEMES.indexOf(current as Theme)
  return THEMES[(at + 1) % THEMES.length]
}

/**
 * The browser's own colour round the page (the address bar on a phone),
 * set to the page colour of the look showing. Read from the stylesheet, so
 * the colour is never typed twice. Only after the page has hydrated: the
 * <meta> tags are React's, and changing them before would be a mismatch.
 */
export function syncThemeColour(): void {
  const page = getComputedStyle(document.documentElement).getPropertyValue("--c-page").trim()
  if (!/^\d+ \d+ \d+$/.test(page)) return
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) meta.content = `rgb(${page.replace(/ /g, ", ")})`
}

export function applyTheme(choice: ThemeChoice): void {
  const theme = resolveTheme(choice)
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = DARK_THEMES.includes(theme) ? "dark" : "light"
  syncThemeColour()
}

export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, choice)
  } catch {
    // remembered for this page view only
  }
  applyTheme(choice)
  window.dispatchEvent(new CustomEvent("site-theme-change", { detail: choice }))
}

/**
 * Run in <head> before the first paint, so a dark or rainbow page never
 * flashes white. A constant string, set with dangerouslySetInnerHTML (React
 * escapes a script's text child differently on the server and the client).
 * A stored value that is not a look (an old one, or junk) counts as none.
 */
export const THEME_SCRIPT = `(function(){try{var t=${JSON.stringify(THEMES)},k=${JSON.stringify(DARK_THEMES)},c=localStorage.getItem("${THEME_KEY}");if(t.indexOf(c)<0)c=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=document.documentElement;r.dataset.theme=c;r.style.colorScheme=k.indexOf(c)<0?"light":"dark"}catch(e){}})()`
