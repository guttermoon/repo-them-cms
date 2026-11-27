/**
 * A page written in Notion as Markdown (CommonMark, with GitHub's tables and
 * task lists): the copy every page, post and product of a live shop has at
 * its address with .md added (app/markdown, the rewrite in next.config.mjs).
 *
 * For whoever reads a page without drawing it, an assistant above all: the
 * page's words in a few kilobytes, where its HTML carries the frame, the
 * styles and React's payload round them. So it says what the page says and
 * nothing else. The blocks are the ones the page draws
 * (components/notion/blocks.tsx), the links go where the page's links go
 * (lib/notion/href.ts), every address is absolute, files come through this
 * site's /media/, the headings keep the page's outline
 * (lib/notion/headings.ts), and what the page leaves out (a child database,
 * a link into a private workspace) is left out here too.
 *
 * Pure: the site's addresses come in through the context, so `npm test`
 * checks every block (tests/markdown.test.mjs).
 */
import type { BlockLabels } from "../../components/notion/context"
import { hostOf, videoFor } from "../content/embeds"
import type { NBlock } from "./blocks"
import { collectHeadings } from "./headings"
import { notionHref } from "./href"
import type { IconValue, MediaRef, RichRun } from "./rows"

export type MarkdownContext = {
  /** A path on this site as a full address; a full address as it is. */
  absolute: (href: string) => string
  /** The address of a live page, post or product by its Notion ID. */
  pageUrl: (notionId: string) => string | undefined
  /** A file's address on this site (lib/content/media.ts, `mediaUrl`). */
  media: (ref: MediaRef, name: string) => string
  /** The renderer's own words, as the site's copy has them. */
  labels: BlockLabels
}

type Payload = {
  rich_text?: RichRun[]
  caption?: RichRun[]
  checked?: boolean
  is_toggleable?: boolean
  icon?: IconValue | null
  language?: string
  expression?: string
  url?: string
  title?: string
  has_column_header?: boolean
  cells?: RichRun[][]
  media?: MediaRef
  name?: string | null
  external?: string | null
  source?: "file" | "external"
  page_id?: string
  type?: string
  list_start_index?: number
}

const payload = (block: NBlock): Payload => (block[block.type] ?? {}) as Payload

// ------------------------------------------------------------------- words

/** Characters Markdown would read as markup, wherever they stand. */
const escape = (text: string) => text.replace(/([\\`*_[\]<])/g, "\\$1")

/** A line that would start a heading, a quotation, a list or a rule. */
const escapeLineStart = (line: string) =>
  line
    // "1. " would number a list: the full stop is what is escaped
    .replace(/^(\s*\d{1,9})([.)])(?=\s|$)/, "$1\\$2")
    .replace(/^(\s*)(#{1,6}(?=\s|$)|>|[-+](?=\s|$)|-{3,}\s*$|={3,}\s*$)/, "$1\\$2")

/** Code in a line of text, fenced with more backticks than it holds. */
function inlineCode(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = "`".repeat(longest + 1)
  // a backtick at either end would join the fence: a space keeps them apart
  const pad = /^`|`$/.test(text) ? " " : ""
  return `${fence}${pad}${text}${pad}${fence}`
}

/** An address as a Markdown link's target: angle brackets round anything
 *  with a space or a bracket in it. */
const target = (href: string) => (/[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, encodeURIComponent)}>` : href)

type Piece = { text: string; code: boolean; bold: boolean; italic: boolean; strike: boolean; href?: string; raw?: boolean }

const sameStyle = (a: Piece, b: Piece) => !a.raw && !b.raw && a.code === b.code && a.bold === b.bold && a.italic === b.italic && a.strike === b.strike && a.href === b.href

/** Where a mention goes: a live page, or the address it names. */
function mentionHref(run: RichRun, ctx: MarkdownContext): string | undefined {
  const mention = run.mention ?? {}
  if (mention.type === "page") return ctx.pageUrl((((mention.page as { id?: string }) ?? {}).id ?? "").replace(/-/g, ""))
  if (mention.type === "link_preview" || mention.type === "link_mention") {
    const url = ((mention[mention.type] as { url?: string }) ?? {}).url ?? run.href ?? undefined
    return notionHref(url, ctx.pageUrl)
  }
  return undefined
}

/**
 * Notion's rich text as Markdown: bold, italic, strikethrough and code as
 * Markdown marks them, links to their addresses here, equations between
 * dollars. Underline and colour have no Markdown, and are left as words.
 * Runs Notion split with the same formatting are joined first, so a bold
 * phrase is one bold phrase.
 */
export function runsMarkdown(runs: RichRun[] | undefined, ctx: MarkdownContext): string {
  const pieces: Piece[] = []
  for (const run of runs ?? []) {
    const a = run.annotations ?? {}
    const style = { code: Boolean(a.code), bold: Boolean(a.bold), italic: Boolean(a.italic), strike: Boolean(a.strikethrough) }
    if (run.type === "equation") {
      pieces.push({ ...style, code: false, text: `$${run.equation?.expression ?? run.plain_text ?? ""}$`, raw: true })
      continue
    }
    const text = run.type === "mention" ? (run.plain_text ?? "") : (run.text?.content ?? run.plain_text ?? "")
    const href = run.type === "mention" ? mentionHref(run, ctx) : notionHref(run.href ?? run.text?.link?.url, ctx.pageUrl)
    const piece: Piece = { ...style, text, ...(href ? { href: ctx.absolute(href) } : {}) }
    const last = pieces[pieces.length - 1]
    if (last && sameStyle(last, piece)) last.text += piece.text
    else pieces.push(piece)
  }
  return pieces
    .map((piece) => {
      if (piece.raw) return piece.text
      if (!piece.text) return ""
      // marks hug the words: the spaces round them stay outside
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece.text) as RegExpExecArray
      if (!core) return piece.text
      let md = piece.code ? inlineCode(core) : escape(core)
      if (piece.strike) md = `~~${md}~~`
      if (piece.italic) md = `*${md}*`
      if (piece.bold) md = `**${md}**`
      if (piece.href) md = `[${md}](${target(piece.href)})`
      return `${lead}${md}${trail}`
    })
    .join("")
    .split("\n")
    .map(escapeLineStart)
    .join("\\\n")
}

const plain = (runs: RichRun[] | undefined) => (runs ?? []).map((r) => r.plain_text ?? "").join("")

/** Every line moved in, for what stands inside a list item. */
const indent = (text: string, by: number) =>
  text
    .split("\n")
    .map((line) => (line ? `${" ".repeat(by)}${line}` : line))
    .join("\n")

/** Every line made part of a quotation. */
const quote = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n")

const linkTo = (words: string, href: string) => `[${escape(words)}](${target(href)})`

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

// ------------------------------------------------------------------ blocks

const LIST_TYPES = new Set(["bulleted_list_item", "numbered_list_item", "to_do"])

type Walk = { ctx: MarkdownContext; heading: Map<string, number> }

/** Consecutive items of one kind of list as one list, item under item. */
function list(items: NBlock[], walk: Walk): string {
  const start = items[0].type === "numbered_list_item" ? (payload(items[0]).list_start_index ?? 1) : 1
  return items
    .map((item, i) => {
      const p = payload(item)
      const marker = item.type === "numbered_list_item" ? `${start + i}.` : item.type === "to_do" ? `- [${p.checked ? "x" : " "}]` : "-"
      // the item's own lines line up under its first word
      const width = item.type === "to_do" ? 2 : marker.length + 1
      const text = runsMarkdown(p.rich_text, walk.ctx)
      const children = item.children?.length ? blocks(item.children, walk) : ""
      // a list straight under the item's words; anything else a paragraph
      // apart, or Markdown would run it on into the item's own line
      const gap = /^([-+*]|\d{1,9}[.)])\s/.test(children) ? "\n" : "\n\n"
      const body = [indent(text, width).trimStart(), children ? indent(children, width) : ""].filter(Boolean).join(gap)
      return `${marker} ${body}`.trimEnd()
    })
    .join("\n")
}

/** A file served from this site, as a link with its name. */
function fileLink(block: NBlock, walk: Walk, name: string, words: string): string {
  const p = payload(block)
  return p.media ? linkTo(words, walk.ctx.absolute(walk.ctx.media(p.media, name))) : ""
}

/** A YouTube or Vimeo video, as a link to watch it where it lives. */
function videoLink(url: string | undefined, caption: string, walk: Walk): string {
  const video = videoFor(url)
  return video ? linkTo(caption || fill(walk.ctx.labels.video, { provider: video.provider }), video.watchUrl) : ""
}

function table(block: NBlock, walk: Walk): string {
  const rows = (block.children ?? []).filter((row) => row.type === "table_row")
  if (!rows.length) return ""
  const cells = (row: NBlock) => (payload(row).cells ?? []).map((cell) => runsMarkdown(cell, walk.ctx).replace(/\\\n/g, " ").replace(/\|/g, "\\|") || " ")
  const width = Math.max(...rows.map((row) => (payload(row).cells ?? []).length))
  const line = (values: string[]) => `| ${Array.from({ length: width }, (_, i) => values[i] ?? " ").join(" | ")} |`
  // Markdown's table needs a header row: a table without one gets an empty one
  const [head, ...rest] = payload(block).has_column_header ? [cells(rows[0]), ...rows.slice(1).map(cells)] : [[], ...rows.map(cells)]
  return [line(head), `|${" --- |".repeat(width)}`, ...rest.map(line)].join("\n")
}

function block(b: NBlock, walk: Walk): string {
  const p = payload(b)
  const { ctx } = walk
  const children = () => (b.children?.length ? blocks(b.children, walk) : "")
  const join = (...parts: string[]) => parts.filter(Boolean).join("\n\n")
  switch (b.type) {
    case "paragraph":
      return join(runsMarkdown(p.rich_text, ctx), children())

    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "heading_4": {
      const text = runsMarkdown(p.rich_text, ctx).replace(/\\\n/g, " ")
      // the page's own outline: <h2> is ##, and never a level skipped
      const heading = text ? `${"#".repeat(walk.heading.get(b.id) ?? 2)} ${text}` : ""
      return join(heading, p.is_toggleable ? children() : "")
    }

    case "toggle":
      return join(runsMarkdown(p.rich_text, ctx), children())

    case "quote":
      return quote(join(runsMarkdown(p.rich_text, ctx), children()))

    case "callout": {
      // a writer's emoji stays; an icon is a picture, and is left out
      const icon = p.icon as { type?: string; emoji?: string } | null | undefined
      const emoji = icon?.type === "emoji" && icon.emoji ? `${icon.emoji} ` : ""
      const text = runsMarkdown(p.rich_text, ctx)
      return quote(join(text ? `${emoji}${text}` : "", children()))
    }

    case "divider":
      return "---"

    case "code": {
      const code = plain(p.rich_text)
      const longest = Math.max(2, ...(code.match(/`{3,}/g) ?? []).map((run) => run.length))
      const fence = "`".repeat(longest + 1)
      const language = (p.language ?? "").toLowerCase() === "plain text" ? "" : (p.language ?? "").toLowerCase().replace(/\s+/g, "-")
      return join(`${fence}${language}\n${code}\n${fence}`, runsMarkdown(p.caption, ctx))
    }

    case "equation":
      return p.expression ? `$$\n${p.expression}\n$$` : ""

    case "image":
      return p.media ? `![${escape(plain(p.caption))}](${target(ctx.absolute(ctx.media(p.media, "image")))})` : ""

    case "video": {
      const caption = plain(p.caption)
      if (p.source === "external") return videoLink(p.external ?? undefined, caption, walk) || (p.media ? fileLink(b, walk, "video", caption || ctx.labels.downloadVideo) : "")
      return fileLink(b, walk, "video", caption || ctx.labels.downloadVideo)
    }

    case "audio":
      return fileLink(b, walk, "audio", plain(p.caption) || ctx.labels.downloadAudio)

    case "pdf":
      return fileLink(b, walk, "document.pdf", p.name || plain(p.caption) || ctx.labels.pdf)

    case "file":
      return fileLink(b, walk, "file", p.name || plain(p.caption) || ctx.labels.file)

    case "bookmark":
    case "link_preview":
    case "embed": {
      const caption = plain(p.caption)
      const video = videoLink(p.url, caption, walk)
      if (video) return video
      const href = notionHref(p.url, ctx.pageUrl)
      return href ? linkTo(caption || hostOf(ctx.absolute(href)), ctx.absolute(href)) : ""
    }

    case "table":
      return table(b, walk)

    case "column_list":
      return join(...(b.children ?? []).filter((c) => c.type === "column").map((column) => blocks(column.children ?? [], walk)))

    case "synced_block":
    case "column":
      return children()

    case "link_to_page": {
      const id = (p.type === "page_id" ? p.page_id : undefined)?.replace(/-/g, "")
      const href = id ? ctx.pageUrl(id) : undefined
      return href ? `<${ctx.absolute(href)}>` : ""
    }

    case "child_page":
      return p.title ? escapeLineStart(escape(p.title)) : ""

    default:
      // a table of contents points at anchors only the page has; child
      // databases, breadcrumbs, templates and anything newer are left out,
      // as the page leaves them out
      return ""
  }
}

/** Blocks in order, list items gathered into their lists. */
function blocks(list_: NBlock[], walk: Walk): string {
  const out: string[] = []
  let run: NBlock[] = []
  const flush = () => {
    if (run.length) out.push(list(run, walk))
    run = []
  }
  for (const b of list_) {
    if (LIST_TYPES.has(b.type) && (!run.length || run[0].type === b.type)) {
      run.push(b)
      continue
    }
    flush()
    if (LIST_TYPES.has(b.type)) {
      run.push(b)
      continue
    }
    const md = block(b, walk)
    if (md.trim()) out.push(md)
  }
  flush()
  return out.join("\n\n")
}

/** A page's body as Markdown, its headings under the page's own `#`. */
export function blocksMarkdown(body: NBlock[], ctx: MarkdownContext): string {
  const heading = new Map(collectHeadings(body).map((h) => [h.id, Number(h.tag.slice(1))]))
  return blocks(body, { ctx, heading })
}

/** A field of the document's front matter: words, a number, or a list of
 *  words. Empty fields are left out. */
export type FrontMatter = Record<string, string | number | string[] | undefined>

/**
 * A whole document: its facts as front matter (YAML, each value written as
 * JSON, which YAML reads as it is), its title as the one `#` heading, then
 * its body.
 */
export function markdownDocument(fields: FrontMatter, title: string, body: string): string {
  const facts = Object.entries(fields).filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ""))
  const head = facts.length ? ["---", ...facts.map(([key, value]) => `${key}: ${JSON.stringify(value)}`), "---", ""] : []
  return [...head, `# ${escape(title).replace(/\s*\n\s*/g, " ")}`, "", ...(body ? [body, ""] : [])].join("\n")
}
