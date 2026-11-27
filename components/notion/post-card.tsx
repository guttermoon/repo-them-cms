import type React from "react"
import Link from "next/link"

import { plainText, type SiteCopy } from "@/components/system/notion-text"
import { SearchItem, type SearchLabels, SearchList } from "@/components/system/search-box"
import { Tag } from "@/components/ui/page"
import { mediaUrl } from "@/lib/content/media"
import { formatDate, postDate } from "@/lib/content/select"
import type { Entry } from "@/lib/notion/rows"
import { SITE_LANGUAGE } from "@/lib/site"
import { NotionIcon } from "./icon"
import { LinkedText } from "@/components/system/linked-text"
import { inlineWords } from "@/lib/inline-text"
import { coverFrame, coverStyle } from "@/lib/cover"
import { picture } from "@/lib/media-sizes"

/**
 * A post as a card in a gallery, the way Notion's gallery view draws a
 * page: the cover on top (or a plain label when there is none), then the
 * title and its properties.
 */
export function PostCard({ post, label, large = false, headingLevel = 3 }: { post: Entry; label: string; large?: boolean; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3"
  return (
    <article className="lit group flex h-full flex-col overflow-hidden rounded-card border border-line bg-card">
      <Link href={`/blog/${post.slug}`} className="flex h-full flex-col focus-visible:outline-offset-[calc(var(--focus-ring)*-1)]">
        {post.cover ? (
          // printed in the look's own ink, unless Cover Tint is Off (lib/cover.ts)
          <div {...coverFrame(post.coverTint, "aspect-[5/2] w-full overflow-hidden border-b border-line")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...picture(mediaUrl(post.cover, "cover"), "(min-width: 1024px) 50vw, 100vw")} alt="" style={coverStyle(post.coverAt)} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div aria-hidden="true" className="flex aspect-[5/2] w-full items-end border-b border-line bg-wash p-4">
            <span className="label text-ui text-sub">{post.category?.name ?? label}</span>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <H className={`title-slab ${large ? "text-head-m" : "text-head-s"}`}>
            {post.icon && post.icon.type !== "image" ? <NotionIcon icon={post.icon} className="mr-1.5 align-[-0.1em]" /> : null}
            {post.title}
          </H>
          {post.description ? (
            <p className={`max-w-measure text-sub ${large ? "text-ui" : "line-clamp-3 text-small"}`}>
              {/* the card is a link: a link in the words stays words */}
              <LinkedText text={post.description} words />
            </p>
          ) : null}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-fine text-sub">
            <time dateTime={postDate(post)}>{formatDate(postDate(post), SITE_LANGUAGE)}</time>
            {post.category ? <Tag color={post.category.color}>{post.category.name}</Tag> : null}
          </div>
        </div>
      </Link>
    </article>
  )
}

/** Posts as a gallery: one large card for the first when `lead` is set. */
/** The word on a card with no cover and no category. */
export const cardLabel = (content: SiteCopy) => plainText(content, "blog.card.label", "post")

/** `label` is the word on a card with no cover and no category: `cardLabel()`. */
export function PostGallery({
  posts,
  label,
  lead = false,
  headingLevel = 3,
  search,
}: {
  posts: Entry[]
  label: string
  lead?: boolean
  headingLevel?: 2 | 3
  /** a search field over the posts, its words and its icon (drawn on the server) */
  search?: { labels: SearchLabels; icon?: React.ReactNode }
}) {
  if (!posts.length) return null
  const [first, ...rest] = posts
  // each card is searched by its words, worked out here so the browser gets words, not posts
  const item = (post: Entry, card: React.ReactNode) => (search ? <SearchItem key={post.id} text={postText(post)}>{card}</SearchItem> : card)
  const gallery = (
    <div className="space-y-5">
      {lead ? item(first, <PostCard post={first} label={label} large headingLevel={headingLevel} />) : null}
      <div className="arrive-each grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(lead ? rest : posts).map((post) => item(post, <PostCard key={post.id} post={post} label={label} headingLevel={headingLevel} />))}
      </div>
    </div>
  )
  return search ? (
    <SearchList labels={search.labels} icon={search.icon} total={posts.length} texts={posts.map(postText)}>
      {gallery}
    </SearchList>
  ) : (
    gallery
  )
}

/** A post's words for search: its title, its description, its category, its tags and its author. */
export function postText(post: Entry): string {
  return [post.title, inlineWords(post.description), post.category?.name, ...post.tags.map((t) => t.name), post.author?.name].filter(Boolean).join(" ")
}
