import type { Metadata } from "next"

import { cardLabel, PostGallery } from "@/components/notion/post-card"
import { JsonLd } from "@/components/system/json-ld"
import { makeT, plainText } from "@/components/system/notion-text"
import { Callout } from "@/components/ui/blocks"
import { Frame, PageHeader, TagLink } from "@/components/ui/page"
import { Icon } from "@/components/ui/icon"
import { blogPosts, categories, featuredFirst } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { metaKey, PAGE_META } from "@/lib/page-meta"
import { pageMetaFor } from "@/lib/seo"
import { blogLd } from "@/lib/structured-data"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/blog", await getSiteData())
}

export default async function BlogPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)
  const posts = blogPosts(data)
  const ordered = featuredFirst(posts)
  const cats = categories(posts)

  return (
    <>
      <JsonLd data={blogLd(posts, data.copy)} />
      <PageHeader
        wide
        label={<T k={metaKey("/blog", "label")}>{PAGE_META["/blog"].label}</T>}
        title={<T k="blog.title">Blog</T>}
        description={<T k="blog.lede">News and guides, in plain words.</T>}
      />
      <Frame wide className="pb-6 pt-6">
        <div className="flex flex-wrap items-center gap-2 text-small">
          {cats.map((c) => (
            <TagLink key={c.slug} href={`/blog/category/${c.slug}`} color={c.color}>
              {c.name} <span className="ml-1 font-normal tabular-nums">{c.count}</span>
            </TagLink>
          ))}
          <a href="/blog/rss.xml" className="n-link ml-auto inline-flex min-h-target items-center text-sub">
            <T k="blog.rss">RSS feed</T>
          </a>
        </div>
        <div className="mt-6">
          {ordered.length ? (
            <PostGallery
              posts={ordered}
              label={cardLabel(data.copy)}
              lead
              headingLevel={2}
              search={{
                labels: {
                  label: plainText(data.copy, "blog.search.label", "Search the posts"),
                  placeholder: plainText(data.copy, "blog.search.placeholder", "search the posts"),
                  found: plainText(data.copy, "blog.search.found", "found"),
                  none: plainText(data.copy, "blog.search.none", "No post matches that. Try a plainer word."),
                },
                icon: <Icon name="magnifying-glass" />,
              }}
            />
          ) : (
            <Callout icon={<Icon name="note-pencil" />}>
              <T k="blog.empty">
                No posts yet. In the Notion database, add a row, set Kind to Post, write it, and tick Published. It appears here within a minute.
              </T>
            </Callout>
          )}
        </div>
      </Frame>
    </>
  )
}
