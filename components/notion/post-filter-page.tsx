import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { JsonLd } from "@/components/system/json-ld"
import { makeT, type SiteCopy } from "@/components/system/notion-text"
import { filterWords, type Kind } from "@/lib/filter-words"
import { Frame, PageHeader } from "@/components/ui/page"
import { blogPosts, categories, filedUnder, tags } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import type { Entry } from "@/lib/notion/rows"
import { pageMeta } from "@/lib/seo"
import { shareImage } from "@/lib/share"
import { siteName } from "@/lib/slots"
import { blogLd } from "@/lib/structured-data"
import { cardLabel, PostGallery } from "./post-card"

/*
 * A category's page (/blog/category/<slug>) and a tag's (/blog/tag/<slug>):
 * the same page for either kind, so each route is its kind and nothing else.
 */

/** Where a category's or a tag's page is. */
const pathOf = (kind: Kind, slug: string) => `/blog/${kind === "Category" ? "category" : "tag"}/${slug}`

/** The address of every category's or every tag's page that has live posts. */
export async function filedSlugs(kind: Kind): Promise<string[]> {
  const posts = blogPosts(await getSiteData())
  return (kind === "Category" ? categories(posts) : tags(posts)).map((filed) => filed.slug)
}

/** What the page at `slug` shows: the 404 when no live post is filed there. */
export async function filedPage(kind: Kind, slug: string): Promise<React.ComponentProps<typeof PostFilterPage>> {
  const data = await getSiteData()
  const found = filedUnder(blogPosts(data), kind, slug)
  // the 404's own page and metadata (app/not-found.tsx)
  if (!found) notFound()
  return { kind, name: found.filed.name, path: pathOf(kind, found.filed.slug), posts: found.posts, content: data.copy }
}

/** The page's search words, the titles of its newest posts among them, and
 *  the site's share picture, if it has one (else the card drawn with the name). */
export async function filedMetadata(kind: Kind, slug: string): Promise<Metadata> {
  const { name, posts, content } = await filedPage(kind, slug)
  const words = filterWords(content, kind, name, posts.length, posts.map((post) => post.title))
  const image = shareImage(await getSiteData())
  return pageMeta({ path: pathOf(kind, slug), title: words.title, description: words.meta, site: siteName(content), ...(image ? { image } : {}) })
}

/** A category's or a tag's posts: the blog, narrowed. */
export function PostFilterPage({ kind, name, path, posts, content }: { kind: Kind; name: string; path: string; posts: Entry[]; content: SiteCopy }) {
  const T = makeT(content)
  const words = filterWords(content, kind, name, posts.length)
  return (
    <>
      <JsonLd data={blogLd(posts, content, { path, name, description: words.description })} />
      <PageHeader wide label={words.label} title={name} description={words.description} />
      <Frame wide className="pb-6 pt-6">
        <PostGallery posts={posts} label={cardLabel(content)} headingLevel={2} />
        <p className="mt-8">
          <Link href="/blog" className="n-link inline-flex min-h-target items-center text-ui">
            <T k="blog.back">← All posts</T>
          </Link>
        </p>
      </Frame>
    </>
  )
}
