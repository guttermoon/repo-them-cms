// The way in for a new site (lib/site.ts): Notion's template, then Vercel's
// Deploy button asking for the two settings a site needs and nothing else.
// The README and /features#deploy use the same addresses, so the directions
// can't drift from the button.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { DEMO_DEPLOY_URL, DEPLOY_SETTINGS, DEPLOY_SETTINGS_HELP, DEPLOY_URL, NOTION_TEMPLATE_URL, REPO_URL, SETUP_GUIDE_URL } from "../lib/site.ts"

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")

test("the Deploy button clones the repository and asks for the two Notion settings, by name only", () => {
  const url = new URL(DEPLOY_URL)
  assert.equal(url.origin + url.pathname, "https://vercel.com/new/clone")
  const q = url.searchParams
  assert.equal(q.get("repository-url"), REPO_URL)
  assert.equal(q.get("env"), "NOTION_TOKEN,NOTION_DATABASE_ID")
  assert.equal(q.get("envDescription"), DEPLOY_SETTINGS_HELP)
  assert.equal(q.get("envLink"), SETUP_GUIDE_URL)
  assert.equal(SETUP_GUIDE_URL, `${REPO_URL}#set-it-up`)
  // a value in the address would sit in the browser's history
  assert.equal(q.get("envDefaults"), null)
  assert.deepEqual([...q.keys()].sort(), ["env", "envDescription", "envLink", "project-name", "repository-name", "repository-url"])
})

test("the settings asked for are the two a site needs, and .env.example's first two", () => {
  assert.deepEqual([...DEPLOY_SETTINGS], ["NOTION_TOKEN", "NOTION_DATABASE_ID"])
  const set = read(".env.example").split("\n").filter((line) => /^[A-Z]/.test(line)).map((line) => line.split("=")[0])
  assert.deepEqual(set.slice(0, 2), [...DEPLOY_SETTINGS])
})

test("the starter-site button asks for nothing", () => {
  const url = new URL(DEMO_DEPLOY_URL)
  assert.equal(url.searchParams.get("repository-url"), REPO_URL)
  assert.equal(url.searchParams.get("env"), null)
})

test("the addresses survive a Markdown link: nothing a link's brackets or spaces would cut short", () => {
  for (const address of [DEPLOY_URL, DEMO_DEPLOY_URL, NOTION_TEMPLATE_URL]) assert.doesNotMatch(address, /[\s()<>'"]/, address)
})

test("the README's buttons are the site's own addresses, and its guide is where the button points", () => {
  const readme = read("README.md")
  for (const [name, address] of Object.entries({ DEPLOY_URL, DEMO_DEPLOY_URL, NOTION_TEMPLATE_URL })) {
    assert.ok(readme.includes(`(${address})`), `README.md does not link ${name}`)
  }
  assert.match(readme, /^\[!\[Deploy with Vercel\]\(https:\/\/vercel\.com\/button\)\]\(https:\/\/vercel\.com\/new\/clone\?[^)]*&env=NOTION_TOKEN,NOTION_DATABASE_ID/m, "the README's first button asks for the settings")
  // GitHub's anchor for "## Set it up" is #set-it-up
  assert.match(readme, /^## Set it up$/m)
  for (const name of DEPLOY_SETTINGS) assert.ok(readme.includes(`| \`${name}\` |`), `README.md does not say what to paste for ${name}`)
})

test("/features#deploy starts from the same template and button", () => {
  const steps = read("components/sections/template/deploy.tsx")
  assert.match(steps, /href: NOTION_TEMPLATE_URL/)
  assert.match(steps, /href=\{DEPLOY_URL\}/)
  // the code reaches Vercel one of two ways, offered side by side: the
  // Deploy button, or from GitHub by hand (Use this template, then import)
  assert.match(steps, /key: "oneclick",[\s\S]*?deploy: true/)
  assert.match(steps, /key: "github",[\s\S]*?href: TEMPLATE_URL[\s\S]*?href: VERCEL_IMPORT_URL/)
  assert.match(read("README.md"), /\*\*In one press\.\*\*[\s\S]*?\*\*From GitHub\.\*\*[\s\S]*?Use this template/, "the README offers both ways")
  assert.match(steps, /NEXT_PUBLIC_POSTHOG_KEY=[\s\S]*POSTHOG_PERSONAL_API_KEY=/, "PostHog's settings are in the steps")
  for (const name of DEPLOY_SETTINGS) assert.match(steps, new RegExp(`(^|\x60)${name}=`, "m"), `the steps do not show ${name}`)
  assert.doesNotMatch(steps, /notion:setup|npm run/, "the steps need no terminal")
})

test("the template is a published copy, never the demo's own database", () => {
  const id = new URL(NOTION_TEMPLATE_URL).pathname.slice(1)
  assert.match(id, /^[0-9a-f]{32}$/)
  // the demo's live database is not in the repository at all; the template's
  // ID is the one Notion ID besides Notion's own that the secret scan allows
  assert.match(read("tests/no-secrets.test.mjs"), new RegExp(`"${id}"`))
})
