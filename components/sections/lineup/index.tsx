import { Fragment } from "react"
import type React from "react"

import { makeT } from "@/components/system/notion-text"
import type { Entry, SiteData } from "@/lib/notion/rows"
import { isPanel, lineup, type SectionKey, type SectionPage } from "@/lib/sections"
import type { SectionDraw } from "./context"
import { HOME_SECTIONS } from "./home"
import { listedQuestions, PAGE_SECTIONS, pricingQuestions } from "./pages"

/** Every section, drawn: a Record, so a section named in lib/sections.ts
 *  does not type-check until it has its drawing. */
const DRAW: Record<SectionKey, SectionDraw> = { ...HOME_SECTIONS, ...PAGE_SECTIONS }

/** The sections whose questions a page's FAQPage data names, wherever they
 *  show: structured data says what the page says, and no more. */
const QUESTIONS: Partial<Record<SectionKey, (data: SiteData) => Entry[]>> = {
  "pricing.faq": pricingQuestions,
  "questions.list": listedQuestions,
}

/** The questions the sections on a page show, for its structured data. */
export function pageQuestions(data: SiteData, page: SectionPage): Entry[] {
  const seen = new Set<string>()
  return lineup(data.sections, page)
    .flatMap((key) => QUESTIONS[key]?.(data) ?? [])
    .filter((row) => (seen.has(row.id) ? false : (seen.add(row.id), true)))
}

/**
 * A designed page's sections below its hero, as Notion's Section rows place
 * them (lib/sections.ts, docs/sections.md). Each is drawn with ids no other
 * on the page has (a section shown twice is `plans-title`, then
 * `plans-title-2`), and on its own ground, except that a panel never runs
 * on from another: the second sits on the page's.
 *
 * Synchronous, so jsdom can render it: the page fetches, this draws.
 */
export function Lineup({ page, data }: { page: SectionPage; data: SiteData }) {
  const content = data.copy
  const T = makeT(content)
  const used = new Map<string, number>()
  const id = (name: string) => {
    const n = (used.get(name) ?? 0) + 1
    used.set(name, n)
    return n === 1 ? name : `${name}-${n}`
  }
  const drawn: React.ReactNode[] = []
  let panel = false
  lineup(data.sections, page).forEach((key, i) => {
    const tone = isPanel(key) && !panel ? "panel" : "page"
    const node = DRAW[key]({ data, content, T, id, tone, first: drawn.length === 0 })
    if (node === null || node === undefined || node === false) return
    drawn.push(
      <Fragment key={`${key}-${i}`}>
        {node}
      </Fragment>,
    )
    panel = tone === "panel"
  })
  return <>{drawn}</>
}
