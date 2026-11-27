// /llms.txt and /llms-full.txt (lib/llms.ts): the site described for the
// assistants people ask, from the same sources as the pages, so it cannot say
// what the site does not.
import { test } from "node:test"
import assert from "node:assert/strict"

import { llmsFullTxt, llmsTxt } from "../lib/llms.ts"
import { INDEXED_PAGES } from "../lib/nav.ts"
import { PAGE_META } from "../lib/page-meta.ts"
import { styledText } from "../lib/inline-text.ts"
import { MAKER, SITE_NAME, SITE_URL } from "../lib/site.ts"
import { pageUrl } from "../lib/structured-data.ts"

const EMPTY = { copy: {}, entries: [] }
let n = 0
const entry = (over) => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  title: `Entry ${n}`,
  slug: `entry-${n}`,
  description: "",
  created: "2026-01-01T00:00:00.000Z",
  lastEdited: "2026-01-01T00:00:00.000Z",
  tags: [],
  featured: false,
  font: "default",
  fullWidth: false,
  ...over,
})
const DATA = {
  copy: {},
  entries: [
    entry({ kind: "Page", title: "Our story", slug: "story", description: "Who we are." }),
    entry({ kind: "Page", title: "Shadow", slug: "blog" }),
    entry({ kind: "Post", title: "Out now", slug: "out-now", description: "News.", date: "2026-01-02" }),
    entry({ kind: "Post", title: "Not yet", slug: "not-yet", date: "2999-01-01" }),
    entry({ kind: "Resource", title: "API docs", link: "https://developers.notion.com/", description: "The reference." }),
  ],
}

test("it opens as the proposal asks: the name, then the summary as a quotation, both as the copy has them", () => {
  const lines = llmsTxt(EMPTY).split("\n")
  assert.equal(lines[0], `# ${SITE_NAME}`)
  assert.equal(lines[2], `> ${PAGE_META["/"].description}`, "the homepage's description is the summary")
  const renamed = llmsTxt({ copy: { "site.name": "Acme", "meta.home.description": "Acme sells plain things." }, entries: [] }).split("\n")
  assert.equal(renamed[0], "# Acme", "the site's name is its Notion row")
  assert.equal(renamed[2], "> Acme sells plain things.")
})

const lineFor = (href) => `- [${PAGE_META[href].title}](${pageUrl(href)}): ${PAGE_META[href].description}`

test("every designed page is listed once, under its own title and description; the example shop is not a shop", () => {
  const saved = process.env.COMMERCE_PROVIDER
  try {
    delete process.env.COMMERCE_PROVIDER
    for (const text of [llmsTxt(EMPTY), llmsFullTxt(EMPTY)]) {
      for (const { href } of INDEXED_PAGES) {
        assert.equal(text.split(lineFor(href)).length - 1, href === "/shop" ? 0 : 1, `${href} is not listed as it should be`)
      }
    }
    process.env.COMMERCE_PROVIDER = "links"
    assert.equal(llmsTxt(EMPTY).split(lineFor("/shop")).length - 1, 1, "a real shop is listed")
  } finally {
    if (saved === undefined) delete process.env.COMMERCE_PROVIDER
    else process.env.COMMERCE_PROVIDER = saved
  }
})

test("pages and posts written in Notion are listed when live, and only then", () => {
  const text = llmsTxt(DATA)
  assert.ok(text.includes(`- [Our story](${SITE_URL}/story): Who we are.`))
  assert.ok(text.includes(`- [Out now](${SITE_URL}/blog/out-now): News.`))
  assert.ok(!text.includes("Not yet"), "a scheduled post waits for its date")
  assert.ok(!text.includes("Shadow"), "a page that would sit under a built-in address is not listed")
  assert.ok(text.includes(`${SITE_URL}/blog/rss.xml`))
  assert.ok(!llmsTxt(EMPTY).includes("## Posts"), "no posts, no heading")
})

test("the facts say who made it, what it costs, and that Notion did not", () => {
  const text = llmsTxt(EMPTY)
  assert.ok(text.includes(`Made by: ${MAKER.name} (${MAKER.url})`))
  assert.ok(text.includes(MAKER.email))
  assert.match(text, /Cost: free; MIT licence/)
  assert.match(text, /Not affiliated with Notion Labs, Inc\./)
  assert.ok(text.includes(`${SITE_URL}/llms-full.txt`))
})

test("the full file answers the Question rows /questions shows, under their categories, in their words", () => {
  const rows = {
    copy: {},
    entries: [
      entry({ kind: "Question", title: "How long does delivery take?", text: "Two to four days.\nOr the next day.", category: { name: "Orders and delivery", color: "default" }, order: 1 }),
      entry({ kind: "Question", title: "Is it bold?", text: styledText([{ plain_text: "Very", annotations: { bold: true } }, { plain_text: ", and [linked](https://example.com)." }]), category: { name: "Orders and delivery", color: "default" }, order: 2 }),
      entry({ kind: "Question", title: "What is this site?", text: "A template.", category: { name: "Template", color: "default" } }),
    ],
  }
  const full = llmsFullTxt(rows)
  assert.ok(full.includes("### Orders and delivery"))
  assert.ok(full.includes("Q: How long does delivery take?\nA: Two to four days. Or the next day."))
  assert.ok(full.includes("Q: Is it bold?\nA: Very, and linked."), "formatting and links read as their words")
  assert.ok(!full.includes("What is this site?"), "the template's own questions are on /features, not /questions")
  assert.ok(!llmsFullTxt(EMPTY).includes("Q: "), "no Question rows, no answers: nothing built in stands in for them")
  assert.ok(llmsFullTxt(DATA).includes("- [API docs](https://developers.notion.com/): The reference."))
})

test("a resource's Link is listed only as its page draws it: a page made whole, never a script", () => {
  const full = llmsFullTxt({
    copy: {},
    entries: [
      entry({ kind: "Resource", title: "Bad", link: "javascript:alert(1)" }),
      entry({ kind: "Resource", title: "Guide", link: "/guide" }),
      entry({ kind: "Resource", title: "Docs", link: "https://docs.example/" }),
    ],
  })
  assert.ok(!full.includes("javascript:") && !full.includes("[Bad]"), "a Link the page drops is dropped here")
  assert.ok(full.includes(`- [Guide](${SITE_URL}/guide)`))
  assert.ok(full.includes("- [Docs](https://docs.example/)"))
})

test("plain text only: no HTML, and no Markdown link to anything but the web", () => {
  for (const text of [llmsTxt(DATA), llmsFullTxt(DATA)]) {
    assert.doesNotMatch(text, /<[a-z/!]/i)
    for (const [, url] of text.matchAll(/\]\(([^)]+)\)/g)) assert.match(url, /^https?:\/\//, url)
  }
})

const plan = (over) => entry({ kind: "Plan", currency: "GBP", ...over })
const PLANS = {
  copy: {},
  entries: [
    plan({ title: "Free", price: 0, priceNote: "for ever", description: "The shelf at shelf prices", text: "Delivery: standard\nReturns: 30 days", order: 1 }),
    plan({ title: "Plus", price: 5, yearlyPrice: 4, priceNote: "a month", description: styledText([{ plain_text: "Member " }, { plain_text: "prices", annotations: { bold: true } }, { plain_text: "." }]), text: "Extras:\nMember prices on everything\nDelivery: free.", order: 2 }),
    plan({ title: "Enterprise", description: "Whatever you need.", order: 3 }),
  ],
}

test("the plans are listed with their prices as the pricing page prints them, so an assistant quotes rather than guesses", () => {
  for (const text of [llmsTxt(PLANS), llmsFullTxt(PLANS)]) {
    const lines = text.split("## Plans\n\n")[1].split("\n\n")[0].split("\n")
    assert.deepEqual(lines, [
      "- Free: £0 for ever. The shelf at shelf prices. Includes: Delivery: standard; Returns: 30 days.",
      "- Plus: £5 a month (£4 a month when paid yearly). Member prices. Includes: Member prices on everything; Delivery: free.",
      "- Enterprise: custom pricing. Whatever you need.",
    ])
    assert.match(text, /\n\nPrices include VAT\. Stop any time: a plan runs to the end of what you paid for\.\n/, "the line the page prints under them")
  }
  // the plans come before the posts, beside the pages that list /pricing
  const text = llmsTxt({ ...PLANS, entries: [...PLANS.entries, ...DATA.entries] })
  assert.ok(text.indexOf("## Plans") > text.indexOf("## Pages") && text.indexOf("## Plans") < text.indexOf("## Posts"))
})

test("the plans' words are the owner's: renamed, reworded, and the line under them taken away by a blank row", () => {
  const copy = { "llms.plans": "Prices", "llms.plan.yearly": "or {price} by the year", "llms.plan.includes": "With:", "pricing.custom": "ask us", "pricing.footnote": "" }
  const text = llmsTxt({ ...PLANS, copy })
  assert.ok(text.includes("## Prices\n"))
  assert.ok(text.includes("- Plus: £5 a month (or £4 a month by the year). Member prices. With: Member prices on everything; Delivery: free."))
  assert.ok(text.includes("- Enterprise: ask us. Whatever you need."))
  assert.ok(!text.includes("Prices include VAT"), "a blank row hides the line, as it does on the page")
})

test("no Plan rows, no plans: nothing built in stands in for them", () => {
  assert.ok(!llmsTxt(EMPTY).includes("## Plans"))
  assert.ok(!llmsTxt(EMPTY).includes("Prices include VAT"))
  assert.ok(!llmsTxt(DATA).includes("## Plans"))
})

test("the facts name the Markdown copies, with one to read, once anything is written in Notion", () => {
  assert.ok(llmsTxt(DATA).includes(`- Markdown: every page and post written in Notion is also served as Markdown, at its address with .md added: ${SITE_URL}/blog/out-now.md\n`))
  const pagesOnly = { copy: {}, entries: DATA.entries.filter((e) => e.kind === "Page") }
  assert.ok(llmsTxt(pagesOnly).includes(`${SITE_URL}/story.md`), "a page's, when there is no post")
  assert.ok(!llmsTxt(EMPTY).includes(".md"), "nothing written in Notion, no copies to name")
  assert.ok(!llmsTxt({ ...DATA, copy: { "llms.fact.markdown": "" } }).includes("- Markdown:"), "a blank row leaves the line out")
})

test("releases are listed under the changelog's name, not among the blog's posts", () => {
  const data = {
    copy: { "nav.changelog": "What's new" },
    entries: [
      entry({ kind: "Post", published: true, title: "Version 2", slug: "version-2", category: { name: "Releases", color: "green" } }),
      entry({ kind: "Post", published: true, title: "A post", slug: "a-post", category: { name: "News", color: "red" } }),
    ],
  }
  for (const text of [llmsTxt(data), llmsFullTxt(data)]) {
    const posts = text.slice(text.indexOf("## Posts"), text.indexOf("## What's new"))
    assert.ok(posts.includes(`${SITE_URL}/blog/a-post`), "a blog post among the posts")
    assert.ok(!posts.includes("version-2"), "a release is not one of the blog's posts")
    assert.ok(text.indexOf("## What's new") > text.indexOf("## Posts"), "the changelog, named as its link is, after the posts")
    assert.equal(text.split(`](${SITE_URL}/blog/version-2)`).length, 2, "a release listed once")
  }
  assert.ok(!llmsTxt({ copy: {}, entries: [data.entries[1]] }).includes("## Changelog"), "no releases, no heading")
})
