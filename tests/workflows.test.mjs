// The workflows run code of other people's: every GitHub Action is pinned
// to a commit, not a tag (SECURITY.md, "Take updates from the template").
// A tag can be moved to other code by whoever holds the action's
// repository, and the next run would take it, the feedback loop's with the
// Anthropic key in reach; a commit is that code and no other. The version
// beside it is what Dependabot reads to propose the next one.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { ROOT } from "./support/sources.mjs"

const DIR = join(ROOT, ".github/workflows")
const workflows = readdirSync(DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => ({ file: f, text: readFileSync(join(DIR, f), "utf8") }))

/** Every `uses:` in a workflow, with the line it is on. */
const uses = workflows.flatMap(({ file, text }) =>
  text.split("\n").flatMap((line, i) => {
    const m = /^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/.exec(line)
    return m ? [{ where: `${file}:${i + 1}`, ref: m[1], rest: m[2].trim() }] : []
  }),
)

test("the workflows use actions", () => {
  assert.ok(workflows.length >= 3)
  assert.ok(uses.length >= 10, `found ${uses.length} actions`)
})

test("every action is pinned to a full commit, its version beside it", () => {
  for (const { where, ref, rest } of uses) {
    // an action in this repository is this commit's own code already
    if (ref.startsWith("./")) continue
    assert.match(ref, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/, `${where}: ${ref} is named by tag or branch, which can be moved to other code`)
    assert.match(rest, /^# v\d+(\.\d+){0,2}$/, `${where}: say which version the commit is (# v1.2.3), for Dependabot and the reader`)
  }
})

test("one action is one commit everywhere it is used", () => {
  const seen = new Map()
  for (const { where, ref, rest } of uses) {
    const [name, commit] = ref.split("@")
    const first = seen.get(name)
    if (first) assert.deepEqual([commit, rest], first.pin, `${where}: ${name} is pinned differently at ${first.where}`)
    else seen.set(name, { where, pin: [commit, rest] })
  }
})

test("Dependabot keeps the pins up to date", () => {
  const config = readFileSync(join(ROOT, ".github/dependabot.yml"), "utf8")
  assert.match(config, /package-ecosystem: github-actions\s*\n\s*directory: \//)
})
