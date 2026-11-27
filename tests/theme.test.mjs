// The four looks (lib/theme.ts): the script that sets one before the first
// paint, the order the header's switch moves through them, and the hooks
// each look needs elsewhere (its icon, its swatch, its name in Notion).
// Adding a look to THEMES without them fails here. The switches themselves
// are tested in jsdom (tests/dom/layout.test.tsx); the colours in
// tests/contrast.test.mjs.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

import { DARK_THEMES, isTheme, nextTheme, THEME_CHOICES, THEME_KEY, THEME_SCRIPT, THEMES } from "../lib/theme.ts"

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
const css = read("app/globals.css")

/** Runs the pre-paint script against a stored value and a system preference. */
function boot(stored, { systemDark = false, storage = true } = {}) {
  const root = { dataset: {}, style: {} }
  const context = {
    localStorage: {
      getItem: (key) => {
        if (!storage) throw new Error("blocked")
        return key === THEME_KEY ? stored : null
      },
    },
    window: { matchMedia: (q) => ({ matches: systemDark && q === "(prefers-color-scheme: dark)" }) },
    document: { documentElement: root },
  }
  vm.runInNewContext(THEME_SCRIPT, context)
  return root
}

test("the pre-paint script sets the stored look, and its colour scheme", () => {
  for (const theme of THEMES) {
    const root = boot(theme)
    assert.equal(root.dataset.theme, theme)
    assert.equal(root.style.colorScheme, DARK_THEMES.includes(theme) ? "dark" : "light", theme)
  }
})

test("with no choice, or one that is not a look, the pre-paint script follows the system", () => {
  for (const stored of [null, "", "system", "sepia", "DARK", '"dark"']) {
    assert.equal(boot(stored).dataset.theme, "light", String(stored))
    assert.equal(boot(stored, { systemDark: true }).dataset.theme, "dark", String(stored))
    assert.equal(boot(stored, { systemDark: true }).style.colorScheme, "dark")
  }
  // storage blocked: the script stops quietly and the server's light stands
  const blocked = boot("rainbow", { storage: false })
  assert.equal(blocked.dataset.theme, undefined)
})

test("the header's switch moves through every look in order, and back to the first", () => {
  assert.deepEqual(THEMES, ["light", "dark", "mono", "rainbow"])
  const seen = []
  let at = "light"
  for (let i = 0; i < THEMES.length; i++) {
    at = nextTheme(at)
    seen.push(at)
  }
  assert.deepEqual(seen, ["dark", "mono", "rainbow", "light"])
  assert.equal(nextTheme(undefined), "light", "from nothing known, the first look")
  assert.equal(nextTheme("sepia"), "light")
})

test("the footer offers the system first, then every look; only real looks count as one", () => {
  assert.deepEqual(THEME_CHOICES, ["system", ...THEMES])
  for (const theme of THEMES) assert.ok(isTheme(theme))
  for (const other of ["system", "", null, undefined, "Light", 1]) assert.equal(isTheme(other), false, String(other))
  for (const theme of DARK_THEMES) assert.ok(isTheme(theme))
})

test("every look has its icon in the header's switch, its swatch and its name in the footer", () => {
  const icons = read("components/ui/theme-icons.tsx")
  const footer = read("components/layout/site-footer.tsx")
  for (const theme of THEMES) {
    assert.ok(css.includes(`:root[data-theme="${theme}"] [data-theme-icon="${theme}"]`), `no icon rule for ${theme}`)
    assert.match(icons, new RegExp(`\\b${theme}: "[\\w-]+"`), `no icon for ${theme}`)
  }
  for (const choice of THEME_CHOICES) {
    assert.ok(css.includes(`.theme-swatch[data-swatch="${choice}"]`), `no swatch for ${choice}`)
    assert.ok(footer.includes(`${choice}: plainText(content, "footer.theme.${choice}", "`), `no Notion slot for the name of ${choice}`)
  }
})

test("Tailwind's dark: variant means the looks drawn on a dark ground, and only those", () => {
  const config = read("tailwind.config.ts")
  assert.deepEqual(DARK_THEMES, ["dark"], "a second dark look needs the variant to name it too")
  assert.match(config, /darkMode: \["selector", '\[data-theme="dark"\]'\]/)
})
