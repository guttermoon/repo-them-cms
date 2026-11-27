/**
 * The blog as an RSS 2.0 feed (/blog/rss.xml): every live post, newest
 * first, with its description, date, author and category.
 *
 * Pure: it takes the posts and the site's address and returns the XML, so
 * `npm test` checks it (tests/feed.test.mjs).
 */
import type { Entry, SiteCopy } from "./notion/rows"
import { inlineWords } from "./inline-text"
import { fillIn, plainText } from "./slots"

/** The feed's name, in the feed and in the <link> every page carries to it:
 *  `meta.feed.title` in Site Copy, with `{site}` for the site's name. */
export function feedTitle(copy: SiteCopy, site: string): string {
  return fillIn(plainText(copy, "meta.feed.title", "{site}: posts"), { site })
}

/** Escaped for XML, with the control characters XML 1.0 cannot hold at all
 *  (a stray one pasted into a title would make the whole feed unreadable)
 *  taken out. */
const escape = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

/** A Notion date as RFC 822, the only date RSS accepts. */
export function rfc822(iso: string): string {
  const at = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  return Number.isNaN(at.getTime()) ? new Date(0).toUTCString() : at.toUTCString()
}

export function rssFeed({
  title,
  description,
  siteUrl,
  language,
  posts,
}: {
  title: string
  description: string
  siteUrl: string
  language: string
  posts: Entry[]
}): string {
  const items = posts
    .map((post) => {
      const url = `${siteUrl}/blog/${post.slug}`
      return [
        "    <item>",
        `      <title>${escape(post.title)}</title>`,
        `      <link>${escape(url)}</link>`,
        `      <guid isPermaLink="true">${escape(url)}</guid>`,
        `      <pubDate>${rfc822(post.date ?? post.created)}</pubDate>`,
        post.description ? `      <description>${escape(inlineWords(post.description))}</description>` : null,
        post.author ? `      <dc:creator>${escape(post.author.name)}</dc:creator>` : null,
        post.category ? `      <category>${escape(post.category.name)}</category>` : null,
        ...post.tags.map((t) => `      <category>${escape(t.name)}</category>`),
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n")
  const latest = posts[0] ? rfc822(posts[0].date ?? posts[0].created) : new Date(0).toUTCString()
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escape(title)}</title>
    <link>${escape(`${siteUrl}/blog`)}</link>
    <description>${escape(description)}</description>
    <language>${escape(language)}</language>
    <lastBuildDate>${latest}</lastBuildDate>
    <atom:link href="${escape(`${siteUrl}/blog/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
}
