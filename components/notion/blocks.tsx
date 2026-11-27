import type React from "react"

import { fillIn } from "@/components/system/notion-text"
import { Divider, Todo } from "@/components/ui/blocks"
import { Icon } from "@/components/ui/icon"
import { hostOf, videoFor } from "@/lib/content/embeds"
import { mediaUrl } from "@/lib/content/media"
import type { NBlock } from "@/lib/notion/blocks"
import { splitCaption } from "@/lib/notion/alt-text"
import { iconFrom, type IconValue, type MediaRef, type RichRun } from "@/lib/notion/rows"
import { CodeBlock } from "./code"
import { NotionIcon } from "./icon"
import type { RenderContext } from "./context"
import { BlockEquation } from "./equation"
import { Anchor, colorClass, resolveHref, RichText, runsPlain } from "./rich-text"
import { VideoEmbed } from "./video-embed"
import { picture } from "@/lib/media-sizes"
import { outsideLink } from "@/lib/outside"

/**
 * A Notion page's body, drawn the way Notion draws it: every block type the
 * API returns, with the colours, toggles, callouts and lists an editor uses.
 * Pictures and files come from this site's /media/ route; videos load only
 * when asked; anything that would open a private part of Notion is left out.
 */

type Payload = {
  rich_text?: RichRun[]
  color?: string
  checked?: boolean
  is_toggleable?: boolean
  icon?: IconValue | null
  language?: string
  caption?: RichRun[]
  expression?: string
  url?: string
  title?: string
  has_column_header?: boolean
  has_row_header?: boolean
  cells?: RichRun[][]
  width_ratio?: number
  media?: MediaRef
  name?: string | null
  external?: string | null
  source?: "file" | "external"
  page_id?: string
  database_id?: string
  type?: string
  list_start_index?: number
}

const payload = (block: NBlock): Payload => (block[block.type] ?? {}) as Payload

/** Children of a block, indented as Notion indents them. */
function Children({ blocks, ctx }: { blocks?: NBlock[]; ctx: RenderContext }) {
  if (!blocks?.length) return null
  return (
    <div className="n-children">
      <Blocks blocks={blocks} ctx={ctx} />
    </div>
  )
}

const LIST_TYPES = new Set(["bulleted_list_item", "numbered_list_item"])

/** Consecutive list items of one kind, as one list. */
type Group = { list: "bulleted_list_item" | "numbered_list_item"; items: NBlock[] } | { block: NBlock }

function group(blocks: NBlock[]): Group[] {
  const out: Group[] = []
  for (const block of blocks) {
    const last = out[out.length - 1]
    if (LIST_TYPES.has(block.type)) {
      if (last && "list" in last && last.list === block.type) last.items.push(block)
      else out.push({ list: block.type as "bulleted_list_item" | "numbered_list_item", items: [block] })
    } else out.push({ block })
  }
  return out
}

/** Every block in order, list items gathered into their lists. */
export function Blocks({ blocks, ctx }: { blocks: NBlock[]; ctx: RenderContext }) {
  return (
    <>
      {group(blocks).map((g) =>
        "list" in g ? (
          <List key={g.items[0].id} kind={g.list} items={g.items} ctx={ctx} />
        ) : (
          <Block key={g.block.id} block={g.block} ctx={ctx} />
        ),
      )}
    </>
  )
}

function List({ kind, items, ctx }: { kind: "bulleted_list_item" | "numbered_list_item"; items: NBlock[]; ctx: RenderContext }) {
  const Tag = kind === "numbered_list_item" ? "ol" : "ul"
  const start = kind === "numbered_list_item" ? payload(items[0]).list_start_index : undefined
  return (
    <Tag className={kind === "numbered_list_item" ? "n-ol" : "n-ul"} {...(start && start > 1 ? { start } : {})}>
      {items.map((item) => {
        const p = payload(item)
        return (
          <li key={item.id} className={colorClass(p.color)}>
            <RichText runs={p.rich_text} ctx={ctx} />
            {item.children?.length ? <Blocks blocks={item.children} ctx={ctx} /> : null}
          </li>
        )
      })}
    </Tag>
  )
}

/** A callout's icon as Notion gives it; Notion's lightbulb when it has none. */
function CalloutIcon({ block }: { block: NBlock }) {
  const icon = iconFrom(payload(block).icon as IconValue | null | undefined, (external) => ({
    owner: "block",
    id: block.id,
    field: "icon",
    v: block.edited ?? "",
    ...(external ? { external } : {}),
  }))
  return icon ? <NotionIcon icon={icon} /> : <Icon name="lightbulb" className="n-c-gray" />
}

const HEADING_TAG = { heading_1: "h2", heading_2: "h3", heading_3: "h4", heading_4: "h5" } as const
const HEADING_CLASS = { heading_1: "n-h1", heading_2: "n-h2", heading_3: "n-h3", heading_4: "n-h4" } as const

/** A block with its caption under it: the block's own, or the one given
 *  (a picture's, without its alt line). */
function Figure({ block, ctx, caption, children }: { block: NBlock; ctx: RenderContext; caption?: RichRun[]; children: React.ReactNode }) {
  const runs = caption ?? payload(block).caption
  return (
    <figure className="my-2">
      {children}
      {runs?.length ? (
        <figcaption className="n-caption">
          <RichText runs={runs} ctx={ctx} />
        </figcaption>
      ) : null}
    </figure>
  )
}

/** A link drawn as Notion's bookmark card. */
function LinkCard({ href, title, caption }: { href: string; title?: string; caption?: string }) {
  return (
    <a
      href={href}
      {...outsideLink(href)}
      className="my-1 flex flex-col rounded-block border border-line-strong px-4 py-3 tone hover:bg-wash"
    >
      <span className="truncate text-small font-medium text-ink">{title || hostOf(href)}</span>
      {caption ? <span className="mt-0.5 line-clamp-2 text-fine text-sub">{caption}</span> : null}
      <span className="mt-1 truncate text-fine text-sub">{href}</span>
    </a>
  )
}

/** A video's words, with its provider filled in. */
function videoLabels(labels: RenderContext["labels"], provider: string) {
  const fill = (text: string) => fillIn(text, { provider })
  return { title: fill(labels.video), play: fill(labels.play), note: fill(labels.playNote), watch: fill(labels.watchOn) }
}

/** A file to open or download, served from this site. */
function FileCard({ block, verb, ctx }: { block: NBlock; verb: string; ctx: RenderContext }) {
  const p = payload(block)
  if (!p.media) return null
  const href = mediaUrl(p.media, block.type === "pdf" ? "document.pdf" : "file")
  const name = p.name || runsPlain(p.caption) || (block.type === "pdf" ? ctx.labels.pdf : ctx.labels.file)
  return (
    <a href={href} className="my-1 flex items-center gap-2 rounded-block px-1.5 py-1.5 text-ui hover:bg-wash">
      <Icon name="paperclip" className="text-lead text-sub" />
      <span className="n-link min-w-0 truncate">{name}</span>
      <span className="ml-auto shrink-0 text-fine text-sub">{verb}</span>
    </a>
  )
}

function Block({ block, ctx }: { block: NBlock; ctx: RenderContext }): React.ReactNode {
  const p = payload(block)
  const color = colorClass(p.color)
  switch (block.type) {
    case "paragraph":
      return (
        <>
          <p className={`n-block ${color}`.trim()}>
            <RichText runs={p.rich_text} ctx={ctx} />
          </p>
          <Children blocks={block.children} ctx={ctx} />
        </>
      )

    case "heading_1":
    case "heading_2":
    case "heading_3":
    case "heading_4": {
      const Tag = ctx.tags.get(block.id) ?? HEADING_TAG[block.type]
      const heading = (
        <Tag id={ctx.anchors.get(block.id)} className={`${HEADING_CLASS[block.type]} ${color}`.trim()}>
          <RichText runs={p.rich_text} ctx={ctx} />
        </Tag>
      )
      if (!p.is_toggleable) return heading
      return (
        <details className="n-toggle-heading">
          <summary className="flex min-h-target items-start gap-1">
            <span aria-hidden="true" className="n-toggle-mark mt-[0.6em] h-[18px] w-[18px] shrink-0 items-center justify-center text-micro">
              ▶
            </span>
            <span className="min-w-0 flex-1 [&>*]:mt-0">{heading}</span>
          </summary>
          <Children blocks={block.children} ctx={ctx} />
        </details>
      )
    }

    case "to_do":
      return (
        <div className={color}>
          <Todo done={Boolean(p.checked)} label={p.checked ? ctx.labels.done : ctx.labels.notDone}>
            <RichText runs={p.rich_text} ctx={ctx} />
          </Todo>
          <Children blocks={block.children} ctx={ctx} />
        </div>
      )

    case "toggle":
      return (
        <details className={`py-[3px] ${color}`.trim()}>
          <summary className="flex min-h-target items-start gap-1 rounded-block px-0.5 py-2.5 hover:bg-wash">
            <span aria-hidden="true" className="n-toggle-mark mt-[3px] h-[18px] w-[18px] shrink-0 items-center justify-center text-micro">
              ▶
            </span>
            <span className="min-w-0 flex-1">
              <RichText runs={p.rich_text} ctx={ctx} />
            </span>
          </summary>
          <Children blocks={block.children} ctx={ctx} />
        </details>
      )

    case "quote":
      return (
        <blockquote className={`n-quote ${color}`.trim()}>
          <RichText runs={p.rich_text} ctx={ctx} />
          {block.children?.length ? <Blocks blocks={block.children} ctx={ctx} /> : null}
        </blockquote>
      )

    case "callout":
      return (
        <div className={`n-callout ${p.color && p.color.endsWith("_background") ? color : p.color && p.color !== "default" ? `${color} n-bg-gray` : ""}`.trim()}>
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center text-head-s leading-none">
            <CalloutIcon block={block} />
          </span>
          <div className="min-w-0 flex-1">
            <div>
              <RichText runs={p.rich_text} ctx={ctx} />
            </div>
            {block.children?.length ? <Blocks blocks={block.children} ctx={ctx} /> : null}
          </div>
        </div>
      )

    case "divider":
      return <Divider />

    case "code": {
      const code = runsPlain(p.rich_text)
      return (
        <CodeBlock
          code={code}
          language={p.language ?? "plain text"}
          caption={p.caption?.length ? runsPlain(p.caption) : undefined}
          labels={{ copy: ctx.labels.copy, copied: ctx.labels.copied, failed: ctx.labels.copyFailed }}
        />
      )
    }

    case "equation":
      return <BlockEquation expression={p.expression ?? ""} />

    case "image": {
      if (!p.media) return null
      // the caption's "Alt:" line is read, not shown (lib/notion/alt-text.ts);
      // without one, the caption under the picture is its description, read
      // once, so the picture itself is not announced a second time
      const { caption, alt } = splitCaption(p.caption)
      return (
        <Figure block={block} ctx={ctx} caption={caption}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img {...picture(mediaUrl(p.media, "image"), "(min-width: 1280px) 1200px, 100vw")} alt={alt ?? ""} className="mx-auto h-auto max-w-full rounded-block" />
        </Figure>
      )
    }

    case "video": {
      const video = p.source === "external" ? videoFor(p.external ?? undefined) : undefined
      if (video) {
        const words = videoLabels(ctx.labels, video.provider)
        return (
          <Figure block={block} ctx={ctx}>
            <VideoEmbed embedUrl={video.embedUrl} watchUrl={video.watchUrl} title={runsPlain(p.caption) || words.title} labels={words} />
          </Figure>
        )
      }
      if (!p.media) return null
      return (
        <Figure block={block} ctx={ctx}>
          <video controls preload="metadata" src={mediaUrl(p.media, "video")} className="w-full rounded-block">
            <a href={mediaUrl(p.media, "video")}>{ctx.labels.downloadVideo}</a>
          </video>
        </Figure>
      )
    }

    case "audio":
      if (!p.media) return null
      return (
        <Figure block={block} ctx={ctx}>
          <audio controls preload="metadata" src={mediaUrl(p.media, "audio")} className="w-full">
            <a href={mediaUrl(p.media, "audio")}>{ctx.labels.downloadAudio}</a>
          </audio>
        </Figure>
      )

    case "pdf":
      return <FileCard block={block} verb={ctx.labels.openPdf} ctx={ctx} />

    case "file":
      return <FileCard block={block} verb={ctx.labels.download} ctx={ctx} />

    case "bookmark":
    case "link_preview":
    case "embed": {
      const url = p.url
      const video = videoFor(url)
      if (video) {
        const words = videoLabels(ctx.labels, video.provider)
        return (
          <Figure block={block} ctx={ctx}>
            <VideoEmbed embedUrl={video.embedUrl} watchUrl={video.watchUrl} title={runsPlain(p.caption) || words.title} labels={words} />
          </Figure>
        )
      }
      const href = resolveHref(url, ctx)
      if (!href) return null
      return <LinkCard href={href} caption={runsPlain(p.caption)} />
    }

    case "table": {
      const rows = (block.children ?? []).filter((r) => r.type === "table_row")
      if (!rows.length) return null
      const [first, ...rest] = rows
      const header = p.has_column_header
      const rowHeader = p.has_row_header
      const cells = (row: NBlock, isHead: boolean) =>
        (payload(row).cells ?? []).map((cell, i) => {
          const content = <RichText runs={cell} ctx={ctx} />
          if (isHead) return <th key={i} scope="col">{content}</th>
          if (rowHeader && i === 0) return <th key={i} scope="row">{content}</th>
          return <td key={i}>{content}</td>
        })
      return (
        <div className="relative my-2 overflow-x-auto" role="region" aria-label={ctx.labels.table} tabIndex={0}>
          <table className="n-table">
            {header ? (
              <thead>
                <tr>{cells(first, true)}</tr>
              </thead>
            ) : null}
            <tbody>
              {(header ? rest : rows).map((row) => (
                <tr key={row.id}>{cells(row, false)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case "column_list": {
      const columns = (block.children ?? []).filter((c) => c.type === "column")
      return (
        <div className="my-1 flex flex-col gap-x-[46px] sm:flex-row">
          {columns.map((column) => {
            // a number, as Notion sends it: anything else in a style is CSS of its own
            const ratio = Number(payload(column).width_ratio)
            return (
              <div key={column.id} className="min-w-0" style={{ flex: Number.isFinite(ratio) && ratio > 0 ? `${ratio} 1 0%` : "1 1 0%" }}>
                <Blocks blocks={column.children ?? []} ctx={ctx} />
              </div>
            )
          })}
        </div>
      )
    }

    case "table_of_contents":
      if (!ctx.headings.length) return null
      return (
        <nav aria-label={ctx.labels.contents} className={`my-1 ${color}`.trim()}>
          <ul>
            {ctx.headings.map((h) => (
              <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 24}px` }}>
                <a href={`#${h.anchor}`} className="block py-[3px] text-small text-sub underline decoration-line-strong underline-offset-2 hover:text-ink">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )

    case "synced_block":
    case "column":
      return block.children?.length ? <Blocks blocks={block.children} ctx={ctx} /> : null

    case "link_to_page": {
      const id = (p.type === "page_id" ? p.page_id : undefined)?.replace(/-/g, "")
      const href = id ? ctx.pageUrl(id) : undefined
      if (!href) return null
      return (
        <p className="n-block">
          <Anchor href={href}>↗ {href}</Anchor>
        </p>
      )
    }

    case "child_page":
      // a page inside a page is not a row of the database, so it has no
      // address here: its title is shown, unlinked
      return p.title ? (
        <p className="n-block flex items-center gap-1.5 text-sub">
          <Icon name="file-text" className="text-lead" />
          {p.title}
        </p>
      ) : null

    default:
      // child databases, breadcrumbs, templates, meeting notes, tabs and
      // anything newer than this renderer: left out rather than half-drawn
      if (process.env.NODE_ENV === "development") console.warn(`[notion] not drawn: a ${block.type} block`)
      return null
  }
}

/** A whole page body in Notion's page style. */
export function NotionBody({ blocks, ctx, font = "default" }: { blocks: NBlock[]; ctx: RenderContext; font?: string }) {
  return (
    <div className="n-page" data-font={font}>
      <Blocks blocks={blocks} ctx={ctx} />
    </div>
  )
}
