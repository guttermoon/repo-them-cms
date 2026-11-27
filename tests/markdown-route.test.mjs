// The Markdown copy of every page written in Notion, at its address with .md
// added: which addresses have one (lib/content/markdown.ts), what it says,
// and how it is served (app/markdown), called as Next calls it, reading the
// starter content from a stand-in Notion over HTTP. And the rewrite in
// next.config.mjs that sends <address>.md there.
import { after, before, test } from "node:test"
import assert from "node:assert/strict"

const saved = { ...process.env }
const { FAKE_DATABASE_ID, startFakeNotion } = await import("../lib/demo/fake-notion.ts")
const fake = await startFakeNotion()
Object.assign(process.env, { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: FAKE_DATABASE_ID, NOTION_API_BASE_URL: fake.url })
delete process.env.COMMERCE_PROVIDER

const quiet = console.warn
before(() => {
  console.warn = () => {}
})
after(async () => {
  console.warn = quiet
  process.env = saved
  await fake.close()
})

const { NextRequest } = await import("next/server")
const route = await import("../app/markdown/[...path]/route.ts")
const { canonicalLink, entryMarkdown, markdownEntry } = await import("../lib/content/markdown.ts")
const { getSiteData } = await import("../lib/content/store.ts")
const { STARTER_DATA } = await import("../lib/demo/starter.ts")
const { pageMeta } = await import("../lib/seo.ts")
const { SITE_URL } = await import("../lib/site.ts")
const { default: nextConfig } = await import("../next.config.mjs")
// CommonJS: Node sees its exports by name, or only as the default, by how the bundle was built
const pathToRegexpModule = await import("next/dist/compiled/path-to-regexp/index.js")
const { pathToRegexp, compile } = pathToRegexpModule.pathToRegexp ? pathToRegexpModule : pathToRegexpModule.default

let ip = 0
const get = (path) =>
  route.GET(new NextRequest(`https://site.example${path}.md`, { headers: { "x-forwarded-for": `10.9.0.${++ip}` } }), { params: { path: path.slice(1).split("/") } })

/** The front matter's fields, read back as YAML would read them. */
const frontMatter = (text) => {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)
  assert.ok(block, "front matter first")
  return Object.fromEntries(block[1].split("\n").map((line) => [line.slice(0, line.indexOf(":")), JSON.parse(line.slice(line.indexOf(":") + 1))]))
}

test("a post's copy: Markdown, its page named as the canonical address, its facts first, its words after", async () => {
  const res = await get("/blog/introducing-generic")
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "text/markdown; charset=utf-8")
  assert.equal(res.headers.get("link"), `<${SITE_URL}/blog/introducing-generic>; rel="canonical"`, "search files the words under the page")
  assert.equal(res.headers.get("x-robots-tag"), null, "connected, nothing keeps it out")
  assert.match(res.headers.get("cache-control"), /s-maxage=60/)
  const text = await res.text()
  const facts = frontMatter(text)
  const post = (await getSiteData()).entries.find((e) => e.slug === "introducing-generic")
  assert.equal(facts.title, post.title)
  assert.equal(facts.url, `${SITE_URL}/blog/introducing-generic`)
  assert.equal(facts.published, post.date ?? post.created)
  assert.equal(facts.category, post.category.name)
  assert.ok(facts.description.length > 20)
  assert.match(facts.images[0], new RegExp(`^${SITE_URL}/media/`), "the cover, through this site, at a whole address")
  assert.ok(text.includes(`\n# ${post.title}\n`))
  assert.ok(text.includes("## What is on the shelf"), "the body's headings under the title's")
  assert.ok(text.includes(`(${SITE_URL}/pricing)`), "a link to this site's own page, whole")
  assert.doesNotMatch(text, /<[a-z]/i, "no HTML")
})

test("a page written in Notion has one too; a designed page, an unknown address and a broken one do not", async () => {
  const page = await get("/colophon")
  assert.equal(page.status, 200)
  assert.ok(frontMatter(await page.text()).updated, "a page carries its last edit")
  for (const path of ["/pricing", "/blog/nothing-here", "/nothing-here", "/blog", "/blog/category/news", "/blog/introducing-generic/more", "/%E0%A4%A"]) {
    const res = await get(path)
    assert.equal(res.status, 404, path)
    assert.equal(await res.text(), "", "nothing to read, and no words of the code's own")
  }
})

test("the example shop's goods have no copy; a real shop's do, with price and stock", async () => {
  assert.equal((await get("/shop/drink")).status, 404, "fictional goods are offered nowhere a listing could be read")
  process.env.COMMERCE_PROVIDER = "links"
  try {
    const res = await get("/shop/drink")
    assert.equal(res.status, 200)
    const facts = frontMatter(await res.text())
    const drink = (await getSiteData()).entries.find((e) => e.kind === "Product" && e.slug === "drink")
    assert.equal(facts.price, drink.price)
    assert.match(facts.currency, /^[A-Z]{3}$/)
    assert.ok(facts.images.length >= 1)
    assert.equal(res.headers.get("link"), `<${SITE_URL}/shop/drink>; rel="canonical"`)
  } finally {
    delete process.env.COMMERCE_PROVIDER
  }
})

test("with no Notion connected the copies are kept out of search, like every page of the starter content", async () => {
  const token = process.env.NOTION_TOKEN
  process.env.NOTION_TOKEN = ""
  try {
    const res = await get("/blog/introducing-generic")
    assert.equal(res.status, 200)
    assert.equal(res.headers.get("x-robots-tag"), "noindex")
  } finally {
    process.env.NOTION_TOKEN = token
  }
})

test("which entry an address names: by the page's own rules, and nothing a page would not show", () => {
  const data = STARTER_DATA
  assert.equal(markdownEntry(data, ["blog", "introducing-generic"], false)?.kind, "Post")
  assert.equal(markdownEntry(data, ["COLOPHON"], false)?.slug, "colophon", "a page's address in any case, as its page")
  assert.equal(markdownEntry(data, ["shop", "drink"], false), undefined)
  assert.equal(markdownEntry(data, ["shop", "DRINK"], true)?.slug, "drink")
  assert.equal(markdownEntry(data, ["blog"], false), undefined)
  assert.equal(markdownEntry(data, [], false), undefined)
  assert.equal(markdownEntry({ ...data, entries: data.entries.map((e) => (e.slug === "colophon" ? { ...e, date: "2999-01-01" } : e)) }, ["colophon"], false), undefined, "a page not yet published has no copy either")
})

test("a page's facts: a post's dates, author and tags; a product's price; nothing that is empty", () => {
  const ctx = { absolute: (h) => `https://site.example${h}`, pageUrl: () => undefined, media: () => "/media/x", labels: {} }
  const base = { id: "p", title: "Hello", slug: "hello", description: "", created: "2026-01-01T00:00:00.000Z", lastEdited: "2026-01-02T00:00:00.000Z", tags: [], featured: false, font: "default", fullWidth: false, layout: "article" }
  const body = [{ id: "b", type: "paragraph", paragraph: { rich_text: [{ type: "text", plain_text: "The first words.", text: { content: "The first words." } }] } }]
  const post = frontMatter(entryMarkdown({ ...base, kind: "Post", tags: [{ name: "News", color: "blue" }], author: { name: "Ada", bio: "" } }, body, ctx, { site: "Acme" }))
  assert.deepEqual(post, {
    title: "Hello",
    description: "The first words.",
    url: "https://site.example/blog/hello",
    site: "Acme",
    published: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-02T00:00:00.000Z",
    author: "Ada",
    tags: ["News"],
  })
  const product = frontMatter(entryMarkdown({ ...base, kind: "Product", price: 4.5, currency: "usd", stock: { name: "Low stock", color: "red" } }, [], ctx, { site: "Acme", images: ["/media/a"] }))
  assert.deepEqual([product.price, product.currency, product.availability, product.images], [4.5, "USD", "Low stock", ["https://site.example/media/a"]])
  assert.ok(!("description" in product), "no words, no description")
})

test("each page written in Notion names its copy in its head; a designed page does not", () => {
  const types = (meta) => meta.alternates.types
  assert.equal(types(pageMeta({ path: "/blog/hello", title: "Hello", description: "A post.", site: "Acme", markdown: true }))["text/markdown"], "/blog/hello.md")
  assert.equal(types(pageMeta({ path: "/pricing", title: "Pricing", description: "Plans.", site: "Acme" }))["text/markdown"], undefined)
  assert.ok(types(pageMeta({ path: "/blog/hello", title: "Hello", description: "A post.", site: "Acme", markdown: true }))["application/rss+xml"], "beside the feed, not instead of it")
})

test("the rewrite sends every address ending in .md to the copies, and nothing of the site's own plumbing", async () => {
  const rules = await nextConfig.rewrites()
  const rule = rules.find((r) => r.destination.startsWith("/markdown/"))
  assert.ok(rule, "a rewrite to app/markdown")
  const keys = []
  const re = pathToRegexp(rule.source, keys)
  const to = compile(rule.destination, { validate: false })
  const where = (path) => {
    const m = re.exec(path)
    return m ? to({ [keys[0].name]: m[1] }) : null
  }
  assert.equal(where("/blog/hello.md"), "/markdown/blog/hello")
  assert.equal(where("/colophon.md"), "/markdown/colophon")
  assert.equal(where("/guides/setup.md"), "/markdown/guides/setup", "a nested page keeps its slashes")
  assert.equal(where("/shop/drink.md"), "/markdown/shop/drink")
  for (const path of ["/blog/hello", "/markdown/blog/hello.md", "/api/contact.md", "/media/x/readme.md", "/.md"]) assert.equal(where(path), null, path)
})

test("a page titled in another script still has its copy: the canonical address goes in the header percent-encoded", () => {
  const link = canonicalLink(`${SITE_URL}/ニュース/новости`)
  assert.equal(link, `<${SITE_URL}/%E3%83%8B%E3%83%A5%E3%83%BC%E3%82%B9/%D0%BD%D0%BE%D0%B2%D0%BE%D1%81%D1%82%D0%B8>; rel="canonical"`)
  assert.doesNotThrow(() => new Response("", { headers: { Link: link } }), "a header holds only bytes")
  assert.equal(canonicalLink(`${SITE_URL}/blog/hello`), `<${SITE_URL}/blog/hello>; rel="canonical"`, "a Latin address is as it was")
})
