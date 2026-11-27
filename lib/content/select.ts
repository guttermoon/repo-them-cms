/**
 * Questions asked of the site's data: which pages, posts, products, plans
 * and the rest are live, in what order, at what address. Plain functions
 * over plain data, so the pages, the feeds and the tests
 * (tests/content-select.test.mjs) all ask them the same way.
 */
import type { Kind } from "../filter-words"
import { siteMenus, type MenuPage, type SiteMenus } from "../menus"
import { isReservedPath, slugify, wordSlug, type Entry, type SiteData, type Tag } from "../notion/rows"

/**
 * An entry is live once Published is ticked (the query only returns those)
 * and its Published Date, if it has one, has arrived. A date without a time
 * arrives at the start of that day, UTC; one with a time, at that minute in
 * the zone picked in Notion (dateOf in lib/notion/rows.ts). So a post dated
 * next Tuesday at 16:00 GMT is written, checked and ticked today, and
 * appears then, within a minute or two (the pages are drawn again each
 * minute).
 */
export function isLive(entry: Entry, now: Date = new Date()): boolean {
  if (!entry.date) return true
  const at = Date.parse(entry.date.length === 10 ? `${entry.date}T00:00:00Z` : entry.date)
  return Number.isNaN(at) || at <= now.getTime()
}

const byKind = (data: SiteData, kind: Entry["kind"], now: Date) =>
  data.entries.filter((e) => e.kind === kind && isLive(e, now))

/** The date a post is filed under: its Published Date, else when it was made. */
export const postDate = (post: Entry): string => post.date ?? post.created

/** A post's date as a time, for sorting. */
const time = (post: Entry) => Date.parse(postDate(post)) || 0

/** Live posts, newest first. */
export function livePosts(data: SiteData, now: Date = new Date()): Entry[] {
  return firstBySlug(byKind(data, "Post", now)).sort((a, b) => time(b) - time(a) || a.title.localeCompare(b.title))
}

/**
 * Live pages, minus any whose address belongs to the site already: a Notion
 * page called "blog" would otherwise be shadowed by /blog without a word.
 * `npm run notion:check` lists the skipped ones.
 */
export function livePages(data: SiteData, now: Date = new Date()): Entry[] {
  return firstBySlug(byKind(data, "Page", now).filter((p) => !isReservedPath(p.slug)))
}

/** The Notion pages a menu may link (lib/menus.ts): their addresses and
 *  titles, and the Order that puts one in the footer's company column. */
export function menuPages(data: SiteData, now: Date = new Date()): MenuPage[] {
  return livePages(data, now).map((p) => ({ href: `/${p.slug}`, title: p.title, ...(p.order === undefined ? {} : { order: p.order }) }))
}

/** Every menu as the site draws it, from the Menu rows and the live pages. */
export function menusFor(data: SiteData, now: Date = new Date()): SiteMenus {
  return siteMenus(data.menus, menuPages(data, now))
}

/** Pages that asked for a place in the footer (Order set), in that order. */
export function navPages(data: SiteData, now: Date = new Date()): Entry[] {
  return livePages(data, now)
    .filter((p) => p.order !== undefined)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))
}

/** Live resources, by Order and then by title. */
export function liveResources(data: SiteData, now: Date = new Date()): Entry[] {
  return byKind(data, "Resource", now).sort(byOrder)
}

/** Resources under their categories, in the order the categories first
 *  appear; uncategorised ones last, under "". */
export function resourcesByCategory(resources: Entry[]): { category: string; items: Entry[] }[] {
  const groups = new Map<string, Entry[]>()
  for (const r of resources) {
    const key = r.category?.name ?? ""
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0))
    .map(([category, items]) => ({ category, items }))
}

/** By Order (empty last), then by title: how every list the editor orders
 *  is sorted. */
const byOrder = (a: Entry, b: Entry) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.title.localeCompare(b.title)

/** Live plans, in the editor's order. */
export function livePlans(data: SiteData, now: Date = new Date()): Entry[] {
  return byKind(data, "Plan", now).sort(byOrder)
}

/** Live products: featured first, then in the editor's order. Two with one
 *  address: the older keeps it, as with pages. */
export function liveProducts(data: SiteData, now: Date = new Date()): Entry[] {
  return firstBySlug(byKind(data, "Product", now)).sort((a, b) => Number(b.featured) - Number(a.featured) || byOrder(a, b))
}

/** The shop's collections (the products' categories), in the order the
 *  products first show them, with counts. */
export function collections(products: Entry[]): (Tag & { slug: string; count: number })[] {
  return categories(products)
}

/** Quotations, featured first, then in the editor's order. */
export function liveQuotes(data: SiteData, now: Date = new Date()): Entry[] {
  return byKind(data, "Quote", now)
    .filter((q) => q.text)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || byOrder(a, b))
}

/**
 * The quotation a page shows. The homepage takes the first (featured first,
 * then in the editor's order) and /pricing the next, so two quotations put a
 * different one on each page; with one, both show it, and with none,
 * neither page has a quotation.
 */
export function quoteFor(data: SiteData, page: "home" | "pricing", now: Date = new Date()): Entry | undefined {
  const quotes = liveQuotes(data, now)
  return page === "home" ? quotes[0] : (quotes[1] ?? quotes[0])
}

/** The team, in the editor's order: every Person but those whose Team Page
 *  is Off, who are only the authors of their posts (withAuthors). */
export function livePeople(data: SiteData, now: Date = new Date()): Entry[] {
  return byKind(data, "Person", now)
    .filter((person) => person.team !== false)
    .sort(byOrder)
}

/** Reviews with words and stars, newest first. */
export function liveReviews(data: SiteData, now: Date = new Date()): Entry[] {
  const all = byKind(data, "Review", now)
    .filter((r) => r.text && r.rating)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || byOrder(a, b))
  // an invented review never shares a list, or an average, with a real one:
  // examples show only until the first real review is published
  const real = all.filter((r) => !isExample(r))
  return real.length ? real : all
}

/** The tag that marks a row as invented (the starter's reviews carry it). */
export const EXAMPLE_TAG = "Example"
/** An invented row: shown marked as an example, never as the real thing. */
export const isExample = (entry: Entry): boolean => entry.tags.some((tag) => tag.name === EXAMPLE_TAG)

/** Proof logos (the "goes well with" strip), in the editor's order. */
export function liveLogos(data: SiteData, now: Date = new Date()): Entry[] {
  return byKind(data, "Proof Logos", now).sort(byOrder)
}

/** Questions with an answer, in the editor's order; with a group name, only
 *  the questions in that group (a Category, compared without case). */
export function liveQuestions(data: SiteData, group?: string, now: Date = new Date()): Entry[] {
  const all = byKind(data, "Question", now).filter((q) => q.text)
  const wanted = group?.toLowerCase()
  return (wanted ? all.filter((q) => q.category?.name.toLowerCase() === wanted) : all).sort(byOrder)
}

/** Whether a post is a release: filed under Category "Releases", it is the
 *  changelog's, not the blog's. */
export const isRelease = (post: Entry): boolean => post.category?.name.toLowerCase() === "releases"

/** The posts in the changelog: Category "Releases", newest first. */
export function releases(data: SiteData, now: Date = new Date()): Entry[] {
  return livePosts(data, now).filter(isRelease)
}

/**
 * The blog's posts: every live post but the releases, which are the
 * changelog's alone. /blog, its feed, its category and tag pages and the
 * homepage's newest posts read these; a release keeps its own page, which
 * /changelog links to.
 */
export function blogPosts(data: SiteData, now: Date = new Date()): Entry[] {
  return livePosts(data, now).filter((post) => !isRelease(post))
}

/** The redirect table: slug → destination, first row wins. */
export function redirects(data: SiteData, now: Date = new Date()): Record<string, string> {
  // no prototype: a slug is typed by anybody, and "constructor" is a slug
  const out: Record<string, string> = Object.create(null)
  for (const r of byKind(data, "Redirect", now)) if (r.link && !(r.slug in out)) out[r.slug] = r.link
  return out
}

/** Two pages with one address: the older keeps it, so a new page cannot
 *  quietly replace an old one. `notion:check` reports the loser. */
function firstBySlug(entries: Entry[]): Entry[] {
  const sorted = [...entries].sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id))
  const seen = new Set<string>()
  return sorted.filter((e) => (seen.has(e.slug) ? false : (seen.add(e.slug), true)))
}

/** Featured posts first (by Feature Block, then date), then the rest. */
export function featuredFirst(posts: Entry[]): Entry[] {
  const featured = posts
    .filter((p) => p.featured)
    .sort((a, b) => (a.featureBlock ?? Infinity) - (b.featureBlock ?? Infinity) || time(b) - time(a))
  return [...featured, ...posts.filter((p) => !p.featured)]
}

/** A category's or tag's address segment. */
export const tagSlug = (name: string): string => slugify(name) || wordSlug(name) || "untitled"

/** A category or a tag as its page knows it: its address and how many live
 *  posts are filed under it. */
export type Filed = Tag & { slug: string; count: number }

/** Each of `all` once, by its address, in first-seen order, counted. */
function counted(all: Tag[]): Filed[] {
  const out = new Map<string, Filed>()
  for (const t of all) {
    const slug = tagSlug(t.name)
    const found = out.get(slug)
    out.set(slug, found ? { ...found, count: found.count + 1 } : { ...t, slug, count: 1 })
  }
  return [...out.values()]
}

/** What a post is filed under, of a kind: its category, or its tags. */
const filedAs = (post: Entry, kind: Kind): Tag[] => (kind === "Category" ? (post.category ? [post.category] : []) : post.tags)

/** The categories that have live posts, in first-seen order, with counts. */
export const categories = (posts: Entry[]): Filed[] => counted(posts.flatMap((p) => filedAs(p, "Category")))

/** The tags on live posts, alphabetical, with counts. */
export const tags = (posts: Entry[]): Filed[] => counted(posts.flatMap((p) => filedAs(p, "Tag"))).sort((a, b) => a.name.localeCompare(b.name))

/** The category or tag at an address (`slug`), and the posts filed under
 *  it, or undefined when none of `posts` is. */
export function filedUnder(posts: Entry[], kind: Kind, slug: string): { filed: Filed; posts: Entry[] } | undefined {
  const filed = (kind === "Category" ? categories(posts) : tags(posts)).find((f) => f.slug === slug)
  return filed ? { filed, posts: posts.filter((p) => filedAs(p, kind).some((t) => tagSlug(t.name) === slug)) } : undefined
}

/** Where an entry lives on this site. Plans, quotes, logos, questions and
 *  resources have no page of their own. */
export function urlFor(entry: Entry): string | undefined {
  if (entry.kind === "Page") return `/${entry.slug}`
  if (entry.kind === "Post") return `/blog/${entry.slug}`
  if (entry.kind === "Product") return `/shop/${entry.slug}`
  if (entry.kind === "Redirect") return `/go/${entry.slug}`
  return undefined
}

/**
 * The site address for a Notion page ID, when that page is live here: what
 * a page mention or a "link to page" block in a post becomes. Notion IDs
 * arrive with and without dashes, so both are compared without.
 */
export function urlForNotionId(data: SiteData, id: string, now: Date = new Date()): string | undefined {
  const bare = id.replace(/-/g, "")
  const live = [...livePages(data, now), ...livePosts(data, now), ...liveProducts(data, now)]
  const entry = live.find((e) => e.id.replace(/-/g, "") === bare)
  return entry ? urlFor(entry) : undefined
}

/** The posts before and after one, by date: [newer, older]. */
export function neighbours(posts: Entry[], slug: string): [Entry | undefined, Entry | undefined] {
  const i = posts.findIndex((p) => p.slug === slug)
  if (i === -1) return [undefined, undefined]
  return [posts[i - 1], posts[i + 1]]
}

/** A Notion date as words: "4 November 2026". The day is the one written
 *  in Notion, time or no time: an evening in New York is still that day,
 *  whatever zone the server or the reader is in. */
export function formatDate(iso: string, locale = "en-GB"): string {
  const at = new Date(/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(0, 10)}T00:00:00Z` : iso)
  if (Number.isNaN(at.getTime())) return iso
  return at.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
}
