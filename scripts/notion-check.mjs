// Checks the connection to Notion and the database's shape, and says what
// the site will do with what is published:
//
//   npm run notion:check
//
// Exits 1 when the site cannot read the database or a required property is
// missing; warnings (a page that would be skipped, a redirect to nowhere)
// are printed and exit 0.
import "./load-env.mjs"
import { notionDatabaseId, notionToken } from "../lib/config.ts"
import { readFile } from "node:fs/promises"

import { entriesWithBodies } from "../lib/content/build-snapshot.ts"
import { fetchBlockTree } from "../lib/notion/blocks.ts"
import { checkMissingSlots, checkPictures, checkProductPictures, checkRetiredRows, checkRows, checkSchema, checkStatusRows, checkUnreadRows, liveStatuses, retiredRows, statusQuery, textRowKeys } from "../lib/notion/check.ts"
import { EDITOR_STATUS } from "../lib/notion/schema.ts"
import { readRows, rowTitle } from "../lib/notion/rows.ts"
import { dataSourceId, listChildren, notion, queryPublishedRows, queryRows } from "../lib/notion/client.ts"

const mark = { error: "✗", warning: "!", info: "·" }

if (!notionToken() || !notionDatabaseId()) {
  console.error("✗ NOTION_TOKEN and NOTION_DATABASE_ID must both be set (in .env.local, or your shell).")
  process.exit(1)
}

let failed = false
try {
  const id = await dataSourceId()
  console.log("✓ The integration can read the database.")
  const source = await notion().dataSources.retrieve({ data_source_id: id })
  const schema = checkSchema(source.properties ?? {})
  if (!schema.length) console.log("✓ Every property the site reads is there.")
  for (const f of schema) {
    console.log(`${mark[f.level]} ${f.message}`)
    if (f.level === "error") failed = true
  }

  // a retired property still in the database: every row holding something
  // in it, drafts too, before the notice above says to delete the column
  for (const f of checkRetiredRows(await retiredRows(source.properties ?? {}, queryRows))) console.log(`${mark[f.level]} ${f.message}`)

  // the editors' Status, where the database has one: every row, drafts too,
  // whose Status says other than Published does
  const live = liveStatuses(source.properties?.[EDITOR_STATUS])
  if (live.length) {
    const odd = checkStatusRows(await queryRows((cursor) => statusQuery(live, cursor)), live)
    if (!odd.length) console.log("✓ Every row's Status agrees with Published.")
    for (const f of odd) console.log(`${mark[f.level]} ${f.message}`)
  }

  // read once: every check below works from the same published rows
  const rows = await queryPublishedRows()
  const { counts, findings } = checkRows(rows)
  console.log(
    `✓ Published: ${counts["Site Copy"]} copy, ${counts.Page} pages, ${counts.Post} posts, ${counts.Resource} resources, ${counts.Redirect} redirects` +
      (counts.skipped ? `, ${counts.skipped} skipped` : ""),
  )
  for (const f of findings) {
    console.log(`${mark[f.level]} ${f.message}`)
    if (f.level === "error") failed = true
  }

  // the text rows against every slot the pages read: a slot's row counts
  // ticked or not (an unticked one still hides it), and a row nothing reads
  // is named only while it is ticked (unticked, it is out of the way)
  const slots = Object.keys(JSON.parse(await readFile(new URL("../copy-keys.json", import.meta.url), "utf8")))
  const textRows = textRowKeys(rows)
  const unread = checkUnreadRows(textRows.ticked, slots)
  if (!unread.length) console.log("✓ Every ticked text row is one the site reads.")
  const missing = checkMissingSlots(textRows.all, slots)
  if (!missing.length) console.log("✓ Every text slot has a row, so every word on the site is one you can see in Notion.")
  for (const f of [...unread, ...missing]) console.log(`${mark[f.level]} ${f.message}`)

  // every picture a page, a post or a product shows, for a description a
  // screen reader can read: one body at a time, through the client's limiter
  const data = readRows(rows)
  const bodies = entriesWithBodies(data)
  const pictures = checkProductPictures(data.entries)
  for (const entry of bodies) {
    try {
      pictures.push(...checkPictures(`${entry.kind} "${entry.title}"`, await fetchBlockTree(entry.id, listChildren)))
    } catch (error) {
      pictures.push({ level: "warning", message: `${entry.kind} "${entry.title}": its body could not be read (${error instanceof Error ? error.message : error}).` })
    }
  }
  if (!pictures.some((f) => f.level === "warning")) console.log(`✓ Every picture in ${bodies.length} pages, posts and products has a description.`)
  for (const f of pictures) console.log(`${mark[f.level]} ${f.message}`)
} catch (error) {
  const status = error?.status
  console.error(
    status === 401
      ? "✗ Notion refused the token. Check NOTION_TOKEN."
      : status === 404
        ? "✗ Notion cannot find the database. Check NOTION_DATABASE_ID, and that the database is shared with the integration (⋯ → Connections)."
        : `✗ ${error instanceof Error ? error.message : error}`,
  )
  process.exit(1)
}
process.exit(failed ? 1 : 0)
