// Which pages and posts are live, in what order, at what address
// (lib/content/select.ts): scheduling, reserved addresses, duplicates,
// featured posts, categories, tags and redirects.
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  blogPosts,
  categories,
  collections,
  filedUnder,
  featuredFirst,
  formatDate,
  isLive,
  isRelease,
  liveLogos,
  livePages,
  livePeople,
  livePlans,
  livePosts,
  liveProducts,
  liveQuestions,
  liveQuotes,
  quoteFor,
  liveResources,
  isExample,
  liveReviews,
  navPages,
  neighbours,
  redirects,
  releases,
  resourcesByCategory,
  tags,
  urlFor,
  urlForNotionId,
} from "../lib/content/select.ts"

let n = 0
const entry = (over) => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  kind: "Post",
  title: `Entry ${n}`,
  slug: `entry-${n}`,
  description: "",
  created: `2026-01-${String(n).padStart(2, "0")}T00:00:00.000Z`,
  lastEdited: "2026-11-01T00:00:00.000Z",
  tags: [],
  featured: false,
  font: "default",
  fullWidth: false,
  ...over,
})
const NOW = new Date("2026-11-23T12:00:00Z")

test("a dated entry goes live on its date; an undated one at once", () => {
  assert.equal(isLive(entry({ date: undefined }), NOW), true)
  assert.equal(isLive(entry({ date: "2026-11-23" }), NOW), true, "today, from midnight UTC")
  assert.equal(isLive(entry({ date: "2026-11-24" }), NOW), false)
  assert.equal(isLive(entry({ date: "2026-11-23T13:00:00Z" }), NOW), false, "later today, to the minute")
  assert.equal(isLive(entry({ date: "nonsense" }), NOW), true, "an unreadable date does not hide a post")
})

test("posts: newest first, scheduled ones hidden", () => {
  const data = {
    copy: {},
    entries: [
      entry({ slug: "old", date: "2026-10-01" }),
      entry({ slug: "new", date: "2026-11-20" }),
      entry({ slug: "future", date: "2027-01-01" }),
      entry({ kind: "Page", slug: "about" }),
    ],
  }
  assert.deepEqual(livePosts(data, NOW).map((p) => p.slug), ["new", "old"])
})

test("pages: one whose address the site already uses is skipped, and the older of two duplicates wins", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Page", slug: "blog", title: "Shadowed" }),
      entry({ kind: "Page", slug: "api/x", title: "Shadowed too" }),
      entry({ kind: "Page", slug: "story", title: "Older", created: "2026-01-01T00:00:00Z" }),
      entry({ kind: "Page", slug: "story", title: "Newer", created: "2026-02-01T00:00:00Z" }),
      entry({ kind: "Page", slug: "guides/setup", title: "Nested" }),
    ],
  }
  const pages = livePages(data, NOW)
  assert.deepEqual(pages.map((p) => p.title).sort(), ["Nested", "Older"])
})

test("the footer lists pages with an Order, in that order", () => {
  const data = { copy: {}, entries: [entry({ kind: "Page", slug: "c", order: 3 }), entry({ kind: "Page", slug: "a", order: 1 }), entry({ kind: "Page", slug: "x" })] }
  assert.deepEqual(navPages(data, NOW).map((p) => p.slug), ["a", "c"])
})

test("featured posts come first, by Feature Block, then the rest in date order", () => {
  const posts = [
    entry({ slug: "a", date: "2026-11-10" }),
    entry({ slug: "b", featured: true, featureBlock: 2, date: "2026-11-01" }),
    entry({ slug: "c", featured: true, featureBlock: 1, date: "2026-10-01" }),
    entry({ slug: "d", date: "2026-11-15" }),
  ]
  assert.deepEqual(featuredFirst(posts).map((p) => p.slug), ["c", "b", "a", "d"])
})

test("categories and tags, with counts and address-safe slugs", () => {
  const posts = [
    entry({ category: { name: "Guides", color: "blue" }, tags: [{ name: "Design", color: "purple" }] }),
    entry({ category: { name: "Guides", color: "blue" }, tags: [{ name: "Design", color: "purple" }, { name: "AI & Ethics", color: "red" }] }),
    entry({ category: { name: "News", color: "red" } }),
  ]
  assert.deepEqual(categories(posts).map((c) => [c.slug, c.count]), [["guides", 2], ["news", 1]])
  assert.deepEqual(tags(posts).map((t) => [t.slug, t.count]), [["ai-and-ethics", 1], ["design", 2]])
})

test("a category's or a tag's page: what is filed at its address, and its posts; nothing where none is", () => {
  const posts = [
    entry({ slug: "a", category: { name: "Guides", color: "blue" }, tags: [{ name: "Design", color: "purple" }] }),
    entry({ slug: "b", category: { name: "News", color: "red" }, tags: [{ name: "AI & Ethics", color: "red" }, { name: "Design", color: "purple" }] }),
    entry({ slug: "c", category: { name: "Guides", color: "blue" } }),
  ]
  const guides = filedUnder(posts, "Category", "guides")
  assert.deepEqual([guides.filed.name, guides.filed.count, guides.posts.map((p) => p.slug)], ["Guides", 2, ["a", "c"]])
  const design = filedUnder(posts, "Tag", "design")
  assert.deepEqual([design.filed.name, design.filed.count, design.posts.map((p) => p.slug)], ["Design", 2, ["a", "b"]])
  assert.deepEqual(filedUnder(posts, "Tag", "ai-and-ethics").posts.map((p) => p.slug), ["b"])
  assert.equal(filedUnder(posts, "Category", "design"), undefined, "a tag is not a category")
  assert.equal(filedUnder(posts, "Tag", "guides"), undefined, "nor a category a tag")
  assert.equal(filedUnder(posts, "Category", "nothing-here"), undefined)
})

test("resources: by Order then title, grouped by category with the uncategorised last", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Resource", title: "B", order: 2, category: { name: "Guides", color: "blue" } }),
      entry({ kind: "Resource", title: "Loose" }),
      entry({ kind: "Resource", title: "A", order: 1, category: { name: "Guides", color: "blue" } }),
    ],
  }
  const groups = resourcesByCategory(liveResources(data, NOW))
  assert.deepEqual(groups.map((g) => [g.category, g.items.map((i) => i.title)]), [["Guides", ["A", "B"]], ["", ["Loose"]]])
})

test("redirects: slug to destination, first row wins, only live ones", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Redirect", slug: "go1", link: "https://one.example/" }),
      entry({ kind: "Redirect", slug: "go1", link: "https://two.example/" }),
      entry({ kind: "Redirect", slug: "later", link: "/x", date: "2099-01-01" }),
    ],
  }
  assert.deepEqual({ ...redirects(data, NOW) }, { go1: "https://one.example/" })
})

test("redirects: a slug is only ever a row, never something every object has", () => {
  const table = redirects({ copy: {}, entries: [entry({ kind: "Redirect", slug: "constructor", link: "https://one.example/" })] }, NOW)
  assert.equal(table.constructor, "https://one.example/", "a row named constructor is a row")
  for (const slug of ["toString", "__proto__", "hasOwnProperty", "valueOf"]) assert.equal(table[slug], undefined, slug)
})

test("addresses, and a Notion page ID becoming a site address only when it is live here", () => {
  const page = entry({ kind: "Page", slug: "story" })
  const post = entry({ kind: "Post", slug: "hello" })
  const hidden = entry({ kind: "Post", slug: "soon", date: "2099-01-01" })
  assert.equal(urlFor(page), "/story")
  assert.equal(urlFor(post), "/blog/hello")
  assert.equal(urlFor(entry({ kind: "Resource" })), undefined)
  const data = { copy: {}, entries: [page, post, hidden] }
  assert.equal(urlForNotionId(data, page.id.replace(/-/g, ""), NOW), "/story")
  assert.equal(urlForNotionId(data, hidden.id, NOW), undefined)
  assert.equal(urlForNotionId(data, "ffffffffffffffffffffffffffffffff", NOW), undefined)
})

test("neighbours are the newer and the older post", () => {
  const posts = [entry({ slug: "n" }), entry({ slug: "m" }), entry({ slug: "o" })]
  assert.deepEqual(neighbours(posts, "m").map((p) => p?.slug), ["n", "o"])
  assert.deepEqual(neighbours(posts, "n").map((p) => p?.slug), [undefined, "m"])
})

test("dates read the way the site prints them, never moved by the server's time zone", () => {
  assert.equal(formatDate("2026-11-04"), "4 November 2026")
  assert.equal(formatDate("2026-11-04T23:30:00.000Z"), "4 November 2026")
  // the day written in Notion, not the day it was in Greenwich at that moment
  assert.equal(formatDate("2026-11-04T21:00:00.000-05:00"), "4 November 2026")
  assert.equal(formatDate("2026-11-04T01:00:00.000+10:00"), "4 November 2026")
  assert.equal(formatDate("not a date"), "not a date")
})

test("plans and logos in the editor's order, empty Orders last", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Plan", title: "C" }),
      entry({ kind: "Plan", title: "B", order: 2 }),
      entry({ kind: "Plan", title: "A", order: 1 }),
      entry({ kind: "Proof Logos", title: "Z", order: 1 }),
    ],
  }
  assert.deepEqual(livePlans(data, NOW).map((p) => p.title), ["A", "B", "C"])
  assert.deepEqual(liveLogos(data, NOW).map((p) => p.title), ["Z"])
})

test("products: featured first, then by Order; one address each; their collections", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Product", slug: "soup", title: "Soup", order: 1, category: { name: "Pantry", color: "green" } }),
      entry({ kind: "Product", slug: "drink", title: "Drink", featured: true, category: { name: "Drinks", color: "blue" } }),
      entry({ kind: "Product", slug: "soup", title: "Soup again", created: "2099-01-01T00:00:00Z" }),
      entry({ kind: "Product", slug: "later", date: "2099-01-01" }),
    ],
  }
  const products = liveProducts(data, NOW)
  assert.deepEqual(products.map((p) => p.title), ["Drink", "Soup"])
  assert.deepEqual(collections(products).map((c) => [c.slug, c.count]), [["drinks", 1], ["pantry", 1]])
  assert.equal(urlFor(products[0]), "/shop/drink")
})

test("quotes need words; questions need an answer, and can be asked by group", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Quote", title: "Empty" }),
      entry({ kind: "Quote", title: "Morris", text: "Useful or beautiful." }),
      entry({ kind: "Quote", title: "Featured", text: "First.", featured: true }),
      entry({ kind: "Question", title: "Cost?", text: "Nothing.", category: { name: "Pricing", color: "yellow" }, order: 2 }),
      entry({ kind: "Question", title: "Refunds?", text: "Yes.", category: { name: "pricing", color: "yellow" }, order: 1 }),
      entry({ kind: "Question", title: "Who?", text: "Us." }),
      entry({ kind: "Question", title: "Unanswered" }),
    ],
  }
  assert.deepEqual(liveQuotes(data, NOW).map((q) => q.title), ["Featured", "Morris"])
  assert.deepEqual(liveQuestions(data, undefined, NOW).map((q) => q.title), ["Refunds?", "Cost?", "Who?"], "in Order, empty last; an unanswered question is not asked")
  assert.deepEqual(liveQuestions(data, "Pricing", NOW).map((q) => q.title), ["Refunds?", "Cost?"], "by group, any case, in Order")
})

test("the changelog is the posts filed under Releases", () => {
  const data = {
    copy: {},
    entries: [
      entry({ slug: "v2", category: { name: "Releases", color: "green" }, date: "2026-11-01" }),
      entry({ slug: "news", category: { name: "News", color: "red" } }),
    ],
  }
  assert.deepEqual(releases(data, NOW).map((p) => p.slug), ["v2"])
})

test("the blog's posts are every live post but the releases, which are the changelog's alone", () => {
  const data = {
    copy: {},
    entries: [
      entry({ slug: "v2", category: { name: "releases", color: "green" }, date: "2026-11-01" }),
      entry({ slug: "news", category: { name: "News", color: "red" }, date: "2026-10-01" }),
      entry({ slug: "plain", date: "2026-09-01" }),
    ],
  }
  assert.equal(isRelease(data.entries[0]), true, "in any case")
  assert.equal(isRelease(data.entries[2]), false, "a post with no category is the blog's")
  assert.deepEqual(blogPosts(data, NOW).map((p) => p.slug), ["news", "plain"])
  assert.deepEqual([...blogPosts(data, NOW), ...releases(data, NOW)].length, livePosts(data, NOW).length, "every post is one or the other")
})

test("the team: Person rows that are live, in the editor's order", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Person", title: "Second", order: 2 }),
      entry({ kind: "Person", title: "First", order: 1 }),
      entry({ kind: "Person", title: "Unordered" }),
      entry({ kind: "Quote", title: "Not a person", order: 0 }),
    ],
  }
  assert.deepEqual(livePeople(data, NOW).map((p) => p.title), ["First", "Second", "Unordered"])
})

test("reviews: only those with words and stars, newest first", () => {
  const data = {
    copy: {},
    entries: [
      entry({ kind: "Review", title: "Old", text: "Fine.", rating: 4, date: "2026-10-01" }),
      entry({ kind: "Review", title: "New", text: "Good.", rating: 5, date: "2026-11-20" }),
      entry({ kind: "Review", title: "Silent", rating: 5, date: "2026-11-21" }),
      entry({ kind: "Review", title: "Unrated", text: "Hm.", date: "2026-11-22" }),
    ],
  }
  assert.deepEqual(liveReviews(data, NOW).map((r) => r.title), ["New", "Old"])
})

test("reviews: invented ones (tagged Example) show only until a real one is published, and never beside it", () => {
  const example = [{ name: "Example", color: "gray" }]
  const invented = [
    entry({ kind: "Review", title: "Invented", text: "Fine.", rating: 5, date: "2026-11-20", tags: example }),
    entry({ kind: "Review", title: "Made up", text: "Good.", rating: 5, date: "2026-11-10", tags: example }),
  ]
  const only = liveReviews({ copy: {}, entries: invented }, NOW)
  assert.deepEqual(only.map((r) => r.title), ["Invented", "Made up"])
  assert.ok(only.every(isExample))
  const real = entry({ kind: "Review", title: "Real", text: "It arrived.", rating: 3, date: "2026-10-01" })
  const mixed = liveReviews({ copy: {}, entries: [...invented, real] }, NOW)
  assert.deepEqual(mixed.map((r) => r.title), ["Real"])
  assert.ok(!mixed.some(isExample))
})

test("the homepage shows the first quotation and /pricing the next, so two put a different one on each page", () => {
  const quote = (title, over = {}) => entry({ kind: "Quote", title, text: `${title} said so.`, ...over })
  const two = { copy: {}, entries: [quote("Lattice", { order: 2 }), quote("Shrimp", { featured: true, order: 1 })] }
  assert.equal(quoteFor(two, "home", NOW)?.title, "Shrimp", "featured first")
  assert.equal(quoteFor(two, "pricing", NOW)?.title, "Lattice")
  const one = { copy: {}, entries: [quote("Only")] }
  assert.equal(quoteFor(one, "home", NOW)?.title, "Only")
  assert.equal(quoteFor(one, "pricing", NOW)?.title, "Only", "with one, both pages show it")
  assert.equal(quoteFor({ copy: {}, entries: [] }, "pricing", NOW), undefined, "with none, neither page has a quotation")
})
