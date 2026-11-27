/**
 * A Notion page's body as a tree of blocks, fetched and trimmed for the
 * renderer (components/notion/blocks.tsx).
 *
 * Nothing here talks to Notion directly: the caller hands in the one call
 * that lists a block's children (lib/notion/client.ts, already behind the
 * rate limiter), so `npm test` runs this against a fake
 * (tests/notion-blocks.test.mjs).
 */
import { cutAtWord } from "../page-meta"
import type { MediaRef, RichRun } from "./rows"

/** One block, with the fields the renderer reads and its children inline. */
export type NBlock = {
  id: string
  type: string
  /** the block's last edit: part of a callout icon's /media/ address */
  edited?: string
  children?: NBlock[]
  /** the payload under the block's own type name, e.g. `paragraph` */
  [payload: string]: unknown
}

export type ChildrenPage = { results: unknown[]; has_more: boolean; next_cursor: string | null }
export type ListChildren = (blockId: string, cursor?: string) => Promise<ChildrenPage>

type RawBlock = {
  id?: string
  type?: string
  has_children?: boolean
  last_edited_time?: string
  in_trash?: boolean
  archived?: boolean
  [key: string]: unknown
}

/** Block types whose files the media route serves. */
export const MEDIA_TYPES = ["image", "video", "file", "pdf", "audio"] as const

/** Children of these are a page of their own, not part of this one. */
const NO_DESCENT = new Set(["child_page", "child_database", "unsupported"])

/** How deep and how big one page may be. Past either, the rest is left out
 *  and the server log says so: a page that size is a mistake, and fetching it
 *  would spend the integration's whole request budget on one render. */
export const MAX_DEPTH = 8
export const MAX_BLOCKS = 2000

/**
 * A block's payload with Notion's expiring file address removed. A file
 * block keeps where its file is (a MediaRef the media route resolves) and
 * its caption and name.
 */
function trim(raw: RawBlock): NBlock | null {
  const id = raw.id
  const type = raw.type
  if (!id || !type || raw.in_trash || raw.archived) return null
  const payload = (raw[type] ?? {}) as Record<string, unknown>

  if ((MEDIA_TYPES as readonly string[]).includes(type)) {
    const external = payload.type === "external" ? (payload.external as { url?: string } | undefined)?.url?.trim() : undefined
    const media: MediaRef = {
      owner: "block",
      id,
      field: "block",
      v: raw.last_edited_time ?? "",
      ...(external ? { external } : {}),
      ...(typeof payload.name === "string" && payload.name ? { name: payload.name } : {}),
    }
    return {
      id,
      type,
      edited: raw.last_edited_time ?? "",
      [type]: {
        caption: (payload.caption as RichRun[] | undefined) ?? [],
        source: payload.type === "external" ? "external" : "file",
        external: external ?? null,
        name: typeof payload.name === "string" ? payload.name : null,
        media,
      },
    }
  }

  return { id, type, ...(type === "callout" ? { edited: raw.last_edited_time ?? "" } : {}), [type]: payload }
}

/**
 * Every block under `rootId`, children inline, siblings fetched side by side
 * (the limiter inside `list` keeps that to Notion's budget). A synced block's
 * copy reads the original's children, as Notion shows them. Child pages and
 * databases are listed but not descended into.
 */
export async function fetchBlockTree(rootId: string, list: ListChildren): Promise<NBlock[]> {
  let count = 0
  let warned = false

  const children = async (blockId: string, depth: number): Promise<NBlock[]> => {
    const raws: RawBlock[] = []
    let cursor: string | undefined
    do {
      const page = await list(blockId, cursor)
      raws.push(...(page.results as RawBlock[]))
      cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
    } while (cursor)

    const blocks: NBlock[] = []
    for (const raw of raws) {
      if (count >= MAX_BLOCKS) {
        if (!warned) {
          warned = true
          console.warn(`[notion] ${rootId} has more than ${MAX_BLOCKS} blocks; the rest are left out`)
        }
        break
      }
      const block = trim(raw)
      if (!block) continue
      count++
      blocks.push(block)
    }

    await Promise.all(
      blocks.map(async (block, i) => {
        const raw = raws.find((r) => r.id === block.id)
        if (!raw?.has_children || NO_DESCENT.has(block.type)) return
        if (depth + 1 > MAX_DEPTH) return
        const syncedFrom =
          block.type === "synced_block"
            ? ((block.synced_block as { synced_from?: { block_id?: string } | null })?.synced_from?.block_id ?? undefined)
            : undefined
        blocks[i] = { ...block, children: await children(syncedFrom ?? block.id, depth + 1) }
      }),
    )
    return blocks
  }

  return children(rootId, 0)
}

/**
 * A summary of a page in its own words, for a search result when its row has
 * no Description: its first paragraphs, cut at a word to the length a search
 * result prints whole (`SEARCH_LIMITS` in lib/page-meta.ts).
 */
export function blocksExcerpt(blocks: NBlock[], max = 160): string {
  const parts: string[] = []
  let length = 0
  const walk = (list: NBlock[]) => {
    for (const block of list) {
      if (length > max) return
      if (block.type === "paragraph") {
        const runs = (block.paragraph as { rich_text?: RichRun[] } | undefined)?.rich_text ?? []
        const text = runs
          .map((r) => r.plain_text ?? "")
          .join("")
          .replace(/\s+/g, " ")
          .trim()
        if (text) {
          parts.push(text)
          length += text.length + 1
        }
      }
      if (block.children) walk(block.children)
    }
  }
  walk(blocks)
  return cutAtWord(parts.join(" "), max)
}

/** The plain words of a list of blocks, for a reading time and a summary. */
export function blocksText(blocks: NBlock[]): string {
  const out: string[] = []
  const walk = (list: NBlock[]) => {
    for (const block of list) {
      const payload = block[block.type] as { rich_text?: RichRun[]; caption?: RichRun[] } | undefined
      const runs = payload?.rich_text ?? []
      const text = runs.map((r) => r.plain_text ?? "").join("")
      if (text) out.push(text)
      if (block.children) walk(block.children)
    }
  }
  walk(blocks)
  return out.join("\n")
}
