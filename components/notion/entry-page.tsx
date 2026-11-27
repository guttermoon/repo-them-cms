import type React from "react"

import { makeT, slotText } from "@/components/system/notion-text"
import { Frame, PageHeader, PropertyRow, Tag, TagLink } from "@/components/ui/page"
import { mediaUrl } from "@/lib/content/media"
import { blogPosts, categories, formatDate, isRelease, postDate, tagSlug, tags, urlForNotionId } from "@/lib/content/select"
import type { NBlock } from "@/lib/notion/blocks"
import type { Entry, SiteData } from "@/lib/notion/rows"
import { SITE_LANGUAGE } from "@/lib/site"
import { NotionBody } from "./blocks"
import { NotionIcon } from "./icon"
import { blockLabels, makeContext } from "./context"
import { LinkedText } from "@/components/system/linked-text"

/** Words per minute for a reading time. */
const WPM = 220

/**
 * A page or a post written in Notion, laid out as Notion lays out a page:
 * cover, icon, title, properties, then the body. `after` is anything the
 * site adds under the body (an author box, the next and previous posts).
 */
export function EntryPage({
  entry,
  blocks,
  data,
  words,
  after,
}: {
  entry: Entry
  blocks: NBlock[]
  data: SiteData
  /** the body's word count, for a post's reading time */
  words?: number
  after?: React.ReactNode
}) {
  const ctx = makeContext(blocks, (id) => urlForNotionId(data, id), blockLabels(data.copy))
  const T = makeT(data.copy)
  const label = (k: string, fallback: string) => slotText(data.copy, `entry.${k}`, fallback)
  const cover = entry.cover ? { src: mediaUrl(entry.cover, "cover"), alt: "", at: entry.coverAt, tint: entry.coverTint } : undefined
  const post = entry.kind === "Post"
  const filed = blogPages(data)
  const minutes = words ? Math.max(1, Math.round(words / WPM)) : undefined

  const properties = post ? (
    <div>
      <PropertyRow name={label("published", "Published")}>
        <time dateTime={postDate(entry)}>{formatDate(postDate(entry), SITE_LANGUAGE)}</time>
        {minutes ? (
          <span className="text-sub">
            {" "}
            · {minutes} <T k="entry.minutes">min read</T>
          </span>
        ) : null}
      </PropertyRow>
      {entry.author ? <PropertyRow name={label("author", "Author")}>{entry.author.name}</PropertyRow> : null}
      {entry.category ? (
        <PropertyRow name={label("category", "Category")}>
          <Filed href={categoryHref(entry, filed)} color={entry.category.color}>
            {entry.category.name}
          </Filed>
        </PropertyRow>
      ) : null}
      {entry.tags.length ? (
        <PropertyRow name={label("tags", "Tags")}>
          <span className="flex flex-wrap gap-1.5">
            {entry.tags.map((t) => (
              <Filed key={t.name} href={filed.tags.has(tagSlug(t.name)) ? `/blog/tag/${tagSlug(t.name)}` : undefined} color={t.color}>
                {t.name}
              </Filed>
            ))}
          </span>
        </PropertyRow>
      ) : null}
    </div>
  ) : null

  return (
    <article lang={SITE_LANGUAGE}>
      <PageHeader
        title={entry.title}
        icon={entry.icon ? <NotionIcon icon={entry.icon} /> : undefined}
        cover={cover}
        description={entry.description ? <LinkedText text={entry.description} /> : undefined}
        properties={properties}
        wide={entry.fullWidth}
      />
      <Frame wide={entry.fullWidth} className="pb-8 pt-6">
        <NotionBody blocks={blocks} ctx={ctx} font={entry.font} />
        {after}
      </Frame>
    </article>
  )
}

/** The blog's category and tag pages that exist: those of its own posts
 *  (a release is the changelog's, and files none). */
function blogPages(data: SiteData) {
  const posts = blogPosts(data)
  return { categories: new Set(categories(posts).map((c) => c.slug)), tags: new Set(tags(posts).map((t) => t.slug)) }
}

/** Where a post's category goes: a release's to the changelog, any other's
 *  to its page on the blog, and nowhere when there is no such page. */
function categoryHref(entry: Entry, filed: ReturnType<typeof blogPages>): string | undefined {
  if (isRelease(entry)) return "/changelog"
  const slug = tagSlug(entry.category?.name ?? "")
  return filed.categories.has(slug) ? `/blog/category/${slug}` : undefined
}

/** A category or a tag: a link to its page, or a plain tag where it has
 *  none, never a link to the 404. */
function Filed({ href, color, children }: { href?: string; color?: React.ComponentProps<typeof Tag>["color"]; children: React.ReactNode }) {
  return href ? (
    <TagLink href={href} color={color}>
      {children}
    </TagLink>
  ) : (
    <Tag color={color}>{children}</Tag>
  )
}
