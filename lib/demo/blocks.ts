/**
 * Notion blocks as the API takes them in a create request, built by small
 * functions so the starter content (lib/demo/content.ts) reads like the
 * page it makes. Imports nothing.
 */
export type Color =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | `${"gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red"}_background`

export type Run = {
  type: "text" | "equation"
  text?: { content: string; link?: { url: string } | null }
  equation?: { expression: string }
  annotations?: Partial<{ bold: boolean; italic: boolean; strikethrough: boolean; underline: boolean; code: boolean; color: Color }>
}

export type Block = { type: string; [payload: string]: unknown }

type Inline = string | Run

/** Plain words, or a run already made. */
const runs = (parts: Inline[]): Run[] => parts.map((p) => (typeof p === "string" ? { type: "text", text: { content: p } } : p))

// ── inline ──────────────────────────────────────────────────────────────────
export const b = (content: string): Run => ({ type: "text", text: { content }, annotations: { bold: true } })
export const i = (content: string): Run => ({ type: "text", text: { content }, annotations: { italic: true } })
export const s = (content: string): Run => ({ type: "text", text: { content }, annotations: { strikethrough: true } })
export const u = (content: string): Run => ({ type: "text", text: { content }, annotations: { underline: true } })
export const code = (content: string): Run => ({ type: "text", text: { content }, annotations: { code: true } })
export const color = (content: string, c: Color): Run => ({ type: "text", text: { content }, annotations: { color: c } })
export const link = (content: string, url: string): Run => ({ type: "text", text: { content, link: { url } } })
export const math = (expression: string): Run => ({ type: "equation", equation: { expression } })

// ── blocks ──────────────────────────────────────────────────────────────────
const text = (type: string, parts: Inline[], extra: Record<string, unknown> = {}, children?: Block[]): Block => ({
  type,
  [type]: { rich_text: runs(parts), ...extra, ...(children?.length ? { children } : {}) },
})

export const p = (...parts: Inline[]) => text("paragraph", parts)
export const h1 = (...parts: Inline[]) => text("heading_1", parts)
export const h2 = (...parts: Inline[]) => text("heading_2", parts)
export const h3 = (...parts: Inline[]) => text("heading_3", parts)
export const toggleHeading = (level: 1 | 2 | 3, title: Inline[], children: Block[]) =>
  text(`heading_${level}`, title, { is_toggleable: true }, children)
export const bullet = (parts: Inline[], children?: Block[]) => text("bulleted_list_item", parts, {}, children)
export const numbered = (parts: Inline[], children?: Block[]) => text("numbered_list_item", parts, {}, children)
export const todo = (parts: Inline[], checked = false) => text("to_do", parts, { checked })
export const toggle = (summary: Inline[], children: Block[]) => text("toggle", summary, {}, children)
export const quote = (...parts: Inline[]) => text("quote", parts)
/** A callout with one of Notion's own icons, by its name in Notion (gray). */
export const callout = (icon: string, parts: Inline[], c: Color = "gray_background") =>
  text("callout", parts, { icon: { type: "icon", icon: { name: icon, color: "gray" } }, color: c })
export const divider = (): Block => ({ type: "divider", divider: {} })
export const codeBlock = (language: string, content: string, caption?: string): Block => ({
  type: "code",
  code: { language, rich_text: runs([content]), ...(caption ? { caption: runs([caption]) } : {}) },
})
export const equation = (expression: string): Block => ({ type: "equation", equation: { expression } })
export const toc = (): Block => ({ type: "table_of_contents", table_of_contents: { color: "gray" } })
export const bookmark = (url: string, caption?: string): Block => ({
  type: "bookmark",
  bookmark: { url, ...(caption ? { caption: runs([caption]) } : {}) },
})
export const video = (url: string, caption?: string): Block => ({
  type: "video",
  video: { type: "external", external: { url }, ...(caption ? { caption: runs([caption]) } : {}) },
})
/** An image uploaded from public/demo (the setup script uploads the file and
 *  fills in its upload ID; the fake Notion serves it). */
export const image = (file: string, caption: string): Block => ({
  type: "image",
  image: { type: "demo_file", demo_file: file, caption: runs([caption]) },
})
export const table = (rows: string[][], header = true, rowHeader = false): Block => ({
  type: "table",
  table: {
    table_width: rows[0]?.length ?? 1,
    has_column_header: header,
    has_row_header: rowHeader,
    children: rows.map((cells) => ({ type: "table_row", table_row: { cells: cells.map((c) => runs([c])) } })),
  },
})
export const columns = (...cols: Block[][]): Block => ({
  type: "column_list",
  column_list: { children: cols.map((children) => ({ type: "column", column: { children } })) },
})
