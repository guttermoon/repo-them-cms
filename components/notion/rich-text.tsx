import type React from "react"

import { colorClass, colorRunClass } from "@/lib/notion-colors"
import { notionHref } from "@/lib/notion/href"
import type { RichRun } from "@/lib/notion/rows"
import type { RenderContext } from "./context"
import { InlineEquation } from "./equation"
import { outsideLink } from "@/lib/outside"

export { colorClass }

/** Where a link in Notion's text goes on this site (lib/notion/href.ts). */
export function resolveHref(href: string | null | undefined, ctx: RenderContext): string | undefined {
  return notionHref(href, ctx.pageUrl)
}

/** An outside address opens in a new tab; this site's own pages do not. */
export function Anchor({ href, className = "n-link", children }: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <a href={href} className={className} {...outsideLink(href)}>
      {children}
    </a>
  )
}

function Mention({ run, ctx }: { run: RichRun; ctx: RenderContext }) {
  const mention = run.mention ?? {}
  const text = run.plain_text ?? ""
  switch (mention.type) {
    case "page": {
      const id = ((mention.page as { id?: string }) ?? {}).id ?? ""
      const href = ctx.pageUrl(id.replace(/-/g, ""))
      return href ? <Anchor href={href}>{text}</Anchor> : <span className="n-c-gray">{text}</span>
    }
    case "date": {
      const start = ((mention.date as { start?: string }) ?? {}).start
      return start ? <time dateTime={start}>{text}</time> : <>{text}</>
    }
    case "link_preview":
    case "link_mention": {
      const url = ((mention[mention.type] as { url?: string; href?: string }) ?? {}).url ?? run.href ?? undefined
      const href = resolveHref(url, ctx)
      return href ? <Anchor href={href}>{text || url}</Anchor> : <>{text}</>
    }
    default:
      // a user, a database, a template mention, a custom emoji: the words
      // Notion prints for it
      return <>{text}</>
  }
}

function Run({ run, ctx }: { run: RichRun; ctx: RenderContext }) {
  const a = run.annotations ?? {}
  let node: React.ReactNode
  if (run.type === "equation") node = <InlineEquation expression={run.equation?.expression ?? run.plain_text ?? ""} />
  else if (run.type === "mention") node = <Mention run={run} ctx={ctx} />
  else node = run.text?.content ?? run.plain_text ?? ""

  if (a.code) node = <code className="n-code-inline">{node}</code>
  if (a.bold) node = <strong className="font-semibold">{node}</strong>
  if (a.italic) node = <em>{node}</em>
  if (a.strikethrough) node = <s>{node}</s>
  if (a.underline) node = <span className="underline underline-offset-2">{node}</span>
  const cls = colorClass(a.color)
  if (cls) node = <span className={colorRunClass(cls)}>{node}</span>

  if (run.type !== "mention") {
    const href = resolveHref(run.href ?? run.text?.link?.url, ctx)
    if (href) node = <Anchor href={href}>{node}</Anchor>
  }
  return <>{node}</>
}

/** A run of Notion rich text, every annotation, colour, link and mention kept. */
export function RichText({ runs, ctx }: { runs: RichRun[] | undefined; ctx: RenderContext }) {
  if (!runs?.length) return null
  return (
    <>
      {runs.map((run, i) => (
        <Run key={i} run={run} ctx={ctx} />
      ))}
    </>
  )
}

/** The words of some rich text, for alt text and titles. */
export const runsPlain = (runs: RichRun[] | undefined): string => (runs ?? []).map((r) => r.plain_text ?? "").join("")
