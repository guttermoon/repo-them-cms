// The structured data (lib/structured-data.ts): the site's graph, each
// designed page's node, the blog, its posts and the pages written in Notion.
// Held to the two rules it is built on: everything marked up is on the page,
// and true (no rating, review or price the site does not have).
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { INDEXED_PAGES } from "../lib/nav.ts"
import { PAGE_META } from "../lib/page-meta.ts"
import { MAKER, REPO_URL, SITE_DESCRIPTION, SITE_LANGUAGE, SITE_LOGO, SITE_NAME, SITE_URL } from "../lib/site.ts"
import { ORGANIZATION_ID, PERSON_ID, answeredRows, blogLd, collectionLd, notionPageLd, pageLd, pageUrl, postLd, siteLd, teamLd } from "../lib/structured-data.ts"

/** Every string anywhere in a JSON-LD value, and every key. */
const strings = (value) =>
  typeof value === "string"
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === "object"
        ? Object.entries(value).flatMap(([k, v]) => [k, ...strings(v)])
        : []

const nodeOfType = (ld, type) => ld["@graph"].find((n) => [n["@type"]].flat().includes(type))
const NEVER = ["aggregateRating", "review", "offers", "price", "ratingValue"]

const post = {
  id: "11111111-2222-4333-8444-555555555555",
  kind: "Post",
  title: "Hello",
  slug: "hello",
  description: "The first post.",
  created: "2026-11-01T00:00:00.000Z",
  lastEdited: "2026-11-20T00:00:00.000Z",
  date: "2026-11-02",
  category: { name: "News", color: "blue" },
  tags: [{ name: "Notion", color: "gray" }, { name: "Design", color: "red" }],
  author: { name: "Ada" },
  featured: false,
  font: "default",
  fullWidth: false,
}

test("the site's graph: the website, made by its maker, under the maker's own @id", () => {
  const ld = siteLd({ copy: {} })
  const site = nodeOfType(ld, "WebSite")
  const person = nodeOfType(ld, "Person")
  assert.equal(site["@id"], `${SITE_URL}/#website`)
  assert.equal(site.name, SITE_NAME)
  assert.equal(site.description, PAGE_META["/"].description, "the homepage's description, as the copy has it")
  const renamed = nodeOfType(siteLd({ copy: { "site.name": "Acme", "meta.home.description": "Acme sells things." } }), "WebSite")
  assert.equal(renamed.name, "Acme", "the site's name is its Notion row")
  assert.equal(renamed.description, "Acme sells things.")
  assert.equal(site.inLanguage, SITE_LANGUAGE)
  assert.deepEqual(site.creator, { "@id": PERSON_ID })
  assert.deepEqual(site.author, { "@id": PERSON_ID })
  assert.equal(person["@id"], `${MAKER.url}/#person`)
  assert.equal(person.name, MAKER.name)
  assert.equal(person.url, MAKER.url)
  assert.equal(person.email, `mailto:${MAKER.email}`)
})

test("the site is published by an Organization of its own name, whose logo is the mark as the file draws it", () => {
  const ld = siteLd({ copy: {} })
  const site = nodeOfType(ld, "WebSite")
  const org = nodeOfType(ld, "Organization")
  assert.equal(org["@id"], `${SITE_URL}/#organization`)
  assert.equal(org["@id"], ORGANIZATION_ID)
  assert.deepEqual(site.publisher, { "@id": ORGANIZATION_ID }, "the website names its publisher")
  assert.equal(org.name, SITE_NAME)
  assert.equal(org.url, `${SITE_URL}/`)
  assert.equal(org.logo.url, `${SITE_URL}${SITE_LOGO.src}`, "an absolute address")
  assert.deepEqual(org.image, { "@id": org.logo["@id"] })
  // the logo is the file it says it is: a PNG of the size given, square, and
  // over the 112 pixels Google asks a logo to be
  const png = readFileSync(new URL(`../public${SITE_LOGO.src}`, import.meta.url))
  assert.equal(png.subarray(1, 4).toString(), "PNG")
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [SITE_LOGO.width, SITE_LOGO.height])
  assert.deepEqual([org.logo.width, org.logo.height], [SITE_LOGO.width, SITE_LOGO.height])
  assert.equal(SITE_LOGO.width, SITE_LOGO.height)
  assert.ok(SITE_LOGO.width >= 112)
  // renamed in Notion, the publisher is renamed with the site
  assert.equal(nodeOfType(siteLd({ copy: { "site.name": "Acme" } }), "Organization").name, "Acme")
  assert.equal(nodeOfType(siteLd({ copy: { "site.name": "Acme" } }), "Organization").logo.caption, "Acme")
})

test("the template is marked up as source code only once its repository is public", () => {
  assert.equal(Boolean(nodeOfType(siteLd({ copy: {} }), "SoftwareSourceCode")), Boolean(REPO_URL))
})

test("every designed page has its own node, with the title and description it prints", () => {
  for (const { href } of INDEXED_PAGES) {
    const page = nodeOfType(pageLd(href, { copy: {} }), "WebPage")
    assert.ok(page, `${href} has no WebPage`)
    assert.equal(page.url, pageUrl(href))
    assert.equal(page["@id"], `${pageUrl(href)}#webpage`)
    assert.equal(page.name, PAGE_META[href].title)
    assert.equal(page.description, PAGE_META[href].description)
    assert.deepEqual(page.isPartOf, { "@id": `${SITE_URL}/#website` })
    assert.match(page.image.url, /\/og(\/[a-z-]+)*$/, `${href}'s share card`)
    assert.equal(page.image.width, 1200)
    assert.equal(page.image.height, 630)
  }
  assert.equal(pageUrl("/"), `${SITE_URL}/`)
})

test("a page's node says what the site's owner wrote in Notion, and a blank row falls back", () => {
  const copy = { "meta.about.title": "Who we are", "meta.about.description": "How we started.", "meta.pricing.title": "  " }
  assert.equal(nodeOfType(pageLd("/about", { copy }), "WebPage").name, "Who we are")
  assert.equal(nodeOfType(pageLd("/about", { copy }), "WebPage").description, "How we started.")
  assert.equal(nodeOfType(pageLd("/pricing", { copy }), "WebPage").name, PAGE_META["/pricing"].title)
})

test("the questions are the Question rows as a reader sees them: links and formatting as words", () => {
  const styled = "\uE000" + JSON.stringify([{ t: "Yes", b: 1 }, { t: ", see " }, { t: "the shop", href: "/shop" }, { t: "." }])
  const all = answeredRows([
    { title: "Can I change plans?", text: "Any time. [Ask](mailto:hello@example.com) if unsure." },
    { title: "Is it bold?", text: styled },
    { title: "No answer yet", text: "" },
  ])
  assert.deepEqual(all, [
    { name: "Can I change plans?", text: "Any time. Ask if unsure." },
    { name: "Is it bold?", text: "Yes, see the shop." },
  ])

  const ld = pageLd("/questions", { copy: {} }, { questions: all })
  const page = nodeOfType(ld, "FAQPage")
  assert.deepEqual(page["@type"], ["WebPage", "FAQPage"])
  assert.equal(page.mainEntity.length, all.length)
  assert.deepEqual(page.mainEntity[0], { "@type": "Question", name: all[0].name, acceptedAnswer: { "@type": "Answer", text: all[0].text } })
  assert.equal(nodeOfType(pageLd("/questions", { copy: {} }, { questions: [] }), "FAQPage"), undefined, "no questions, no FAQPage")
})

test("the blog is a page whose main entity is the Blog, its posts BlogPostings; a category page lists its posts, with a trail", () => {
  const ld = blogLd([post], {})
  const page = nodeOfType(ld, "CollectionPage")
  assert.equal(page.url, pageUrl("/blog"))
  assert.equal(page["@id"], `${pageUrl("/blog")}#webpage`)
  const blog = page.mainEntity
  assert.equal(blog["@type"], "Blog")
  assert.deepEqual(blog.blogPost[0], { "@type": "BlogPosting", headline: "Hello", url: pageUrl("/blog/hello"), datePublished: "2026-11-02" })
  assert.equal(nodeOfType(ld, "BreadcrumbList"), undefined, "the blog is one level down: no trail")

  const category = blogLd([post], {}, { path: "/blog/category/news", name: "News", description: "Posts in News." })
  const list = nodeOfType(category, "CollectionPage").mainEntity
  assert.equal(list["@type"], "ItemList")
  assert.deepEqual(list.itemListElement[0], { "@type": "ListItem", position: 1, url: pageUrl("/blog/hello"), name: "Hello" })
  assert.ok(!("blogPost" in nodeOfType(category, "CollectionPage")), "blogPost is a Blog's property, not a page's")
  const trail = nodeOfType(category, "BreadcrumbList").itemListElement.map((i) => i.name)
  assert.deepEqual(trail, [SITE_NAME, "Blog", "News"])
  // the trail names the blog as the navigation does
  const renamed = blogLd([post], { "nav.blog": "Journal" }, { path: "/blog/category/news", name: "News", description: "Posts in News." })
  assert.deepEqual(nodeOfType(renamed, "BreadcrumbList").itemListElement.map((i) => i.name), [SITE_NAME, "Journal", "News"])
  assert.equal(nodeOfType(blogLd([post], { "meta.blog.title": "Journal" }), "CollectionPage").name, "Journal")
})

test("a shop collection lists its products, named, never offered, with a trail through the shop", () => {
  const ld = collectionLd([{ slug: "drink", title: "Drink" }], { "nav.shop": "Store" }, { path: "/shop/collection/kitchen", name: "Kitchen", description: "Kitchen: 1 product." })
  const page = nodeOfType(ld, "CollectionPage")
  assert.equal(page.url, pageUrl("/shop/collection/kitchen"))
  assert.deepEqual(page.mainEntity.itemListElement, [{ "@type": "ListItem", position: 1, url: pageUrl("/shop/drink"), name: "Drink" }])
  assert.doesNotMatch(JSON.stringify(ld), /Offer|price/i)
  assert.deepEqual(nodeOfType(ld, "BreadcrumbList").itemListElement.map((i) => i.name), [SITE_NAME, "Store", "Kitchen"])
})

test("a post carries its real dates, author, section and tags", () => {
  const ld = postLd(post, {})
  const article = nodeOfType(ld, "BlogPosting")
  assert.equal(article.headline, "Hello")
  assert.equal(article.description, "The first post.")
  assert.equal(article.datePublished, "2026-11-02")
  assert.equal(article.dateModified, "2026-11-20T00:00:00.000Z")
  assert.deepEqual(article.author, { "@type": "Person", name: "Ada" })
  assert.equal(article.articleSection, "News")
  assert.equal(article.keywords, "Notion, Design")
  assert.equal(article.mainEntityOfPage, pageUrl("/blog/hello"))
  assert.deepEqual(article.publisher, { "@id": ORGANIZATION_ID }, "the site publishes its posts")
  // the author as the page shows them: the line about them as words, and
  // their portrait at an absolute address
  const bio = "\uE000" + JSON.stringify([{ t: "Writes the ", i: 1 }, { t: "labels", href: "/shop" }, { t: "." }])
  const shown = nodeOfType(postLd({ ...post, author: { name: "Ada", bio } }, {}, undefined, "/media/x/author.png"), "BlogPosting")
  assert.deepEqual(shown.author, { "@type": "Person", name: "Ada", description: "Writes the labels.", image: `${SITE_URL}/media/x/author.png` })
  // without an author or a date, nothing is invented
  const bare = nodeOfType(postLd({ ...post, author: undefined, date: undefined, description: "", tags: [], category: undefined }, {}), "BlogPosting")
  assert.equal(bare.author, undefined)
  assert.equal(bare.datePublished, post.created, "undated posts are dated by when they were made")
  assert.equal(bare.description, undefined)
  assert.equal(bare.keywords, undefined)
})

test("a page written in Notion is a WebPage with its last edit, and a trail through the live pages above it only when nested", () => {
  const page = { ...post, kind: "Page", slug: "about", title: "About" }
  const ld = notionPageLd(page, {})
  assert.equal(nodeOfType(ld, "WebPage").url, pageUrl("/about"))
  assert.equal(nodeOfType(ld, "WebPage").dateModified, page.lastEdited)
  assert.equal(nodeOfType(ld, "BreadcrumbList"), undefined)
  assert.equal(nodeOfType(ld, "WebPage").breadcrumb, undefined)

  const setup = { ...page, slug: "guides/basics/setup", title: "Setup" }
  const pages = [{ slug: "guides", title: "Guides" }, { slug: "guides/basics", title: "The basics" }, setup]
  const nested = notionPageLd(setup, { "site.name": "Acme" }, pages)
  const trail = nodeOfType(nested, "BreadcrumbList")
  assert.deepEqual(
    trail.itemListElement.map((i) => [i.position, i.name, i.item]),
    [
      [1, "Acme", pageUrl("/")],
      [2, "Guides", pageUrl("/guides")],
      [3, "The basics", pageUrl("/guides/basics")],
      [4, "Setup", pageUrl("/guides/basics/setup")],
    ],
  )
  assert.deepEqual(nodeOfType(nested, "WebPage").breadcrumb, { "@id": trail["@id"] })
  // a level with no live page of its own is stepped over, never invented
  const gap = nodeOfType(notionPageLd(setup, {}, [{ slug: "guides", title: "Guides" }]), "BreadcrumbList")
  assert.deepEqual(gap.itemListElement.map((i) => i.name), [SITE_NAME, "Guides", "Setup"])
})

test("a designed page below the top level has a trail through the page above it, named as its link back is", () => {
  for (const { href } of INDEXED_PAGES) {
    const ld = pageLd(href, { copy: {} })
    const nested = href.split("/").filter(Boolean).length > 1
    assert.equal(Boolean(nodeOfType(ld, "BreadcrumbList")), nested, `${href}: a trail only below the top level`)
  }
  const ld = pageLd("/resources/ingredients", { copy: { "meta.resources.label": "Library" } })
  const trail = nodeOfType(ld, "BreadcrumbList")
  assert.deepEqual(
    trail.itemListElement.map((i) => [i.name, i.item]),
    [
      [SITE_NAME, pageUrl("/")],
      ["Library", pageUrl("/resources")],
      [PAGE_META["/resources/ingredients"].title, pageUrl("/resources/ingredients")],
    ],
  )
  assert.deepEqual(nodeOfType(ld, "WebPage").breadcrumb, { "@id": `${pageUrl("/resources/ingredients")}#breadcrumb` })
})

test("nothing anywhere claims a rating, a review or a price", () => {
  const all = [
    siteLd({ copy: {} }),
    ...INDEXED_PAGES.map(({ href }) => pageLd(href, { copy: {} })),
    blogLd([post], {}),
    postLd(post, {}),
    notionPageLd({ ...post, kind: "Page" }, {}),
  ]
  for (const ld of all) {
    const keys = strings(ld)
    for (const never of NEVER) assert.ok(!keys.includes(never), never)
  }
})

test("the team is a list of people, each with their role, and a portrait or profile only when the row has one", () => {
  const ld = teamLd([
    { title: "Pat Generic", description: "Founder", text: "Still answers the email.", image: "/demo/person-founder.webp" },
    { title: "Jo Regular", link: "https://profile.example/jo" },
  ])
  const list = nodeOfType(ld, "ItemList")
  assert.equal(list["@id"], `${pageUrl("/team")}#team`)
  const [pat, jo] = list.itemListElement.map((item) => item.item)
  assert.deepEqual([pat["@type"], pat.name, pat.jobTitle, pat.description], ["Person", "Pat Generic", "Founder", "Still answers the email."])
  assert.equal(pat.image, `${SITE_URL}/demo/person-founder.webp`, "an absolute address")
  assert.equal(jo.url, "https://profile.example/jo")
  assert.ok(!("jobTitle" in jo) && !("image" in jo), "nothing the row does not say")
  for (const word of NEVER) assert.ok(!strings(ld).includes(word), word)
})

test("a person's Link is in the team's data only as their card draws it: a page made whole, never a script", () => {
  const ld = teamLd([
    { title: "Sam Script", link: "javascript:alert(document.cookie)" },
    { title: "Pat Path", link: "/about" },
    { title: "Lee Sideways", link: "/\\evil.example" },
  ])
  const [sam, pat, lee] = nodeOfType(ld, "ItemList").itemListElement.map((item) => item.item)
  assert.ok(!("url" in sam), "a Link the card drops is dropped here")
  assert.equal(pat.url, `${SITE_URL}/about`)
  assert.ok(!("url" in lee))
  assert.ok(!JSON.stringify(ld).includes("javascript:"))
})

test("the template is what /features is about; the homepage is the generic site's own", () => {
  const home = nodeOfType(pageLd("/", { copy: {} }), "WebPage")
  assert.ok(!("about" in home) || !String(home.about["@id"]).endsWith("#template"))
})
