/**
 * /llms.txt and /llms-full.txt, after the llmstxt.org proposal: the site
 * described in plain text for the assistants people ask, from the same
 * words the pages print. Nothing here is written for machines alone.
 *
 * Pure: it takes the site's data and returns text, so `npm test` checks it
 * (tests/llms.test.mjs).
 */
import { commerce, shopIsLive } from "./commerce/config"
import { blogPosts, livePages, livePlans, livePosts, liveProducts, liveQuestions, liveResources, releases, urlFor } from "./content/select"
import type { SiteCopy, SiteData } from "./notion/rows"
import { safeHref } from "./inline-links"
import { inlineWords } from "./inline-text"
import { fillIn, plainText, siteDescriptor, siteName, slotText } from "./slots"
import { INDEXED_PAGES, navName } from "./nav"
import { PAGE_META, pageWords, type IndexedPath } from "./page-meta"
import { planFromEntry, PRICING_FOOTNOTE } from "./plans"
import { formatPrice } from "./pricing"
import { markdownPath } from "./seo"
import { MAKER, REPO_URL, SITE_URL } from "./site"

/** A link with a note after it: the note's words alone, on one line (a row's
 *  description may carry links and formatting, lib/inline-text.ts). */
const line = (title: string, url: string, note?: string) => {
  const words = note ? inlineWords(note).replace(/\s*\n\s*/g, " ").trim() : ""
  return `- [${title}](${url})${words ? `: ${words}` : ""}`
}

/**
 * The name, the summary, and the facts an assistant is asked for. Each fact
 * is a Site Copy row (`llms.fact.*`), so a site made from the template says
 * what it is rather than what the template is; a fact's row published blank
 * leaves its line out. A heading falls back instead, as a heading must. The independence statement is printed outside any slot, as
 * Notion's brand rules ask (docs/brand.md).
 */
function head(data: SiteData): string[] {
  const copy = data.copy
  const fact = (key: string, fallback: string, values: Record<string, string> = {}) => {
    const text = slotText(copy, `llms.fact.${key}`, fallback)
    return text ? [`- ${fillIn(text, values)}`] : []
  }
  const heading = plainText(copy, "llms.facts", "Key facts:")
  return [
    `# ${siteName(copy)}`,
    "",
    // the summary is the homepage's description, as the site's owner has it
    `> ${pageWords("/", copy).description}`,
    "",
    heading,
    ...fact("what", "What it is: {descriptor}, a website template. Copy, pages, blog posts, plans and products are written in one Notion database.", {
      // Notion keeps its capital, and so does CMS: only the article is lowered
      descriptor: siteDescriptor(copy).charAt(0).toLowerCase() + siteDescriptor(copy).slice(1),
    }),
    ...fact("cost", "Cost: free; MIT licence."),
    ...fact("built", "Built with: Next.js and the Notion API. Email through Brevo, Resend, SendGrid, Mailchimp, Klaviyo, beehiiv, Loops, MailerLite, Kit, Buttondown, Postmark or a webhook."),
    ...fact("maker", "Made by: {name} ({url}), who also offers setup help and builds sites to order: {email}.", { name: MAKER.name, url: MAKER.url, email: MAKER.email }),
    ...(REPO_URL ? fact("source", "Source code: {url}", { url: REPO_URL }) : []),
    // the Markdown copies (app/markdown), named with one to read, when any
    // page or post written in Notion is live
    ...(markdownExample(data) ? fact("markdown", "Markdown: every page and post written in Notion is also served as Markdown, at its address with .md added: {example}", { example: markdownExample(data) as string }) : []),
    "- Not affiliated with Notion Labs, Inc.",
    "",
  ]
}

/** A page's Markdown copy to name in the facts: the newest post's, or the
 *  first page's written in Notion. */
function markdownExample(data: SiteData): string | undefined {
  const entry = livePosts(data)[0] ?? livePages(data)[0]
  return entry ? `${SITE_URL}${markdownPath(urlFor(entry) ?? "/")}` : undefined
}

function pages(data: SiteData): string[] {
  const out = [`## ${plainText(data.copy, "llms.pages", "Pages")}`, ""]
  // the example shop sells nothing, so it is not described as a shop
  const live = shopIsLive(commerce())
  for (const item of INDEXED_PAGES.filter((page) => live || page.href !== "/shop")) {
    if (!(item.href in PAGE_META)) continue
    const words = pageWords(item.href as IndexedPath, data.copy)
    out.push(line(words.title, `${SITE_URL}${item.href === "/" ? "/" : item.href}`, words.description))
  }
  for (const page of livePages(data)) out.push(line(page.title, `${SITE_URL}/${page.slug}`, page.description || undefined))
  out.push("")
  return out
}

/** Words from a row, on one line. */
const oneLine = (text: string) => inlineWords(text).replace(/\s*\n\s*/g, " ").trim()

/**
 * The plans, as /pricing shows them, so an assistant asked what the site
 * costs quotes the page rather than guessing: each plan's price with its
 * note ("a month"), the price paid yearly where there is one, what it is
 * for, and what it includes, then the line the page prints under them. Plan
 * rows and nothing else: with none, there is no section.
 */
function plans(data: SiteData): string[] {
  const list = livePlans(data).map(planFromEntry)
  if (!list.length) return []
  const copy = data.copy
  const custom = plainText(copy, "pricing.custom", "custom pricing")
  const yearly = plainText(copy, "llms.plan.yearly", "{price} when paid yearly")
  const includes = plainText(copy, "llms.plan.includes", "Includes:")
  const lines = list.map((plan) => {
    const cost = (amount: number) => [formatPrice(amount, plan.currency), plan.priceNote ? oneLine(plan.priceNote) : ""].filter(Boolean).join(" ")
    const price = plan.price === undefined ? custom : cost(plan.price)
    const year = plan.price !== undefined && plan.yearlyPrice !== undefined ? ` (${fillIn(yearly, { price: cost(plan.yearlyPrice) })})` : ""
    const said = plan.description ? oneLine(plan.description) : ""
    const what = said ? ` ${said}${/[.!?…]$/.test(said) ? "" : "."}` : ""
    const features = plan.features.flatMap((line) => (line.kind === "group" ? [] : [oneLine(line.kind === "value" ? `${line.label}: ${line.value}` : line.label)]))
    const has = features.length ? ` ${includes} ${features.join("; ").replace(/[\s.;]+$/, "")}.` : ""
    return `- ${plan.name}: ${price}${year}.${what}${has}`
  })
  const footnote = slotText(copy, "pricing.footnote", PRICING_FOOTNOTE)
  return [`## ${plainText(copy, "llms.plans", "Plans")}`, "", ...lines, ...(footnote ? ["", footnote] : []), ""]
}

/** The blog's posts, as /blog lists them, and its feed. */
function posts(data: SiteData, full: boolean): string[] {
  const list = blogPosts(data)
  if (!list.length) return []
  return [
    `## ${plainText(data.copy, "llms.posts", "Posts")}`,
    "",
    ...list.slice(0, full ? 200 : 20).map((p) => line(p.title, `${SITE_URL}/blog/${p.slug}`, p.description || undefined)),
    `- ${plainText(data.copy, "llms.feed", "Feed")}: ${SITE_URL}/blog/rss.xml`,
    "",
  ]
}

/** The releases, as /changelog lists them, under the changelog's own name:
 *  they are the changelog's, not the blog's (`blogPosts`). */
function changelog(data: SiteData, full: boolean): string[] {
  const list = releases(data)
  if (!list.length) return []
  return [`## ${navName(data.copy, "/changelog")}`, "", ...list.slice(0, full ? 200 : 20).map((p) => line(p.title, `${SITE_URL}/blog/${p.slug}`, p.description || undefined)), ""]
}

/** A resource's Link as its page draws it (`safeHref`), a path made whole:
 *  one the page leaves out is left out here too. */
function resourceLink(link: string | undefined): string | undefined {
  const href = link ? safeHref(link) : undefined
  if (!href || href.startsWith("#")) return undefined
  return href.startsWith("/") ? `${SITE_URL}${href}` : href
}

export function llmsTxt(data: SiteData): string {
  // "Optional" is the proposal's own word for a section an assistant may skip
  const full = line(plainText(data.copy, "llms.full", "Everything, with the answers"), `${SITE_URL}/llms-full.txt`)
  return [...head(data), ...pages(data), ...plans(data), ...posts(data, false), ...changelog(data, false), "## Optional", "", full, ""].join("\n")
}

export function llmsFullTxt(data: SiteData): string {
  const content = data.copy
  // the questions /questions shows (the template's own are on /features),
  // under their categories in the order they first appear
  const questions = liveQuestions(data).filter((row) => row.category?.name.toLowerCase() !== "template")
  const groups = new Map<string, typeof questions>()
  for (const row of questions) groups.set(row.category?.name ?? "", [...(groups.get(row.category?.name ?? "") ?? []), row])
  const answers: string[] = questions.length ? [`## ${plainText(content, "llms.answers", "Questions and answers")}`, ""] : []
  for (const [name, rows] of [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0))) {
    answers.push(`### ${name || plainText(content, "questions.other", "Other questions")}`, "")
    for (const row of rows) answers.push(`Q: ${row.title}`, `A: ${inlineWords(row.text ?? "").replace(/\s*\n\s*/g, " ").trim()}`, "")
  }
  const resources = liveResources(data)
  const products = shopIsLive(commerce()) ? liveProducts(data) : []
  return [
    ...head(data),
    ...pages(data),
    ...plans(data),
    ...posts(data, true),
    ...changelog(data, true),
    ...answers,
    ...(resources.length ? [`## ${plainText(content, "llms.resources", "Resources")}`, "", ...resources.flatMap((r) => (resourceLink(r.link) ? [line(r.title, resourceLink(r.link) as string, r.description || undefined)] : [])), ""] : []),
    ...(products.length ? [`## ${plainText(content, "llms.shop", "Shop")}`, "", ...products.map((p) => line(p.title, `${SITE_URL}/shop/${p.slug}`, p.description || undefined)), ""] : []),
  ].join("\n")
}
