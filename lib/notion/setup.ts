/**
 * Making a new site's database: the logic behind `npm run notion:setup`,
 * kept here (rather than in the script) so the tests run it against the
 * stand-in Notion (tests/notion-setup.test.mjs).
 *
 * It makes the database inside a page the integration can reach, with every
 * property the site reads (lib/notion/schema.ts), then fills it with the
 * starter content (lib/demo/content.ts) unless asked not to. It needs an
 * integration with "Insert content"; the site itself needs only "Read content".
 */
import type { NotionClient as Client } from "./client"

import type { Block } from "../demo/blocks"
import type { DemoRow } from "../demo/content"
import { blocksRequest, propertiesRequest, schemaRequest } from "../demo/notion-shape"
import { richTextRequest, textRequest } from "../inline-links"
import { ROWLESS_SLOTS } from "../slots"
import { PROPS } from "./schema"

type Log = (line: string) => void

/** Notion accepts two levels of nesting in one request: a block and its
 *  children. Anything deeper is appended afterwards, under the block it
 *  belongs to. A column list is the exception: its columns cannot be made
 *  empty, so they travel with their contents. */
function oneLevel(blocks: Block[]): { send: Block[]; later: (Block[] | null)[] } {
  const later: (Block[] | null)[] = []
  const send = blocks.map((block) => {
    const payload = { ...(block[block.type] as Record<string, unknown>) }
    const children = (payload.children as Block[] | undefined) ?? []
    if (block.type === "column_list" || block.type === "table") {
      later.push(null)
      return block
    }
    delete payload.children
    later.push(children.length ? children : null)
    return { type: block.type, [block.type]: payload }
  })
  return { send, later }
}

/** Every block under a parent, a hundred at a time, deeper levels after. */
export async function appendTree(notion: Client, parentId: string, blocks: Block[]): Promise<void> {
  for (let start = 0; start < blocks.length; start += 100) {
    const chunk = blocks.slice(start, start + 100)
    const { send, later } = oneLevel(chunk)
    const response = (await notion.blocks.children.append({ block_id: parentId, children: send as never })) as { results: { id: string }[] }
    for (const [k, children] of later.entries()) {
      const created = response.results[k]
      if (children && created) await appendTree(notion, created.id, children)
    }
  }
}

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf" }

/** A file's type from its name, as Notion's upload wants it said. */
export const contentType = (name: string): string => TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream"

/** Uploads the starter content's pictures; a file that fails is left out. */
export async function uploadFiles(
  notion: Client,
  files: { name: string; data: Uint8Array }[],
  log: Log = () => {},
): Promise<Record<string, string>> {
  const uploads: Record<string, string> = {}
  for (const file of files) {
    try {
      const type = contentType(file.name)
      const created = (await notion.fileUploads.create({ mode: "single_part", filename: file.name, content_type: type })) as { id: string }
      // copied into a plain ArrayBuffer-backed array: a Blob takes nothing else
      await notion.fileUploads.send({ file_upload_id: created.id, file: { filename: file.name, data: new Blob([new Uint8Array(file.data)], { type }) } })
      uploads[file.name] = created.id
    } catch (error) {
      log(`  could not upload ${file.name} (${error instanceof Error ? error.message : error}); it is left out`)
    }
  }
  return uploads
}

export async function createDatabase(notion: Client, parentPageId: string, title: string): Promise<{ databaseId: string; dataSourceId: string }> {
  const database = (await notion.databases.create({
    parent: { type: "page_id", page_id: parentPageId },
    title: textRequest(title),
    initial_data_source: { properties: schemaRequest() as never },
  })) as { id: string; data_sources?: { id: string }[] }
  const dataSourceId = database.data_sources?.[0]?.id
  if (!dataSourceId) throw new Error("Notion made the database but returned no data source")
  return { databaseId: database.id, dataSourceId }
}

/** One starter row: its properties and icon, then its body. */
export async function createRow(notion: Client, dataSourceId: string, row: DemoRow, uploads: Record<string, string>): Promise<string> {
  const page = (await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: propertiesRequest(row, uploads) as never,
    ...(row.icon ? { icon: { type: "icon", icon: { name: row.icon, color: "gray" } } as never } : {}),
  })) as { id: string }
  if (row.blocks?.length) await appendTree(notion, page.id, blocksRequest(row.blocks, uploads))
  return page.id
}

/**
 * The slots a database has no Site Copy row for, each with the words the
 * code suggests (copy-keys.json, written by `npm run copy`). A slot meant to
 * have no row (ROWLESS_SLOTS) is never one of them.
 */
export function missingCopy(keys: Record<string, string>, existing: ReadonlySet<string>): [string, string][] {
  return Object.entries(keys).filter(([key]) => !existing.has(key) && !ROWLESS_SLOTS.includes(key))
}

/**
 * One Site Copy row holding a slot's suggested words. Unticked unless asked:
 * on a connected site a slot shows only a ticked row's words, so a row
 * nobody has read never reaches a reader. The starter content is the one
 * thing made ticked, because whoever runs the setup asked for it.
 */
export async function createCopyRow(notion: Client, dataSourceId: string, key: string, text: string, ticked: boolean): Promise<void> {
  await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: {
      [PROPS.title]: { title: textRequest(key) },
      [PROPS.kind]: { select: { name: "Site Copy" } },
      [PROPS.published]: { checkbox: ticked },
      // a web link in the wording arrives as a real Notion link
      [PROPS.text]: { rich_text: richTextRequest(text) },
    } as never,
  })
}
