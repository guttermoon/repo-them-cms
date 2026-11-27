// Reading the database's rows into the site's data (lib/notion/rows.ts): the
// copy, and every Page, Post, Resource and Redirect, the way the site, the
// build snapshot and the checker all read them.
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  pathSlug,
  plainText,
  publishedQuery,
  publishedRows,
  offsetIn,
  readRow,
  readRows,
  rowTitle,
  slugify,
  variantsOf,
  zonedTime,
} from "../lib/notion/rows.ts"
import { styledText as linkedText } from "../lib/inline-text.ts"
import { liveLogos } from "../lib/content/select.ts"

const rt = (content, href = null) => ({ plain_text: content, href })
const row = (props, extra = {}) => ({
  object: "page",
  id: "11111111-2222-4333-8444-555555555555",
  created_time: "2026-11-01T10:00:00.000Z",
  last_edited_time: "2026-11-02T10:00:00.000Z",
  ...extra,
  properties: {
    Title: { type: "title", title: [rt(props.title ?? "")] },
    Kind: { type: "select", select: props.kind ? { name: props.kind, color: "gray" } : null },
    Published: { type: "checkbox", checkbox: true },
    Text: { type: "rich_text", rich_text: props.text ?? [] },
    Slug: { type: "rich_text", rich_text: props.slug ? [rt(props.slug)] : [] },
    Description: { type: "rich_text", rich_text: props.description ? [rt(props.description)] : [] },
    "Published Date": { type: "date", date: props.date ? { start: props.date, ...(props.zone ? { time_zone: props.zone } : {}) } : null },
    Category: { type: "select", select: props.category ? { name: props.category, color: "blue" } : null },
    Tags: { type: "multi_select", multi_select: (props.tags ?? []).map((name) => ({ name, color: "red" })) },
    Author: { type: "rich_text", rich_text: props.author ? [rt(props.author)] : [] },
    "Author Bio": { type: "rich_text", rich_text: props.authorBio ? [rt(props.authorBio)] : [] },
    "Author Image": { type: "files", files: props.authorImage ?? [] },
    Image: { type: "files", files: props.cover ?? [] },
    Order: { type: "number", number: props.order ?? null },
    Featured: { type: "checkbox", checkbox: Boolean(props.featured) },
    Font: { type: "select", select: props.font ? { name: props.font, color: "gray" } : null },
    "Full width": { type: "checkbox", checkbox: Boolean(props.fullWidth) },
    Link: { type: "url", url: props.link ?? null },
    Action: { type: "select", select: props.action ? { name: props.action, color: "blue" } : null },
    Layout: { type: "select", select: props.layout ? { name: props.layout, color: "blue" } : null },
    Price: { type: "number", number: props.price ?? null },
    "Yearly Price": { type: "number", number: props.yearlyPrice ?? null },
    Currency: { type: "select", select: props.currency ? { name: props.currency, color: "green" } : null },
    "Price Note": { type: "rich_text", rich_text: props.priceNote ? [rt(props.priceNote)] : [] },
    "Compare-at Price": { type: "number", number: props.compareAt ?? null },
    Gallery: { type: "files", files: props.gallery ?? [] },
    Stock: { type: "select", select: props.stock ? { name: props.stock, color: "red" } : null },
    "Checkout ID": { type: "rich_text", rich_text: props.checkoutId ? [rt(props.checkoutId)] : [] },
    Button: { type: "rich_text", rich_text: props.button ? [rt(props.button)] : [] },
    "Cover Position": { type: "select", select: props.coverPosition ? { name: props.coverPosition, color: "default" } : null },
    "Cover Tint": { type: "select", select: props.coverTint ? { name: props.coverTint, color: "default" } : null },
  },
})

test("rich text: plain, and with Notion's links kept as [label](url)", () => {
  assert.equal(plainText([rt("One "), rt("day", "https://x.test")]), "One day")
  assert.equal(plainText(undefined), "")
  assert.equal(linkedText([rt("Read "), rt("the docs", "https://docs.example/"), rt(".")]), "Read [the docs](https://docs.example/).")
  assert.equal(linkedText([rt("x", null)]), "x")
})

test("a title is found whatever the title property is called", () => {
  assert.equal(rowTitle({ properties: { Name: { type: "title", title: [rt(" hero.title ")] } } }), "hero.title")
  assert.equal(rowTitle({ properties: {} }), "")
})

test("an unticked text row hides its slot, a ticked one beats it, and anything else unticked is not on the site", () => {
  const copyRow = (title, text, published) => {
    const r = row({ kind: "Site Copy", title })
    r.properties.Text = { type: "rich_text", rich_text: [rt(text)] }
    r.properties.Published = { type: "checkbox", checkbox: published }
    return r
  }
  const unticked = readRows([copyRow("hero.title", "Words not live", false)])
  assert.equal(unticked.copy["hero.title"], "", "an unticked row hides its slot, not its words")
  // two rows for one slot: the ticked one wins, whichever comes first
  assert.equal(readRows([copyRow("a", "unticked", false), copyRow("a", "ticked", true)]).copy.a, "ticked")
  assert.equal(readRows([copyRow("a", "ticked", true), copyRow("a", "unticked", false)]).copy.a, "ticked")
  const post = row({ kind: "Post", title: "Draft", slug: "draft" })
  post.properties.Published = { type: "checkbox", checkbox: false }
  assert.equal(readRows([post]).entries.length, 0, "a page, a post or a product shows only ticked")
})

test("a ticked Site Copy row carries its picture: its Notion cover, else its Image; an unticked or empty one none", () => {
  const file = { name: "share.png", type: "file", file: { url: "https://files.test/share.png" } }
  const withFile = row({ kind: "Site Copy", title: "meta.pricing.image", text: [rt("Four plans on a shelf")], cover: [file] })
  const read = readRow(withFile)
  assert.deepEqual(read.copy, ["meta.pricing.image", "Four plans on a shelf"], "its Text is still the slot's words: the picture's")
  assert.equal(read.picture.field, "prop")
  assert.equal(read.picture.prop, "Image")
  assert.equal(read.picture.id, withFile.id)
  assert.equal(read.picture.v, withFile.last_edited_time, "a new upload is a new address")

  const covered = row({ kind: "Site Copy", title: "meta.pricing.image", cover: [file] }, { cover: { type: "external", external: { url: "https://pics.example/cover.jpg" } } })
  assert.equal(readRow(covered).picture.field, "cover", "Notion's own cover first, as a page's")
  assert.equal(readRow(covered).picture.external, "https://pics.example/cover.jpg")

  const off = row({ kind: "Site Copy", title: "meta.pricing.image", cover: [file] })
  off.properties.Published.checkbox = false
  assert.equal(readRow(off).picture, undefined, "unticked: no picture, as nothing unticked is shown")
  assert.equal(readRow(row({ kind: "Site Copy", title: "meta.pricing.image" })).picture, undefined, "no file: no picture")

  // the row whose words win is the row whose picture is shown
  assert.deepEqual(Object.keys(readRows([off, withFile]).pictures), ["meta.pricing.image"])
  assert.equal(readRows([off]).pictures, undefined, "no pictures: nothing in the cached data")
  const plain = row({ kind: "Site Copy", title: "meta.pricing.image", text: [rt("Plain")] })
  assert.equal(readRows([withFile, plain]).pictures["meta.pricing.image"].prop, "Image", "of two ticked rows, the first wins, words and picture")
})

test("a Site Copy row is its title and its Text, links kept, blank kept (a blank row hides its slot)", () => {
  assert.deepEqual(readRow(row({ kind: "Site Copy", title: "hero.title", text: [rt("Hello "), rt("there", "https://x.test/")] })), {
    copy: ["hero.title", "Hello [there](https://x.test/)"],
  })
  assert.deepEqual(readRow(row({ kind: "Site Copy", title: "demo.hidden", text: [] })), { copy: ["demo.hidden", ""] })
})

test("a row with no Kind, no title, or in the bin is not read at all", () => {
  assert.equal(readRow(row({ title: "orphan" })), null)
  assert.equal(readRow(row({ kind: "Page", title: "" })), null)
  assert.equal(readRow(row({ kind: "Page", title: "Gone" }, { in_trash: true })), null)
  assert.equal(readRow(row({ kind: "Mystery", title: "x" })), null)
})

test("a Post carries everything the blog prints", () => {
  const { entry } = readRow(
    row({
      kind: "Post",
      title: "Hello, World!",
      description: "First.",
      date: "2026-11-23",
      category: "News",
      tags: ["Design", "News"],
      author: "Ada",
      featured: true,
      font: "Serif",
      cover: [{ name: "c.png", type: "file", file: { url: "https://s3.example/c.png?sig" } }],
    }),
  )
  assert.equal(entry.kind, "Post")
  assert.equal(entry.slug, "hello-world", "made from the title when Slug is empty")
  assert.equal(entry.description, "First.")
  assert.equal(entry.date, "2026-11-23")
  assert.deepEqual(entry.category, { name: "News", color: "blue" })
  assert.deepEqual(entry.tags.map((t) => t.name), ["Design", "News"])
  assert.equal(entry.author.name, "Ada")
  assert.equal(entry.featured, true)
  assert.equal(entry.font, "serif")
  assert.equal(entry.cover.field, "prop")
  assert.equal(entry.cover.prop, "Image")
  assert.equal(entry.cover.external, undefined, "a Notion-hosted file keeps no address: it expires")
  assert.ok(!JSON.stringify(entry).includes("s3.example"), "the expiring address is never stored")
})

test("a page's own cover and icon are read when the properties have none", () => {
  const { entry } = readRow(
    row({ kind: "Page", title: "About", slug: "about" }, { cover: { type: "external", external: { url: "https://pics.example/a.jpg" } }, icon: { type: "emoji", emoji: "🏷️" } }),
  )
  assert.deepEqual(entry.icon, { type: "emoji", emoji: "🏷️" })
  assert.equal(entry.cover.field, "cover")
  assert.equal(entry.cover.external, "https://pics.example/a.jpg")
})

test("a post or a page is shown with Notion's own cover first, as Notion shows it; anything else with its Image first", () => {
  const upload = [{ name: "boxes.jpg", type: "file", file: { url: "https://s3.example/boxes.jpg" } }]
  const banner = { cover: { type: "external", external: { url: "https://pics.example/morris.jpg" } } }
  for (const kind of ["Post", "Page"]) {
    const { entry } = readRow(row({ kind, title: "Version 1.0", slug: "version-1", cover: upload }, banner))
    assert.equal(entry.cover.field, "cover", `${kind}: the page's own cover`)
    assert.equal(entry.cover.external, "https://pics.example/morris.jpg")
    // with no page cover, the property still serves
    assert.equal(readRow(row({ kind, title: "Version 1.0", slug: "version-1", cover: upload })).entry.cover.prop, "Image")
  }
  for (const kind of ["Product", "Person"]) {
    const { entry } = readRow(row({ kind, title: "Corn flakes", slug: "corn-flakes", cover: upload }, banner))
    assert.equal(entry.cover.prop, "Image", `${kind}: the thing itself, not the banner`)
  }
})

test("Cover Position says where a cover is cut; unset, or not one of its choices, is the middle", () => {
  const at = (coverPosition) => readRow(row({ kind: "Post", title: "A", slug: "a", coverPosition })).entry.coverAt
  assert.deepEqual(["Top", "Upper", "Middle", "Lower", "Bottom"].map(at), [0, 25, 50, 75, 100])
  assert.equal(at(undefined), undefined)
  assert.equal(at("Sideways"), undefined)
})

test("Cover Tint Off shows a cover as uploaded; empty, On, or a choice the site doesn't know prints it in the ink", () => {
  const tint = (coverTint) => readRow(row({ kind: "Post", title: "A", slug: "a", coverTint })).entry.coverTint
  assert.equal(tint("Off"), false)
  assert.equal(tint("On"), true)
  assert.equal(tint(undefined), true)
  assert.equal(tint("Sepia"), true)
})

test("one of Notion's own icons is read as its name and colour, with the address Notion draws it at", () => {
  const read = (icon) => readRow(row({ kind: "Page", title: "About", slug: "about" }, { icon })).entry.icon
  const alien = read({ type: "icon", icon: { name: "alien", color: "blue" } })
  assert.equal(alien.type, "native")
  assert.equal(alien.name, "alien")
  assert.equal(alien.color, "blue")
  assert.equal(alien.media.field, "icon")
  assert.equal(alien.media.external, "https://www.notion.so/icons/alien_blue.svg")
  // a colour Notion does not offer is drawn grey; an icon with no name is no icon
  assert.equal(read({ type: "icon", icon: { name: "alien", color: "chartreuse" } }).color, "gray")
  assert.equal(read({ type: "icon", icon: {} }), undefined)
})

test("a Review's stars are read whole, 1 to 5, and anything else is no rating", () => {
  const review = (rating) =>
    readRow({ ...row({ kind: "Review", title: "Sam" }), properties: { ...row({ kind: "Review", title: "Sam" }).properties, Rating: { type: "number", number: rating } } }).entry
  assert.equal(review(5).rating, 5)
  assert.equal(review(4.4).rating, 4)
  assert.equal(review(0).rating, undefined)
  assert.equal(review(9).rating, undefined)
  assert.equal(review(null).rating, undefined)
})

test("slugs: a Slug is cleaned segment by segment, a title becomes one", () => {
  assert.equal(slugify("Hello, World!"), "hello-world")
  assert.equal(slugify("Café & Crème"), "cafe-and-creme")
  assert.equal(slugify("Don’t panic"), "dont-panic")
  assert.equal(pathSlug(" Guides / Set Up ", "ignored"), "guides/set-up")
  assert.equal(pathSlug("", "A Title"), "a-title")
  assert.equal(pathSlug("///", "x"), "")
  // a post lives one level under /blog: its slashes join, or its address would be a page that is not there
  assert.equal(pathSlug("", "CI/CD basics", 1), "ci-cd-basics")
  assert.equal(pathSlug("guides / setup", "ignored", 1), "guides-setup")
  // words with no Latin letter keep their own letters; words with one keep the address they had
  assert.equal(pathSlug("", "日本語の記事"), "日本語の記事")
  assert.equal(pathSlug("", "Hello 世界"), "hello")
  assert.equal(pathSlug("", "!!!"), "")
})

test("a Redirect's slug is its title, lowercased, and its destination its Link", () => {
  const { entry } = readRow(row({ kind: "Redirect", title: " Poster ", link: "https://example.com/" }))
  assert.equal(entry.slug, "poster")
  assert.equal(entry.link, "https://example.com/")
})

test("a page or post with nothing usable for an address is skipped", () => {
  assert.equal(readRow(row({ kind: "Page", title: "!!!" })), null)
})

test("readRows splits copy from entries, and the first row with a key wins", () => {
  const data = readRows([
    row({ kind: "Site Copy", title: "a", text: [rt("first")] }),
    row({ kind: "Site Copy", title: "a", text: [rt("second")] }),
    row({ kind: "Page", title: "About", slug: "about" }),
  ])
  assert.deepEqual(data.copy, { a: "first" })
  assert.equal(data.entries.length, 1)
})

test("the query asks for every ticked row and every text slot's, section's and menu link's row ticked or not, a hundred at a time, and pages in order", async () => {
  assert.deepEqual(publishedQuery(), {
    filter: {
      or: [
        { property: "Published", checkbox: { equals: true } },
        { property: "Kind", select: { equals: "Site Copy" } },
        { property: "Kind", select: { equals: "Section" } },
        { property: "Kind", select: { equals: "Menu" } },
      ],
    },
    page_size: 100,
  })
  assert.equal(publishedQuery("abc").start_cursor, "abc")
  const cursors = []
  const pages = [
    { results: [{ id: "1" }, { id: "2" }], has_more: true, next_cursor: "c2" },
    { results: [{ id: "3" }, { object: "data_source", id: "x" }], has_more: false, next_cursor: null },
  ]
  const rows = await publishedRows(async (body) => {
    cursors.push(body.start_cursor)
    return pages.shift()
  })
  assert.deepEqual(cursors, [undefined, "c2"])
  assert.deepEqual(rows.map((r) => r.id), ["1", "2", "3"], "a data source in the results is not a row")
})

test("any query pages the same way: the body is made for each cursor, and only rows come back (notion:check's retired-row pass)", async () => {
  const { everyRow } = await import("../lib/notion/rows.ts")
  const { retiredQuery } = await import("../lib/notion/check.ts")
  const asked = []
  const pages = [
    { results: [{ id: "a" }], has_more: true, next_cursor: "n2" },
    { results: [{ object: "data_source", id: "x" }, { id: "b" }], has_more: false, next_cursor: null },
  ]
  const rows = await everyRow(
    async (body) => (asked.push(body), pages.shift()),
    (cursor) => retiredQuery("Author Image", "files", cursor),
  )
  assert.deepEqual(asked.map((b) => [b.filter.property, b.start_cursor]), [["Author Image", undefined], ["Author Image", "n2"]])
  assert.deepEqual(rows.map((r) => r.id), ["a", "b"])
})

test("a Plan carries its prices, its note, its features with their links, and its button", () => {
  const { entry } = readRow(
    row({
      kind: "Plan",
      title: "Pro",
      price: 10,
      yearlyPrice: 8,
      currency: "USD",
      priceNote: "per seat / month",
      text: [rt("Pages: Unlimited\n"), rt("Docs", "https://docs.example/")],
      button: "Get Pro",
      link: "/contact",
      featured: true,
      category: "Services",
    }),
  )
  assert.equal(entry.slug, "", "a plan has no page of its own")
  assert.equal(entry.price, 10)
  assert.equal(entry.yearlyPrice, 8)
  assert.equal(entry.currency, "USD")
  assert.equal(entry.priceNote, "per seat / month")
  assert.equal(entry.text, "Pages: Unlimited\n[Docs](https://docs.example/)")
  assert.equal(entry.button, "Get Pro")
  assert.equal(entry.link, "/contact")
  assert.equal(entry.featured, true)
  assert.equal(entry.category.name, "Services")
  assert.equal(readRow(row({ kind: "Plan", title: "Custom" })).entry.price, undefined, "no price is custom pricing, not zero")
})

test("a Product: one address under /shop, its gallery, stock, old price and Shopify variants", () => {
  const { entry } = readRow(
    row({
      kind: "Product",
      title: "Corn Flakes",
      price: 2.5,
      compareAt: 3,
      stock: "Low stock",
      checkoutId: "Small: 4012345678901\nLarge: 4012345678902",
      gallery: [
        { name: "back.png", type: "file", file: { url: "https://s3.example/b.png" } },
        { name: "side.png", type: "external", external: { url: "https://pics.example/s.png" } },
      ],
      category: "Breakfast",
    }),
  )
  assert.equal(entry.slug, "corn-flakes")
  assert.equal(entry.compareAt, 3)
  assert.equal(entry.stock.name, "Low stock")
  assert.deepEqual(entry.variants, [
    { label: "Small", id: "4012345678901" },
    { label: "Large", id: "4012345678902" },
  ])
  assert.deepEqual(entry.gallery.map((m) => [m.prop, m.index, m.external]), [
    ["Gallery", 0, undefined],
    ["Gallery", 1, "https://pics.example/s.png"],
  ])
  assert.equal(readRow(row({ kind: "Product", title: "x", slug: "a/b" })), null, "a product's address is one segment")
})

test("variants: one ID, labelled lines, Shopify's gid form; a line with no ID is left out", () => {
  assert.deepEqual(variantsOf("4012345678901"), [{ label: "", id: "4012345678901" }])
  assert.deepEqual(variantsOf("Red: gid://shopify/ProductVariant/4012345678903\nno id here\n\ngid://shopify/ProductVariant/55555"), [
    { label: "Red", id: "4012345678903" },
    { label: "", id: "55555" },
  ])
  assert.deepEqual(variantsOf(""), [])
})

test("a Page's layout: Landing when chosen, otherwise an article", () => {
  assert.equal(readRow(row({ kind: "Page", title: "Launch", layout: "Landing" })).entry.layout, "landing")
  assert.equal(readRow(row({ kind: "Page", title: "About" })).entry.layout, "article")
})

test("a Quote, a Question and a Proof Logos row keep their text and have no address", () => {
  const quote = readRow(row({ kind: "Quote", title: "William Morris", text: [rt("Have nothing in your houses…")] })).entry
  assert.equal(quote.text, "Have nothing in your houses…")
  assert.equal(quote.slug, "")
  const question = readRow(row({ kind: "Question", title: "What does it cost?", text: [rt("Nothing.")], category: "Pricing" })).entry
  assert.equal(question.text, "Nothing.")
  assert.equal(question.category.name, "Pricing")
  const logo = readRow(row({ kind: "Proof Logos", title: "Acme" })).entry
  assert.equal(logo.slug, "")
  assert.equal(logo.text, undefined, "only plans, quotes and questions read Text")
})

test("a Kind under its former name is read as the Kind it became: a Logo row is a Proof Logos row", () => {
  const old = readRow(row({ kind: "Logo", title: "Acme" })).entry
  assert.equal(old.kind, "Proof Logos", "a database from before the rename keeps its strip")
  assert.deepEqual(liveLogos({ copy: {}, entries: [old] }).map((e) => e.title), ["Acme"])
  assert.equal(readRow(row({ kind: "Logos", title: "Acme" })), null, "a Kind nobody ever named is still nothing")
})

test("a Quote names its speaker in Title and who they are in Author Bio, with no Author needed", () => {
  const quote = readRow(row({ kind: "Quote", title: "William Morris", authorBio: "The Beauty of Life, a lecture, 1880" })).entry
  assert.deepEqual([quote.author.name, quote.author.bio], ["William Morris", "The Beauty of Life, a lecture, 1880"])
  assert.equal(readRow(row({ kind: "Quote", title: "Anonymous" })).entry.author, undefined, "no bio, no byline")
  const post = readRow(row({ kind: "Post", title: "Hello", slug: "hello", authorBio: "Writes things." })).entry
  assert.equal(post.author, undefined, "a post's byline needs its Author")
  const named = readRow(row({ kind: "Post", title: "Hello", slug: "hello", author: "Jo", authorBio: "Writes things." })).entry
  assert.deepEqual(named.author, { name: "Jo", bio: "" }, "a post's own Author Bio is not read: the byline is the Person row's")
})

test("a database made before Image was renamed reads the same: its Cover Image is the picture, fetched by that name", async () => {
  const { otherName } = await import("../lib/notion/schema.ts")
  const upload = { type: "file", name: "box.png", file: { url: "https://files.example/box.png" } }
  const old = row({ kind: "Product", title: "Box", slug: "box" })
  delete old.properties.Image
  old.properties["Cover Image"] = { type: "files", files: [upload] }
  const entry = readRow(old).entry
  assert.equal(entry.cover.prop, "Cover Image", "the media route asks Notion for the name the database has")
  // both names: the new one wins
  const both = row({ kind: "Product", title: "Box", slug: "box", cover: [upload] })
  both.properties["Cover Image"] = { type: "files", files: [{ ...upload, name: "old.png" }] }
  assert.equal(readRow(both).entry.cover.prop, "Image")
  // the media route finds a picture by either name, so a page drawn before the rename still shows it after
  assert.equal(otherName("Cover Image"), "Image")
  assert.equal(otherName("Image"), "Cover Image")
  assert.equal(otherName("Gallery"), "Gallery")
  const route = (await import("node:fs")).readFileSync(new URL("../app/media/[...parts]/route.ts", import.meta.url), "utf8")
  assert.match(route, /files\.props\?\.\[ref\.prop\] \?\? files\.props\?\.\[otherName\(ref\.prop\)\]/, "the media route asks by either name")
})

// Published Date with a time and a zone (dateOf, zonedTime, offsetIn): so a
// row set for 4pm GMT goes live at 4pm GMT, and prints the day written.
test("a Published Date with a time keeps the moment Notion gives it, offset and all", () => {
  const entry = (date, zone) => readRow(row({ kind: "Post", title: "Opening hours", slug: "opening-hours", date, zone })).entry
  assert.equal(entry("2026-12-01").date, "2026-12-01", "a date alone stays a date")
  assert.equal(entry("2026-12-01T16:00:00.000+00:00").date, "2026-12-01T16:00:00.000+00:00", "a time with its offset, as Notion's date picker writes it")
  assert.equal(entry("2026-12-01T16:00:00.000-05:00", "America/New_York").date, "2026-12-01T16:00:00.000-05:00", "an offset already there is kept")
})

test("a time given with a named zone and no offset takes that zone's offset at that moment, summer time and all", () => {
  assert.equal(zonedTime("2026-12-01T16:00:00.000", "Europe/London"), "2026-12-01T16:00:00.000+00:00", "4pm GMT in winter")
  assert.equal(zonedTime("2026-07-01T16:00:00.000", "Europe/London"), "2026-07-01T16:00:00.000+01:00", "4pm in London in summer is BST")
  assert.equal(zonedTime("2026-12-01T16:00:00.000", "America/New_York"), "2026-12-01T16:00:00.000-05:00")
  assert.equal(zonedTime("2026-12-01T16:00:00.000", "Asia/Kolkata"), "2026-12-01T16:00:00.000+05:30", "half hours too")
  assert.equal(zonedTime("2026-12-01T16:00:00.000", "Australia/Sydney"), "2026-12-01T16:00:00.000+11:00", "and the southern summer")
  // the night the clocks go forward in London (29 March 2026): 01:30 does not exist, and is read as after the change
  assert.equal(zonedTime("2026-03-29T03:00:00.000", "Europe/London"), "2026-03-29T03:00:00.000+01:00")
  assert.equal(zonedTime("2026-12-01T16:00:00.000"), "2026-12-01T16:00:00.000Z", "no zone at all: UTC")
  assert.equal(zonedTime("2026-12-01T16:00:00.000", "Nowhere/Atlantis"), "2026-12-01T16:00:00.000Z", "a zone nobody knows: UTC, never a crash")
  assert.equal(zonedTime("2026-12-01", "Europe/London"), "2026-12-01", "a date alone has no time to place")
  assert.equal(offsetIn("UTC", "2026-12-01T16:00"), "+00:00")
})

test("a row set for 4pm London time goes live at 4pm London time, and prints the day written", async () => {
  const { formatDate, isLive } = await import("../lib/content/select.ts")
  const winter = readRow(row({ kind: "Post", title: "Opening hours", slug: "opening-hours", date: "2026-12-01T16:00:00.000", zone: "Europe/London" })).entry
  assert.equal(isLive(winter, new Date("2026-12-01T15:59:00Z")), false, "a minute before")
  assert.equal(isLive(winter, new Date("2026-12-01T16:00:00Z")), true, "on the minute")
  const summer = readRow(row({ kind: "Post", title: "Opening hours", slug: "opening-hours", date: "2026-07-01T16:00:00.000", zone: "Europe/London" })).entry
  assert.equal(isLive(summer, new Date("2026-07-01T15:00:00Z")), true, "16:00 BST is 15:00 UTC")
  assert.equal(isLive(summer, new Date("2026-07-01T14:59:00Z")), false)
  const lateInNewYork = readRow(row({ kind: "Post", title: "Opening hours", slug: "opening-hours", date: "2026-12-01T23:30:00.000", zone: "America/New_York" })).entry
  assert.equal(formatDate(lateInNewYork.date), "1 December 2026", "the evening of the 1st in New York is printed as the 1st, though it is the 2nd in UTC")
})
