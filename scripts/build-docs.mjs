// Writes the parts of the documentation that are generated from the code,
// so they cannot drift from it: the table of database properties in
// docs/notion.md, from lib/notion/schema.ts, the table of menus there, from
// lib/menus.ts, and the table of sections in docs/sections.md, from
// lib/sections.ts.
//
//   npm run docs
//
// tests/docs.test.mjs fails when a generated part is out of date.
import { readFile, writeFile } from "node:fs/promises"

import { menusTable, schemaTable, sectionsTable, withBlock } from "../lib/docs.ts"

for (const [file, block, table, from] of [
  ["notion.md", "schema", schemaTable(), "lib/notion/schema.ts"],
  ["notion.md", "menus", menusTable(), "lib/menus.ts"],
  ["sections.md", "sections", sectionsTable(), "lib/sections.ts"],
]) {
  const path = new URL(`../docs/${file}`, import.meta.url)
  const before = await readFile(path, "utf8")
  const after = withBlock(before, block, table)
  if (after === before) {
    console.log(`docs/${file} is up to date`)
  } else {
    await writeFile(path, after)
    console.log(`docs/${file}: the ${block} table was rewritten from ${from}`)
  }
}
