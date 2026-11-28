// The documentation says what the code does: the generated parts are
// current, every link between documents lands on a file, every command a
// document tells you to run exists, and every document is reachable from
// the README.
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"

import { menusTable, schemaTable, sectionsTable, withBlock } from "../lib/docs.ts"

const ROOT = fileURLToPath(new URL("../", import.meta.url))
const read = (file) => readFileSync(join(ROOT, file), "utf8")
const DOCS = readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)
const ALL = ["README.md", "CLAUDE.md", "SECURITY.md", "CONTRIBUTING.md", "SUPPORT.md", "CODE_OF_CONDUCT.md", ".github/pull_request_template.md", ...DOCS]
const SCRIPTS = JSON.parse(read("package.json")).scripts

test("the property table in docs/notion.md is the schema's (npm run docs rewrites it)", () => {
  const text = read("docs/notion.md")
  assert.equal(withBlock(text, "schema", schemaTable()), text, "docs/notion.md is out of date: run npm run docs")
})

test("the table of menus in docs/notion.md is lib/menus.ts's (npm run docs rewrites it)", () => {
  const text = read("docs/notion.md")
  assert.equal(withBlock(text, "menus", menusTable()), text, "docs/notion.md is out of date: run npm run docs")
  assert.match(menusTable(), /\| `header` \| The header, left of the mark \| 4 \| `features`, `pricing`, `shop`, `about` \|/)
})

test("the table of sections in docs/sections.md is lib/sections.ts's (npm run docs rewrites it)", () => {
  const text = read("docs/sections.md")
  assert.equal(withBlock(text, "sections", sectionsTable()), text, "docs/sections.md is out of date: run npm run docs")
})

test("every link between documents lands on a file", () => {
  for (const file of ALL) {
    for (const [, target] of read(file).matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue
      const path = normalize(join(dirname(file), target.split("#")[0]))
      assert.ok(existsSync(join(ROOT, path)), `${file} links to ${target}, which is not there`)
    }
  }
})

test("every command a document tells you to run exists", () => {
  for (const file of [...ALL, "components/sections/template/deploy.tsx", "scripts/shop-import.mjs", "lib/commerce/import-run.ts"]) {
    // a name ends on a letter, digit or dash: "npm run shop:import:" is a sentence going on
    for (const [, name] of read(file).matchAll(/npm run ([a-z][\w:-]*[\w-])/g)) {
      assert.ok(name in SCRIPTS, `${file} mentions npm run ${name}, which package.json does not have`)
    }
  }
})

test("every document is in the README's list", () => {
  const readme = read("README.md")
  for (const doc of DOCS) assert.ok(readme.includes(`(${doc})`), `${doc} is not linked from the README`)
})

test("the README names every kind of row and every email platform the code has", async () => {
  const readme = read("README.md")
  const { KINDS } = await import("../lib/notion/schema.ts")
  for (const kind of KINDS) assert.ok(readme.includes(`| ${kind} |`), kind)
  const { PROVIDERS } = await import("../lib/email/index.ts")
  const email = read("docs/email.md")
  for (const id of Object.keys(PROVIDERS)) assert.ok(email.includes(`| \`${id}\` |`), `docs/email.md does not describe ${id}`)
})
