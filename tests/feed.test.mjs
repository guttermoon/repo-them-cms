// The blog's RSS feed (lib/feed.ts): valid XML whatever a title holds, real
// dates in the one format RSS accepts, and nothing a post does not have.
import { test } from "node:test"
import assert from "node:assert/strict"

import { rfc822, rssFeed } from "../lib/feed.ts"

const post = (over) => ({
  id: "11111111-2222-4333-8444-555555555555",
  kind: "Post",
  title: "Hello",
  slug: "hello",
  description: "",
  created: "2026-11-01T10:00:00.000Z",
  lastEdited: "2026-11-02T10:00:00.000Z",
  tags: [],
  featured: false,
  font: "default",
  fullWidth: false,
  ...over,
})
const feed = (posts) => rssFeed({ title: "Site: posts", description: "Posts & news", siteUrl: "https://site.example", language: "en-GB", posts })

test("dates: a Notion date or date-time as RFC 822, and nonsense as the epoch rather than a broken feed", () => {
  assert.equal(rfc822("2026-11-04"), "Wed, 04 Nov 2026 00:00:00 GMT")
  assert.equal(rfc822("2026-11-04T09:30:00.000+01:00"), "Wed, 04 Nov 2026 08:30:00 GMT")
  assert.equal(rfc822("soon"), "Thu, 01 Jan 1970 00:00:00 GMT")
})

test("a post becomes an item with its link, date, description, author and categories", () => {
  const xml = feed([post({ date: "2026-11-04", description: "First.", author: { name: "Ada" }, category: { name: "News", color: "blue" }, tags: [{ name: "Notion", color: "gray" }] })])
  assert.ok(xml.includes("<link>https://site.example/blog/hello</link>"))
  assert.ok(xml.includes('<guid isPermaLink="true">https://site.example/blog/hello</guid>'))
  assert.ok(xml.includes("<pubDate>Wed, 04 Nov 2026 00:00:00 GMT</pubDate>"))
  assert.ok(xml.includes("<description>First.</description>"))
  assert.ok(xml.includes("<dc:creator>Ada</dc:creator>"))
  assert.ok(xml.includes("<category>News</category>"))
  assert.ok(xml.includes("<category>Notion</category>"))
  assert.ok(xml.includes("<lastBuildDate>Wed, 04 Nov 2026 00:00:00 GMT</lastBuildDate>"))
  assert.ok(xml.includes('<atom:link href="https://site.example/blog/rss.xml" rel="self" type="application/rss+xml" />'))
})

test("without a description, author or category, the item says nothing rather than something empty", () => {
  const xml = feed([post({})])
  assert.doesNotMatch(xml, /<description><\/description>|<dc:creator>|<item>[\s\S]*<category>/)
  assert.ok(xml.includes("<pubDate>Sun, 01 Nov 2026 10:00:00 GMT</pubDate>"), "undated posts are dated by when they were made")
})

test("whatever a title holds, the feed stays well-formed XML", () => {
  const xml = feed([post({ title: `Fish & <chips> "quoted" 'too'\u0007\u000B` })])
  assert.ok(xml.includes("<title>Fish &amp; &lt;chips&gt; &quot;quoted&quot; &apos;too&apos;</title>"))
  assert.doesNotMatch(xml, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/)
  assert.ok(xml.includes("<description>Posts &amp; news</description>"))
  // every tag that opens, closes
  const opens = (xml.match(/<(item|channel|rss)\b/g) ?? []).length
  const closes = (xml.match(/<\/(item|channel|rss)>/g) ?? []).length
  assert.equal(opens, closes)
})

test("an empty blog is still a valid feed", () => {
  const xml = feed([])
  assert.match(xml, /<channel>[\s\S]*<\/channel>/)
  assert.doesNotMatch(xml, /<item>/)
})
