/**
 * A Plan row as /pricing and the homepage show it. The plans are rows and
 * nothing else: no Plan rows, no plans (the starter content's four are rows
 * too, lib/demo/plans.ts).
 *
 * Pure, so the pages and the tests read plans the same way.
 */
import { safeHref } from "./inline-links"
import { inlineWords } from "./inline-text"
import { currencyOf, featureLines, type FeatureLine } from "./pricing"
import type { Entry } from "./notion/rows"

/** The line under the plans on /pricing, and under them in /llms.txt: the
 * `pricing.footnote` slot's built-in wording, kept here so both say it the
 * same way. */
export const PRICING_FOOTNOTE = "Prices include VAT. Stop any time: a plan runs to the end of what you paid for."

export type Plan = {
  key: string
  name: string
  description?: string
  price?: number
  yearlyPrice?: number
  currency: string
  priceNote?: string
  features: FeatureLine[]
  recommended: boolean
  group?: string
  cta?: { href: string; label: string }
}

/** A Plan row as the page shows it. */
export function planFromEntry(entry: Entry): Plan {
  // a row's Link is typed by a person: a button goes only where `safeHref` allows
  const href = entry.link ? safeHref(entry.link) : undefined
  return {
    key: entry.id,
    name: entry.title,
    description: entry.description || undefined,
    price: entry.price,
    yearlyPrice: entry.yearlyPrice,
    currency: currencyOf(entry.currency),
    priceNote: entry.priceNote,
    // each line fills the comparison table, so a line is read as its words
    features: featureLines(inlineWords(entry.text ?? "")),
    recommended: entry.featured,
    group: entry.category?.name,
    cta: href ? { href, label: entry.button || entry.title } : undefined,
  }
}
