/**
 * `npm run shop:import`: products from Shopify or Printify, as Product rows
 * in the site's Notion database. This file is the part that decides, and it
 * does no I/O, so `npm test` checks every rule (tests/shop-import.test.mjs):
 *
 * - `fromShopify` and `fromPrintify` read each platform's own product shape
 *   into one `ImportedProduct`;
 * - `planImport` lines the import up against the rows already in Notion and
 *   says, row by row, what would be created, what would change and what is
 *   left alone, with the Notion requests that would do it.
 *
 * The rules a plan keeps, whatever the platform says:
 *
 * - **Nothing is deleted.** A product that has gone from the platform is
 *   reported, not removed: unpublishing it is the editor's call.
 * - **New rows are unpublished.** They arrive with the platform's words and
 *   pictures for somebody to check, then tick Published.
 * - **The catalogue is the platform's, and a row repeats it.** Whatever the
 *   platform says of a product is written again on every import: its title,
 *   its description (the line and the body), its price, its stock, its
 *   checkout IDs, its buy link, its pictures, its collection and its tags.
 *   A word changed in Notion is changed back, so the two never drift: the
 *   place to change a product is the shop.
 * - **What the platform does not say is the editor's**: Published, the
 *   Slug, Featured, Order, and Low stock or Pre-order while the product
 *   can be bought. A field the platform leaves blank (no description, no
 *   product type, no tags) is left as Notion has it.
 * - **Pictures uploaded in Notion are never replaced.** The importer only
 *   swaps pictures that are addresses, which is what it writes.
 * - A row is found again by its Import ID ("shopify:123"), so renaming a
 *   product's Slug in Notion does not make a second one. A row written by
 *   hand with the same address is adopted rather than duplicated.
 */
import { textRequest } from "../inline-links"
import { currencyOf } from "../pricing"
import { filesOf, multiSelectOf, numberOf, pathSlug, rowProperty, rowText, rowTitle, selectOf, slugify, urlOf, type NotionRow } from "../notion/rows"
import { PROPS } from "../notion/schema"

export type Source = "shopify" | "printify"

/** A product as either platform describes it, in this site's terms. */
export type ImportedProduct = {
  /** "shopify:<product ID>" or "printify:<product ID>" */
  importId: string
  title: string
  /** the address under /shop the row is made with */
  slug: string
  /** the whole description, as plain text: paragraphs, and "- " list lines */
  description: string
  price?: number
  compareAt?: number
  currency?: string
  /** https addresses, the first the cover */
  images: string[]
  /** the platform's alt text for a picture, by its address (Shopify has it;
   *  Printify does not): written as the picture's name in Notion, which the
   *  site reads as its description (lib/notion/alt-text.ts) */
  alts?: Record<string, string>
  /** whether it can be bought at all */
  available: boolean
  /** Shopify only: the variants a cart permalink can sell */
  variants: { label: string; id: string }[]
  link?: string
  category?: string
  tags: string[]
}

export type Skipped = { title: string; reason: string }
export type Mapped = { products: ImportedProduct[]; skipped: Skipped[] }

/** A picture's address, kept to what Notion accepts and a reader's browser
 *  never fetches itself (the media route does, server to server). */
const MAX_URL = 2000
/** Pictures a product brings with it: a cover and a gallery's worth. */
export const MAX_IMAGES = 10

const https = (raw: string | null | undefined): string | undefined => {
  const value = raw?.trim()
  if (!value || value.length > MAX_URL) return undefined
  try {
    return new URL(value).protocol === "https:" ? value : undefined
  } catch {
    return undefined
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** A select option's name as Notion takes it: no commas, at most 100
 *  characters. */
export const optionName = (raw: string): string => raw.replace(/,/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)

const uniq = <T>(items: T[]): T[] => [...new Set(items)]

// ---------------------------------------------------------------- HTML to text

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", copy: "©", reg: "®", trade: "™", deg: "°", times: "×",
  pound: "£", euro: "€", cent: "¢", yen: "¥", middot: "·", bull: "•", frac12: "½", frac14: "¼", frac34: "¾",
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10)
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return ENTITIES[name.toLowerCase()] ?? match
  })
}

const BLOCK_TAGS = "p|div|h[1-6]|ul|ol|table|tr|blockquote|section|article|header|footer|figure"

/**
 * A product description's HTML as plain text, keeping its shape: a blank
 * line between paragraphs, "- " before each list item. Both platforms store
 * descriptions as HTML; Notion and this site want words.
 */
export function htmlToText(html: string): string {
  let s = (html ?? "").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
  // the source's own line breaks and indentation mean nothing in HTML
  s = s.replace(/\s+/g, " ")
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/li\s*>/gi, "")
  s = s.replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n\n")
  s = s.replace(/<[^>]*>/g, "")
  s = decodeEntities(s)
  return s
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** The first paragraph, cut to fit a search result: at a sentence end when
 *  there is one late enough, else at a word, with an ellipsis. */
export function summarise(text: string, max = 160): string {
  const first = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.split("\n").map((line) => line.replace(/^- /, "")).join(" ").trim())
    .find(Boolean)
  if (!first) return ""
  if (first.length <= max) return first
  const head = first.slice(0, max)
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "))
  if (sentence >= max * 0.4) return head.slice(0, sentence + 1)
  const space = head.lastIndexOf(" ", max - 1)
  return `${head.slice(0, space > 0 ? space : max - 1).replace(/[\s,;:.–-]+$/, "")}…`
}

// ---------------------------------------------------------------- Shopify

type Money = { amount: string; currencyCode: string } | null | undefined

export type ShopifyVariant = {
  id: string
  title: string
  availableForSale: boolean
  price: Money
  compareAtPrice?: Money
}

/** A product as the Storefront API's query (lib/commerce/import-sources.ts)
 *  returns it. */
export type ShopifyProduct = {
  id: string
  handle: string
  title: string
  descriptionHtml?: string | null
  productType?: string | null
  tags?: string[] | null
  availableForSale: boolean
  onlineStoreUrl?: string | null
  images?: { nodes: { url: string; altText?: string | null }[] } | null
  variants: { nodes: ShopifyVariant[]; pageInfo?: { hasNextPage: boolean; endCursor: string | null } }
}

/** The number at the end of a gid://shopify/…/123 ID. */
export const numericId = (gid: string | number | null | undefined): string => /(\d+)$/.exec(String(gid ?? "").trim())?.[1] ?? ""

const amount = (money: Money): number | undefined => {
  const n = Number.parseFloat(money?.amount ?? "")
  return Number.isFinite(n) && n >= 0 ? round2(n) : undefined
}

/** Shopify names the one variant of a product that has none "Default Title". */
const variantLabel = (title: string, alone: boolean): string =>
  alone || title.trim() === "Default Title" ? "" : title.replace(/:/g, " ").replace(/\s+/g, " ").trim()

export function fromShopify(nodes: ShopifyProduct[]): Mapped {
  const products: ImportedProduct[] = []
  const skipped: Skipped[] = []
  for (const node of nodes) {
    const title = node.title?.trim() || node.handle
    const id = numericId(node.id)
    if (!id) {
      skipped.push({ title, reason: "Shopify gave it no product ID" })
      continue
    }
    const variants = node.variants?.nodes ?? []
    const priced = variants.flatMap((v) => {
      const price = amount(v.price)
      return price === undefined ? [] : [{ v, price }]
    })
    if (!priced.length) {
      skipped.push({ title, reason: "it has no priced variant" })
      continue
    }
    // the cheapest variant sets the price shown ("from"), and its own
    // compare-at price the struck-through one
    const cheapest = priced.reduce((a, b) => (b.price < a.price ? b : a))
    const compare = amount(cheapest.v.compareAtPrice)
    // a sold-out size cannot be checked out, so the cart is offered the
    // ones that can; with none, the row keeps them all and says Sold out
    const forSale = variants.filter((v) => v.availableForSale)
    const listed = forSale.length ? forSale : variants
    products.push({
      importId: `shopify:${id}`,
      title,
      slug: slugify(node.handle || title),
      description: htmlToText(node.descriptionHtml ?? ""),
      price: cheapest.price,
      compareAt: compare !== undefined && compare > cheapest.price ? compare : undefined,
      currency: cheapest.v.price?.currencyCode?.toUpperCase(),
      images: uniq((node.images?.nodes ?? []).flatMap((image) => https(image.url) ?? [])).slice(0, MAX_IMAGES),
      alts: shopifyAlts(node.images?.nodes ?? []),
      available: node.availableForSale && forSale.length > 0,
      variants: listed.flatMap((v) => {
        const variantId = numericId(v.id)
        return variantId ? [{ label: variantLabel(v.title, listed.length === 1), id: variantId }] : []
      }),
      link: https(node.onlineStoreUrl),
      category: node.productType?.trim() ? optionName(node.productType) : undefined,
      tags: uniq((node.tags ?? []).map(optionName).filter(Boolean)),
    })
  }
  return { products, skipped }
}

// ---------------------------------------------------------------- Printify

export type PrintifyVariant = { id: number; title?: string; price: number; is_enabled: boolean; is_default?: boolean; is_available: boolean }
export type PrintifyImage = { src: string; variant_ids?: number[]; position?: string; is_default?: boolean }
export type PrintifyExternal = { id?: string; handle?: string }

/** A product as Printify's GET /v1/shops/{shop}/products.json lists it. */
export type PrintifyProduct = {
  id: string
  title: string
  description?: string | null
  tags?: string[] | null
  variants: PrintifyVariant[]
  images?: PrintifyImage[] | null
  visible?: boolean
  is_deleted?: boolean
  external?: PrintifyExternal | PrintifyExternal[] | null
}

/**
 * Printify's prices are whole cents in the shop's currency, which the API
 * does not say (PRINTIFY_CURRENCY does; USD by default). Its variant IDs
 * are the print provider's (a size and colour), not anything a checkout
 * takes, so a Printify product sells through its Link: the product's page
 * on the store it is published to, when Printify knows it.
 */
export function fromPrintify(items: PrintifyProduct[], currency: string): Mapped {
  const products: ImportedProduct[] = []
  const skipped: Skipped[] = []
  for (const item of items) {
    const title = item.title?.trim() || item.id
    if (item.is_deleted) {
      skipped.push({ title, reason: "it is deleted in Printify" })
      continue
    }
    if (item.visible === false) {
      skipped.push({ title, reason: "it is hidden in Printify" })
      continue
    }
    const enabled = (item.variants ?? []).filter((v) => v.is_enabled && Number.isFinite(v.price) && v.price >= 0)
    if (!enabled.length) {
      skipped.push({ title, reason: "it has no enabled variant" })
      continue
    }
    const price = round2(Math.min(...enabled.map((v) => v.price)) / 100)
    const shown = new Set(enabled.map((v) => v.id))
    // the default mockup first, then the ones of variants on sale
    const images = [...(item.images ?? [])]
      .filter((image) => !image.variant_ids?.length || image.variant_ids.some((id) => shown.has(id)))
      .sort((a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)))
      .flatMap((image) => https(image.src) ?? [])
    const externals = Array.isArray(item.external) ? item.external : item.external ? [item.external] : []
    products.push({
      importId: `printify:${item.id}`,
      title,
      slug: slugify(title),
      description: htmlToText(item.description ?? ""),
      price,
      currency: currencyOf(currency),
      images: uniq(images).slice(0, MAX_IMAGES),
      available: enabled.some((v) => v.is_available),
      variants: [],
      link: externals.map((e) => https(e.handle)).find(Boolean),
      tags: uniq((item.tags ?? []).map(optionName).filter(Boolean)),
    })
  }
  return { products, skipped }
}

// ---------------------------------------------------------------- what is in Notion

/** A Product row as the importer needs it: what it would compare. */
export type ExistingProduct = {
  id: string
  title: string
  slug: string
  importId: string
  price?: number
  compareAt?: number
  currency?: string
  stock?: string
  checkoutId: string
  link?: string
  /** the line on its card */
  description: string
  category?: string
  tags: string[]
  /** the row's page as the import compares it, when it was read
   *  (`readBody` in import-run.ts): its words, and its blocks' IDs */
  body?: { text: string; blockIds: string[] }
  /** the cover and gallery as addresses, or null when any of them is a file
   *  uploaded to Notion: those pictures are the editor's */
  images: string[] | null
  /** their names in Notion, in the same order (the descriptions the site
   *  reads), or null with the pictures */
  imageNames: string[] | null
}

const rawFiles = (row: NotionRow, name: string) =>
  (rowProperty(row, name) as { files?: { name?: string; type?: string; external?: { url?: string } }[] } | undefined)?.files ?? []

export function existingFromRow(row: NotionRow): ExistingProduct | null {
  if (!row.id || row.in_trash || row.archived) return null
  const title = rowTitle(row)
  const files = [...rawFiles(row, PROPS.cover), ...rawFiles(row, PROPS.gallery)]
  const uploaded = files.some((f) => f.type !== "external")
  return {
    id: row.id,
    title,
    slug: pathSlug(rowText(row, PROPS.slug), title),
    importId: rowText(row, PROPS.importId).trim(),
    price: numberOf(row, PROPS.price),
    compareAt: numberOf(row, PROPS.compareAt),
    currency: selectOf(row, PROPS.currency)?.name,
    stock: selectOf(row, PROPS.stock)?.name,
    checkoutId: rowText(row, PROPS.checkoutId),
    link: urlOf(row, PROPS.link),
    description: rowText(row, PROPS.description),
    category: selectOf(row, PROPS.category)?.name,
    tags: multiSelectOf(row, PROPS.tags).map((tag) => tag.name),
    images: uploaded ? null : [...filesOf(row, PROPS.cover), ...filesOf(row, PROPS.gallery)].flatMap((f) => f.external ?? []),
    imageNames: uploaded ? null : files.filter((f) => f.external?.url?.trim()).map((f) => f.name ?? ""),
  }
}

// ---------------------------------------------------------------- Notion requests

/** Words as a property's or a block's runs: Notion takes 100 runs at most. */
const rich = (content: string) => textRequest(content).slice(0, 100)

/** The alt text Shopify holds for each picture, by address: the first one
 *  given for an address that is listed twice. */
function shopifyAlts(nodes: { url: string; altText?: string | null }[]): Record<string, string> {
  const alts: Record<string, string> = {}
  for (const node of nodes) {
    const url = https(node.url)
    const alt = node.altText?.replace(/\s+/g, " ").trim()
    if (url && alt && !(url in alts)) alts[url] = alt
  }
  return alts
}

/** Notion keeps a file's name to 100 characters: a description that long is
 *  cut at a word and marked as cut. */
const MAX_NAME = 100

/** A picture's name in Notion: its alt text from the platform when there is
 *  some, which the site reads as its description; otherwise the file name at
 *  the end of its address, which it does not. */
export function pictureName(url: string, n: number, alt?: string): string {
  const words = alt?.replace(/\s+/g, " ").trim()
  if (!words) return imageName(url, n)
  if (words.length <= MAX_NAME) return words
  const cut = words.slice(0, MAX_NAME - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > MAX_NAME / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`
}

/** A picture's name in Notion: the file name at the end of its address. */
export function imageName(url: string, n: number): string {
  let name = ""
  try {
    name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "")
  } catch {
    name = ""
  }
  return (name || `picture-${n + 1}`).slice(0, 100)
}

/**
 * Pictures as Notion files. A picture's name is the platform's alt text when
 * it has some; when it has none, the name the picture already has in Notion
 * stays (an editor may have described it there: Notion decides a field the
 * platform leaves blank), and a new picture is named after its file.
 */
const externalFiles = (urls: string[], alts: Record<string, string> = {}, names: Map<string, string> = new Map()) =>
  urls.map((url, n) => ({ name: alts[url] ? pictureName(url, n, alts[url]) : names.get(url) || imageName(url, n), type: "external", external: { url } }))

/** The cover and the gallery a product's pictures make, as Notion files,
 *  keeping the names (by address) the row's pictures have now. */
const pictureFiles = (product: Pick<ImportedProduct, "images" | "alts">, names?: Map<string, string>) => ({
  cover: externalFiles(product.images.slice(0, 1), product.alts, names),
  gallery: externalFiles(product.images.slice(1), product.alts, names),
})

/** What the Checkout ID holds for these variants: one ID, or "Label: ID" a line. */
export const checkoutText = (variants: { label: string; id: string }[]): string =>
  variants.map((v) => (v.label ? `${v.label}: ${v.id}` : v.id)).join("\n")

/** The Stock a product should show: Sold out when it cannot be bought;
 *  otherwise the editor's Low stock or Pre-order stands, being a finer
 *  "available" than the platform says. */
export function stockFor(current: string | undefined, available: boolean): string {
  if (!available) return "Sold out"
  return current === "Low stock" || current === "Pre-order" ? current : "In stock"
}

/** The body of a row: the description's paragraphs and list items, all of
 *  them. Notion takes a hundred blocks a request (`blockBatches`). */
export function bodyBlocks(description: string) {
  const blocks: { type: string; [key: string]: unknown }[] = []
  for (const chunk of description.split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((line) => line.trim())
    if (!lines.length) continue
    if (lines.every((line) => line.startsWith("- "))) {
      for (const line of lines) blocks.push({ type: "bulleted_list_item", bulleted_list_item: { rich_text: rich(line.slice(2)) } })
    } else {
      blocks.push({ type: "paragraph", paragraph: { rich_text: rich(lines.join("\n")) } })
    }
  }
  return blocks
}

/** Notion's most blocks in one request. */
export const BLOCKS_A_REQUEST = 100

/** Blocks in the batches Notion takes them in, in order. */
export function blockBatches<T>(blocks: T[]): T[][] {
  const out: T[][] = []
  for (let at = 0; at < blocks.length; at += BLOCKS_A_REQUEST) out.push(blocks.slice(at, at + BLOCKS_A_REQUEST))
  return out
}

type Run = { plain_text?: string; text?: { content?: string } }
/** A block of a row's page, as Notion returns it or as `bodyBlocks` writes it. */
export type BodyBlock = { id?: string; type?: string; has_children?: boolean; [key: string]: unknown }

/**
 * A body as the words `bodyBlocks` would write it from: paragraphs a blank
 * line apart, "- " before each list item. A block the import never writes
 * (a heading, a picture, a list inside a list) is named in brackets, so a
 * body that holds one never reads as the platform's.
 */
export function bodyText(blocks: BodyBlock[]): string {
  let out = ""
  let lastWasItem = false
  for (const block of blocks) {
    const type = block.type ?? ""
    const runs = (block[type] as { rich_text?: Run[] } | undefined)?.rich_text
    const words = (runs ?? []).map((run) => run.plain_text ?? run.text?.content ?? "").join("")
    const plain = (type === "paragraph" || type === "bulleted_list_item") && !block.has_children
    // an empty paragraph is a blank line somebody left, not a difference
    if (type === "paragraph" && plain && !words.trim()) continue
    const item = plain && type === "bulleted_list_item"
    const piece = !plain ? `[${type || "block"}]` : item ? `- ${words}` : words
    out += out ? (item && lastWasItem ? "\n" : "\n\n") + piece : piece
    lastWasItem = item
  }
  return out
}

/** The rows whose pages an import has to read to compare their bodies: the
 *  ones a product with a description would be lined up against. */
export function rowsToRead(existing: ExistingProduct[], mapped: Mapped): ExistingProduct[] {
  const described = mapped.products.filter((p) => p.description)
  const ids = new Set(described.map((p) => p.importId))
  const slugs = new Set(described.map((p) => p.slug).filter(Boolean))
  return existing.filter((row) => (row.importId ? ids.has(row.importId) : slugs.has(row.slug)))
}

/** Every property of a new Product row. */
export function productProperties(product: ImportedProduct, slug: string): Record<string, unknown> {
  const props: Record<string, unknown> = {
    [PROPS.title]: { title: rich(product.title) },
    [PROPS.kind]: { select: { name: "Product" } },
    [PROPS.published]: { checkbox: false },
    [PROPS.slug]: { rich_text: rich(slug) },
    [PROPS.importId]: { rich_text: rich(product.importId) },
    [PROPS.stock]: { select: { name: stockFor(undefined, product.available) } },
  }
  const summary = summarise(product.description)
  if (summary) props[PROPS.description] = { rich_text: rich(summary) }
  if (product.price !== undefined) props[PROPS.price] = { number: product.price }
  if (product.compareAt !== undefined) props[PROPS.compareAt] = { number: product.compareAt }
  if (product.currency) props[PROPS.currency] = { select: { name: product.currency } }
  if (product.variants.length) props[PROPS.checkoutId] = { rich_text: rich(checkoutText(product.variants)) }
  if (product.link) props[PROPS.link] = { url: product.link }
  if (product.images.length) {
    const files = pictureFiles(product)
    props[PROPS.cover] = { files: files.cover }
    if (files.gallery.length) props[PROPS.gallery] = { files: files.gallery }
  }
  if (product.category) props[PROPS.category] = { select: { name: product.category } }
  if (product.tags.length) props[PROPS.tags] = { multi_select: product.tags.slice(0, 100).map((name) => ({ name })) }
  return props
}

// ---------------------------------------------------------------- the plan

export type Change = { field: string; from: string; to: string }

export type Plan = {
  source: Source
  create: { product: ImportedProduct; slug: string; note?: string; properties: Record<string, unknown>; children: ReturnType<typeof bodyBlocks> }[]
  update: {
    id: string
    title: string
    product: ImportedProduct
    changes: Change[]
    properties: Record<string, unknown>
    /** the row's page rewritten: the blocks to take out, then the platform's */
    body?: { remove: string[]; children: ReturnType<typeof bodyBlocks> }
    note?: string
  }[]
  unchanged: { id: string; title: string; note?: string }[]
  /** rows this source made that the import no longer has: left as they are */
  gone: { id: string; title: string }[]
  /** rows typed into Notion that no platform's product matches: nothing
   *  keeps them in step with a shop, so the plan names them */
  byHand: { id: string; title: string }[]
  skipped: Skipped[]
}

/** A price as a line of the plan says it ("4.50 GBP", "12 USD"); `none`
 *  when there is none. */
export const money = (n: number | undefined, currency?: string, none = "none") => (n === undefined ? none : `${n.toFixed(2).replace(/\.00$/, "")}${currency ? ` ${currency}` : ""}`)
/** `n` and its word, plural unless `n` is 1: "1 picture", "3 pictures". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const sameNumber = (a: number | undefined, b: number | undefined) => (a === undefined || b === undefined ? a === b : Math.abs(a - b) < 0.005)
const squash = (text: string) => text.replace(/\s+/g, " ").trim()
/** Words short enough for a line of the plan. */
const brief = (text: string, max = 40) => {
  const words = squash(text)
  return !words ? "none" : words.length > max ? `"${words.slice(0, max - 1).trimEnd()}…"` : `"${words}"`
}
const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("\n")

/**
 * The import, lined up against the Product rows in Notion. `existing` is
 * every Product row, published or not (new rows start unpublished, so a
 * second run has to see them).
 */
export function planImport(existing: ExistingProduct[], mapped: Mapped, source: Source): Plan {
  const plan: Plan = { source, create: [], update: [], unchanged: [], gone: [], byHand: [], skipped: [...mapped.skipped] }
  const byImport = new Map(existing.filter((e) => e.importId).map((e) => [e.importId, e]))
  const taken = new Set(existing.map((e) => e.slug))
  const claimed = new Set<string>()
  const seen = new Set<string>()

  for (const product of mapped.products) {
    if (seen.has(product.importId)) continue
    seen.add(product.importId)
    let row = byImport.get(product.importId)
    let adopted = false
    if (!row) {
      // a row written by hand at the same address, not yet from anywhere
      // (an empty slug is no address: two rows without one are not twins)
      const twin = product.slug ? existing.find((e) => !e.importId && e.slug === product.slug && !claimed.has(e.id)) : undefined
      if (twin) {
        row = twin
        adopted = true
      }
    }

    if (!row) {
      let slug = product.slug || slugify(product.title) || "product"
      let note: string | undefined
      if (taken.has(slug)) {
        let n = 2
        while (taken.has(`${slug}-${n}`)) n++
        note = `/shop/${slug} is another row's, so this one is /shop/${slug}-${n}`
        slug = `${slug}-${n}`
      }
      taken.add(slug)
      plan.create.push({ product, slug, note, properties: productProperties(product, slug), children: bodyBlocks(product.description) })
      continue
    }

    claimed.add(row.id)
    const changes: Change[] = []
    const properties: Record<string, unknown> = {}
    const change = (field: string, from: string, to: string, prop: string, value: unknown) => {
      changes.push({ field, from, to })
      properties[prop] = value
    }

    if (adopted) change("import ID", "none", product.importId, PROPS.importId, { rich_text: rich(product.importId) })
    if (squash(row.title) !== squash(product.title)) change("title", brief(row.title), brief(product.title), PROPS.title, { title: rich(product.title) })
    // a field the platform leaves blank is Notion's to fill
    const summary = summarise(product.description)
    if (summary && squash(row.description) !== squash(summary)) {
      change("description", brief(row.description), brief(summary), PROPS.description, { rich_text: rich(summary) })
    }
    if (!sameNumber(row.price, product.price) && product.price !== undefined) {
      change("price", money(row.price), money(product.price), PROPS.price, { number: product.price })
    }
    // only Shopify has compare-at prices: a Printify import leaves them be
    if (source === "shopify" && !sameNumber(row.compareAt, product.compareAt)) {
      change("compare-at price", money(row.compareAt), money(product.compareAt), PROPS.compareAt, { number: product.compareAt ?? null })
    }
    if (product.currency && currencyOf(row.currency) !== product.currency) {
      change("currency", row.currency ?? `none (${currencyOf(undefined)})`, product.currency, PROPS.currency, { select: { name: product.currency } })
    }
    const stock = stockFor(row.stock, product.available)
    if (stock !== row.stock) change("stock", row.stock ?? "none", stock, PROPS.stock, { select: { name: stock } })
    if (source === "shopify") {
      const ids = checkoutText(product.variants)
      if (lines(ids) !== lines(row.checkoutId)) {
        change("checkout IDs", `${variantCount(row.checkoutId)}`, plural(product.variants.length, "variant"), PROPS.checkoutId, {
          rich_text: rich(ids),
        })
      }
    }
    if (product.link && product.link !== row.link) change("link", row.link ?? "none", product.link, PROPS.link, { url: product.link })

    let note: string | undefined
    if (row.images === null) {
      note = "pictures kept: uploaded in Notion"
    } else if (product.images.length) {
      const now = new Map(row.images.map((url, n) => [url, row.imageNames?.[n] ?? ""] as const).filter(([, name]) => name))
      const files = pictureFiles(product, now)
      const names = [...files.cover, ...files.gallery].map((f) => f.name)
      if (product.images.join("\n") !== row.images.join("\n")) {
        change("pictures", `${row.images.length}`, `${product.images.length}`, PROPS.cover, { files: files.cover })
        properties[PROPS.gallery] = { files: files.gallery }
      } else if (names.join("\n") !== (row.imageNames ?? []).join("\n")) {
        // the same pictures, described differently in the shop: their alt text
        const described = names.filter((name, n) => name !== row.imageNames?.[n]).length
        change("picture descriptions", `${described} changed`, `${names.length} pictures`, PROPS.cover, { files: files.cover })
        properties[PROPS.gallery] = { files: files.gallery }
      }
    }

    if (product.category && product.category !== row.category) {
      change("collection", row.category ?? "none", product.category, PROPS.category, { select: { name: product.category } })
    }
    const tags = product.tags.slice(0, 100)
    if (tags.length && [...tags].sort().join("\n") !== [...row.tags].sort().join("\n")) {
      change("tags", row.tags.join(", ") || "none", tags.join(", "), PROPS.tags, { multi_select: tags.map((name) => ({ name })) })
    }
    // the body is compared only when the row's page was read
    let body: Plan["update"][number]["body"]
    const children = bodyBlocks(product.description)
    if (row.body && children.length && bodyText(children) !== row.body.text) {
      changes.push({ field: "details", from: plural(row.body.blockIds.length, "block"), to: plural(children.length, "block") })
      body = { remove: row.body.blockIds, children }
    }

    if (changes.length) plan.update.push({ id: row.id, title: product.title, product, changes, properties, ...(body ? { body } : {}), note })
    else plan.unchanged.push({ id: row.id, title: row.title || product.title, note })
  }

  for (const row of existing) {
    if (row.importId.startsWith(`${source}:`) && !seen.has(row.importId)) plan.gone.push({ id: row.id, title: row.title })
    else if (!row.importId && !claimed.has(row.id)) plan.byHand.push({ id: row.id, title: row.title })
  }
  return plan
}

const variantCount = (checkoutId: string): string => {
  const n = lines(checkoutId) ? lines(checkoutId).split("\n").length : 0
  return n ? plural(n, "variant") : "none"
}

/** The properties a write needs that the database lacks, with their types
 *  (lib/notion/schema.ts), so the import can add them before it writes. */
export const IMPORT_PROPERTIES = [
  PROPS.title,
  PROPS.kind,
  PROPS.published,
  PROPS.slug,
  PROPS.description,
  PROPS.cover,
  PROPS.category,
  PROPS.tags,
  PROPS.link,
  PROPS.price,
  PROPS.currency,
  PROPS.compareAt,
  PROPS.gallery,
  PROPS.stock,
  PROPS.checkoutId,
  PROPS.importId,
] as const
