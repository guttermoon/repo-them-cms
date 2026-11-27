import type { Metadata } from "next"
import Link from "next/link"

import { Container, MoreLink } from "@/components/sections/marketing"
import { JsonLd } from "@/components/system/json-ld"
import { makeT } from "@/components/system/notion-text"
import { Callout } from "@/components/ui/blocks"
import { Icon } from "@/components/ui/icon"
import { formatDate, postDate, releases } from "@/lib/content/select"
import { getSiteData } from "@/lib/content/store"
import { pageMetaFor } from "@/lib/seo"
import { SITE_LANGUAGE } from "@/lib/site"
import { pageWords } from "@/lib/page-meta"
import { blogLd } from "@/lib/structured-data"
import { LinkedText } from "@/components/system/linked-text"

export const revalidate = 60
export async function generateMetadata(): Promise<Metadata> {
  return pageMetaFor("/changelog", await getSiteData())
}

/**
 * /changelog: the posts filed under Releases, newest first, as a timeline.
 * A release is written like any post; filing it under Releases is all it
 * takes to appear here, and to stay out of the blog (`blogPosts`).
 */
export default async function ChangelogPage() {
  const data = await getSiteData()
  const T = makeT(data.copy)
  const posts = releases(data)
  const words = pageWords("/changelog", data.copy)
  return (
    <>
      <JsonLd data={blogLd(posts, data.copy, { path: "/changelog", name: words.title, description: words.description })} />
      <Container size="text" className="pb-16 pt-12 sm:pt-16">
        <p className="eyebrow text-lead">
          <T k="changelog.eyebrow">what is new</T>
        </p>
        <h1 className="title-slab title-display mt-3 text-fluid-hero">
          <T k="changelog.title">changelog</T>
        </h1>
        <p className="mt-4 max-w-[640px] text-lead leading-relaxed text-ink sm:text-head-s">
          <T k="changelog.lede">Every release, newest first: what changed, what was fixed, and what it means for you.</T>
        </p>
        {posts.length ? (
          <ol className="mt-12 border-l-2 border-tint pl-6 sm:pl-8">
            {posts.map((post) => (
              <li key={post.id} className="relative pb-12 last:pb-0">
                <span aria-hidden="true" className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-[3px] border-page bg-brand sm:-left-[41px]" />
                <time dateTime={postDate(post)} className="text-small font-medium text-sub">
                  {formatDate(postDate(post), SITE_LANGUAGE)}
                </time>
                <h2 className="title-slab mt-1 text-head-m sm:text-head-l">
                  <Link href={`/blog/${post.slug}`} className="inline-flex min-h-target items-center hover:underline">
                    {post.title}
                  </Link>
                </h2>
                {post.description ? (
                  <p className="mt-2 text-lead leading-relaxed text-ink">
                    <LinkedText text={post.description} />
                  </p>
                ) : null}
                <MoreLink href={`/blog/${post.slug}`} className="mt-3 text-body">
                  <T k="changelog.read">Read the notes</T>
                </MoreLink>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-10">
            <Callout icon={<Icon name="calendar-blank" />}>
              <T k="changelog.empty">No releases yet. Write a post in Notion, set its Category to Releases, and tick Published.</T>
            </Callout>
          </div>
        )}
      </Container>
    </>
  )
}
