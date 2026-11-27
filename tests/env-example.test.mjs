// .env.example is the list of settings a fork reads to set the site up, so it
// has to be complete and it has to be safe: every setting the code reads is
// in it, nothing in it is a setting the code no longer reads, and every
// value is a placeholder.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ROOT, sourceFiles } from "./support/sources.mjs"

const EXAMPLE = readFileSync(join(ROOT, ".env.example"), "utf8")

/** Set by the platform or the tools, never by whoever runs the site: Node's
 *  and Next's, Vercel's, and GitHub Actions' own (scripts/feedback-open.mjs). */
const PROVIDED = new Set([
  "NODE_ENV",
  "NEXT_PHASE",
  "VERCEL_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "PORT",
  "GITHUB_SHA",
  "GITHUB_REF_NAME",
  "GITHUB_STEP_SUMMARY",
  "RUNNER_TEMP",
])

/** NAME=value lines, set or commented out, with their values. */
const listed = new Map(
  EXAMPLE.split("\n")
    .map((line) => /^#?\s?([A-Z][A-Z0-9_]+)=(.*)$/.exec(line.trim()))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
)

/** Every setting the code reads: process.env.X, env.X where the
 *  environment is passed in, and the import command's value(env, "X"). */
const READ = new Set(
  [
    ...sourceFiles(["app", "components", "lib", "scripts", ".github"], /\.(ts|tsx|mjs|js|yml)$/),
    // the root's own code: next.config.mjs, instrumentation.ts and the like
    ...readdirSync(ROOT).filter((name) => /\.(ts|mjs)$/.test(name) && statSync(join(ROOT, name)).isFile()),
  ].flatMap((file) =>
    [...readFileSync(join(ROOT, file), "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)|\benv\.([A-Z][A-Z0-9_]{3,})\b|value\(env, "([A-Z][A-Z0-9_]+)"\)|secrets\.([A-Z][A-Z0-9_]+)/g)].map(
      (m) => m[1] ?? m[2] ?? m[3] ?? m[4],
    ),
  ),
)

test("the scan finds the settings it should", () => {
  for (const name of ["NOTION_TOKEN", "NOTION_DATABASE_ID", "BREVO_API_KEY", "SHOPIFY_STOREFRONT_TOKEN", "NEXT_PUBLIC_GA_MEASUREMENT_ID", "POSTHOG_LOGS_ENDPOINT"]) assert.ok(READ.has(name), name)
})

test("every setting the code reads is in .env.example", () => {
  const missing = [...READ].filter((name) => !PROVIDED.has(name) && !listed.has(name)).sort()
  assert.deepEqual(missing, [])
})

test("nothing in .env.example is a setting the code no longer reads", () => {
  const stale = [...listed.keys()].filter((name) => !READ.has(name)).sort()
  assert.deepEqual(stale, [])
})

test("every value is a placeholder, a stand-in's local address, or a documented default", () => {
  const PLACEHOLDER = /^$|your|example|^https?:\/\/127\.0\.0\.1:\d+$|^\/path\/to\/|^(brevo|postmark|shopify|eu|USD|2026-10|true|false|outbound)$/i
  for (const [name, value] of listed) assert.match(value, PLACEHOLDER, `${name}=${value}`)
})

test("only the settings a first run needs are uncommented, and they are empty or placeholders", () => {
  const set = EXAMPLE.split("\n").filter((line) => /^[A-Z]/.test(line)).map((line) => line.split("=")[0])
  assert.deepEqual(set, ["NOTION_TOKEN", "NOTION_DATABASE_ID", "REVALIDATION_SECRET", "CONTACT_TO_EMAIL", "EMAIL_FROM", "BREVO_API_KEY"])
})
