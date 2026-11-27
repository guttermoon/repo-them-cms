// Makes the site's Notion database, with every property the site reads and
// the starter content in it, a ticked row of the starter wording for every
// text slot among it (a connected site shows only Notion's words):
//
//   NOTION_TOKEN=ntn_… npm run notion:setup -- "<address of a Notion page>"
//   npm run notion:setup -- "<page>" --empty     the database only
//
// The page must be shared with the integration (the page's ⋯ menu, then
// Connections), and the integration needs "Insert content" for this one
// command; the site itself needs only "Read content". It prints the
// NOTION_DATABASE_ID to put in .env.local.
import "./load-env.mjs"
import { readFile } from "node:fs/promises"
import path from "node:path"

import { notionId, notionToken } from "../lib/config.ts"
import { DEMO_FILES, DEMO_ROWS } from "../lib/demo/content.ts"
import { notion } from "../lib/notion/client.ts"
import { createCopyRow, createDatabase, createRow, missingCopy, uploadFiles } from "../lib/notion/setup.ts"
import { SITE_NAME } from "../lib/site.ts"

const args = process.argv.slice(2)
const parent = notionId(args.find((a) => !a.startsWith("--")))
const empty = args.includes("--empty")

if (!notionToken()) {
  console.error("Set NOTION_TOKEN to your integration's token first.")
  process.exit(1)
}
if (!parent) {
  console.error('Give the address of a Notion page shared with the integration:\n  npm run notion:setup -- "https://www.notion.so/Your-page-…"')
  process.exit(1)
}

const client = notion()
console.log(`Making "${SITE_NAME} content" inside the page…`)
const { databaseId, dataSourceId } = await createDatabase(client, parent, `${SITE_NAME} content`)
console.log(`  database ${databaseId}`)

if (!empty) {
  const files = await Promise.all(
    DEMO_FILES.map(async (name) => ({ name, data: new Uint8Array(await readFile(path.join(process.cwd(), "public", "demo", name))) })),
  )
  const uploads = await uploadFiles(client, files, console.log)
  for (const row of DEMO_ROWS) {
    await createRow(client, dataSourceId, row, uploads)
    console.log(`  ${row.kind.padEnd(9)} ${row.title}`)
  }
  // the starter wording, ticked: whoever runs the setup asked for the starter site
  const keys = JSON.parse(await readFile(path.join(process.cwd(), "copy-keys.json"), "utf8"))
  const made = new Set(DEMO_ROWS.filter((row) => row.kind === "Site Copy").map((row) => row.title))
  const words = missingCopy(keys, made)
  console.log(`  and ${words.length} rows of wording, one for each text slot (a few minutes: Notion takes three a second)`)
  for (const [key, text] of words) await createCopyRow(client, dataSourceId, key, String(text), true)
}

console.log(`
Done. Put this in .env.local (and in your host's environment variables):

  NOTION_DATABASE_ID=${databaseId}

Then: npm run notion:check && npm run dev${empty ? `

The database is empty, and a connected site shows only Notion's words, so
every slot is blank. For a row of suggested wording for each, unticked for
you to read and tick: npm run notion:seed-copy` : ""}`)
