// Run by npm's `prebuild`: reads Notion once, in this one process, so that
// `next build` doesn't have to (lib/content/build-snapshot.ts says why):
// - every published row into lib/snapshot.json, so each deployment ships the
//   content as it stood when it was built; lib/content/store.ts reads it
//   during the build and falls back to it if Notion can't be reached later;
// - the body of every live page, post and product into
//   lib/snapshot-bodies.json, which the build alone reads.
// Each request waits as long as Notion asks (`patiently`).
//
// It never fails a build: with no credentials, or Notion unreachable, it
// keeps the snapshot it has and exits 0, and the build reads Notion itself.
// An empty answer from a configured database is kept too (a new site may
// have nothing published yet). A body that can't be read is left out, and
// its page is rendered on its first visit instead.
import "./load-env.mjs"
import { writeFile } from "node:fs/promises"

import { notionConfigured } from "../lib/config.ts"
import { entriesWithBodies, patiently, snapshotBodies } from "../lib/content/build-snapshot.ts"
import { listChildren, queryPublishedRows } from "../lib/notion/client.ts"
import { readRows } from "../lib/notion/rows.ts"

const ROWS = new URL("../lib/snapshot.json", import.meta.url)
const BODIES = new URL("../lib/snapshot-bodies.json", import.meta.url)

if (!notionConfigured()) {
  console.log("[snapshot] NOTION_TOKEN or NOTION_DATABASE_ID is not set; keeping the snapshot as it is")
  process.exit(0)
}

let data
try {
  data = readRows(await patiently(() => queryPublishedRows()))
} catch (error) {
  console.warn(`[snapshot] Notion could not be read (${error instanceof Error ? error.message : error}); keeping the snapshot as it is`)
  process.exit(0)
}

const entries = entriesWithBodies(data)
const started = Date.now()
const bodies = await snapshotBodies(
  entries,
  (blockId, cursor) => patiently(() => listChildren(blockId, cursor)),
  (entry, error) => console.warn(`[snapshot] the body of /${entry.slug} could not be read (${error instanceof Error ? error.message : error}); it is rendered on its first visit`),
)

// the rows and the bodies are written together, so the build never reads a
// body of an older edit than its row
await writeFile(ROWS, `${JSON.stringify(data, null, 2)}\n`)
await writeFile(BODIES, `${JSON.stringify(bodies)}\n`)
console.log(`[snapshot] ${Object.keys(data.copy).length} copy rows and ${data.entries.length} entries written to lib/snapshot.json`)
console.log(
  `[snapshot] ${Object.keys(bodies).length} of ${entries.length} page, post and product bodies written to lib/snapshot-bodies.json in ${((Date.now() - started) / 1000).toFixed(1)}s`,
)
