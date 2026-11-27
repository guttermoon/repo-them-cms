/**
 * Prices, as the pricing sections and the shop print them. Pure (no React,
 * no Next), so `npm test` checks every rule (tests/pricing.test.mjs).
 *
 * The rules:
 * - A price is a number in Notion, never words: the site formats it in the
 *   site's locale and the row's currency. An empty Price is "custom
 *   pricing", which the page says in its own words.
 * - Yearly Price is the price per month when paid yearly, as SaaS pricing
 *   pages print it. The saving is worked out from the two, never typed.
 * - A plan's Text is its features, one per line. "Label: value" puts a value
 *   in the comparison table; a line with no colon is a feature that is
 *   simply included; a line that ends in a colon ("Content:") starts a
 *   group of rows.
 */
import { SITE_LOCALE } from "./site"

export type Billing = "monthly" | "yearly"

/** The currency codes the Currency select offers. Any other three-letter
 *  ISO 4217 code typed into it works as well (a shop imported from Shopify
 *  in its own currency, say): Intl prints whatever it is given. */
export const CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "NZD", "CHF", "SEK", "NOK", "DKK", "JPY", "INR"] as const
export const DEFAULT_CURRENCY = "GBP"

/** A currency code, or the site's default for anything that is not three
 *  letters. Not checked against a list of currencies: the server's and the
 *  browser's lists can differ, and a page must print the same in both. */
export const currencyOf = (raw: string | undefined): string => {
  const code = raw?.trim().toUpperCase()
  return code && /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY
}

/** "£8.50", "£12", "¥1,200": no pennies on a whole amount. */
export function formatPrice(amount: number, currency: string, locale: string = SITE_LOCALE.replace("_", "-")): string {
  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyOf(currency),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount)
}

/** What a plan costs on the chosen billing: the yearly figure when there is
 *  one and yearly is chosen, else the monthly one; undefined is custom. */
export function priceFor(plan: { price?: number; yearlyPrice?: number }, billing: Billing): number | undefined {
  if (billing === "yearly" && plan.yearlyPrice !== undefined) return plan.yearlyPrice
  return plan.price
}

/** The best saving yearly billing gives across the plans, as a whole
 *  percentage rounded down (never overclaimed), or 0 when there is none. */
export function yearlySaving(plans: { price?: number; yearlyPrice?: number }[]): number {
  let best = 0
  for (const { price, yearlyPrice } of plans) {
    if (price === undefined || yearlyPrice === undefined || price <= 0 || yearlyPrice >= price || yearlyPrice < 0) continue
    // the multiplication first, and a hair added: 29/100 as a float is 28.999…
    best = Math.max(best, Math.floor(((price - yearlyPrice) * 100) / price + 1e-9))
  }
  return best
}

/** Whether the page needs the monthly/yearly switch at all. */
export const hasYearly = (plans: { yearlyPrice?: number }[]) => plans.some((p) => p.yearlyPrice !== undefined)

export type FeatureLine =
  | { kind: "group"; label: string }
  | { kind: "included"; label: string }
  | { kind: "value"; label: string; value: string }

/** A plan's Text, one feature per line. */
export function featureLines(text: string): FeatureLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•✓]\s*/, "").trim())
    .filter(Boolean)
    .map((line): FeatureLine => {
      if (/:\s*$/.test(line)) return { kind: "group", label: line.replace(/:\s*$/, "").trim() }
      const at = line.indexOf(":")
      // a colon inside a link's address ("https://…") is not a value
      if (at > 0 && !/^\[|https?:$/.test(line.slice(0, at + 1))) {
        const label = line.slice(0, at).trim()
        const value = line.slice(at + 1).trim()
        if (label && value) return { kind: "value", label, value }
      }
      return { kind: "included", label: line }
    })
}

/** A cell of the comparison table: a value, included, or not offered. */
export type Cell = { kind: "value"; text: string } | { kind: "yes" } | { kind: "no" }
export type ComparisonGroup = { name: string; rows: { label: string; cells: Cell[] }[] }

/**
 * The comparison table, from every plan's features: one row per feature
 * label, in the order the labels first appear, grouped as the first plan to
 * group them does. A plan that does not mention a feature does not have it.
 */
export function comparison(plans: { features: FeatureLine[] }[]): ComparisonGroup[] {
  const groups: ComparisonGroup[] = []
  const rowIndex = new Map<string, { group: number; row: number }>()
  const groupIndex = new Map<string, number>()
  const ensureGroup = (name: string) => {
    if (!groupIndex.has(name)) {
      groupIndex.set(name, groups.length)
      groups.push({ name, rows: [] })
    }
    return groupIndex.get(name) as number
  }
  plans.forEach((plan, p) => {
    let current = ""
    for (const line of plan.features) {
      if (line.kind === "group") {
        current = line.label
        continue
      }
      const key = line.label.toLowerCase()
      let at = rowIndex.get(key)
      if (!at) {
        const g = ensureGroup(current)
        at = { group: g, row: groups[g].rows.length }
        rowIndex.set(key, at)
        groups[g].rows.push({ label: line.label, cells: plans.map(() => ({ kind: "no" }) as Cell) })
      }
      groups[at.group].rows[at.row].cells[p] = line.kind === "value" ? { kind: "value", text: line.value } : { kind: "yes" }
    }
  })
  return groups.filter((g) => g.rows.length)
}
