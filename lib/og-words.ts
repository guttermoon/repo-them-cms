/**
 * The words on a page's share card (app/og/[[...path]]/route.tsx): its
 * title, and the small label above it. A designed page's are its own words as
 * the site's owner has them (lib/page-meta.ts); a row's are its title, and
 * a label from Site Copy (`og.label.*`, or the blog's own for a category or a
 * tag).
 */
import { blogPosts, categories, collections, livePages, livePosts, liveProducts, tags } from "./content/select"
import { getSiteData } from "./content/store"
import { filterWords } from "./filter-words"
import { PAGE_META, pageWords, type IndexedPath } from "./page-meta"
import { plainText, siteDescriptor, siteName, siteNoun } from "./slots"

/** A share card's words: its title and label, and the site's name and
 *  descriptor as the copy has them (`site.name`, `site.descriptor`).
 *  `front`: the home page's card, which is the one a shared site shows, so
 *  it leads with the shelf (lib/og-card.tsx). `missing`: the address is no
 *  page, and its card is the one every such address shares (lib/og-once.ts). */
export type OgWords = { title: string; label: string; name: string; descriptor: string; front?: boolean; missing?: boolean }

export async function ogWords(path: string): Promise<OgWords> {
  const data = await getSiteData()
  const copy = data.copy
  const site = { name: siteName(copy), descriptor: siteDescriptor(copy) }
  // every label read, so `npm run copy` lists them all
  const labels = {
    post: plainText(copy, "og.label.post", "Post"),
    page: plainText(copy, "og.label.page", "Page"),
    product: plainText(copy, "og.label.product", "Shop"),
    collection: plainText(copy, "og.label.collection", "Collection"),
    missing: plainText(copy, "og.label.missing", "Not found"),
  }
  if (path in PAGE_META) {
    const words = pageWords(path as IndexedPath, copy)
    return { ...site, title: words.title, label: words.label, ...(path === "/" ? { front: true } : {}) }
  }

  // the blog's categories and tags are its own posts' (a release is the
  // changelog's), but every post, a release too, has a page and a card
  const posts = blogPosts(data)
  const [first, second, third] = path.split("/").filter(Boolean)
  if (first === "blog" && second === "category" && third) {
    const c = categories(posts).find((x) => x.slug === third)
    if (c) return { ...site, title: c.name, label: filterWords(copy, "Category", c.name, 0).label }
  }
  if (first === "blog" && second === "tag" && third) {
    const t = tags(posts).find((x) => x.slug === third)
    if (t) return { ...site, title: t.name, label: filterWords(copy, "Tag", t.name, 0).label }
  }
  if (first === "blog" && second && !third) {
    const post = livePosts(data).find((p) => p.slug === second)
    if (post) return { ...site, title: post.title, label: post.category?.name ?? labels.post }
  }
  if (first === "shop" && second === "collection" && third) {
    const c = collections(liveProducts(data)).find((x) => x.slug === third)
    if (c) return { ...site, title: c.name, label: labels.collection }
  }
  if (first === "shop" && second && !third) {
    const product = liveProducts(data).find((p) => p.slug === second)
    if (product) return { ...site, title: product.title, label: product.category?.name ?? labels.product }
  }
  const page = livePages(data).find((p) => `/${p.slug}` === path)
  if (page) return { ...site, title: page.title, label: labels.page }
  return { ...site, title: siteNoun(copy), label: labels.missing, missing: true }
}
