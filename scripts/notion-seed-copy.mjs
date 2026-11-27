// Makes a Site Copy row for every text slot the site has that the database
// does not, holding the words the code suggests and UNTICKED: on a connected
// site a slot shows only a ticked row's words, so nothing reaches a reader
// until an editor has read the row and ticked it.
//
//   npm run copy                            # renders the site, writes copy-keys.json
//   npm run notion:check                    # names the slots with no row
//   npm run notion:seed-copy                # adds them, unticked
//   npm run notion:seed-copy -- --dry-run   # lists them, adds nothing
//   npm run notion:seed-copy -- --ticked    # adds them ticked: their words show at once
//
// Rows that exist (ticked or not) are left alone, and a slot meant to have
// no row (ROWLESS_SLOTS in lib/slots.ts) is never added. Needs an integration
// with "Insert content".
import "./load-env.mjs"
import { readFile } from "node:fs/promises"

import { notionDatabaseId, notionToken } from "../lib/config.ts"
import { dataSourceId, notion } from "../lib/notion/client.ts"
import { PROPS } from "../lib/notion/schema.ts"
import { rowTitle } from "../lib/notion/rows.ts"
import { createCopyRow, missingCopy } from "../lib/notion/setup.ts"

const dryRun = process.argv.includes("--dry-run")
const ticked = process.argv.includes("--ticked")
if (!notionToken() || !notionDatabaseId()) {
  console.error("Set NOTION_TOKEN and NOTION_DATABASE_ID first.")
  process.exit(1)
}

let keys
try {
  keys = JSON.parse(await readFile("copy-keys.json", "utf8"))
} catch {
  console.error("No copy-keys.json: run `npm run copy` first.")
  process.exit(1)
}

const id = await dataSourceId()
const existing = new Set()
let cursor
do {
  const page = await notion().dataSources.query({
    data_source_id: id,
    filter: { property: PROPS.kind, select: { equals: "Site Copy" } },
    page_size: 100,
    ...(cursor ? { start_cursor: cursor } : {}),
  })
  for (const row of page.results) existing.add(rowTitle(row))
  cursor = page.has_more ? page.next_cursor : undefined
} while (cursor)

const missing = missingCopy(keys, existing)
console.log(`${Object.keys(keys).length} slots, ${existing.size} rows already in Notion, ${missing.length} to add${ticked ? " ticked" : " unticked"}${dryRun ? " (dry run)" : ""}.`)
if (dryRun) {
  for (const [key] of missing) console.log(`  ${key}`)
  process.exit(0)
}

for (const [key, text] of missing) {
  await createCopyRow(notion(), id, key, String(text), ticked)
  console.log(`  + ${key}`)
}
console.log(
  ticked
    ? "Done. Their words show now. Reword a row to change the site; untick it to hide its words."
    : "Done. Nothing on the site changed: read each new row in Notion, reword it if you like, and tick Published to show it.",
)
