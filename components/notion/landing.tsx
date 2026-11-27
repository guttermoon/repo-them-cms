import type React from "react"

import { Bento, ComparisonTable, Faq, FinalCta, HeroCentered, MarketingSection, Quote, SectionHead, StatCards } from "@/components/sections/marketing"
import { ButtonLink, ButtonRow } from "@/components/ui/button"
import { mediaUrl } from "@/lib/content/media"
import { splitCaption } from "@/lib/notion/alt-text"
import type { NBlock } from "@/lib/notion/blocks"
import type { Entry, RichRun } from "@/lib/notion/rows"
import type { Cell, ComparisonGroup } from "@/lib/pricing"
import { Blocks } from "./blocks"
import type { RenderContext } from "./context"
import { resolveHref, RichText, runsPlain } from "./rich-text"
import { LinkedText } from "@/components/system/linked-text"
import { picture } from "@/lib/media-sizes"

/**
 * A Notion page with Layout set to Landing: its top-level blocks set as a
 * marketing page, so a new landing page is written in Notion, not in code
 * (docs/sections.md has the whole mapping).
 *
 * - The page's title is the hero's <h1>. The blocks before the first H1 are
 *   the hero: the first paragraph its lede, a paragraph of nothing but links
 *   its buttons, a picture its visual.
 * - Every H1 starts a section, and is its title. A divider starts one with
 *   no title.
 * - In a section: the first paragraph is its lede; a column list is a row of
 *   cards (each column's first heading the card's title, its first picture
 *   the card's picture); callouts in a row whose first lines are short are
 *   figures; a quote is a big quotation (its children name who said it); a
 *   run of toggles is questions and answers; a table with both header rows
 *   is a comparison table; a picture is shown large, framed.
 * - A section of nothing but words and a line of links is the page's call to
 *   action, centred, with its buttons.
 * - Anything else is drawn as Notion draws it.
 */

type Payload = {
  rich_text?: RichRun[]
  caption?: RichRun[]
  media?: Parameters<typeof mediaUrl>[0]
  has_column_header?: boolean
  has_row_header?: boolean
  cells?: RichRun[][]
}
const payload = (block: NBlock) => (block[block.type] ?? {}) as Payload
const runs = (block: NBlock) => payload(block).rich_text ?? []

/** A paragraph that is nothing but links: a row of buttons. */
function isLinkRow(block: NBlock): boolean {
  if (block.type !== "paragraph") return false
  const live = runs(block).filter((r) => (r.plain_text ?? "").trim())
  return live.length > 0 && live.every((r) => r.href)
}

function Buttons({ block, ctx }: { block: NBlock; ctx: RenderContext }) {
  const links = runs(block).flatMap((r) => {
    const href = resolveHref(r.href, ctx)
    const label = (r.plain_text ?? "").trim()
    return href && label ? [{ href, label }] : []
  })
  return (
    <ButtonRow className="justify-center">
      {links.map((link, i) => (
        <ButtonLink key={`${link.href}-${i}`} href={link.href} tone={i === 0 ? "primary" : "secondary"}>
          {link.label}
        </ButtonLink>
      ))}
    </ButtonRow>
  )
}

function Showcase({ block }: { block: NBlock }) {
  const p = payload(block)
  if (!p.media) return null
  // as in a page's body: the "Alt:" line is read, the rest shown
  const { caption: shown, alt } = splitCaption(p.caption)
  const caption = runsPlain(shown)
  return (
    <figure className="mx-auto max-w-[1100px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img {...picture(mediaUrl(p.media, "image"), "(min-width: 1100px) 1100px, 100vw")} alt={alt ?? ""} className="w-full rounded-panel border border-line shadow-card" />
      {caption ? <figcaption className="mt-3 text-center text-small text-sub">{caption}</figcaption> : null}
    </figure>
  )
}

/** A short first line with a figure in it is a figure ("98%", "#1", "0",
 *  "~1 min"), the rest its label. */
const FIGURE = /^(?=.*[\d#%£$€~])[^\n]{1,10}$/

function calloutParts(block: NBlock): { value: string; label: string } {
  const [first, ...rest] = runsPlain(runs(block)).split("\n")
  return { value: first.trim(), label: rest.join(" ").trim() }
}

function Cards({ block, ctx }: { block: NBlock; ctx: RenderContext }) {
  const columns = (block.children ?? []).filter((c) => c.type === "column")
  return (
    <Bento
      items={columns.map((column, i) => {
        const kids = column.children ?? []
        const heading = kids.find((k) => /^heading_[1-4]$/.test(k.type))
        const picture = kids.find((k) => k.type === "image")
        const rest = kids.filter((k) => k !== heading && k !== picture)
        return {
          key: column.id ?? String(i),
          title: heading ? <RichText runs={runs(heading)} ctx={ctx} /> : "",
          text: rest.length ? (
            <div className="n-page text-body text-sub">
              <Blocks blocks={rest} ctx={ctx} />
            </div>
          ) : (
            ""
          ),
          art: picture ? <Showcase block={picture} /> : undefined,
        }
      })}
    />
  )
}

export type LandingLabels = { yes: string; no: string; feature: string; region: string }

function Comparison({ block, title, labels }: { block: NBlock; title: string; labels: LandingLabels }) {
  const rows = (block.children ?? []).filter((r) => r.type === "table_row").map((r) => (payload(r).cells ?? []).map((cell) => runsPlain(cell).trim()))
  const [head, ...body] = rows
  if (!head || head.length < 2) return null
  const cell = (text: string): Cell =>
    /^(✓|✔|yes|y|true|included)$/i.test(text) ? { kind: "yes" } : /^(—|–|-|no|n|false|)$/i.test(text) ? { kind: "no" } : { kind: "value", text }
  const groups: ComparisonGroup[] = []
  for (const row of body) {
    const [label, ...values] = row
    if (values.every((v) => !v)) {
      groups.push({ name: label, rows: [] })
      continue
    }
    if (!groups.length) groups.push({ name: "", rows: [] })
    groups[groups.length - 1].rows.push({ label, cells: head.slice(1).map((_, i) => cell(values[i] ?? "")) })
  }
  return (
    <ComparisonTable
      label={labels.region}
      caption={title}
      plans={head.slice(1).map((name, i) => ({ key: `${i}-${name}`, name }))}
      groups={groups.filter((g) => g.rows.length)}
      labels={{ ...labels, feature: head[0] || labels.feature }}
    />
  )
}

/**
 * One section's body, block by block, with runs of like blocks together.
 * The first block stands the one gap under the section's heading
 * (`.section-body`), and each after it 40px below the last.
 */
function SectionBody({ blocks, ctx, title, labels, headed }: { blocks: NBlock[]; ctx: RenderContext; title: string; labels: LandingLabels; headed: boolean }) {
  const out: React.ReactNode[] = []
  let loose: NBlock[] = []
  const gap = () => (out.length ? "mt-10" : headed ? "section-body" : "")
  const flush = () => {
    if (loose.length) {
      out.push(
        <div key={`loose-${out.length}`} className={`n-page mx-auto max-w-[760px] ${gap()}`.trim()}>
          <Blocks blocks={loose} ctx={ctx} />
        </div>,
      )
      loose = []
    }
  }
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.type === "toggle") {
      flush()
      const run: NBlock[] = []
      while (blocks[i]?.type === "toggle") run.push(blocks[i++])
      i--
      out.push(
        <div key={`faq-${i}`} className={`mx-auto max-w-[900px] ${gap()}`.trim()}>
          <Faq items={run.map((t, n) => ({ key: t.id ?? String(n), question: <RichText runs={runs(t)} ctx={ctx} />, answer: <Blocks blocks={t.children ?? []} ctx={ctx} /> }))} />
        </div>,
      )
    } else if (block.type === "callout") {
      const run: NBlock[] = []
      let j = i
      while (blocks[j]?.type === "callout") run.push(blocks[j++])
      const figures = run.map(calloutParts)
      if (run.length > 1 && figures.every((f) => FIGURE.test(f.value))) {
        flush()
        out.push(
          <div key={`stats-${i}`} className={gap()}>
            {/* a band: the sections' headings are centred, and every other one is a panel */}
            <StatCards
              band
              items={figures.map((f, n) => ({ key: run[n].id ?? String(n), value: f.value, label: f.label }))}
            />
          </div>,
        )
        i = j - 1
      } else {
        loose.push(block)
      }
    } else if (block.type === "column_list") {
      flush()
      out.push(
        <div key={`cards-${i}`} className={gap()}>
          <Cards block={block} ctx={ctx} />
        </div>,
      )
    } else if (block.type === "quote") {
      flush()
      const [name, role] = (block.children ?? []).map((c) => runsPlain(runs(c)).replace(/^[—–-]\s*/, "").trim()).filter(Boolean)
      out.push(
        <div key={`quote-${i}`} className={gap()}>
          <Quote quote={<RichText runs={runs(block)} ctx={ctx} />} name={name ?? ""} role={role} />
        </div>,
      )
    } else if (block.type === "table" && payload(block).has_column_header && payload(block).has_row_header) {
      flush()
      out.push(
        <div key={`table-${i}`} className={gap()}>
          <Comparison block={block} title={title} labels={labels} />
        </div>,
      )
    } else if (block.type === "image") {
      flush()
      out.push(
        <div key={`image-${i}`} className={gap()}>
          <Showcase block={block} />
        </div>,
      )
    } else if (isLinkRow(block)) {
      flush()
      out.push(
        <div key={`buttons-${i}`} className={gap()}>
          <Buttons block={block} ctx={ctx} />
        </div>,
      )
    } else {
      loose.push(block)
    }
  }
  flush()
  return <>{out}</>
}

type Section = { heading?: NBlock; blocks: NBlock[] }

function split(blocks: NBlock[]): { hero: NBlock[]; sections: Section[] } {
  const hero: NBlock[] = []
  const sections: Section[] = []
  for (const block of blocks) {
    if (block.type === "heading_1") sections.push({ heading: block, blocks: [] })
    else if (block.type === "divider") sections.push({ blocks: [] })
    else if (sections.length) sections[sections.length - 1].blocks.push(block)
    else hero.push(block)
  }
  return { hero, sections }
}

export function LandingPage({ entry, blocks, ctx, labels }: { entry: Entry; blocks: NBlock[]; ctx: RenderContext; labels: LandingLabels }) {
  const { hero, sections } = split(blocks)
  const lede = hero.find((b) => b.type === "paragraph" && !isLinkRow(b))
  const buttons = hero.find(isLinkRow)
  const picture = hero.find((b) => b.type === "image")
  const heroRest = hero.filter((b) => b !== lede && b !== buttons && b !== picture)

  return (
    <article>
      <HeroCentered
        title={entry.title}
        lede={lede ? <RichText runs={runs(lede)} ctx={ctx} /> : entry.description ? <LinkedText text={entry.description} /> : undefined}
        actions={buttons ? <Buttons block={buttons} ctx={ctx} /> : undefined}
        visual={picture ? <Showcase block={picture} /> : undefined}
      />
      {heroRest.length ? (
        <div className="n-page mx-auto max-w-[760px] px-5 pb-12 sm:px-8">
          <Blocks blocks={heroRest} ctx={ctx} />
        </div>
      ) : null}
      {sections.map((section, n) => {
        // the heading's own anchor, so a table of contents on the page finds it
        const titleId = (section.heading && ctx.anchors.get(section.heading.id)) || `section-${n + 1}`
        const title = section.heading ? runsPlain(runs(section.heading)) : ""
        const first = section.blocks[0]
        // a lede belongs under a title; a section a divider opens has none
        const sectionLede = section.heading && first?.type === "paragraph" && !isLinkRow(first) ? first : undefined
        const body = sectionLede ? section.blocks.slice(1) : section.blocks
        const onlyWords = section.heading && body.length > 0 && body.every((b) => isLinkRow(b) || (b.type === "paragraph" && !runs(b).some((r) => r.href)))
        const linkRow = body.find(isLinkRow)
        if (onlyWords && linkRow) {
          const words = body.filter((b) => b !== linkRow)
          return (
            <FinalCta
              key={titleId}
              titleId={titleId}
              title={<RichText runs={runs(section.heading as NBlock)} ctx={ctx} />}
              lede={
                // every paragraph under the title, not the first alone
                sectionLede || words.length ? (
                  <>
                    {[...(sectionLede ? [sectionLede] : []), ...words].map((block, i) => (
                      <span key={block.id} className={i ? "mt-3 block" : "block"}>
                        <RichText runs={runs(block)} ctx={ctx} />
                      </span>
                    ))}
                  </>
                ) : undefined
              }
              actions={<Buttons block={linkRow} ctx={ctx} />}
            />
          )
        }
        return (
          <MarketingSection key={titleId} labelledBy={section.heading ? titleId : undefined} tone={n % 2 ? "panel" : "page"}>
            {section.heading ? (
              <SectionHead
                id={titleId}
                align="center"
                title={<RichText runs={runs(section.heading)} ctx={ctx} />}
                lede={sectionLede ? <RichText runs={runs(sectionLede)} ctx={ctx} /> : undefined}
              />
            ) : null}
            <SectionBody blocks={body} ctx={ctx} title={title} labels={labels} headed={Boolean(section.heading)} />
          </MarketingSection>
        )
      })}
    </article>
  )
}
