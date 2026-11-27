// Feature flags (lib/flags.ts): every flag the code reads is listed, with
// the value a reader gets when PostHog cannot say, and the list is the one
// `npm run posthog:setup` makes in PostHog.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { FLAGS, flagValue } from "../lib/flags.ts"
import { ROOT, sources } from "./support/sources.mjs"

const CODE = sources(["app", "components", "lib"]).map(({ text }) => text).join("\n")

test("every flag the code reads is listed, and every listed flag is read", () => {
  const read = new Set([...CODE.matchAll(/\b(?:useFlag|onPostHogFlag)\(\s*"([^"]+)"/g)].map((m) => m[1]))
  assert.ok(read.size > 0, "no flag is read")
  for (const key of read) assert.ok(key in FLAGS, `"${key}" is read but not in lib/flags.ts`)
  for (const key of Object.keys(FLAGS)) assert.ok(read.has(key), `"${key}" is listed but nothing reads it: take it out, or read it`)
})

test("a flag is named as PostHog names them, and says what it is for", () => {
  for (const [key, flag] of Object.entries(FLAGS)) {
    assert.match(key, /^[a-z][a-z0-9-]*$/)
    assert.ok(flag.about.length > 20, `${key} does not say what it is for`)
    assert.equal(typeof flag.fallback, "boolean")
  }
})

test("PostHog's answer wins when it gives one; otherwise the fallback", () => {
  assert.equal(flagValue("site-feedback", false), false)
  assert.equal(flagValue("site-feedback", true), true)
  assert.equal(flagValue("site-feedback", "variant-b"), true)
  assert.equal(flagValue("site-feedback", undefined), FLAGS["site-feedback"].fallback)
})

test("PostHog is asked for a flag only after a yes", () => {
  const client = readFileSync(join(ROOT, "components/layout/posthog-analytics.tsx"), "utf8")
  const body = client.slice(client.indexOf("export function onPostHogFlag"), client.indexOf("export async function postHogVisit"))
  assert.match(body, /readConsent\(\) !== "accepted"\) return listen\(flagValue\(key, undefined\)\)/)
})
