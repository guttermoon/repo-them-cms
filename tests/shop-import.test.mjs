// `npm run shop:import`: products from Shopify or Printify as Product rows.
// The rules (lib/commerce/import.ts), the two platforms' clients against
// stand-ins that answer as the real APIs do (lib/commerce/import-sources.ts),
// and the whole command, dry run and write, against a recording stand-in for
// the Notion client (lib/commerce/import-run.ts).
import { test } from "node:test"
import assert from "node:assert/strict"

import {
  MAX_IMAGES,
  blockBatches,
  bodyBlocks,
  bodyText,
  checkoutText,
  existingFromRow,
  fromPrintify,
  fromShopify,
  htmlToText,
  imageName,
  money as planMoney,
  numericId,
  pictureName,
  optionName,
  planImport,
  plural,
  productProperties,
  rowsToRead,
  stockFor,
  summarise,
} from "../lib/commerce/import.ts"
import {
  ImportError,
  PRINTIFY_USER_AGENT,
  PRODUCTS_QUERY,
  SHOPIFY_API_VERSION,
  VARIANTS_QUERY,
  fetchPrintify,
  fetchShopify,
  listPrintifyShops,
  shopifyVersion,
} from "../lib/commerce/import-sources.ts"
import { asNamed, chooseSource, propertyGaps, readBody, runImport } from "../lib/commerce/import-run.ts"
import { variantsOf } from "../lib/notion/rows.ts"
import { PROPS, SCHEMA } from "../lib/notion/schema.ts"

const noSleep = async () => {}

// ------------------------------------------------------------------ fixtures

const money = (amount, currencyCode = "GBP") => ({ amount, currencyCode })
const gid = (type, n) => `gid://shopify/${type}/${n}`

/** A product as the Storefront API's PRODUCTS_QUERY returns it. */
function shopifyProduct(over = {}) {
  return {
    id: gid("Product", 7001),
    handle: "corn-flakes",
    title: "Corn flakes",
    descriptionHtml: "<p>Toasted corn cereal. <strong>Mostly</strong> flakes.</p><ul><li>Net wt 12 oz</li><li>Keep dry</li></ul>",
    productType: "Breakfast, cereal",
    tags: ["generic", " breakfast "],
    availableForSale: true,
    onlineStoreUrl: "https://generic.example/products/corn-flakes",
    images: {
      nodes: [
        { url: "https://cdn.shopify.example/files/corn-flakes.jpg?v=1", altText: "The box" },
        { url: "https://cdn.shopify.example/files/corn-flakes.jpg?v=1", altText: "The same box again" },
        { url: "http://insecure.example/back.jpg", altText: null },
        { url: "https://cdn.shopify.example/files/corn-flakes-back.jpg", altText: "The back" },
      ],
    },
    variants: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [
        { id: gid("ProductVariant", 40000000000011), title: "Large", availableForSale: false, price: money("4.00"), compareAtPrice: null },
        { id: gid("ProductVariant", 40000000000012), title: "Small: 12 oz", availableForSale: true, price: money("2.50"), compareAtPrice: money("3.00") },
        { id: gid("ProductVariant", 40000000000013), title: "Medium", availableForSale: true, price: money("3.25"), compareAtPrice: money("3.25") },
      ],
    },
    ...over,
  }
}

/** A product as Printify's products.json lists it. */
function printifyProduct(over = {}) {
  return {
    id: "5d39b159e7c48c000728c89f",
    title: "Generic mug",
    description: "<p>A mug. For drink.</p><p>11&nbsp;oz &amp; dishwasher safe.</p>",
    tags: ["Mugs", "Home & Living"],
    variants: [
      { id: 12100, title: "11oz", price: 1499, is_enabled: true, is_default: true, is_available: true },
      { id: 12101, title: "15oz", price: 1299, is_enabled: true, is_default: false, is_available: false },
      { id: 12102, title: "20oz", price: 999, is_enabled: false, is_default: false, is_available: true },
    ],
    images: [
      { src: "https://images.printify.example/mug-20oz.png", variant_ids: [12102], position: "front", is_default: false },
      { src: "https://images.printify.example/mug-15oz.png", variant_ids: [12101], position: "front", is_default: false },
      { src: "https://images.printify.example/mug-11oz.png", variant_ids: [12100], position: "front", is_default: true },
    ],
    visible: true,
    is_deleted: false,
    external: [{ id: "x1", handle: "https://generic.printify.me/product/123/generic-mug" }],
    ...over,
  }
}

const rich = (content) => (content ? [{ type: "text", plain_text: content, text: { content } }] : [])
const files = (urls, uploaded = false, names = []) =>
  urls.map((url, n) => {
    const name = names[n] ?? `f${n}.png`
    return uploaded ? { name, type: "file", file: { url } } : { name, type: "external", external: { url } }
  })

/** A Product row as a data-source query returns it. */
function productRow(over = {}) {
  const o = { id: "row-1", title: "Corn flakes", slug: "", importId: "", stock: "In stock", currency: "GBP", checkoutId: "", cover: [], gallery: [], uploaded: false, description: "Written in Notion by the editor.", tags: [], ...over }
  return {
    object: "page",
    id: o.id,
    last_edited_time: "2026-11-20T10:00:00.000Z",
    in_trash: false,
    properties: {
      [PROPS.title]: { type: "title", title: rich(o.title) },
      [PROPS.kind]: { type: "select", select: { name: "Product", color: "orange" } },
      [PROPS.slug]: { type: "rich_text", rich_text: rich(o.slug) },
      [PROPS.importId]: { type: "rich_text", rich_text: rich(o.importId) },
      [PROPS.price]: { type: "number", number: o.price ?? null },
      [PROPS.compareAt]: { type: "number", number: o.compareAt ?? null },
      [PROPS.currency]: { type: "select", select: o.currency ? { name: o.currency, color: "default" } : null },
      [PROPS.stock]: { type: "select", select: o.stock ? { name: o.stock, color: "green" } : null },
      [PROPS.checkoutId]: { type: "rich_text", rich_text: rich(o.checkoutId) },
      [PROPS.link]: { type: "url", url: o.link ?? null },
      [PROPS.cover]: { type: "files", files: files(o.cover, o.uploaded, o.coverNames) },
      [PROPS.gallery]: { type: "files", files: files(o.gallery, o.uploaded, o.galleryNames) },
      [PROPS.description]: { type: "rich_text", rich_text: rich(o.description) },
      [PROPS.category]: { type: "select", select: o.category ? { name: o.category, color: "default" } : null },
      [PROPS.tags]: { type: "multi_select", multi_select: o.tags.map((name) => ({ name, color: "default" })) },
    },
  }
}

/** A row's page: `over.body` is its blocks as Notion lists them. */
const existing = (over = {}) => {
  const row = existingFromRow(productRow(over))
  if (row && over.body) row.body = { text: bodyText(over.body), blockIds: over.body.map((b) => b.id) }
  return row
}

/** A block as Notion lists it. */
const block = (id, type, content, more = {}) => ({ object: "block", id, type, has_children: false, [type]: { rich_text: rich(content) }, ...more })

/** What Notion holds for the Shopify fixture once it is in step: the words
 *  the platform has, in every field the import writes. */
const CORN_WORDS = { title: "Corn flakes", description: "Toasted corn cereal. Mostly flakes.", category: "Breakfast cereal", tags: ["breakfast", "generic"] }
const CORN_BODY = [block("b1", "paragraph", "Toasted corn cereal. Mostly flakes."), block("b2", "bulleted_list_item", "Net wt 12 oz"), block("b3", "bulleted_list_item", "Keep dry")]
const MUG_WORDS = { title: "Generic mug", description: "A mug. For drink.", tags: ["Mugs", "Home & Living"] }

// ------------------------------------------------------------------ text

test("descriptions: HTML as words, keeping paragraphs and list items, entities read", () => {
  assert.equal(
    htmlToText("<div>\n  <p>One &amp; <em>two</em>.</p>\n<p>Three&nbsp;&mdash; four<br>five &#8364;6 &#x2603;</p><ul><li>a</li><li>b</li></ul><script>alert(1)</script></div>"),
    "One & two.\n\nThree — four\nfive €6 ☃\n\n- a\n- b",
  )
  assert.equal(htmlToText(""), "")
  assert.equal(htmlToText("&bogus; &#0; plain"), "&bogus; &#0; plain", "what is not an entity is left as written")
})

test("the summary is the first paragraph, cut at a sentence or a word to fit a search result", () => {
  assert.equal(summarise("Short.\n\nSecond paragraph."), "Short.")
  assert.equal(summarise("- a list first\n- of things"), "a list first of things")
  const long = `${"Word ".repeat(20)}ends here. ${"more ".repeat(40)}`
  assert.equal(summarise(long), `${"Word ".repeat(20)}ends here.`)
  const run = "abcdefghij ".repeat(30)
  const cut = summarise(run)
  assert.ok(cut.length <= 160 && cut.endsWith("…") && !cut.includes(" …"), cut)
  assert.equal(summarise(""), "")
})

test("select options lose commas (Notion refuses them) and stop at 100 characters", () => {
  assert.equal(optionName(" Home, Living "), "Home Living")
  assert.equal(optionName("x".repeat(150)).length, 100)
})

// ------------------------------------------------------------------ Shopify

test("Shopify: the cheapest variant on sale sets the price, its compare-at only when higher", () => {
  const { products, skipped } = fromShopify([shopifyProduct()])
  assert.deepEqual(skipped, [])
  const [p] = products
  assert.equal(p.importId, "shopify:7001")
  assert.equal(p.slug, "corn-flakes")
  assert.equal(p.price, 2.5)
  assert.equal(p.compareAt, 3)
  assert.equal(p.currency, "GBP")
  assert.equal(p.available, true)
  assert.equal(p.link, "https://generic.example/products/corn-flakes")
  assert.equal(p.category, "Breakfast cereal")
  assert.deepEqual(p.tags, ["generic", "breakfast"])
  assert.equal(p.description, "Toasted corn cereal. Mostly flakes.\n\n- Net wt 12 oz\n- Keep dry")
})

test("Shopify: only variants that can be checked out go to the cart, as the Checkout ID the site reads", () => {
  const [p] = fromShopify([shopifyProduct()]).products
  assert.deepEqual(p.variants, [
    { label: "Small 12 oz", id: "40000000000012" },
    { label: "Medium", id: "40000000000013" },
  ])
  assert.deepEqual(variantsOf(checkoutText(p.variants)), p.variants, "the site reads back exactly what was written")
  const single = fromShopify([
    shopifyProduct({ variants: { nodes: [{ id: gid("ProductVariant", 40000000000099), title: "Default Title", availableForSale: true, price: money("1.00") }] } }),
  ]).products[0]
  assert.equal(checkoutText(single.variants), "40000000000099", "one variant is a bare ID")
})

test("Shopify: a product nothing can be bought of is Sold out, and keeps its variants for when it is back", () => {
  const soldOut = shopifyProduct({
    availableForSale: false,
    variants: { nodes: shopifyProduct().variants.nodes.map((v) => ({ ...v, availableForSale: false })) },
  })
  const [p] = fromShopify([soldOut]).products
  assert.equal(p.available, false)
  assert.equal(p.variants.length, 3)
})

test("Shopify: each picture's alt text, by address, the first given where an address repeats", () => {
  const [p] = fromShopify([shopifyProduct()]).products
  assert.deepEqual(p.alts, { "https://cdn.shopify.example/files/corn-flakes.jpg?v=1": "The box", "https://cdn.shopify.example/files/corn-flakes-back.jpg": "The back" })
  const blank = fromShopify([shopifyProduct({ images: { nodes: [{ url: "https://cdn.shopify.example/a.jpg", altText: "   " }] } })]).products[0]
  assert.deepEqual(blank.alts, {}, "blank alt text is no alt text")
})

test("a picture's name in Notion: the alt text, cut at a word to Notion's 100 characters, or else the file name", () => {
  assert.equal(pictureName("https://cdn.example/files/box.jpg", 0, "  The   box \n"), "The box")
  assert.equal(pictureName("https://cdn.example/files/box.jpg", 0), "box.jpg")
  assert.equal(pictureName("https://cdn.example/files/box.jpg", 0, ""), "box.jpg")
  const long = "A tall box of corn flakes with a yellow label, standing on a kitchen counter beside a bowl, a spoon and a jug of milk"
  const name = pictureName("https://cdn.example/a.jpg", 0, long)
  assert.ok(name.length <= 100, `${name.length} characters`)
  assert.ok(name.endsWith("…") && long.startsWith(name.slice(0, -1)), name)
  assert.ok(!/\s…$/.test(name), "cut at a word, not after a space")
})

test("Shopify: pictures are https only, without repeats, at most ten", () => {
  const [p] = fromShopify([shopifyProduct()]).products
  assert.deepEqual(p.images, ["https://cdn.shopify.example/files/corn-flakes.jpg?v=1", "https://cdn.shopify.example/files/corn-flakes-back.jpg"])
  const many = shopifyProduct({ images: { nodes: Array.from({ length: 14 }, (_, n) => ({ url: `https://cdn.shopify.example/${n}.jpg` })) } })
  assert.equal(fromShopify([many]).products[0].images.length, MAX_IMAGES)
  const plain = fromShopify([shopifyProduct({ onlineStoreUrl: "http://generic.example/p" })]).products[0]
  assert.equal(plain.link, undefined, "a plain-http buy link is not offered")
})

test("Shopify: a product without a priced variant or an ID is reported, not guessed at", () => {
  const { products, skipped } = fromShopify([
    shopifyProduct({ variants: { nodes: [] } }),
    shopifyProduct({ id: "not-a-gid", title: "Mystery" }),
  ])
  assert.deepEqual(products, [])
  assert.deepEqual(skipped.map((s) => s.reason), ["it has no priced variant", "Shopify gave it no product ID"])
  assert.equal(numericId("gid://shopify/ProductVariant/123"), "123")
})

// ------------------------------------------------------------------ Printify

test("Printify: whole cents become the price, from the cheapest enabled variant, in the shop's currency", () => {
  const { products } = fromPrintify([printifyProduct()], "usd")
  const [p] = products
  assert.equal(p.importId, "printify:5d39b159e7c48c000728c89f")
  assert.equal(p.slug, "generic-mug")
  assert.equal(p.price, 12.99, "the disabled 20oz at 9.99 is not for sale")
  assert.equal(p.currency, "USD")
  assert.equal(p.available, true)
  assert.equal(p.compareAt, undefined)
  assert.deepEqual(p.variants, [], "Printify's variant IDs are the print provider's, not a checkout's")
  assert.equal(p.link, "https://generic.printify.me/product/123/generic-mug")
  assert.equal(p.description, "A mug. For drink.\n\n11 oz & dishwasher safe.")
  assert.deepEqual(p.tags, ["Mugs", "Home & Living"])
})

test("Printify: the default mockup first, then those of variants on sale; a disabled variant's pictures stay out", () => {
  const [p] = fromPrintify([printifyProduct()], "USD").products
  assert.deepEqual(p.images, ["https://images.printify.example/mug-11oz.png", "https://images.printify.example/mug-15oz.png"])
})

test("Printify: hidden, deleted and unsellable products are reported; the link is https or nothing", () => {
  const { products, skipped } = fromPrintify(
    [
      printifyProduct({ id: "a", title: "Hidden", visible: false }),
      printifyProduct({ id: "b", title: "Gone", is_deleted: true }),
      printifyProduct({ id: "c", title: "Off", variants: printifyProduct().variants.map((v) => ({ ...v, is_enabled: false })) }),
      printifyProduct({ id: "d", title: "Plain", external: { id: "1", handle: "generic-mug" } }),
    ],
    "GBP",
  )
  assert.deepEqual(skipped.map((s) => `${s.title}: ${s.reason}`), [
    "Hidden: it is hidden in Printify",
    "Gone: it is deleted in Printify",
    "Off: it has no enabled variant",
  ])
  assert.equal(products.length, 1)
  assert.equal(products[0].link, undefined, "a handle that is not an https address is no link")
  const outOfStock = fromPrintify([printifyProduct({ variants: printifyProduct().variants.map((v) => ({ ...v, is_available: false })) })], "USD").products[0]
  assert.equal(outOfStock.available, false)
})

// ------------------------------------------------------------------ rows

test("a Product row as the import compares it; pictures uploaded in Notion are marked the editor's", () => {
  const row = existing({ slug: "", importId: "shopify:7001", price: 2.5, cover: ["https://cdn.example/a.jpg"], gallery: ["https://cdn.example/b.jpg"] })
  assert.equal(row.slug, "corn-flakes", "an empty Slug is made from the title, as the site makes it")
  assert.equal(row.importId, "shopify:7001")
  assert.deepEqual(row.images, ["https://cdn.example/a.jpg", "https://cdn.example/b.jpg"])
  assert.deepEqual(row.imageNames, ["f0.png", "f0.png"], "and their names, in the same order")
  const uploaded = existing({ cover: ["https://x.example/a.png"], uploaded: true })
  assert.equal(uploaded.images, null)
  assert.equal(uploaded.imageNames, null)
  assert.equal(existingFromRow({ ...productRow(), in_trash: true }), null)
})

test("a new row: unpublished, every field the platform knows, pictures as addresses, the body from the description", () => {
  const [p] = fromShopify([shopifyProduct()]).products
  const props = productProperties(p, "corn-flakes")
  assert.deepEqual(props[PROPS.published], { checkbox: false })
  assert.deepEqual(props[PROPS.kind], { select: { name: "Product" } })
  assert.equal(props[PROPS.importId].rich_text[0].text.content, "shopify:7001")
  assert.equal(props[PROPS.slug].rich_text[0].text.content, "corn-flakes")
  assert.equal(props[PROPS.description].rich_text[0].text.content, "Toasted corn cereal. Mostly flakes.")
  assert.deepEqual(props[PROPS.price], { number: 2.5 })
  assert.deepEqual(props[PROPS.compareAt], { number: 3 })
  assert.deepEqual(props[PROPS.stock], { select: { name: "In stock" } })
  // each picture is named with Shopify's alt text, which the site reads as its description
  assert.deepEqual(props[PROPS.cover].files, [{ name: "The box", type: "external", external: { url: "https://cdn.shopify.example/files/corn-flakes.jpg?v=1" } }])
  assert.deepEqual(props[PROPS.gallery].files.map((f) => f.name), ["The back"])
  assert.deepEqual(props[PROPS.tags], { multi_select: [{ name: "generic" }, { name: "breakfast" }] })
  for (const name of Object.keys(props)) assert.ok(SCHEMA.some((p) => p.name === name), `${name} is a property the site has`)
  assert.deepEqual(
    bodyBlocks(p.description).map((b) => [b.type, b[b.type].rich_text[0].text.content]),
    [
      ["paragraph", "Toasted corn cereal. Mostly flakes."],
      ["bulleted_list_item", "Net wt 12 oz"],
      ["bulleted_list_item", "Keep dry"],
    ],
  )
  assert.equal(imageName("https://cdn.example/", 2), "picture-3")
})

test("stock: Sold out when nothing can be bought; the editor's Low stock and Pre-order stand while it can", () => {
  assert.equal(stockFor("Low stock", true), "Low stock")
  assert.equal(stockFor("Pre-order", true), "Pre-order")
  assert.equal(stockFor("Sold out", true), "In stock")
  assert.equal(stockFor(undefined, true), "In stock")
  assert.equal(stockFor("Low stock", false), "Sold out")
})

// ------------------------------------------------------------------ the plan

const ALLOWED_ON_UPDATE = new Set([PROPS.title, PROPS.description, PROPS.category, PROPS.tags, PROPS.price, PROPS.compareAt, PROPS.currency, PROPS.stock, PROPS.checkoutId, PROPS.link, PROPS.cover, PROPS.gallery, PROPS.importId])
/** What only Notion says of a product: an import writes none of it. */
const THE_EDITORS = [PROPS.published, PROPS.slug, PROPS.featured, PROPS.order, PROPS.kind]

test("plan: a product new to Notion is created; one already there is found by its Import ID, even renamed", () => {
  const mapped = fromShopify([shopifyProduct(), shopifyProduct({ id: gid("Product", 7002), handle: "drink", title: "Drink" })])
  const rows = [existing({ ...CORN_WORDS, body: CORN_BODY, id: "row-drink", title: "Drink", slug: "renamed-in-notion", importId: "shopify:7002", price: 2.5, compareAt: 3, link: "https://generic.example/products/corn-flakes", checkoutId: "Small 12 oz: 40000000000012\nMedium: 40000000000013", cover: ["https://cdn.shopify.example/files/corn-flakes.jpg?v=1"], gallery: ["https://cdn.shopify.example/files/corn-flakes-back.jpg"], coverNames: ["The box"], galleryNames: ["The back"] })]
  const plan = planImport(rows, mapped, "shopify")
  assert.deepEqual(plan.create.map((c) => c.slug), ["corn-flakes"])
  assert.deepEqual(plan.unchanged, [{ id: "row-drink", title: "Drink", note: undefined }], "found, and nothing differs")
  assert.deepEqual(plan.update, [])
})

test("plan: an update writes what the platform says and nothing that is only Notion's, and says what changed", () => {
  const mapped = fromShopify([shopifyProduct({ availableForSale: false, variants: { nodes: [{ id: gid("ProductVariant", 40000000000012), title: "Small", availableForSale: false, price: money("2.75", "USD") }] } })])
  const rows = [existing({ ...CORN_WORDS, body: CORN_BODY, importId: "shopify:7001", price: 2.5, compareAt: 3, currency: "GBP", stock: "Low stock", checkoutId: "Small: 40000000000012\nLarge: 40000000000011" })]
  const [update] = planImport(rows, mapped, "shopify").update
  assert.deepEqual(update.changes.map((c) => c.field), ["price", "compare-at price", "currency", "stock", "checkout IDs", "link", "pictures"])
  assert.equal(update.body, undefined, "a body already the platform's is left")
  for (const name of THE_EDITORS) assert.ok(!(name in update.properties), `an update never writes ${name}`)
  assert.deepEqual(update.properties[PROPS.price], { number: 2.75 })
  assert.deepEqual(update.properties[PROPS.compareAt], { number: null }, "a compare-at price Shopify dropped is cleared")
  assert.deepEqual(update.properties[PROPS.stock], { select: { name: "Sold out" } })
  assert.equal(update.properties[PROPS.checkoutId].rich_text[0].text.content, "40000000000012", "one variant left: a bare ID")
  for (const name of Object.keys(update.properties)) assert.ok(ALLOWED_ON_UPDATE.has(name), `an update never writes ${name}`)
})

test("plan: words changed in Notion are changed back to the shop's: the title, the line, the collection, the tags", () => {
  const drifted = existing({ importId: "shopify:7001", title: "Corn flakes (new!)", description: "The t-shirt of cereals, as rewritten in Notion.", category: "Snacks", tags: ["generic", "mine"] })
  const [update] = planImport([drifted], fromShopify([shopifyProduct()]), "shopify").update
  const fields = Object.fromEntries(update.changes.map((c) => [c.field, c]))
  assert.deepEqual(fields.title, { field: "title", from: '"Corn flakes (new!)"', to: '"Corn flakes"' })
  assert.equal(fields.description.to, '"Toasted corn cereal. Mostly flakes."')
  assert.match(fields.description.from, /^"The t-shirt of cereals, as rewritten in…"$/, "a long line is cut for the plan")
  assert.deepEqual(fields.collection, { field: "collection", from: "Snacks", to: "Breakfast cereal" })
  assert.deepEqual(fields.tags, { field: "tags", from: "generic, mine", to: "generic, breakfast" })
  assert.equal(update.title, "Corn flakes", "the plan names the row as the shop does")
  assert.equal(update.properties[PROPS.title].title[0].text.content, "Corn flakes")
  assert.equal(update.properties[PROPS.description].rich_text[0].text.content, "Toasted corn cereal. Mostly flakes.")
  assert.deepEqual(update.properties[PROPS.category], { select: { name: "Breakfast cereal" } })
  assert.deepEqual(update.properties[PROPS.tags], { multi_select: [{ name: "generic" }, { name: "breakfast" }] })
  // the same tags in another order are the same tags
  const reordered = planImport([existing({ ...CORN_WORDS, importId: "shopify:7001", tags: ["generic", "breakfast"] })], fromShopify([shopifyProduct()]), "shopify").update[0]
  assert.ok(!reordered.changes.some((c) => c.field === "tags"))
})

test("plan: a field the shop leaves blank is Notion's to fill", () => {
  const bare = fromShopify([shopifyProduct({ descriptionHtml: "", productType: "", tags: [] })])
  const row = existing({ importId: "shopify:7001", description: "Ours.", category: "Snacks", tags: ["mine"], body: [block("x", "heading_2", "Our own words")] })
  const [update] = planImport([row], bare, "shopify").update
  for (const name of [PROPS.description, PROPS.category, PROPS.tags]) assert.ok(!(name in update.properties), `${name} is left`)
  assert.equal(update.body, undefined, "and so is the page")
  assert.deepEqual(rowsToRead([row], bare), [], "whose blocks are not even read")
})

test("plan: a row's page is rewritten when it is not the shop's description, and only when it was read", () => {
  const mapped = fromShopify([shopifyProduct()])
  assert.equal(bodyText(CORN_BODY), "Toasted corn cereal. Mostly flakes.\n\n- Net wt 12 oz\n- Keep dry")
  assert.equal(bodyText(bodyBlocks(mapped.products[0].description)), bodyText(CORN_BODY), "what the import writes reads back as itself")
  assert.equal(bodyText([...CORN_BODY, block("b4", "paragraph", " ")]), bodyText(CORN_BODY), "a blank line left at the foot is no difference")
  // a block the import never writes can never pass for the platform's
  assert.equal(bodyText([block("h", "heading_2", "Sizes"), block("n", "bulleted_list_item", "S", { has_children: true }), { id: "i", type: "image", image: {} }]), "[heading_2]\n\n[bulleted_list_item]\n\n[image]")

  const reworded = [block("b1", "paragraph", "A softer tee, as rewritten in Notion."), block("b9", "image", "")]
  const [update] = planImport([existing({ ...CORN_WORDS, importId: "shopify:7001", body: reworded })], mapped, "shopify").update
  assert.deepEqual(update.changes.find((c) => c.field === "details"), { field: "details", from: "2 blocks", to: "3 blocks" })
  assert.deepEqual(update.body.remove, ["b1", "b9"])
  assert.deepEqual(update.body.children.map((b) => b.type), ["paragraph", "bulleted_list_item", "bulleted_list_item"])
  assert.ok(!planImport([existing({ ...CORN_WORDS, importId: "shopify:7001" })], mapped, "shopify").update[0].changes.some((c) => c.field === "details"), "a page nobody read is not judged")

  // which pages to read: the rows a described product lines up with
  const rows = [existing({ id: "a", importId: "shopify:7001" }), existing({ id: "b", slug: "corn-flakes" }), existing({ id: "c", slug: "other" }), existing({ id: "d", importId: "printify:1", slug: "corn-flakes" })]
  assert.deepEqual(rowsToRead(rows, mapped).map((r) => r.id), ["a", "b"])
})

test("plan: a row written by hand at the same address is adopted, not duplicated", () => {
  const plan = planImport([existing({ id: "hand", title: "Corn Flakes", price: 2.5, compareAt: 3 })], fromShopify([shopifyProduct()]), "shopify")
  assert.equal(plan.create.length, 0)
  const [update] = plan.update
  assert.equal(update.id, "hand")
  assert.deepEqual(update.changes[0], { field: "import ID", from: "none", to: "shopify:7001" })
})

test("plan: two rows with no address are not the same row", () => {
  // neither title makes a slug, so neither has an address to share
  const plan = planImport([existing({ id: "hand", title: "!!!", price: 99 })], fromShopify([shopifyProduct({ handle: "???", title: "???" })]), "shopify")
  assert.equal(plan.update.length, 0, "the hand-written row is left alone")
  assert.equal(plan.create.length, 1)
})

test("plan: the same pictures described differently in the shop get their new descriptions; described alike, nothing changes", () => {
  const mapped = fromShopify([shopifyProduct()])
  const urls = { cover: ["https://cdn.shopify.example/files/corn-flakes.jpg?v=1"], gallery: ["https://cdn.shopify.example/files/corn-flakes-back.jpg"] }
  // a row made before descriptions were imported: named after its files
  const old = planImport([existing({ importId: "shopify:7001", ...urls, coverNames: ["corn-flakes.jpg"], galleryNames: ["corn-flakes-back.jpg"] })], mapped, "shopify").update[0]
  const change = old.changes.find((c) => c.field === "picture descriptions")
  assert.ok(change, old.changes.map((c) => c.field).join(", "))
  assert.equal(change.from, "2 changed")
  assert.deepEqual([...old.properties[PROPS.cover].files, ...old.properties[PROPS.gallery].files].map((f) => f.name), ["The box", "The back"])
  const same = planImport([existing({ importId: "shopify:7001", ...urls, coverNames: ["The box"], galleryNames: ["The back"] })], mapped, "shopify").update[0]
  assert.ok(!same?.changes.some((c) => c.field.startsWith("picture")), "nothing to write")
  // Printify has no alt text: its pictures keep their file names, and nothing changes
  const mug = fromPrintify([printifyProduct()], "GBP")
  const mugRow = existing({ importId: "printify:5d39b159e7c48c000728c89f", cover: ["https://images.printify.example/mug-11oz.png"], gallery: ["https://images.printify.example/mug-15oz.png"], coverNames: ["mug-11oz.png"], galleryNames: ["mug-15oz.png"] })
  assert.ok(!planImport([mugRow], mug, "printify").update[0]?.changes.some((c) => c.field.startsWith("picture")))
  // a description an editor gave a picture in Notion stands when the platform has none, even when the pictures change
  const described = existing({ importId: "printify:5d39b159e7c48c000728c89f", cover: ["https://images.printify.example/mug-11oz.png"], gallery: ["https://images.printify.example/old.png"], coverNames: ["A white mug, handle to the right"], galleryNames: ["An old mockup"] })
  const swapped = planImport([described], mug, "printify").update[0]
  assert.deepEqual([...swapped.properties[PROPS.cover].files, ...swapped.properties[PROPS.gallery].files].map((f) => f.name), ["A white mug, handle to the right", "mug-15oz.png"])
})

test("plan: pictures uploaded in Notion are kept; addresses are replaced when the platform's differ", () => {
  const mapped = fromShopify([shopifyProduct()])
  const kept = planImport([existing({ importId: "shopify:7001", cover: ["https://notion.example/upload.png"], uploaded: true })], mapped, "shopify")
  const [row] = kept.update
  assert.ok(!(PROPS.cover in row.properties) && !(PROPS.gallery in row.properties), "the editor's pictures are not touched")
  assert.equal(row.note, "pictures kept: uploaded in Notion", "and the plan says why")
  const swapped = planImport([existing({ importId: "shopify:7001", cover: ["https://old.example/a.jpg"] })], mapped, "shopify").update[0]
  assert.equal(swapped.properties[PROPS.cover].files[0].external.url, "https://cdn.shopify.example/files/corn-flakes.jpg?v=1")
  assert.equal(swapped.properties[PROPS.gallery].files[0].external.url, "https://cdn.shopify.example/files/corn-flakes-back.jpg")
})

test("plan: a Printify import leaves compare-at prices and checkout IDs alone", () => {
  const rows = [existing({ ...MUG_WORDS, category: "Kitchen", importId: "printify:5d39b159e7c48c000728c89f", price: 12.99, currency: "USD", compareAt: 20, checkoutId: "Hand: 40000000000001", link: "https://generic.printify.me/product/123/generic-mug", cover: ["https://images.printify.example/mug-11oz.png"], gallery: ["https://images.printify.example/mug-15oz.png"] })]
  const plan = planImport(rows, fromPrintify([printifyProduct()], "USD"), "printify")
  assert.equal(plan.update.length, 0, JSON.stringify(plan.update))
  assert.equal(plan.unchanged.length, 1)
})

test("plan: nothing is deleted; rows the platform no longer has are reported, hand-written ones left out of it", () => {
  const rows = [existing({ id: "old", title: "Discontinued", importId: "shopify:1" }), existing({ id: "mine", title: "Handmade", slug: "handmade" }), existing({ id: "pf", title: "Mug", importId: "printify:9" })]
  const plan = planImport(rows, fromShopify([shopifyProduct()]), "shopify")
  assert.deepEqual(plan.gone, [{ id: "old", title: "Discontinued" }])
  assert.deepEqual(plan.byHand, [{ id: "mine", title: "Handmade" }], "a row no shop knows is named, since nothing keeps it in step")
  assert.equal(plan.update.length + plan.unchanged.length, 0)
})

test("plan: an address another row holds gets a free one, said in the plan; a product listed twice is made once", () => {
  const rows = [existing({ id: "other", slug: "corn-flakes", importId: "printify:abc" }), existing({ id: "other2", slug: "corn-flakes-2", importId: "printify:def" })]
  const plan = planImport(rows, fromShopify([shopifyProduct(), shopifyProduct()]), "shopify")
  assert.equal(plan.create.length, 1)
  assert.equal(plan.create[0].slug, "corn-flakes-3")
  assert.match(plan.create[0].note, /corn-flakes is another row's/)
  assert.equal(plan.create[0].properties[PROPS.slug].rich_text[0].text.content, "corn-flakes-3")
})

// ------------------------------------------------------------------ the Shopify client

/** A stand-in Storefront API: products a page at a time, by cursor. */
function fakeShopify({ products, variantPages = {}, failFirst, costLimit } = {}) {
  const calls = []
  let failures = failFirst ? [...failFirst] : []
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url, headers: init.headers, method: init.method, body })
    const failure = failures.shift()
    if (failure) return new Response("busy", { status: failure, headers: { "retry-after": "1" } })
    if (body.query === VARIANTS_QUERY) {
      const page = variantPages[body.variables.after]
      return Response.json({ data: { product: { variants: page } } })
    }
    const { first, after } = body.variables
    if (costLimit && first > costLimit) return Response.json({ errors: [{ message: "Query cost is 2000, which exceeds the limit", extensions: { code: "MAX_COST_EXCEEDED" } }] })
    const start = after ? Number(after) : 0
    const nodes = products.slice(start, start + first)
    const end = start + nodes.length
    return Response.json({ data: { products: { pageInfo: { hasNextPage: end < products.length, endCursor: String(end) }, nodes } } })
  }
  return { fetch, calls }
}

test("Shopify client: the Storefront API at the shop's address, its token in its own header, page after page", async () => {
  const products = Array.from({ length: 5 }, (_, n) => shopifyProduct({ id: gid("Product", n + 1), handle: `p${n}` }))
  const fake = fakeShopify({ products })
  const got = await fetchShopify({ domain: "generic.myshopify.com", token: "shpat-fake-token", fetch: fake.fetch, sleep: noSleep, pageSize: 2 })
  assert.equal(got.length, 5)
  assert.equal(fake.calls.length, 3)
  const [first, second] = fake.calls
  assert.equal(first.url, `https://generic.myshopify.com/api/${SHOPIFY_API_VERSION}/graphql.json`)
  assert.equal(first.method, "POST")
  assert.equal(first.headers["X-Shopify-Storefront-Access-Token"], "shpat-fake-token")
  assert.equal(first.body.query, PRODUCTS_QUERY)
  assert.deepEqual(first.body.variables, { first: 2, after: null })
  assert.deepEqual(second.body.variables, { first: 2, after: "2" })
  assert.match(PRODUCTS_QUERY, /descriptionHtml/)
  assert.doesNotMatch(PRODUCTS_QUERY, /quantityAvailable/, "inventory counts need a scope a public token lacks")
})

test("Shopify client: a product's variants past the first hundred are fetched too", async () => {
  const product = shopifyProduct({
    variants: { pageInfo: { hasNextPage: true, endCursor: "v1" }, nodes: [shopifyProduct().variants.nodes[0]] },
  })
  const more = { id: gid("ProductVariant", 40000000000777), title: "XL", availableForSale: true, price: money("5.00") }
  const fake = fakeShopify({ products: [product], variantPages: { v1: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [more] } } })
  const [got] = await fetchShopify({ domain: "generic.myshopify.com", token: "t", fetch: fake.fetch, sleep: noSleep })
  assert.deepEqual(got.variants.nodes.map((v) => v.title), ["Large", "XL"])
  assert.deepEqual(fake.calls[1].body.variables, { id: product.id, after: "v1" })
})

test("Shopify client: a query that costs too much is asked again for fewer products; busy answers are retried", async () => {
  const products = Array.from({ length: 3 }, (_, n) => shopifyProduct({ id: gid("Product", n + 1) }))
  const logs = []
  const costly = fakeShopify({ products, costLimit: 12 })
  assert.equal((await fetchShopify({ domain: "generic.myshopify.com", token: "t", fetch: costly.fetch, sleep: noSleep, log: (l) => logs.push(l) })).length, 3)
  assert.deepEqual(costly.calls.map((c) => c.body.variables.first), [50, 25, 12])
  assert.match(logs[0], /too costly; asking for 25 products a page/)
  const sleeps = []
  const busy = fakeShopify({ products, failFirst: [429, 503] })
  await fetchShopify({ domain: "generic.myshopify.com", token: "t", fetch: busy.fetch, sleep: async (ms) => sleeps.push(ms) })
  assert.deepEqual(sleeps, [1000, 1000], "Retry-After is honoured")
})

test("Shopify client: a refused token says which setting to fix, and never prints the token", async () => {
  const fetch = async () => new Response("Unauthorized", { status: 401 })
  await assert.rejects(fetchShopify({ domain: "generic.myshopify.com", token: "shpat-secret-value", fetch, sleep: noSleep }), (error) => {
    assert.ok(error instanceof ImportError)
    assert.match(error.message, /SHOPIFY_STOREFRONT_TOKEN/)
    assert.ok(!error.message.includes("shpat-secret-value"))
    return true
  })
  const missing = async () => new Response("Not Found", { status: 404 })
  await assert.rejects(fetchShopify({ domain: "nowhere.myshopify.com", token: "t", fetch: missing, sleep: noSleep }), /SHOPIFY_STORE_DOMAIN/)
  const graphql = async () => Response.json({ errors: [{ message: "Field 'nope' doesn't exist" }] })
  await assert.rejects(fetchShopify({ domain: "generic.myshopify.com", token: "t", fetch: graphql, sleep: noSleep }), /refused the query: Field 'nope'/)
})

test("Shopify versions: a quarter's or unstable, nothing else", () => {
  assert.equal(shopifyVersion("2026-07"), "2026-07")
  assert.equal(shopifyVersion("unstable"), "unstable")
  assert.equal(shopifyVersion("2026-08"), undefined)
  assert.equal(shopifyVersion("latest"), undefined)
  assert.ok(shopifyVersion(SHOPIFY_API_VERSION))
})

// ------------------------------------------------------------------ the Printify client

function fakePrintify({ products = [], perPage = 2, refuseLimit = false, status, shops = [] } = {}) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, headers: init?.headers })
    if (status) return new Response("nope", { status })
    const u = new URL(url)
    if (u.pathname === "/v1/shops.json") return Response.json(shops)
    if (refuseLimit && u.searchParams.has("limit")) return Response.json({ status: "error", errors: { limit: ["The limit may not be greater than 20."] } }, { status: 400 })
    const page = Number(u.searchParams.get("page"))
    const size = Number(u.searchParams.get("limit") ?? perPage)
    const data = products.slice((page - 1) * size, page * size)
    return Response.json({ current_page: page, data, last_page: Math.max(1, Math.ceil(products.length / size)), total: products.length })
  }
  return { fetch, calls }
}

test("Printify client: every page of products, the token as a bearer, the template named as the client", async () => {
  const products = Array.from({ length: 5 }, (_, n) => printifyProduct({ id: `p${n}` }))
  const fake = fakePrintify({ products })
  const got = await fetchPrintify({ token: "pfy-fake", shopId: "123", fetch: fake.fetch, sleep: noSleep, limit: 2 })
  assert.deepEqual(got.map((p) => p.id), ["p0", "p1", "p2", "p3", "p4"])
  assert.deepEqual(fake.calls.map((c) => new URL(c.url).search), ["?page=1&limit=2", "?page=2&limit=2", "?page=3&limit=2"])
  assert.equal(new URL(fake.calls[0].url).pathname, "/v1/shops/123/products.json")
  assert.equal(fake.calls[0].headers.Authorization, "Bearer pfy-fake")
  assert.equal(fake.calls[0].headers["User-Agent"], PRINTIFY_USER_AGENT)
  assert.doesNotMatch(PRINTIFY_USER_AGENT, /@/, "the client is named, not the person running it")
})

test("Printify client: a page size it refuses is dropped for its own; a refused token or shop says what to fix", async () => {
  const fake = fakePrintify({ products: Array.from({ length: 3 }, (_, n) => printifyProduct({ id: `p${n}` })), refuseLimit: true, perPage: 2 })
  const logs = []
  const got = await fetchPrintify({ token: "t", shopId: "123", fetch: fake.fetch, sleep: noSleep, log: (l) => logs.push(l) })
  assert.equal(got.length, 3)
  assert.match(logs[0], /its own page size/)
  await assert.rejects(fetchPrintify({ token: "pfy-secret", shopId: "1", fetch: fakePrintify({ status: 401 }).fetch, sleep: noSleep }), (error) => {
    assert.match(error.message, /PRINTIFY_API_TOKEN/)
    assert.ok(!error.message.includes("pfy-secret"))
    return true
  })
  await assert.rejects(fetchPrintify({ token: "t", shopId: "999", fetch: fakePrintify({ status: 404 }).fetch, sleep: noSleep }), /no shop 999/)
  const shops = await listPrintifyShops({ token: "t", fetch: fakePrintify({ shops: [{ id: 123, title: "Generic goods", sales_channel: "shopify" }] }).fetch, sleep: noSleep })
  assert.deepEqual(shops, [{ id: "123", title: "Generic goods", channel: "shopify" }])
})

// ------------------------------------------------------------------ the command

/** A Notion client that records every call. */
function recordingNotion({ rows = [], properties, bodies = {} } = {}) {
  const calls = []
  const props = properties ?? Object.fromEntries(SCHEMA.map((p) => [p.name, { type: p.type }]))
  return {
    calls,
    databases: { retrieve: async (body) => (calls.push(["databases.retrieve", body]), { data_sources: [{ id: "ds-1", name: "Content" }] }) },
    dataSources: {
      retrieve: async (body) => (calls.push(["dataSources.retrieve", body]), { properties: props }),
      query: async (body) => (calls.push(["dataSources.query", body]), { results: rows, has_more: false, next_cursor: null }),
      update: async (body) => (calls.push(["dataSources.update", body]), {}),
    },
    blocks: {
      children: {
        // two blocks a page, so a long body is read to its end
        list: async (body) => {
          calls.push(["blocks.children.list", body])
          const all = bodies[body.block_id] ?? []
          const from = body.start_cursor ? Number(body.start_cursor) : 0
          const more = from + 2 < all.length
          return { results: all.slice(from, from + 2), has_more: more, next_cursor: more ? String(from + 2) : null }
        },
        append: async (body) => (calls.push(["blocks.children.append", body]), {}),
      },
      delete: async (body) => (calls.push(["blocks.delete", body]), {}),
    },
    pages: {
      create: async (body) => (calls.push(["pages.create", body]), { id: "new" }),
      update: async (body) => (calls.push(["pages.update", body]), { id: body.page_id }),
    },
  }
}

const SHOP_ENV = {
  SHOPIFY_STORE_DOMAIN: "https://Generic.myshopify.com/",
  SHOPIFY_STOREFRONT_TOKEN: "storefront-secret",
  NOTION_DATABASE_ID: "0123456789abcdef0123456789abcdef",
  NOTION_TOKEN: "site-read-secret",
}

async function run(args, env, { notion = recordingNotion(), fetch = fakeShopify({ products: [shopifyProduct()] }).fetch } = {}) {
  const lines = []
  const tokens = []
  const code = await runImport({ args, env, fetch, sleep: noSleep, notion: (token) => (tokens.push(token), notion), log: (line) => lines.push(line) })
  const out = lines.join("\n")
  for (const secret of ["storefront-secret", "site-read-secret", "import-write-secret", "pfy-secret"]) assert.ok(!out.includes(secret), `${secret} printed`)
  return { code, out, notion, tokens }
}

const writes = (notion) => notion.calls.filter(([name]) => ["pages.create", "pages.update", "dataSources.update", "blocks.delete", "blocks.children.append"].includes(name))

test("command: a dry run reads Shopify and Notion, prints the plan, and writes nothing", async () => {
  const notion = recordingNotion({ rows: [productRow({ id: "row-old", title: "Discontinued", importId: "shopify:1" })] })
  const { code, out, tokens } = await run([], SHOP_ENV, { notion })
  assert.equal(code, 0)
  assert.deepEqual(tokens, ["site-read-secret"], "a dry run reads with the site's own token")
  assert.deepEqual(writes(notion), [])
  const query = notion.calls.find(([name]) => name === "dataSources.query")[1]
  assert.deepEqual(query.filter, { property: PROPS.kind, select: { equals: "Product" } }, "every Product row, published or not")
  assert.match(out, /Reading products from Shopify \(generic\.myshopify\.com\)/)
  assert.match(out, /\+ Corn flakes: \/shop\/corn-flakes · 2\.50 GBP · in stock · 2 pictures · 2 variants · buy link/)
  assert.match(out, /No longer in Shopify, left as they are[\s\S]*\? Discontinued/)
  assert.match(out, /Dry run: nothing was written/)
  const byHand = await run([], SHOP_ENV, { notion: recordingNotion({ rows: [productRow({ id: "hand", title: "Handmade", slug: "handmade" })] }) })
  assert.match(byHand.out, /Typed into Notion, and not in Shopify[\s\S]*! Handmade/)
})

test("command: --write needs an import token of its own, and asks the platform nothing without one", async () => {
  let asked = 0
  const fetch = async () => (asked++, Response.json({}))
  const { code, out } = await run(["--write"], SHOP_ENV, { fetch })
  assert.equal(code, 1)
  assert.match(out, /NOTION_IMPORT_TOKEN/)
  assert.equal(asked, 0)
})

test("command: --write makes the new rows, changes the old, and adds a missing property first", async () => {
  const properties = Object.fromEntries(SCHEMA.filter((p) => p.name !== PROPS.importId).map((p) => [p.name, { type: p.type }]))
  const notion = recordingNotion({ rows: [productRow({ id: "row-drink", title: "Drink", slug: "drink", price: 1 })], properties, bodies: { "row-drink": CORN_BODY } })
  const products = [shopifyProduct(), shopifyProduct({ id: gid("Product", 7002), handle: "drink", title: "Drink" })]
  const { code, out, tokens } = await run(["--write"], { ...SHOP_ENV, NOTION_IMPORT_TOKEN: "import-write-secret" }, { notion, fetch: fakeShopify({ products }).fetch })
  assert.equal(code, 0, out)
  assert.deepEqual(tokens, ["import-write-secret"])
  const [[first, addProps], [second, create], [third, update]] = writes(notion)
  assert.equal(first, "dataSources.update")
  assert.deepEqual(Object.keys(addProps.properties), [PROPS.importId])
  assert.equal(addProps.properties[PROPS.importId].rich_text !== undefined, true)
  assert.equal(second, "pages.create")
  assert.deepEqual(create.parent, { type: "data_source_id", data_source_id: "ds-1" })
  assert.deepEqual(create.properties[PROPS.published], { checkbox: false })
  assert.ok(create.children.length > 0)
  assert.equal(third, "pages.update")
  assert.equal(update.page_id, "row-drink")
  assert.ok(update.properties[PROPS.importId], "the hand-written row is adopted")
  assert.equal(update.properties[PROPS.description].rich_text[0].text.content, "Toasted corn cereal. Mostly flakes.", "and its line is the shop's again")
  for (const name of THE_EDITORS) assert.ok(!(name in update.properties), `${name} stays the editor's`)
  assert.equal(writes(notion).length, 3, "a page already the shop's is not rewritten")
  assert.match(out, /Done: 1 row made, 1 changed/)
  assert.match(out, /tick Published/)
})

test("command: a description rewritten in Notion is shown in the dry run, and --write puts the shop's back", async () => {
  const mine = [block("m1", "paragraph", "A softer tee."), block("m2", "paragraph", "Rewritten in Notion."), block("m3", "image", "")]
  const inStep = { ...CORN_WORDS, importId: "shopify:7001", price: 2.5, compareAt: 3, link: "https://generic.example/products/corn-flakes", checkoutId: "Small 12 oz: 40000000000012\nMedium: 40000000000013", cover: ["https://cdn.shopify.example/files/corn-flakes.jpg?v=1"], gallery: ["https://cdn.shopify.example/files/corn-flakes-back.jpg"], coverNames: ["The box"], galleryNames: ["The back"] }
  const setup = () => recordingNotion({ rows: [productRow({ ...inStep, id: "row-tee" })], bodies: { "row-tee": mine } })

  const dry = await run([], SHOP_ENV, { notion: setup() })
  assert.match(dry.out, /~ Corn flakes: details 3 blocks → 3 blocks/)
  assert.deepEqual(writes(dry.notion), [])
  assert.deepEqual(await readBody(dry.notion, "row-tee"), { text: "A softer tee.\n\nRewritten in Notion.\n\n[image]", blockIds: ["m1", "m2", "m3"] }, "every page of blocks is read")

  const { code, notion } = await run(["--write"], { ...SHOP_ENV, NOTION_IMPORT_TOKEN: "import-write-secret" }, { notion: setup() })
  assert.equal(code, 0)
  const made = writes(notion)
  assert.deepEqual(made.map(([name, body]) => [name, body.block_id]), [["blocks.children.append", "row-tee"], ["blocks.delete", "m1"], ["blocks.delete", "m2"], ["blocks.delete", "m3"]], "only the page, and the shop's words in before the old come out")
  assert.equal(bodyText(made[0][1].children), bodyText(CORN_BODY))

  // Notion refuses the new words: nothing of the old page is taken out
  const refusing = setup()
  refusing.blocks.children.append = async (body) => {
    refusing.calls.push(["blocks.children.append", body])
    throw new Error("rate limited")
  }
  const refused = await run(["--write"], { ...SHOP_ENV, NOTION_IMPORT_TOKEN: "import-write-secret" }, { notion: refusing })
  assert.equal(refused.code, 3)
  assert.match(refused.out, /Could not change "Corn flakes": rate limited/)
  assert.deepEqual(writes(refusing).filter(([name]) => name === "blocks.delete"), [], "a failed import destroys nothing")

  // in step in every field: nothing to do, and nothing written
  const settled = recordingNotion({ rows: [productRow({ ...inStep, id: "row-tee" })], bodies: { "row-tee": CORN_BODY } })
  const again = await run(["--write"], { ...SHOP_ENV, NOTION_IMPORT_TOKEN: "import-write-secret" }, { notion: settled })
  assert.match(again.out, /Already up to date \(1\)/)
  assert.deepEqual(writes(settled), [])
})

test("command: a description longer than Notion takes in one request is written whole, a hundred blocks at a time", async () => {
  const long = Array.from({ length: 230 }, (_, n) => `<p>Paragraph ${n + 1}.</p>`).join("")
  const [product] = fromShopify([shopifyProduct({ descriptionHtml: long })]).products
  assert.equal(bodyBlocks(product.description).length, 230, "nothing is cut")
  assert.deepEqual(blockBatches(bodyBlocks(product.description)).map((b) => b.length), [100, 100, 30])
  assert.deepEqual(blockBatches([]), [])
  const env = { ...SHOP_ENV, NOTION_IMPORT_TOKEN: "import-write-secret" }

  // a new row: made with the first hundred, the rest appended to the page it made
  const fresh = recordingNotion()
  await run(["--write"], env, { notion: fresh, fetch: fakeShopify({ products: [shopifyProduct({ descriptionHtml: long })] }).fetch })
  const made = writes(fresh)
  assert.deepEqual(made.map(([name, body]) => [name, body.block_id, body.children.length]), [["pages.create", undefined, 100], ["blocks.children.append", "new", 100], ["blocks.children.append", "new", 30]])
  assert.equal(made[2][1].children[29].paragraph.rich_text[0].text.content, "Paragraph 230.")

  // an old row: every batch appended, then the old blocks out
  const old = recordingNotion({ rows: [productRow({ id: "row-long", importId: "shopify:7001" })], bodies: { "row-long": [block("o1", "paragraph", "Old words.")] } })
  await run(["--write"], env, { notion: old, fetch: fakeShopify({ products: [shopifyProduct({ descriptionHtml: long })] }).fetch })
  const page = writes(old).filter(([name]) => name.startsWith("blocks."))
  assert.deepEqual(page.map(([name, body]) => [name, body.children?.length ?? body.block_id]), [["blocks.children.append", 100], ["blocks.children.append", 100], ["blocks.children.append", 30], ["blocks.delete", "o1"]])
})

test("command: the site's own token given as the import's is written with, and warned about", async () => {
  const { out } = await run(["--write"], { ...SHOP_ENV, NOTION_IMPORT_TOKEN: "site-read-secret" })
  assert.match(out, /is the site's own NOTION_TOKEN/)
})

test("command: which platform, a wrongly typed property, and a Printify shop to choose", async () => {
  assert.deepEqual(chooseSource([], { SHOPIFY_STOREFRONT_TOKEN: "a" }), { source: "shopify" })
  assert.deepEqual(chooseSource(["--from=printify"], { SHOPIFY_STOREFRONT_TOKEN: "a" }), { source: "printify" })
  assert.match(chooseSource([], { SHOPIFY_STOREFRONT_TOKEN: "a", PRINTIFY_API_TOKEN: "b" }).error, /--from shopify or --from printify/)
  assert.match(chooseSource(["--from", "etsy"], {}).error, /not "etsy"/)

  const wrong = recordingNotion({ properties: { ...Object.fromEntries(SCHEMA.map((p) => [p.name, { type: p.type }])), [PROPS.price]: { type: "rich_text" } } })
  const typed = await run([], SHOP_ENV, { notion: wrong })
  assert.equal(typed.code, 3)
  assert.match(typed.out, /"Price" is rich_text; the import writes number/)
  assert.deepEqual(propertyGaps({ Name: { type: "title" }, Kind: { type: "select" } }).missing.includes(PROPS.title), false, "the title may be called anything")

  // a database made before Image was renamed: its Cover Image is written, and no Image is added beside it
  const { [PROPS.cover]: image, ...older } = Object.fromEntries(SCHEMA.map((p) => [p.name, { type: p.type }]))
  const gaps = propertyGaps({ ...older, "Cover Image": image })
  assert.equal(gaps.missing.includes(PROPS.cover), false)
  assert.deepEqual(gaps.renamed, { [PROPS.cover]: "Cover Image" })
  assert.deepEqual(asNamed({ [PROPS.cover]: { files: [] }, [PROPS.price]: { number: 1 } }, gaps.renamed), { "Cover Image": { files: [] }, [PROPS.price]: { number: 1 } })

  const shops = fakePrintify({ shops: [{ id: 123, title: "Generic goods", sales_channel: "pop-up" }] })
  const choose = await run(["--from", "printify"], { PRINTIFY_API_TOKEN: "pfy-secret" }, { fetch: shops.fetch })
  assert.equal(choose.code, 1)
  assert.match(choose.out, /PRINTIFY_SHOP_ID is not set[\s\S]*123 {2}Generic goods \(pop-up\)/)
})

test("command: Printify end to end, without Notion set up: everything shown as new", async () => {
  const fake = fakePrintify({ products: [printifyProduct()] })
  const { code, out } = await run([], { PRINTIFY_API_TOKEN: "pfy-secret", PRINTIFY_SHOP_ID: "123", PRINTIFY_CURRENCY: "gbp" }, { fetch: fake.fetch })
  assert.equal(code, 0)
  assert.match(out, /Notion is not set up here/)
  assert.match(out, /\+ Generic mug: \/shop\/generic-mug · 12\.99 GBP · in stock · 2 pictures · buy link/)
})

test("command: a platform that cannot be read is exit 2, with the reason", async () => {
  const { code, out } = await run([], SHOP_ENV, { fetch: async () => new Response("no", { status: 401 }) })
  assert.equal(code, 2)
  assert.match(out, /Shopify refused the Storefront token/)
})

test("the plan's words: a count with its word, plural unless it is one, and a price with its currency", () => {
  assert.equal(plural(1, "picture"), "1 picture")
  assert.equal(plural(0, "variant"), "0 variants")
  assert.equal(plural(3, "Product row"), "3 Product rows")
  assert.equal(planMoney(4.5, "GBP"), "4.50 GBP")
  assert.equal(planMoney(12, "USD"), "12 USD")
  assert.equal(planMoney(3), "3")
  assert.equal(planMoney(undefined, "GBP"), "none")
  assert.equal(planMoney(undefined, "GBP", "no price"), "no price")
})
