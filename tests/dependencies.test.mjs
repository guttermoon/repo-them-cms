// Which packages a live site runs, and the one held to a fixed release
// (docs/development.md, "Dependencies"). `npm audit --omit=dev` reads
// `dependencies` as what a reader's request can reach, so a build or test
// tool there is an advisory counted against the site for nothing.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { ROOT } from "./support/sources.mjs"

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"))

/** [major, minor, patch] of a plain version. */
const parts = (version) => version.split(".").map(Number)
const atLeast = (version, floor) => {
  const [a, b] = [parts(version), parts(floor)]
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return true
}

test("what only builds or tests the site is a dev dependency", () => {
  for (const tool of ["tailwindcss", "tailwindcss-animate", "postcss", "eslint", "typescript", "vitest", "jsdom"]) {
    assert.ok(!(tool in pkg.dependencies), `${tool} only builds or tests the site: it belongs in devDependencies`)
    assert.ok(tool in pkg.devDependencies, `${tool} is not a dev dependency`)
  }
})

test("Next.js uses the site's PostCSS, at a release past its advisories", () => {
  assert.equal(pkg.overrides?.next?.postcss, "$postcss", "Next's own PostCSS is the old one")
  assert.equal(lock.packages["node_modules/next/node_modules/postcss"], undefined, "the lockfile still gives Next a PostCSS of its own")
  const postcss = lock.packages["node_modules/postcss"]?.version
  assert.ok(postcss && atLeast(postcss, "8.5.23"), `PostCSS ${postcss} has advisories fixed in 8.5.23`)
})
