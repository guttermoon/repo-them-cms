/**
 * The starter content as the site's own data: what a fresh copy of the
 * template shows before a Notion database is connected (`npm run dev` with
 * no settings, a first deploy). It is the same rows `npm run notion:setup`
 * writes and the stand-in Notion serves, read by the same code
 * (`readRows`), so what you see before connecting is what you get after.
 *
 * Pictures are this site's own files in public/demo, written as Notion
 * writes an outside address, so lib/content/media.ts serves them as they
 * are: no proxy, no signing key, nobody else's host.
 *
 * Once Notion is connected, the database alone decides what shows; an empty
 * one is an empty site, each list saying so (nothing built in stands in for
 * a row: lib/demo/plans.ts and lib/demo/questions.ts are rows here, and
 * only here).
 */
import { OWN_FILES } from "../content/media"
import type { ChildrenPage } from "../notion/blocks"
import { readRows, type NotionRow, type SiteData } from "../notion/rows"
import { DEMO_ROWS } from "./content"
import { fakeDatabase } from "./notion-shape"

const STARTER = fakeDatabase(DEMO_ROWS, (name) => ({ type: "external", external: { url: `${OWN_FILES}${name}` } }))

/** The starter rows Notion's query would return (every ticked row, and
 *  every text slot's row), as getSiteData() returns content. */
export const STARTER_DATA: SiteData = readRows(
  STARTER.pages.filter(
    (page) => (page.properties.Published as { checkbox: boolean }).checkbox || (page.properties.Kind as { select?: { name?: string } }).select?.name === "Site Copy",
  ) as unknown as NotionRow[],
)

/** A block's children from the starter content, the way Notion lists them. */
export async function starterChildren(blockId: string): Promise<ChildrenPage> {
  const children = STARTER.tree[blockId]?.children ?? []
  return { results: children.map((id) => STARTER.tree[id].block), has_more: false, next_cursor: null }
}
