/**
 * The Markdown copy of a page, post or product written in Notion, at its
 * address with .md added (app/markdown/[...path]/route.ts). Which entry an
 * address names, and the document for it: the entry's facts as front
 * matter, its title, and its body (lib/notion/markdown.ts).
 *
 * Pure: the route fetches the body and hands it in, so `npm test` checks
 * every rule here (tests/markdown-route.test.mjs).
 */
import { inlineWords } from "../inline-text"
import { blocksExcerpt, type NBlock } from "../notion/blocks"
import { blocksMarkdown, markdownDocument, type FrontMatter, type MarkdownContext } from "../notion/markdown"
import type { Entry, SiteData } from "../notion/rows"
import { currencyOf } from "../pricing"
import { livePages, livePosts, liveProducts, urlFor } from "./select"

const decode = (part: string): string | undefined => {
  try {
    return decodeURIComponent(part)
  } catch {
    return undefined
  }
}

/**
 * The entry a Markdown address names, by the same rules its page is found:
 * /blog/<slug>.md a live post, /shop/<slug>.md a live product while the shop
 * sells for real (the example shop's goods are not offered anywhere a page
 * might be read as a listing), and any other address a live page. Nothing
 * else, so a designed page or a route has no copy here.
 */
/**
 * The `Link` header that names a copy's page as the canonical address. A
 * header is bytes, and a page titled in another script ("ニュース") has an
 * address in it, so the address goes percent-encoded, as a browser sends it.
 */
export const canonicalLink = (url: string): string => `<${encodeURI(url)}>; rel="canonical"`

export function markdownEntry(data: SiteData, parts: string[], shopLive: boolean): Entry | undefined {
  const decoded = parts.map(decode)
  if (!decoded.length || decoded.some((part) => !part)) return undefined
  const [root, slug, ...rest] = decoded as string[]
  if (root === "blog") return slug && !rest.length ? livePosts(data).find((post) => post.slug === slug) : undefined
  if (root === "shop") return shopLive && slug && !rest.length ? liveProducts(data).find((product) => product.slug === slug.toLowerCase()) : undefined
  const path = decoded.join("/").toLowerCase()
  return livePages(data).find((page) => page.slug === path)
}

/** What a Markdown copy says beside its body. */
export type MarkdownFacts = {
  /** the site's name, as the copy has it */
  site: string
  /** a post's cover, a product's pictures: addresses on this site */
  images?: string[]
}

/**
 * The whole document: front matter with what its page says of it (its
 * description, as the page's metadata has it; its page's address; a post's
 * dates, author, category and tags; a product's price, currency and stock;
 * its pictures), the title, and the body.
 */
export function entryMarkdown(entry: Entry, body: NBlock[], ctx: MarkdownContext, facts: MarkdownFacts): string {
  const path = urlFor(entry) ?? "/"
  const fields: FrontMatter = {
    title: entry.title,
    description: inlineWords(entry.description).replace(/\s*\n\s*/g, " ").trim() || blocksExcerpt(body),
    url: ctx.absolute(path),
    site: facts.site,
  }
  if (entry.kind === "Post") {
    Object.assign(fields, {
      published: entry.date ?? entry.created,
      updated: entry.lastEdited || undefined,
      author: entry.author?.name,
      category: entry.category?.name,
      tags: entry.tags.map((tag) => tag.name),
    })
  } else if (entry.kind === "Product") {
    Object.assign(fields, {
      price: entry.price,
      currency: entry.price === undefined ? undefined : currencyOf(entry.currency),
      availability: entry.stock?.name,
    })
  } else {
    fields.updated = entry.lastEdited || undefined
  }
  if (facts.images?.length) fields.images = facts.images.map(ctx.absolute)
  return markdownDocument(fields, entry.title, blocksMarkdown(body, ctx))
}
