/**
 * Every designed page's title, description and keywords, in one place. The
 * page's metadata (`pageMetaFor()` in lib/seo.ts), its structured data
 * (`pageLd()` in lib/structured-data.ts), its share card (app/og) and
 * /llms.txt all read these, so they cannot say different things.
 *
 * Written for search and held to it by tests/page-meta.test.mjs: a title
 * short enough that Google prints it whole with " | REPO THEM" after it, and
 * a description of 140 to 160 characters that says what is on the page in
 * the words people search with.
 *
 * Imports nothing but lib/inline-text.ts, so the tests, the routes and
 * every page can load it.
 */
import { inlineWords } from "./inline-text"

export type PageMetaEntry = {
  /** Bare page title: lib/seo.ts adds the site's name. */
  title: string
  description: string
  keywords?: string[]
  /** the generic label printed on the page and on its share card */
  label: string
}

export const PAGE_META = {
  "/": {
    title: "Everything you need, nothing you don't",
    label: "Home",
    description:
      "Plain products and plain plans, priced up front and explained without small print. Shop the shelf, pick a plan, or ask a real person a question.",
    keywords: ["generic products",  "simple pricing",  "online shop",  "plain packaging"],
  },
  "/features": {
    title: "Features of the Notion-powered CMS",
    label: "Features",
    description:
      "The Notion-powered CMS behind this site: words, pages, posts, a shop and plans written in Notion, private by construction, deployed on Vercel in five steps.",
    keywords: ["notion cms", "notion powered cms", "notion website template", "notion blog", "next.js notion", "deploy on vercel"],
  },
  "/pricing": {
    title: "Pricing: a plan for every size",
    label: "Pricing",
    description:
      "Plans from free to whatever you need. Monthly or yearly, every feature listed side by side, and the questions people ask about billing answered.",
    keywords: ["pricing",  "plans",  "monthly or yearly",  "compare plans"],
  },
  "/shop": {
    title: "Shop the shelf",
    label: "Shop",
    description:
      "Plain goods with plain labels: drink, cereal, coffee and the rest. Every product with its price, its pictures and what is in it, on one tidy shelf.",
    keywords: ["shop",  "generic goods",  "plain packaging"],
  },
  "/about": {
    title: "About us: generic, on purpose",
    label: "About",
    description:
      "Who we are and how we work: plain products, fair prices and a person on the other end of every email. The story so far, what we value and the team.",
    keywords: ["about us",  "our story",  "our values"],
  },
  "/team": {
    title: "Meet the team",
    label: "Team",
    description:
      "The people behind the products and what each of them does, in a sentence or two. Generic job titles, specific opinions, and every one reads the email.",
    keywords: ["our team",  "meet the team",  "who we are"],
  },
  "/blog": {
    title: "Blog",
    label: "Posts",
    description:
      "News and guides, written plainly and published here, with an RSS feed for anyone who likes one. What changed in each release is on the changelog.",
    keywords: ["blog",  "news",  "guides"],
  },
  "/changelog": {
    title: "Changelog: what is new",
    label: "Changelog",
    description:
      "Every release, newest first: what changed, what was fixed and what it means for you. Written in plain words and filed in date order, with nothing hidden.",
    keywords: ["changelog",  "release notes",  "what is new"],
  },
  "/contact": {
    title: "Contact",
    label: "Contact",
    description:
      "Send a message from this page and a person reads it. Questions, orders, problems and ideas are all welcome. Expect a reply in sentences, usually soon.",
    keywords: ["contact",  "get in touch",  "support"],
  },
  "/questions": {
    title: "Questions and answers",
    label: "Questions",
    description:
      "Answers to what people ask most: orders, delivery, returns, plans, billing, accounts and privacy. Plain answers to plain questions, kept up to date.",
    keywords: ["faq",  "questions",  "help",  "delivery and returns"],
  },
  "/resources": {
    title: "Resources",
    label: "Resources",
    description:
      "Guides, downloads and further reading, gathered in one list: things worth reading about what we make, and how to get the most out of it, kept current.",
    keywords: ["resources",  "guides",  "downloads"],
  },
  "/resources/ingredients": {
    title: "The full list of ingredients",
    label: "Ingredients",
    description:
      "Everything the template does, group by group: words, pages, posts, a shop, pricing, pictures, publishing, search, email and privacy, and what it leaves out.",
    keywords: ["features",  "ingredients",  "notion cms"],
  },
  "/security": {
    title: "Security and privacy",
    label: "Security",
    description:
      "How this site keeps you private and itself safe: no third parties in your browser, nothing counted without a yes, strict rules on what loads, and more.",
    keywords: ["security",  "privacy",  "data protection"],
  },
  "/privacy": {
    title: "Privacy notice",
    label: "Privacy",
    description:
      "What this website keeps about you and why: almost nothing. No third parties, no tracking without a yes, and your rights over anything that is kept.",
  },
} as const satisfies Record<string, PageMetaEntry>

export type IndexedPath = keyof typeof PAGE_META

/** The words of a page that the site's owner can replace, row by row. */
export const PAGE_FIELDS = ["title", "description", "label"] as const
export type PageField = (typeof PAGE_FIELDS)[number]

/**
 * The Site Copy rows for a page's own words: `meta.home.title` for the
 * homepage, `meta.blog.description` for /blog, and so on, the page's path
 * with its slashes as dots.
 */
export function metaKey(path: string, field: string): string {
  return `meta.${path === "/" ? "home" : path.slice(1).replace(/\//g, ".")}.${field}`
}

/**
 * A designed page's title, description and label as the site's owner has
 * them: the published `meta.<page>.<field>` row in place of the wording
 * above. A row published blank falls back: a page without a title is broken,
 * not an editorial choice. Everything that names the page reads this (its
 * metadata, its structured data, its share card, /llms.txt), so they agree.
 */
export function pageWords(path: IndexedPath, copy: Readonly<Record<string, string>>): PageMetaEntry {
  const entry = PAGE_META[path]
  const word = (field: PageField) => {
    const v = inlineWords(copy[metaKey(path, field)] ?? "").trim()
    return v || entry[field]
  }
  return { ...entry, title: word("title"), description: word("description"), label: word("label") }
}

/** Every page's rows with their built-in wording, for `npm run copy`. */
export function metaSlots(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [path, entry] of Object.entries(PAGE_META)) {
    for (const field of PAGE_FIELDS) out[metaKey(path, field)] = entry[field]
  }
  return out
}

/** What a search result prints whole: the title with the site's name, the
 *  bare title of a page other than the homepage, and the description. The
 *  wording above is held to it (tests/page-meta.test.mjs), and
 *  `npm run notion:check` measures an owner's own wording against it. */
export const SEARCH_LIMITS = { fullTitle: 60, title: 38, description: { min: 140, max: 160 } } as const

/**
 * `text` at most `max` characters long: whole when it fits, else cut at the
 * last word that fits (or mid-word, when the last space would lose more
 * than two fifths of it), the punctuation it then ends on dropped, and an
 * ellipsis to say it was cut.
 */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, "")}…`
}
