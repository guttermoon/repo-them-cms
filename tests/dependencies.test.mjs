// Which packages a live site runs, the one held to a fixed release, and the
// Node the site asks for (docs/development.md, "Dependencies"). `npm audit
// --omit=dev` reads `dependencies` as what a reader's request can reach, so a
// build or test tool there is an advisory counted against the site for
// nothing; and a Node the test runner refuses is one `npm ci` refuses too
// where engines are enforced.
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

/** Whether a plain version is in a range made of `^x.y.z` and `>=x.y.z`
 *  joined by `||`, the only forms the two ranges below use. */
function inRange(version, range) {
  return range.split("||").some((part) => {
    const m = /^\s*(\^|>=)(\d+)\.(\d+)\.(\d+)\s*$/.exec(part)
    assert.ok(m, `a range this test cannot read: ${part.trim()}`)
    const floor = `${m[2]}.${m[3]}.${m[4]}`
    return atLeast(version, floor) && (m[1] === ">=" || parts(version)[0] === Number(m[2]))
  })
}

test("the site asks for no Node its test runner refuses", () => {
  const ours = pkg.engines.node
  const vitest = JSON.parse(readFileSync(join(ROOT, "node_modules/vitest/package.json"), "utf8")).engines.node
  assert.ok(inRange("22.18.0", ours), "the Node line CI runs is allowed")
  for (const major of [22, 23, 24, 25, 26, 27, 28]) {
    for (const version of [`${major}.0.0`, `${major}.18.0`, `${major}.99.0`]) {
      if (inRange(version, ours)) assert.ok(inRange(version, vitest), `Node ${version} is allowed here, but Vitest (${vitest}) refuses it`)
    }
  }
})
