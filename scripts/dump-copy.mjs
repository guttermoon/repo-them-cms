#!/usr/bin/env node
/**
 * Every text slot on the site, with the wording built into the code as its
 * default:
 *
 *   npm run copy                  # writes copy-keys.json
 *   npm run copy -- elsewhere.json
 *
 * The keys are not all literals in the source (the questions, the features,
 * the service counter are rendered from data), so a grep for <T k="…"> would
 * report a shorter list than the truth. This renders the site instead: every
 * page, the 404 and the frame round them, from the starter content and from
 * none, with their metadata, share cards and /llms.txt, in jsdom
 * (tests/dom/every-word.test.tsx, which records each slot as it is read). The
 * few a render cannot reach (a form's answer, a setting that is off) are
 * added from tests/support/hidden-slots.ts. `npm run notion:seed-copy` then
 * makes a Notion row for every key that has none.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const out = resolve(process.argv[2] || "copy-keys.json")
const run = spawnSync("npx", ["vitest", "run", "tests/dom/every-word.test.tsx"], {
  stdio: "inherit",
  env: { ...process.env, COPY_OUT: out },
  shell: process.platform === "win32",
})
if (run.status !== 0 || !existsSync(out)) {
  console.error("The pages did not render cleanly, so no list was written. The test's output above says why.")
  process.exit(run.status || 1)
}
console.log(`${Object.keys(JSON.parse(readFileSync(out, "utf8"))).length} slots in ${process.argv[2] || "copy-keys.json"}`)
