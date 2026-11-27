/**
 * A Notion page's headings, as the page draws them and as its Markdown
 * writes them (components/notion/blocks.tsx, lib/notion/markdown.ts), so the
 * two outlines are the same.
 */
import type { NBlock } from "./blocks"
import { slugify, type RichRun } from "./rows"

export type HeadingTag = "h2" | "h3" | "h4" | "h5" | "h6"

/**
 * `level` is Notion's (Heading 1 to 4), and sets the look; `tag` is the
 * element, under the page's own <h1>.
 */
export type HeadingRef = { id: string; level: 1 | 2 | 3 | 4; tag: HeadingTag; text: string; anchor: string }

const HEADING_LEVEL: Record<string, 1 | 2 | 3 | 4> = { heading_1: 1, heading_2: 2, heading_3: 3, heading_4: 4 }

const runsText = (runs: RichRun[] | undefined) => (runs ?? []).map((r) => r.plain_text ?? "").join("")

/**
 * Every heading on the page, depth-first, with an anchor made from its words
 * ("Set up the database" → #set-up-the-database, then -2, -3…) and the
 * element it is drawn as.
 *
 * Notion's Heading 1 is an <h2> (the page's title is the <h1>), Heading 2 an
 * <h3>, and so on, except that no heading is ever more than one level below
 * the one before it. People start a page at Heading 2 or put a Heading 3
 * straight under a Heading 1, and a screen reader's list of headings would
 * then have gaps in it; the look stays Notion's either way.
 */
export function collectHeadings(blocks: NBlock[], under: 1 | 2 = 1): HeadingRef[] {
  const out: HeadingRef[] = []
  const used = new Map<string, number>()
  // the heading the body sits under: the page's <h1>, or a section's <h2>
  let last: number = under
  const walk = (list: NBlock[]) => {
    for (const block of list) {
      const level = HEADING_LEVEL[block.type]
      if (level) {
        const text = runsText((block[block.type] as { rich_text?: RichRun[] })?.rich_text)
        const base = slugify(text) || "section"
        const n = (used.get(base) ?? 0) + 1
        used.set(base, n)
        last = Math.min(level + under, last + 1, 6)
        out.push({ id: block.id, level, tag: `h${last}` as HeadingTag, text, anchor: n === 1 ? base : `${base}-${n}` })
      }
      if (block.children) walk(block.children)
    }
  }
  walk(blocks)
  return out
}
