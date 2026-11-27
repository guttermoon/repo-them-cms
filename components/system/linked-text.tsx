import { Fragment } from "react"
import type React from "react"

import { safeHref } from "@/lib/inline-links"
import { inlineRuns, type InlineRun } from "@/lib/inline-text"
import { sitePathFromHref } from "@/lib/notion/links"
import { SITE_URL } from "@/lib/site"
import { outsideLink } from "@/lib/outside"

/**
 * Words from Notion as nodes: each line break a line break, each link a
 * link, and bold, italic, underline, strikethrough and code as a page's own
 * blocks draw them (components/notion/rich-text.tsx). The words arrive as
 * lib/inline-text.ts keeps them.
 *
 * Not Notion's colours. These are the words the site sets in its own design
 * (a slot, a quotation, an answer, a description, a bio), so they take the
 * site's colours, in every look; a colour or a highlight given in Notion is
 * left out. Colour belongs to a page's or a post's own body, which the
 * writer lays out, and which draws Notion's colours as Notion does.
 *
 * A link to one of this site's pages, as its full address or as a path
 * Notion kept on its app, becomes the path and stays in the tab; one to
 * another site opens in a new tab; one to anywhere but the web, mail, a
 * phone or this site is drawn as its words alone.
 *
 * `words`: the words are those of a link or a button the code draws, and a
 * link inside a link is invalid HTML (React reports it as a hydration
 * error), so a link in them is kept as its words.
 *
 * `colon`: each line's lead-in, up to and including its first colon, is
 * bold ("Brevo: …"), as the privacy notice's list of processors is set.
 *
 * Plain words with nothing to draw come back as a bare string, valid
 * anywhere a string is.
 */
export function inlineNodes(text: string, { key = "t", words = false, colon = false }: { key?: string; words?: boolean; colon?: boolean } = {}): React.ReactNode {
  const lines: InlineRun[][] = [[]]
  for (const run of inlineRuns(text)) {
    run.t.split("\n").forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines[lines.length - 1].push({ ...run, t: part })
    })
  }
  const plain = (r: InlineRun) => !r.b && !r.i && !r.u && !r.s && !r.c && !(r.col && !words) && !(r.href && !words)
  if (lines.length === 1 && !colon && lines[0].every(plain)) return lines[0].map((r) => r.t).join("")
  const out: React.ReactNode[] = []
  lines.forEach((line, n) => {
    if (n > 0) out.push(<br key={`${key}-br${n}`} />)
    out.push(...drawLine(colon ? leadIn(line) : line.map((r) => ({ run: r, lead: false })), `${key}-${n}`, words))
  })
  return out
}

/** Text from a Notion row (a quotation, an answer, a bio, a description)
 *  with its links, line breaks and formatting, as `<T>` draws a slot.
 *  `words` inside a card that is itself a link, as `<T words>`. */
export function LinkedText({ text, words = false }: { text: string; words?: boolean }) {
  return <>{inlineNodes(text, { key: "lt", words })}</>
}

/** Where a link in some words goes on this site, or nowhere. */
function linkTarget(href: string): string | undefined {
  return safeHref(sitePathFromHref(href, SITE_URL) ?? href)
}

/** The runs of a line, those up to and including its first colon marked
 *  as the lead-in. */
function leadIn(line: InlineRun[]): { run: InlineRun; lead: boolean }[] {
  const out: { run: InlineRun; lead: boolean }[] = []
  let done = false
  for (const run of line) {
    const at = done ? -1 : run.t.indexOf(":")
    if (done) out.push({ run, lead: false })
    else if (at === -1) out.push({ run, lead: true })
    else {
      out.push({ run: { ...run, t: run.t.slice(0, at + 1) }, lead: true })
      if (at + 1 < run.t.length) out.push({ run: { ...run, t: run.t.slice(at + 1) }, lead: false })
      done = true
    }
  }
  // a line with no colon has no lead-in
  return done ? out : line.map((run) => ({ run, lead: false }))
}

function drawLine(line: { run: InlineRun; lead: boolean }[], key: string, words: boolean): React.ReactNode[] {
  const lead = line.filter((r) => r.lead).map((r, i) => drawRun(r.run, `${key}-l${i}`, words))
  const rest = line.filter((r) => !r.lead).map((r, i) => drawRun(r.run, `${key}-r${i}`, words))
  return lead.length ? [<strong key={`${key}-lead`}>{lead}</strong>, ...rest] : rest
}

function drawRun(run: InlineRun, key: string, words: boolean): React.ReactNode {
  let node: React.ReactNode = run.t
  if (run.c) node = <code className="n-code-inline">{node}</code>
  if (run.b) node = <strong className="font-semibold">{node}</strong>
  if (run.i) node = <em>{node}</em>
  if (run.s) node = <s>{node}</s>
  if (run.u) node = <span className="underline underline-offset-2">{node}</span>
  // run.col, Notion's colour, is not drawn: these words take the site's
  const href = !words && run.href ? linkTarget(run.href) : undefined
  if (href) {
    node = (
      <a href={href} className="n-link" {...outsideLink(href)}>
        {node}
      </a>
    )
  }
  return <Fragment key={key}>{node}</Fragment>
}
