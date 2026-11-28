// PostHog's own widgets in the site's look (app/globals.css, docs/analytics.md,
// "PostHog's pop-ups and chat"): every colour, corner, shadow and font that
// posthog-js reads for a survey pop-up or the support chat is set from one of
// the site's tokens, so the widgets follow the look the reader chose. The
// names are read from the installed posthog-js itself, so an update that
// reads a new one fails here until it is given a token.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

import { ROOT } from "./support/sources.mjs"

const css = readFileSync(join(ROOT, "app/globals.css"), "utf8")
const library = dirname(createRequire(join(ROOT, "package.json")).resolve("posthog-js/package.json"))
const dist = (file) => readFileSync(join(library, "dist", file), "utf8")

/** A rule's declarations, by the selector it opens with. */
function declarations(selector) {
  const start = css.indexOf(`${selector} {`)
  assert.ok(start >= 0, `app/globals.css has no rule for ${selector}`)
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start))
  return new Map(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  )
}

/** What a survey's box is given inline by posthog-js. */
const surveyNames = [...new Set([...dist("surveys.js").matchAll(/setProperty\("(--ph-survey-[a-z-]+)"/g)].map((m) => m[1]))]
/** What the chat reads, each with a fallback of its own. */
const chatNames = [...new Set([...dist("conversations.js").matchAll(/Te\("([a-z-]+)"/g)].map((m) => `--ph-conv-${m[1]}`))]

// layout the library keeps, not the look: room, stacking, padding, and the
// bottom edge it draws only for a pop-up docked to the window's edge
const SURVEY_LAYOUT = new Set(["--ph-survey-max-width", "--ph-survey-z-index", "--ph-survey-box-padding", "--ph-survey-border-bottom", "--ph-survey-disabled-button-opacity"])
// the launcher's shadow is a filter, not a box shadow, and the site has no token for one
const CHAT_LAYOUT = new Set(["--ph-conv-launcher-shadow"])

/** A value made only of the site's tokens: `rgb(var(--c-…))`, `var(--…)`,
 *  and the font's own fallbacks. */
const fromTokens = (value) => {
  const bare = value.replace(/\s*!important$/, "")
  if (!/var\(--(c|r|shadow|font)-?[\w-]*\)/.test(bare)) return false
  // no colour typed in: no hex, and no rgb() of numbers
  return !/#[0-9a-f]{3,8}\b/i.test(bare) && !/rgba?\(\s*\d/.test(bare)
}

test("posthog-js still draws surveys in a box of their own, and the chat in its container", () => {
  assert.ok(surveyNames.length >= 15, `found ${surveyNames.length} survey variables: has posthog-js changed how it styles surveys?`)
  assert.match(dist("surveys.js"), /PostHogSurvey-\$\{e\.id\}/, "the survey's box is no longer PostHogSurvey-<id>")
  assert.ok(chatNames.length >= 8, `found ${chatNames.length} chat variables`)
  assert.match(dist("conversations.js"), /"ph-conversations-widget-container"/, "the chat's container has a new id")
})

test("every colour, corner, shadow and font of a survey pop-up is one of the site's tokens", () => {
  const mapped = declarations('[class^="PostHogSurvey-"]')
  for (const name of surveyNames.filter((n) => !SURVEY_LAYOUT.has(n))) {
    assert.ok(mapped.has(name), `${name} is read by posthog-js but not set from a token in app/globals.css`)
  }
  for (const [name, value] of mapped) {
    assert.ok(surveyNames.includes(name), `${name} is set, but posthog-js no longer reads it`)
    // posthog-js writes these on the box inline: only !important outranks it
    assert.match(value, /!important$/, `${name} needs !important to outrank the survey's own appearance`)
    assert.ok(fromTokens(value), `${name}: ${value} is not made of the site's tokens`)
  }
})

test("every colour, corner, shadow and font of the support chat is one of the site's tokens", () => {
  const mapped = declarations("#ph-conversations-widget-container")
  for (const name of chatNames.filter((n) => !CHAT_LAYOUT.has(n))) {
    assert.ok(mapped.has(name), `${name} is read by posthog-js but not set from a token in app/globals.css`)
  }
  for (const [name, value] of mapped) {
    assert.ok(chatNames.includes(name), `${name} is set, but posthog-js no longer reads it`)
    assert.ok(fromTokens(value), `${name}: ${value} is not made of the site's tokens`)
  }
})

test("the tokens it uses are ones every look defines", () => {
  const used = new Set([...css.slice(css.indexOf('[class^="PostHogSurvey-"] {')).split("\n/*")[0].matchAll(/var\((--c-[\w-]+)\)/g)].map((m) => m[1]))
  assert.ok(used.size >= 8)
  for (const token of used) assert.match(css, new RegExp(`^\\s*${token}\\s*:`, "m"), `${token} is not a token in app/globals.css`)
})
