// The pictures the site's owner gives it in Notion (lib/share.ts): a page's
// share picture (`meta.<page>.image`), the site's (`meta.site.image`) and its
// logo (`site.logo`), each the picture on a ticked Site Copy row, its Text the
// picture's words. And where they go: the page's Open Graph and X cards, its
// structured data, the Organization's logo.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { INDEXED_PAGES } from "../lib/nav.ts"
import { PAGE_META, metaKey } from "../lib/page-meta.ts"
import { pageMeta, pageMetaFor } from "../lib/seo.ts"
import { HERO_PICTURE, ICON_PICTURE, LOGO_DARK_PICTURE, LOGO_PICTURE, SITE_PICTURE, heroBackdrop, iconLinks, manifestIcons, pagePicture, pictureSlot, shareImage, siteIcon, siteLogo, sitePicture } from "../lib/share.ts"
import { readRow, readRows } from "../lib/notion/rows.ts"
import { SITE_LOGO, SITE_NAME, SITE_URL } from "../lib/site.ts"
import { pageLd, siteLd } from "../lib/structured-data.ts"

const ref = (id) => ({ owner: "page", id, field: "prop", prop: "Image", index: 0, v: "2026-11-26T09:00:00.000Z", name: `${id}.png` })
const nodeOfType = (ld, type) => ld["@graph"].find((n) => [n["@type"]].flat().includes(type))
const ogImage = (meta) => meta.openGraph.images[0]

test("a picture slot: the ticked row's picture through this site's /media/, with the row's words, or the words given", () => {
  assert.equal(pictureSlot({ copy: {} }, "meta.pricing.image", "Pricing"), undefined, "no row, no picture")
  const picture = pictureSlot({ copy: {}, pictures: { "meta.pricing.image": ref("p1") } }, "meta.pricing.image", "Pricing")
  assert.match(picture.url, /^\/media\/[^/]+\/p1\.png$/, "served from this site, never Notion's host")
  assert.equal(picture.alt, "Pricing", "no Text: the words given")
  const said = pictureSlot({ copy: { "meta.pricing.image": "Four plans on a shelf" }, pictures: { "meta.pricing.image": ref("p1") } }, "meta.pricing.image", "Pricing")
  assert.equal(said.alt, "Four plans on a shelf", "the row's Text is the picture's words")
  const blank = pictureSlot({ copy: { "meta.pricing.image": "  " }, pictures: { "meta.pricing.image": ref("p1") } }, "meta.pricing.image", "Pricing")
  assert.equal(blank.alt, "Pricing", "a picture is never without words")
})

test("a designed page's picture is its own row's, named by the page's title until the row says otherwise", () => {
  const data = { copy: { "meta.pricing.title": "Prices" }, pictures: { "meta.pricing.image": ref("p1") } }
  assert.equal(metaKey("/pricing", "image"), "meta.pricing.image")
  assert.equal(metaKey("/", "image"), "meta.home.image")
  assert.equal(pagePicture(data, "/pricing").alt, "Prices", "the title as Notion has it")
  assert.equal(pagePicture(data, "/about"), undefined)
  assert.equal(sitePicture({ copy: { "site.name": "Acme" }, pictures: { [SITE_PICTURE]: ref("s1") } }).alt, "Acme")
})

test("what a link shows: the page's own picture, else the site's, else nothing (the card drawn with its title)", () => {
  const own = { url: "/media/own/cover.png", alt: "Own" }
  const site = { copy: {}, pictures: { [SITE_PICTURE]: ref("s1") } }
  assert.equal(shareImage(site, own), own)
  assert.match(shareImage(site).url, /s1\.png$/)
  assert.equal(shareImage({ copy: {} }), undefined)
})

test("a designed page's cards and structured data show its picture; without one, the site's; without either, the drawn card", () => {
  const drawn = pageMetaFor("/pricing", { copy: {} })
  assert.equal(ogImage(drawn).url, "/og/pricing")
  assert.equal(ogImage(drawn).width, 1200, "the drawn card's size is known")

  const own = pageMetaFor("/pricing", { copy: { "meta.pricing.image": "Four plans on a shelf" }, pictures: { "meta.pricing.image": ref("p1"), [SITE_PICTURE]: ref("s1") } })
  assert.match(ogImage(own).url, /^\/media\/.*p1\.png$/)
  assert.equal(ogImage(own).alt, "Four plans on a shelf")
  assert.equal(ogImage(own).width, undefined, "an upload's size is not claimed")
  assert.match(own.twitter.images[0].url, /p1\.png$/, "the X card shows the same")

  const site = pageMetaFor("/pricing", { copy: {}, pictures: { [SITE_PICTURE]: ref("s1") } })
  assert.match(ogImage(site).url, /s1\.png$/)

  const page = nodeOfType(pageLd("/pricing", { copy: {}, pictures: { "meta.pricing.image": ref("p1") } }), "WebPage")
  assert.match(page.image.url, new RegExp(`^${SITE_URL}/media/.*p1\\.png$`), "whole, for structured data")
  assert.equal(page.image.caption, PAGE_META["/pricing"].title)
  assert.match(nodeOfType(pageLd("/pricing", { copy: {} }), "WebPage").image.url, /\/og\/pricing$/)
  assert.ok(pageMeta({ path: "/x", title: "X", description: "A page.", site: "Acme", image: { url: "/media/a/b.png", alt: "B" } }).openGraph.images[0].url.endsWith("b.png"))
})

test("the site's logo in its structured data is the one given in Notion, or the mark at its known size", () => {
  const mark = nodeOfType(siteLd({ copy: {} }), "Organization").logo
  assert.equal(mark.url, `${SITE_URL}${SITE_LOGO.src}`)
  assert.equal(mark.width, SITE_LOGO.width)
  const given = nodeOfType(siteLd({ copy: { [LOGO_PICTURE]: "The Acme wordmark" }, pictures: { [LOGO_PICTURE]: ref("l1") } }), "Organization").logo
  assert.match(given.url, new RegExp(`^${SITE_URL}/media/.*l1\\.png$`))
  assert.equal(given.caption, "The Acme wordmark")
  assert.equal(given.width, undefined, "an upload's size is not claimed")
  assert.equal(given["@id"], mark["@id"], "the same logo node, so the website's publisher still points at it")
})

test("every picture slot is in the list of slots, so notion:seed-copy gives each a row and notion:check knows it", () => {
  const slots = JSON.parse(readFileSync(new URL("../copy-keys.json", import.meta.url), "utf8"))
  for (const { href } of INDEXED_PAGES) assert.ok(metaKey(href, "image") in slots, metaKey(href, "image"))
  assert.equal(slots[metaKey("/pricing", "image")], PAGE_META["/pricing"].title, "the page's title is its built-in words")
  assert.equal(slots[SITE_PICTURE], SITE_NAME)
  assert.equal(slots[LOGO_PICTURE], SITE_NAME)
})

// ── the picture under the home page's hero ──

const rt = (text) => ({ plain_text: text, href: null, annotations: {} })
const copyRow = ({ title, text = "", published = true, image, tint, position }) => ({
  object: "page",
  id: "22222222-3333-4444-8555-666666666666",
  created_time: "2026-11-01T10:00:00.000Z",
  last_edited_time: "2026-11-26T09:00:00.000Z",
  properties: {
    Title: { type: "title", title: [rt(title)] },
    Kind: { type: "select", select: { name: "Site Copy", color: "default" } },
    Published: { type: "checkbox", checkbox: published },
    Text: { type: "rich_text", rich_text: text ? [rt(text)] : [] },
    Image: { type: "files", files: image ? [{ name: image, type: "external", external: { url: `https://images.example.com/${image}` } }] : [] },
    "Cover Tint": { type: "select", select: tint ? { name: tint, color: "default" } : null },
    "Cover Position": { type: "select", select: position ? { name: position, color: "default" } : null },
  },
})

test("the hero's picture is the home.hero.image row's, drawn as its row says, decoration unless its Text says what it shows", () => {
  assert.equal(HERO_PICTURE, "home.hero.image")
  assert.equal(heroBackdrop({ copy: {} }), undefined, "no row, no picture: the hero as designed")
  assert.equal(heroBackdrop(readRows([copyRow({ title: HERO_PICTURE, image: "field.jpg", published: false })])), undefined, "unticked: none")
  assert.equal(heroBackdrop(readRows([copyRow({ title: HERO_PICTURE })])), undefined, "ticked with no picture: none")

  const plain = heroBackdrop(readRows([copyRow({ title: HERO_PICTURE, image: "field.jpg" })]))
  assert.match(plain.src, /^\/media\/[^/]+\/field\.jpg$/, "served from this site")
  assert.equal(plain.alt, "", "no words: decoration")
  assert.equal(plain.tint, true, "printed in the look's ink, as any cover")
  assert.equal(plain.at, undefined)

  const said = heroBackdrop(readRows([copyRow({ title: HERO_PICTURE, image: "field.jpg", text: "A wheat field at dawn", tint: "Off", position: "Bottom" })]))
  assert.equal(said.alt, "A wheat field at dawn")
  assert.equal(said.tint, false, "Cover Tint Off: as uploaded")
  assert.equal(said.at, 100, "Cover Position Bottom")
})

test("a picture slot's look (Cover Tint Off, Cover Position) rides beside its file, never in its signed address", async () => {
  const read = readRow(copyRow({ title: "meta.site.image", image: "card.png", tint: "Off", position: "Top" }))
  assert.equal(read.picture.tint, false)
  assert.equal(read.picture.at, 0)
  const { signMedia } = await import("../lib/content/media.ts")
  const { tint, at, ...file } = read.picture
  assert.equal(signMedia(read.picture), signMedia(file), "the same address with or without how it is drawn")
  // a row nobody touched carries neither
  const plain = readRow(copyRow({ title: "meta.site.image", image: "card.png" }))
  assert.equal("tint" in plain.picture, false)
  assert.equal("at" in plain.picture, false)
})

// ------------------------------------------------------------ the logo and the icon

const svgRef = (id) => ({ ...ref(id), name: `${id}.svg` })

test("the site's logo stands where the mark does: site.logo, with site.logo.dark for the dark look, or none", () => {
  assert.equal(siteLogo({ copy: {} }), undefined, "no row: the drawn mark")
  const one = siteLogo({ copy: {}, pictures: { [LOGO_PICTURE]: ref("l1") } })
  assert.match(one.src, /^\/media\/[^/]+\/l1\.png$/, "served from this site")
  assert.equal(one.dark, undefined)
  const both = siteLogo({ copy: {}, pictures: { [LOGO_PICTURE]: ref("l1"), [LOGO_DARK_PICTURE]: ref("l2") } })
  assert.match(both.dark, /l2\.png$/)
  assert.equal(siteLogo({ copy: {}, pictures: { [LOGO_DARK_PICTURE]: ref("l2") } }), undefined, "a dark logo alone stands for nothing")
})

test("the site's icon is site.icon's picture, else the logo's; a drawing is known by its name", () => {
  assert.equal(siteIcon({ copy: {} }), undefined, "neither: the mark's icons")
  assert.match(siteIcon({ copy: {}, pictures: { [LOGO_PICTURE]: ref("l1") } }).src, /l1\.png$/, "the logo, when there is no icon")
  const icon = siteIcon({ copy: {}, pictures: { [LOGO_PICTURE]: ref("l1"), [ICON_PICTURE]: ref("i1") } })
  assert.match(icon.src, /i1\.png$/, "the icon first")
  assert.equal(icon.drawing, false)
  assert.equal(siteIcon({ copy: {}, pictures: { [ICON_PICTURE]: svgRef("i2") } }).drawing, true)
})

test("a page's head names the icon at a tab's, a home screen's and an iPhone's size; a drawing once, as it is", () => {
  const icon = siteIcon({ copy: {}, pictures: { [ICON_PICTURE]: ref("i1") } })
  const links = iconLinks(icon)
  assert.deepEqual(links.icon.map((l) => [l.url.replace(/^.*\?/, ""), l.sizes, l.type]), [["icon=32", "32x32", "image/png"], ["icon=192", "192x192", "image/png"]])
  assert.deepEqual(links.apple.map((l) => [l.url.replace(/^.*\?/, ""), l.sizes]), [["icon=180", "180x180"]])
  for (const l of [...links.icon, ...links.apple]) assert.ok(l.url.startsWith(icon.src), "the icon's own address")
  assert.deepEqual(manifestIcons(icon).map((l) => [l.src.replace(/^.*\?/, ""), l.sizes]), [["icon=192", "192x192"], ["icon=512", "512x512"]])
  const drawing = siteIcon({ copy: {}, pictures: { [ICON_PICTURE]: svgRef("i2") } })
  assert.deepEqual(iconLinks(drawing), { icon: [{ url: drawing.src, type: "image/svg+xml" }], apple: [] })
  assert.deepEqual(manifestIcons(drawing), [{ src: drawing.src, sizes: "any", type: "image/svg+xml" }])
})
