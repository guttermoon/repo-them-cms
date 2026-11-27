import type { MetadataRoute } from "next"

import { commerce, shopIsLive } from "@/lib/commerce/config"
import { blogPosts, categories, collections, livePages, livePosts, liveProducts, tags } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { INDEXED_PAGES } from "@/lib/nav"
import { SITE_URL } from "@/lib/site"
import { notionConfigured } from "@/lib/config"

// refreshed with the content, like the pages: a page's date here is never
// more than a minute behind Notion's, which the hourly IndexNow run reads
export const revalidate = 60

/**
 * Every indexable page: the designed ones from the site's map (lib/nav.ts),
 * then every live page and post written in Notion, with the date each was
 * last edited there (a true date, so it is printed), then the blog's
 * categories and tags, and the shop's products and collections when the
 * shop is real. /subscribed, /cart and /go/* are absent: the first two
 * carry noindex of their own, the last are redirects. The example shop
 * (lib/commerce/config.ts) is absent too: it is noindex, and a sitemap
 * that lists a page it also asks search engines to drop contradicts
 * itself. For the same reason there is none at all while the site shows the
 * starter content.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // the starter content is noindex with robots shut: it has no sitemap either
  if (!notionConfigured()) return []
  const data = await getSiteData()
  // every post has a page, a release too; the blog's categories and tags
  // are its own posts' (a release is the changelog's), as their pages are
  const posts = livePosts(data)
  const filed = blogPosts(data)
  const live = shopIsLive(commerce())
  const products = live ? liveProducts(data) : []
  const url = (path: string) => `${SITE_URL}${path === "/" ? "/" : path}`
  return [
    ...INDEXED_PAGES.filter((page) => live || page.href !== "/shop").map((page) => ({
      url: url(page.href),
      changeFrequency: "weekly" as const,
      priority: page.priority ?? 0.5,
    })),
    ...livePages(data).map((page) => ({ url: url(`/${page.slug}`), lastModified: page.lastEdited || undefined, priority: 0.6 })),
    ...posts.map((post) => ({ url: url(`/blog/${post.slug}`), lastModified: post.lastEdited || undefined, priority: 0.7 })),
    ...categories(filed).map((c) => ({ url: url(`/blog/category/${c.slug}`), priority: 0.4 })),
    ...tags(filed).map((t) => ({ url: url(`/blog/tag/${t.slug}`), priority: 0.3 })),
    ...products.map((product) => ({ url: url(`/shop/${product.slug}`), lastModified: product.lastEdited || undefined, priority: 0.6 })),
    ...collections(products).map((c) => ({ url: url(`/shop/collection/${c.slug}`), priority: 0.4 })),
  ]
}
