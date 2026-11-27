/**
 * The starter content (lib/demo/content.ts) in Notion's two shapes:
 *
 * - as create requests, for `npm run notion:setup` to send to Notion;
 * - as API responses (rows and block trees), for scripts/fake-notion.mjs and
 *   the tests, so the site can be run end to end against a stand-in Notion
 *   that answers exactly as the real one does.
 */
import { createHash } from "node:crypto"

import { richTextRequest, textRequest } from "../inline-links"
import { sendableHref } from "../notion/links"
import { PROPS, SCHEMA } from "../notion/schema"
import type { Block, Run } from "./blocks"
import { EXAMPLE_TAG } from "../content/select"
import type { DemoRow } from "./content"

/** A row's tags; an invented row (a starter review) carries the Example
 *  tag, so a site connected to Notion shows it marked, never as real. */
const tagsOf = (row: DemoRow): string[] => [...(row.tags ?? []), ...(row.example ? [EXAMPLE_TAG] : [])]

// ── requests ────────────────────────────────────────────────────────────────

/** A row's properties as a create request. `uploads` maps a demo file to its
 *  Notion file upload ID. */
export function propertiesRequest(row: DemoRow, uploads: Record<string, string> = {}) {
  const props: Record<string, unknown> = {
    [PROPS.title]: { title: textRequest(row.title) },
    [PROPS.kind]: { select: { name: row.kind } },
    [PROPS.published]: { checkbox: row.published },
  }
  if (row.text !== undefined) props[PROPS.text] = { rich_text: richTextRequest(row.text) }
  if (row.slug) props[PROPS.slug] = { rich_text: textRequest(row.slug) }
  if (row.description) props[PROPS.description] = { rich_text: textRequest(row.description) }
  if (row.date) props[PROPS.publishedDate] = { date: { start: row.date } }
  if (row.category) props[PROPS.category] = { select: { name: row.category } }
  if (tagsOf(row).length) props[PROPS.tags] = { multi_select: tagsOf(row).map((name) => ({ name })) }
  if (row.author) props[PROPS.author] = { rich_text: textRequest(row.author) }
  if (row.authorBio) props[PROPS.authorBio] = { rich_text: textRequest(row.authorBio) }
  if (row.teamPage) props[PROPS.teamPage] = { select: { name: row.teamPage } }
  if (row.featured !== undefined) props[PROPS.featured] = { checkbox: row.featured }
  if (row.featureBlock !== undefined) props[PROPS.featureBlock] = { number: row.featureBlock }
  if (row.order !== undefined) props[PROPS.order] = { number: row.order }
  if (row.action) props[PROPS.action] = { select: { name: row.action } }
  if (row.link) props[PROPS.link] = { url: row.link }
  if (row.font) props[PROPS.font] = { select: { name: row.font } }
  if (row.layout) props[PROPS.layout] = { select: { name: row.layout } }
  if (row.price !== undefined) props[PROPS.price] = { number: row.price }
  if (row.yearlyPrice !== undefined) props[PROPS.yearlyPrice] = { number: row.yearlyPrice }
  if (row.currency) props[PROPS.currency] = { select: { name: row.currency } }
  if (row.priceNote) props[PROPS.priceNote] = { rich_text: textRequest(row.priceNote) }
  if (row.compareAt !== undefined) props[PROPS.compareAt] = { number: row.compareAt }
  if (row.stock) props[PROPS.stock] = { select: { name: row.stock } }
  if (row.checkoutId) props[PROPS.checkoutId] = { rich_text: textRequest(row.checkoutId) }
  if (row.importId) props[PROPS.importId] = { rich_text: textRequest(row.importId) }
  if (row.button) props[PROPS.button] = { rich_text: textRequest(row.button) }
  if (row.rating !== undefined) props[PROPS.rating] = { number: row.rating }
  if (row.cover && uploads[row.cover]) {
    props[PROPS.cover] = { files: [{ type: "file_upload", file_upload: { id: uploads[row.cover] }, name: row.cover }] }
  }
  const gallery = (row.gallery ?? []).filter((name) => uploads[name])
  if (gallery.length) props[PROPS.gallery] = { files: gallery.map((name) => ({ type: "file_upload", file_upload: { id: uploads[name] }, name })) }
  return props
}

/** Runs with each link to one of the site's own pages (/pricing) in the
 *  form Notion's API takes (lib/notion/links.ts). */
const sendableRuns = (runs: unknown) =>
  Array.isArray(runs)
    ? (runs as Run[]).map((run) =>
        run.text?.link?.url ? { ...run, text: { ...run.text, link: { url: sendableHref(run.text.link.url) } } } : run,
      )
    : runs

/** Blocks as a create request: a demo picture becomes its file upload, or is
 *  left out when it was not uploaded; a link to a page here goes as Notion
 *  keeps one. */
export function blocksRequest(blocks: Block[], uploads: Record<string, string> = {}): Block[] {
  return blocks.flatMap((block) => {
    const payload = { ...(block[block.type] as Record<string, unknown>) }
    for (const key of ["rich_text", "caption"]) if (key in payload) payload[key] = sendableRuns(payload[key])
    if (block.type === "table_row") payload.cells = (payload.cells as Run[][]).map((cell) => sendableRuns(cell))
    if (block.type === "image" && payload.type === "demo_file") {
      const id = uploads[payload.demo_file as string]
      if (!id) return []
      return [{ type: "image", image: { type: "file_upload", file_upload: { id }, caption: payload.caption } }]
    }
    if (Array.isArray(payload.children)) payload.children = blocksRequest(payload.children as Block[], uploads)
    return [{ type: block.type, [block.type]: payload }]
  })
}

/** The database's properties as a create request (notion:setup). */
export function schemaRequest() {
  const out: Record<string, unknown> = {}
  for (const prop of SCHEMA) {
    const config =
      prop.type === "select" || prop.type === "multi_select"
        ? { [prop.type]: { options: prop.options ?? [] } }
        : prop.type === "number"
          ? { number: { format: "number" } }
          : { [prop.type]: {} }
    out[prop.name] = { ...config, description: prop.description }
  }
  return out
}

// ── responses (the stand-in Notion) ─────────────────────────────────────────

/** A stable UUID from a name, so every run of the fake answers the same. */
export function fakeId(name: string): string {
  const h = createHash("sha1").update(name).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}

const ANNOTATIONS = { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" }

function runResponse(run: Run) {
  if (run.type === "equation") {
    return { type: "equation", equation: run.equation, annotations: { ...ANNOTATIONS, ...run.annotations }, plain_text: run.equation?.expression ?? "", href: null }
  }
  const content = run.text?.content ?? ""
  const url = run.text?.link?.url ?? null
  return {
    type: "text",
    text: { content, link: url ? { url } : null },
    annotations: { ...ANNOTATIONS, ...run.annotations },
    plain_text: content,
    href: url,
  }
}

const runsResponse = (runs: unknown) => (Array.isArray(runs) ? (runs as Run[]).map(runResponse) : runs)

const optionColor = (prop: string, name: string) =>
  SCHEMA.find((p) => p.name === prop)?.options?.find((o) => o.name === name)?.color ?? "default"

export type FakeTree = Record<string, { block: Record<string, unknown>; children: string[] }>

/**
 * How a demo picture appears in a row or a block: the file object Notion
 * would send, without its name. The stand-in Notion serves the pictures
 * itself (`hostedFiles`); the starter content points at this site's own
 * copies in public/demo (lib/demo/starter.ts).
 */
export type FileShape = (name: string) => Record<string, unknown>

/** Files the stand-in Notion serves at `<base>/files/<name>`, as Notion's own
 *  uploads look: an address that expires (here, never). */
export const hostedFiles =
  (base: string): FileShape =>
  (name) => ({ type: "file", file: { url: `${base}/files/${name}`, expiry_time: "2099-01-01T00:00:00.000Z" } })

/** A block as the API returns it, and its children registered in `tree` by ID. */
function blockResponse(block: Block, id: string, edited: string, tree: FakeTree, file: FileShape): Record<string, unknown> {
  const payload = { ...(block[block.type] as Record<string, unknown>) }
  const children = Array.isArray(payload.children) ? (payload.children as Block[]) : []
  delete payload.children
  for (const key of ["rich_text", "caption"]) if (key in payload) payload[key] = runsResponse(payload[key])
  if (block.type === "table_row") payload.cells = (payload.cells as Run[][]).map((cell) => cell.map(runResponse))
  if (block.type === "image" && payload.type === "demo_file") {
    const name = String(payload.demo_file)
    delete payload.demo_file
    Object.assign(payload, file(name))
  }
  const childIds = children.map((child, n) => {
    const childId = fakeId(`${id}/${n}`)
    tree[childId] = { block: blockResponse(child, childId, edited, tree, file), children: tree[childId]?.children ?? [] }
    return childId
  })
  tree[id] = { block: {}, children: childIds }
  return {
    object: "block",
    id,
    type: block.type,
    has_children: childIds.length > 0,
    created_time: edited,
    last_edited_time: edited,
    in_trash: false,
    [block.type]: payload,
  }
}

/** A row as the API returns it from a data-source query. */
export function rowResponse(row: DemoRow, id: string, edited: string, file: FileShape) {
  const text = (content: string | undefined) => ({ type: "rich_text", rich_text: content ? [runResponse({ type: "text", text: { content } })] : [] })
  const select = (prop: string, name?: string) => ({ type: "select", select: name ? { name, color: optionColor(prop, name) } : null })
  return {
    object: "page",
    id,
    created_time: edited,
    last_edited_time: edited,
    in_trash: false,
    icon: row.icon ? { type: "icon", icon: { name: row.icon, color: "gray" } } : null,
    cover: null,
    properties: {
      [PROPS.title]: { type: "title", title: [runResponse({ type: "text", text: { content: row.title } })] },
      [PROPS.kind]: select(PROPS.kind, row.kind),
      [PROPS.published]: { type: "checkbox", checkbox: row.published },
      [PROPS.text]: text(row.text),
      [PROPS.slug]: text(row.slug),
      [PROPS.description]: text(row.description),
      [PROPS.publishedDate]: { type: "date", date: row.date ? { start: row.date, end: null } : null },
      [PROPS.category]: select(PROPS.category, row.category),
      [PROPS.tags]: { type: "multi_select", multi_select: tagsOf(row).map((name) => ({ name, color: optionColor(PROPS.tags, name) })) },
      [PROPS.author]: text(row.author),
      [PROPS.authorBio]: text(row.authorBio),
      [PROPS.teamPage]: select(PROPS.teamPage, row.teamPage),
      [PROPS.featured]: { type: "checkbox", checkbox: Boolean(row.featured) },
      [PROPS.featureBlock]: { type: "number", number: row.featureBlock ?? null },
      [PROPS.order]: { type: "number", number: row.order ?? null },
      [PROPS.action]: select(PROPS.action, row.action),
      [PROPS.link]: { type: "url", url: row.link ?? null },
      [PROPS.font]: select(PROPS.font, row.font),
      [PROPS.fullWidth]: { type: "checkbox", checkbox: false },
      [PROPS.layout]: select(PROPS.layout, row.layout),
      [PROPS.price]: { type: "number", number: row.price ?? null },
      [PROPS.yearlyPrice]: { type: "number", number: row.yearlyPrice ?? null },
      [PROPS.currency]: select(PROPS.currency, row.currency),
      [PROPS.priceNote]: text(row.priceNote),
      [PROPS.compareAt]: { type: "number", number: row.compareAt ?? null },
      [PROPS.stock]: select(PROPS.stock, row.stock),
      [PROPS.checkoutId]: text(row.checkoutId),
      [PROPS.importId]: text(row.importId),
      [PROPS.button]: text(row.button),
      [PROPS.rating]: { type: "number", number: row.rating ?? null },
      [PROPS.gallery]: {
        type: "files",
        files: (row.gallery ?? []).map((name) => ({ name, ...file(name) })),
      },
      [PROPS.cover]: {
        type: "files",
        files: row.cover ? [{ name: row.cover, ...file(row.cover) }] : [],
      },
    },
  }
}

/** Every demo row and every block under it, as the fake serves them. */
export function fakeDatabase(rows: DemoRow[], file: FileShape, edited = "2026-11-23T09:00:00.000Z") {
  const tree: FakeTree = {}
  const pages = rows.map((row, n) => {
    const id = fakeId(`row/${n}/${row.title}`)
    const blocks = row.blocks ?? []
    const childIds = blocks.map((block, k) => {
      const blockId = fakeId(`${id}/${k}`)
      const response = blockResponse(block, blockId, edited, tree, file)
      tree[blockId] = { block: response, children: tree[blockId]?.children ?? [] }
      return blockId
    })
    tree[id] = { block: { object: "page", id }, children: childIds }
    return rowResponse(row, id, edited, file)
  })
  return { pages, tree }
}
