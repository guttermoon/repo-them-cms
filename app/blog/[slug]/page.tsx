import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { EntryPage } from "@/components/notion/entry-page"
import { JsonLd } from "@/components/system/json-ld"
import { LinkedText } from "@/components/system/linked-text"
import { fillIn, makeT, plainText, siteName } from "@/components/system/notion-text"
import { getBlocks, prerenderable } from "@/lib/content/blocks"
import { mediaUrl } from "@/lib/content/media"
import { coverStyle } from "@/lib/cover"
import { isRelease, livePosts, neighbours } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { blocksExcerpt, blocksText } from "@/lib/notion/blocks"
import { pageMeta } from "@/lib/seo"
import { shareImage } from "@/lib/share"
import { postLd } from "@/lib/structured-data"
import { inlineWords } from "@/lib/inline-text"
import { picture } from "@/lib/media-sizes"

export const revalidate = 60
// a post published after the build is rendered on its first visit
export const dynamicParams = true

export async function generateStaticParams() {
  return prerenderable(livePosts(await getSiteData())).map((post) => ({ slug: post.slug }))
}

async function findPost(slug: string) {
  const posts = livePosts(await getSiteData())
  return { posts, post: posts.find((p) => p.slug === decodeURIComponent(slug)) }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { post } = await findPost(slug)
  // the 404's own metadata (app/not-found.tsx)
  if (!post) notFound()
  const data = await getSiteData()
  const { copy } = data
  // read first, so the slot is there to find (npm run copy) whichever is used
  const fallback = fillIn(plainText(copy, "meta.post.description", "{title}, on the blog."), { title: post.title })
  const image = shareImage(data, post.cover ? { url: mediaUrl(post.cover, "cover"), alt: post.title } : undefined)
  return pageMeta({
    site: siteName(copy),
    path: `/blog/${post.slug}`,
    title: post.title,
    description:
      inlineWords(post.description) || blocksExcerpt(await getBlocks(post)) || fallback,
    type: "article",
    markdown: true,
    publishedTime: post.date ?? post.created,
    modifiedTime: post.lastEdited,
    authors: post.author ? [post.author.name] : undefined,
    ...(image ? { image } : {}),
  })
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getSiteData()
  const { posts, post } = await findPost(slug)
  if (!post) notFound()

  const T = makeT(data.copy)
  const blocks = await getBlocks(post)
  const words = blocksText(blocks).split(/\s+/).filter(Boolean).length
  // a release's neighbours are releases, and it leads back to the
  // changelog; a blog post's are the blog's (lib/content/select.ts)
  const release = isRelease(post)
  const [newer, older] = neighbours(posts.filter((p) => isRelease(p) === release), post.slug)

  const after = (
    <>
      {post.author ? (
        <aside aria-label={plainText(data.copy, "post.author.region", "About the author")} className="mt-12 flex gap-4 border-t border-line pt-6">
          {post.author.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...picture(mediaUrl(post.author.image, "author"), 112)} alt={post.author.name} width={56} height={56} style={coverStyle(post.author.at)} className="h-14 w-14 shrink-0 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0">
            <p className="label text-fine text-sub">
              <T k="post.author.label">Written by</T>
            </p>
            <p className="mt-1 font-semibold text-ink">{post.author.name}</p>
            {post.author.role ? <p className="text-fine text-sub">{post.author.role}</p> : null}
            {post.author.bio ? (
              <p className="mt-1 text-ui text-sub">
                <LinkedText text={post.author.bio} />
              </p>
            ) : null}
          </div>
        </aside>
      ) : null}
      {newer || older ? (
      <nav aria-label={plainText(data.copy, "post.more", "More posts")} className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {newer ? (
          <Link href={`/blog/${newer.slug}`} className="rounded-card border border-line p-4 hover:bg-wash">
            <span className="label text-micro text-sub">
              <T k="post.newer">Newer</T>
            </span>
            <span className="mt-1 block font-semibold text-ink">{newer.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {older ? (
          <Link href={`/blog/${older.slug}`} className="rounded-card border border-line p-4 text-right hover:bg-wash">
            <span className="label text-micro text-sub">
              <T k="post.older">Older</T>
            </span>
            <span className="mt-1 block font-semibold text-ink">{older.title}</span>
          </Link>
        ) : null}
      </nav>
      ) : null}
      <p className="mt-8">
        {release ? (
          <Link href="/changelog" className="n-link inline-flex min-h-target items-center text-ui">
            <T k="changelog.back">← Every release</T>
          </Link>
        ) : (
          <Link href="/blog" className="n-link inline-flex min-h-target items-center text-ui">
            <T k="blog.back">← All posts</T>
          </Link>
        )}
      </p>
    </>
  )

  return (
    <>
      <JsonLd
        data={postLd(
          post,
          data.copy,
          shareImage(data, post.cover ? { url: mediaUrl(post.cover, "cover"), alt: post.title } : undefined)?.url,
          post.author?.image ? mediaUrl(post.author.image, "author") : undefined,
        )}
      />
      <EntryPage entry={post} blocks={blocks} data={data} words={words} after={after} />
    </>
  )
}
