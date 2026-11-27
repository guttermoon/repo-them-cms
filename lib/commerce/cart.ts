/**
 * The cart, as plain data: what is in it, how it is read back from the
 * reader's browser, and the Shopify checkout link it becomes. Pure (no
 * React, no browser), so `npm test` checks every rule (tests/commerce.test.mjs)
 * and the cart page and the buttons share it.
 *
 * The cart lives in the reader's own browser (localStorage, `site-cart`),
 * written only once they add something, and named in the privacy notice.
 * Nothing about it reaches this site's server or anyone else's until the
 * reader presses Checkout, which takes them to the shop's own checkout.
 *
 * Prices are never the cart's to decide: Shopify prices the cart it is sent,
 * so a reader editing their browser's storage changes only what they see.
 */
export const CART_KEY = "site-cart"
export const MAX_QUANTITY = 99
export const MAX_LINES = 50

export type CartLine = {
  /** the product's address under /shop */
  slug: string
  /** the Shopify variant chosen, when the product has one */
  variant?: string
  quantity: number
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const VARIANT = /^\d{5,20}$/

const clampQuantity = (n: unknown): number => {
  const value = typeof n === "number" ? n : Number.parseInt(String(n), 10)
  return Number.isFinite(value) ? Math.min(MAX_QUANTITY, Math.max(1, Math.floor(value))) : 1
}

const sameLine = (a: CartLine, b: Pick<CartLine, "slug" | "variant">) => a.slug === b.slug && (a.variant ?? "") === (b.variant ?? "")

/**
 * The cart from whatever is in storage: anything that is not a list of
 * lines is an empty cart; a line with a bad address or variant is dropped;
 * quantities are whole numbers from 1 to 99; one line per product and
 * variant (a repeat adds up); no more than fifty lines.
 */
export function parseCart(raw: unknown): CartLine[] {
  let value = raw
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  let lines: CartLine[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const { slug, variant, quantity } = item as Record<string, unknown>
    if (typeof slug !== "string" || !SLUG.test(slug)) continue
    if (variant !== undefined && (typeof variant !== "string" || !VARIANT.test(variant))) continue
    lines = addLine(lines, { slug, ...(variant ? { variant: variant as string } : {}), quantity: clampQuantity(quantity) })
  }
  return lines.slice(0, MAX_LINES)
}

/** Add to the cart: a product already in it (in that variant) has its
 *  quantity raised, to the limit. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const quantity = clampQuantity(line.quantity)
  const found = lines.find((l) => sameLine(l, line))
  if (found) return lines.map((l) => (l === found ? { ...l, quantity: clampQuantity(l.quantity + quantity) } : l))
  if (lines.length >= MAX_LINES) return lines
  return [...lines, { slug: line.slug, ...(line.variant ? { variant: line.variant } : {}), quantity }]
}

/** Change a line's quantity; nought or less takes it out. */
export function setQuantity(lines: CartLine[], line: Pick<CartLine, "slug" | "variant">, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity) || quantity < 1) return removeLine(lines, line)
  return lines.map((l) => (sameLine(l, line) ? { ...l, quantity: clampQuantity(quantity) } : l))
}

export function removeLine(lines: CartLine[], line: Pick<CartLine, "slug" | "variant">): CartLine[] {
  return lines.filter((l) => !sameLine(l, line))
}

/** How many things are in the cart, for the button in the header. */
export const itemCount = (lines: CartLine[]): number => lines.reduce((n, l) => n + l.quantity, 0)

/** A shop's own address as Shopify knows it: a hostname and nothing else
 *  (your-store.myshopify.com, or the shop's own domain). */
export function shopDomain(raw: string | undefined): string | undefined {
  const host = raw
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
  return host && /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ? host : undefined
}

/**
 * Shopify's cart permalink: `https://<shop>/cart/<variant>:<quantity>,…`.
 * It fills a cart at the shop and opens its checkout, with no API key and
 * nothing to set up but the shop's address. Lines without a variant are not
 * Shopify's to sell and are left out; with none left there is no link.
 */
export function cartPermalink(domain: string | undefined, lines: { variant?: string; quantity: number }[]): string | undefined {
  const host = shopDomain(domain)
  const parts = lines.filter((l) => l.variant && VARIANT.test(l.variant)).map((l) => `${l.variant}:${clampQuantity(l.quantity)}`)
  return host && parts.length ? `https://${host}/cart/${parts.join(",")}` : undefined
}
