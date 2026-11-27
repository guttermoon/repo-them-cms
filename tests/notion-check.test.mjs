// `npm run notion:check` (lib/notion/check.ts): the database's properties
// against the contract in lib/notion/schema.ts, and the published rows the
// site would skip or read differently from what the editor meant.
import { test } from "node:test"
import assert from "node:assert/strict"

import { readFileSync } from "node:fs"

import { checkCopyKeys, checkEntrySearchWords, checkMissingSlots, textRowKeys, checkPictures, checkProductPictures, checkRows, checkSchema, checkSearchWords, checkStatusRows, checkUnreadRows, liveStatuses, statusQuery } from "../lib/notion/check.ts"
import { EDITOR_STATUS, PROPS, SCHEMA } from "../lib/notion/schema.ts"
import { DEMO_ROWS } from "../lib/demo/content.ts"
import { fakeId, hostedFiles, rowResponse } from "../lib/demo/notion-shape.ts"

const full = Object.fromEntries(SCHEMA.map((p) => [p.name, { type: p.type }]))
const rows = (list) => list.map((row, n) => rowResponse(row, fakeId(`check/${n}`), "2026-11-23T09:00:00.000Z", hostedFiles("http://files.test")))

test("a database made by notion:setup has nothing to report", () => {
  assert.deepEqual(checkSchema(full), [])
})

test("a missing required property is an error; a missing optional one a warning", () => {
  const { [PROPS.kind]: _kind, [PROPS.tags]: _tags, ...rest } = full
  const findings = checkSchema(rest)
  assert.ok(findings.some((f) => f.level === "error" && f.message.includes(`"${PROPS.kind}"`)))
  assert.ok(findings.some((f) => f.level === "warning" && f.message.includes(`"${PROPS.tags}"`)))
})

test("a property under its former name is not missing: the check suggests the new one", () => {
  const { [PROPS.cover]: image, ...rest } = full
  const findings = checkSchema({ ...rest, "Cover Image": image })
  assert.deepEqual(findings, [{ level: "info", message: `"Cover Image" is now called "${PROPS.cover}". The site reads either; rename it in Notion (the property's menu, Rename) to match the template.` }])
})

test("a Kind under its former name is named, with the one it became: the site reads either", () => {
  const kinds = (names) => ({ ...full, [PROPS.kind]: { type: "select", select: { options: names.map((name) => ({ name })) } } })
  assert.deepEqual(checkSchema(kinds(["Site Copy", "Logo", "Quote"])), [
    { level: "info", message: 'The Kind "Logo" is now called "Proof Logos". The site reads either; rename the option in Notion (Kind\'s menu, Edit property) to match the template.' },
  ])
  assert.deepEqual(checkSchema(kinds(["Site Copy", "Proof Logos", "Quote"])), [], "renamed: nothing to say")
  assert.ok(SCHEMA.find((p) => p.name === PROPS.kind).options.some((o) => o.name === "Proof Logos"), "the setup makes the new name")
  assert.ok(!SCHEMA.find((p) => p.name === PROPS.kind).options.some((o) => o.name === "Logo"), "and never the old one")
})

test("a property the site no longer reads is named, with where its contents go", () => {
  const findings = checkSchema({ ...full, "Author Image": { type: "files" }, "Author Photo Credit": { type: "rich_text" } })
  assert.deepEqual(findings, [
    { level: "info", message: `"Author Image" is no longer read. A person has one picture: their Person row's Image, shown on the team page and on every post they write. Move the picture there, then delete this property.` },
    { level: "info", message: `"Author Photo Credit" is no longer read. The site no longer prints a credit under a person's picture. Delete this property, or put a credit a photographer asks for in the person's Text.` },
  ])
  for (const retired of ["Author Image", "Author Photo Credit"]) assert.ok(!SCHEMA.some((p) => p.name === retired), `the setup no longer makes ${retired}`)
})

test("a property of the wrong type says what the site reads it as", () => {
  const findings = checkSchema({ ...full, [PROPS.published]: { type: "status" } })
  assert.deepEqual(findings, [{ level: "error", message: `Property "${PROPS.published}" is status; the site reads it as checkbox.` }])
})

test("the starter content reads cleanly, every kind counted", () => {
  const { counts, findings } = checkRows(rows(DEMO_ROWS))
  assert.deepEqual(findings, [])
  assert.equal(counts["Site Copy"], DEMO_ROWS.filter((r) => r.kind === "Site Copy").length)
  assert.equal(counts.Post, DEMO_ROWS.filter((r) => r.kind === "Post").length)
  assert.equal(counts.Redirect, 2)
  assert.equal(counts.skipped, 0)
})

test("the rows the site would skip, or read differently, are each reported", () => {
  const base = { published: true }
  const { counts, findings } = checkRows(
    rows([
      { ...base, kind: undefined, title: "Kindless" },
      { ...base, kind: "Page", title: "Clash", slug: "blog/mine" },
      { ...base, kind: "Redirect", title: "bad", link: "javascript:alert(1)" },
      { ...base, kind: "Resource", title: "No link" },
      { ...base, kind: "Post", title: "One", slug: "same" },
      { ...base, kind: "Post", title: "Two", slug: "same" },
    ]),
  )
  const said = findings.map((f) => `${f.level}: ${f.message}`).join("\n")
  assert.match(said, /warning: "Kindless" is published but has no Kind/)
  assert.match(said, /error: Page "Clash" wants \/blog\/mine, which the site already uses/)
  assert.match(said, /error: Redirect "bad" goes to "javascript:alert\(1\)"/)
  assert.match(said, /warning: Resource "No link" has no Link/)
  assert.match(said, /warning: Posts "One" and "Two" share the address same/)
  assert.equal(counts.skipped, 1)
})

test("a page's search title or description reworded in Notion is measured against what a result prints whole", () => {
  assert.deepEqual(checkSearchWords("meta.pricing.title", "Prices"), [])
  assert.equal(checkSearchWords("meta.pricing.title", "A title far too long to be printed whole in any search result")[0].level, "warning")
  assert.equal(checkSearchWords("meta.blog.description", "Too short.")[0].level, "warning")
  assert.deepEqual(checkSearchWords("meta.blog.description", "x".repeat(150)), [])
  // not a designed page's, and a blank row (which falls back): nothing to say
  assert.deepEqual(checkSearchWords("meta.post.description", "Short."), [])
  assert.deepEqual(checkSearchWords("meta.blog.description", "   "), [])
  assert.deepEqual(checkSearchWords("hero.title", "Anything at all"), [])
})

test("a page's, post's or product's own title and description are measured against a search result too", () => {
  const fine = "x".repeat(150)
  assert.deepEqual(checkEntrySearchWords({ kind: "Post", title: "Hello", description: fine }), [])
  assert.deepEqual(checkEntrySearchWords({ kind: "Post", title: "Hello", description: "" }), [], "no Description: the first words stand in")
  const long = checkEntrySearchWords({ kind: "Page", title: "A title far too long to be printed whole in any search result at all", description: fine })
  assert.equal(long.length, 1)
  assert.match(long[0].message, /^Page "A title far too long.*" is \d+ characters; a search result prints about \d+ of it whole\.$/)
  const short = checkEntrySearchWords({ kind: "Post", title: "Hello", description: "Too short." })
  assert.deepEqual(short, [{ level: "warning", message: 'Post "Hello" has a Description of 10 characters; a search result shows 140 to 160 best.' }])
  assert.deepEqual(checkEntrySearchWords({ kind: "Product", title: "Drink", description: "Cold." }), [], "a product's description is its shop's")
  assert.deepEqual(checkEntrySearchWords({ kind: "Plan", title: "A plan with a name far longer than any search result would print", description: "" }), [], "a plan has no page of its own")
  // read through checkRows, as `npm run notion:check` reads every row
  const { findings } = checkRows(rows([{ published: true, kind: "Post", title: "Hello", slug: "hello", description: "Too short." }]))
  assert.ok(findings.some((f) => f.message === short[0].message))
})

test("a title is measured with the site's name as the rows have it, the name a search result prints after it", () => {
  // 34 characters: whole beside "REPO THEM" (34 + 3 + 9 = 46), cut beside a
  // name of 30 (34 + 3 + 30 = 67)
  const title = "A post with a moderately long name"
  assert.deepEqual(checkEntrySearchWords({ kind: "Post", title, description: "" }), [])
  const long = "Acme Generic Goods Corporation"
  assert.equal(checkEntrySearchWords({ kind: "Post", title, description: "" }, long).length, 1)
  assert.match(checkEntrySearchWords({ kind: "Post", title, description: "" }, long)[0].message, /prints about 27 of it whole/)
  const post = { published: true, kind: "Post", title, slug: "long" }
  const named = (text, published = true) => ({ published, kind: "Site Copy", title: "site.name", text })
  const warned = (list) => checkRows(rows(list)).findings.some((f) => f.message.startsWith(`Post "${title}"`))
  assert.equal(warned([post]), false, "beside the built-in name it fits")
  assert.equal(warned([named(long), post]), true, "beside the name in the rows it does not")
  assert.equal(warned([post, named(long)]), true, "wherever the row stands")
  assert.equal(warned([named(long, false), post]), false, "an unticked name falls back, as the site's does")
  // the homepage's title is measured the same way
  const home = "Everything you need, nothing else"
  assert.deepEqual(checkSearchWords("meta.home.title", home), [])
  assert.equal(checkSearchWords("meta.home.title", home, long).length, 1)
})

test("a text row no page reads is named, so an editor never edits words the site ignores", () => {
  const findings = checkCopyKeys(["home.hero.title", "pricing.plan.enterprise.name", "home.quote.text"], ["home.hero.title", "pricing.empty"])
  assert.deepEqual(
    findings.slice(0, 2).map((f) => f.message),
    [
      'Text row "home.quote.text" is not read by any page, so editing it changes nothing. Untick it, or move it to the trash.',
      'Text row "pricing.plan.enterprise.name" is not read by any page, so editing it changes nothing. Untick it, or move it to the trash.',
    ],
  )
  assert.equal(findings.length, 3)
  assert.equal(findings.at(-1).level, "warning")
  assert.equal(findings.at(-1).message.startsWith("1 text slot has no row in Notion, so the site shows nothing there: pricing.empty."), true, "and the slot with no row, by name")
  assert.deepEqual(checkCopyKeys(["home.hero.title"], ["home.hero.title"]), [], "a database in step with the code has nothing to say")
})

test("a slot with no row shows nothing on a connected site, so each is named, a dozen at most, and how to add them unticked", () => {
  const slots = Array.from({ length: 15 }, (_, i) => `area.slot${String(i).padStart(2, "0")}`)
  const [finding] = checkMissingSlots(["area.slot00"], [...slots, "demo.default"])
  assert.equal(finding.level, "warning")
  assert.match(finding.message, /^14 text slots have no row in Notion, so the site shows nothing there: area\.slot01, area\.slot02,/)
  assert.match(finding.message, /area\.slot12 and 2 more \(`npm run notion:seed-copy -- --dry-run` lists them all\)/)
  assert.doesNotMatch(finding.message, /area\.slot13|area\.slot00/)
  assert.match(finding.message, /adds a row for each, unticked/)
  assert.doesNotMatch(finding.message, /demo\.default/, "a slot meant to have no row is never asked for")
  assert.deepEqual(checkMissingSlots(["a.b"], ["a.b", "demo.default"]), [])
})

test("the slots the setup seeds are all slots the pages read: copy-keys.json holds no row that would be dead", () => {
  const slots = Object.keys(JSON.parse(readFileSync(new URL("../copy-keys.json", import.meta.url), "utf8")))
  assert.ok(slots.length > 500)
  assert.ok(!slots.some((key) => key.startsWith("pricing.plan.") || key.startsWith("home.quote.") || /^questions\.[a-z]+\.(faq|head)/.test(key)), "no slot stands in for rows")
})

test("a post or a page with a Notion cover and an Image is told the file is not shown", () => {
  const [both, upload, banner] = rows([
    { published: true, kind: "Post", title: "Both", slug: "both", cover: "boxes.jpg" },
    { published: true, kind: "Post", title: "Upload only", slug: "upload", cover: "boxes.jpg" },
    { published: true, kind: "Post", title: "Banner only", slug: "banner" },
  ])
  both.cover = { type: "external", external: { url: "https://pics.example/morris.jpg" } }
  banner.cover = { type: "external", external: { url: "https://pics.example/morris.jpg" } }
  const said = checkRows([both, upload, banner]).findings.map((f) => `${f.level}: ${f.message}`)
  assert.deepEqual(
    said.filter((line) => /Notion cover and an Image/.test(line)),
    ['info: Post "Both" has a Notion cover and an Image; the site shows the Notion cover, so the Image can be cleared.'],
  )
})

test("pictures nobody described are named, page by page; a caption, an Alt: line or a bare Alt: each count as described", () => {
  const run = (text) => ({ type: "text", plain_text: text, text: { content: text } })
  const picture = (caption, children) => ({ id: caption, type: "image", image: { caption: caption ? [run(caption)] : [] }, ...(children ? { children } : {}) })
  const blocks = [
    picture(""),
    picture("Opening day"),
    picture("Alt: A green shopfront"),
    picture("Alt:"),
    { id: "t", type: "toggle", toggle: { rich_text: [] }, children: [picture(""), picture("")] },
  ]
  const [finding, ...rest] = checkPictures('Post "Hello"', blocks)
  assert.equal(rest.length, 0)
  assert.equal(finding.level, "warning")
  assert.match(finding.message, /^Post "Hello": 3 pictures have no description, so a screen reader skips them/)
  assert.match(checkPictures("Page", [picture("")])[0].message, /1 picture has no description, so a screen reader skips it/)
  assert.deepEqual(checkPictures("Page", [picture("Alt: Bread")]), [])
})

test("products whose pictures have no description are listed, from their names in Notion", () => {
  const media = (name) => ({ owner: "page", id: "p", field: "prop", v: "", name })
  const product = (title, cover, gallery = []) => ({ kind: "Product", title, cover: media(cover), gallery: gallery.map(media) })
  const [finding] = checkProductPictures([
    product("Corn flakes", "The box", ["The back"]),
    product("Drink", "drink.jpg"),
    product("Food", "A tin of food", ["IMG_2001.jpg"]),
    { kind: "Post", title: "Not a product", cover: media("cover.png") },
  ])
  assert.equal(finding.level, "info")
  assert.match(finding.message, /^2 products have pictures with no description \("Drink", "Food"\)/)
  assert.deepEqual(checkProductPictures([product("Corn flakes", "The box")]), [])
})

// The editors' Status (EDITOR_STATUS, docs/notion.md, "Published and Status"):
// the site reads Published alone, and notion:check names a row whose Status
// says otherwise.
const statusProperty = (complete = ["Published"]) => ({
  type: "status",
  status: {
    options: [{ id: "d", name: "Draft" }, { id: "r", name: "In Review" }, ...complete.map((name, n) => ({ id: `c${n}`, name }))],
    groups: [
      { name: "To-do", option_ids: ["d"] },
      { name: "In progress", option_ids: ["r"] },
      { name: "Complete", option_ids: complete.map((_, n) => `c${n}`) },
    ],
  },
})
let statusRowId = 0
const statusRow = (kind, title, published, status) => ({
  object: "page",
  id: fakeId(`status/${++statusRowId}`),
  properties: {
    Title: { type: "title", title: [{ plain_text: title }] },
    [PROPS.kind]: { type: "select", select: { name: kind } },
    [PROPS.published]: { type: "checkbox", checkbox: published },
    [EDITOR_STATUS]: { type: "status", status: status ? { name: status } : null },
  },
})

test("Status is the editors' own: the setup never makes it, and a database with or without it is missing nothing", () => {
  assert.ok(!SCHEMA.some((p) => p.name === EDITOR_STATUS), "Notion's API can't make a status property")
  assert.deepEqual(checkSchema({ ...full, [EDITOR_STATUS]: statusProperty() }), [])
  assert.deepEqual(liveStatuses(undefined), [], "no Status, nothing to compare")
  assert.deepEqual(liveStatuses({ type: "select" }), [], "a select called Status is somebody else's")
})

test("a live Status is an option in its Complete group, whatever an editor named it", () => {
  assert.deepEqual(liveStatuses(statusProperty()), ["Published"])
  assert.deepEqual(liveStatuses(statusProperty(["Live", "Archived but up"])), ["Live", "Archived but up"])
})

test("the query asks for every row, drafts too, whose Status disagrees with Published, two levels deep as Notion allows", () => {
  const ticked = (equals) => ({ property: PROPS.published, checkbox: { equals } })
  const query = statusQuery(["Published", "Live"])
  assert.deepEqual(query.filter.or, [
    { and: [ticked(true), { property: EDITOR_STATUS, status: { does_not_equal: "Published" } }, { property: EDITOR_STATUS, status: { does_not_equal: "Live" } }] },
    { and: [ticked(false), { property: EDITOR_STATUS, status: { equals: "Published" } }] },
    { and: [ticked(false), { property: EDITOR_STATUS, status: { equals: "Live" } }] },
  ])
  const depth = (filter) => (filter.or || filter.and ? 1 + Math.max(...(filter.or ?? filter.and).map(depth)) : 0)
  assert.ok(depth(query.filter) <= 2, "Notion refuses a filter nested deeper")
  assert.equal(query.page_size, 100)
  assert.equal(statusQuery(["Published"], "next").start_cursor, "next")
})

test("notion:check names a row on the site under a Status that says otherwise, and one off it that says Published", () => {
  const said = (rows) => checkStatusRows(rows, ["Published"]).map((f) => `${f.level}: ${f.message}`)
  assert.deepEqual(said([statusRow("Post", "Opening hours", true, "Published"), statusRow("Page", "About", false, "Draft"), statusRow("Page", "Terms", false, "In Review")]), [], "in step")

  const [shown] = said([statusRow("Post", "Opening hours", true, "Draft"), statusRow("Site Copy", "home.hero.title", true, null)])
  assert.match(shown, /^warning: 2 rows on the site, Published ticked, under a Status that says otherwise: Post "Opening hours" \(Draft\), Site Copy "home\.hero\.title" \(no Status\)\. Untick Published to take one off, or set its Status\./)
  assert.match(shown, /The site reads Published alone; Status is for editors, kept in step by two automations \(docs\/notion\.md, "Published and Status"\)\.$/)

  const [hidden] = said([statusRow("Site Copy", "home.statement.label", false, "Published")])
  assert.match(hidden, /^warning: 1 row off the site, Published unticked, under a Status of Published: Site Copy "home\.statement\.label"\. Tick Published to show one, or set its Status back\./)
})

test("a Status finding names ten rows and counts the rest", () => {
  const rows = Array.from({ length: 12 }, (_, n) => statusRow("Site Copy", `slot.${n}`, true, "Draft"))
  const [finding] = checkStatusRows(rows, ["Published"])
  assert.match(finding.message, /^12 rows on the site/)
  assert.match(finding.message, /Site Copy "slot\.9" \(Draft\), and 2 more\./)
  assert.doesNotMatch(finding.message, /slot\.10/)
})

test("notion:check says when a ticked, dated row goes live, in UTC, so a time zone read wrong shows", () => {
  const now = new Date("2026-11-23T12:00:00Z")
  const dated = (date, time_zone) => ({
    object: "page",
    id: fakeId(`scheduled/${date}`),
    properties: {
      Title: { type: "title", title: [{ plain_text: "Opening hours" }] },
      [PROPS.kind]: { type: "select", select: { name: "Post" } },
      [PROPS.published]: { type: "checkbox", checkbox: true },
      [PROPS.slug]: { type: "rich_text", rich_text: [{ plain_text: "opening-hours" }] },
      [PROPS.publishedDate]: { type: "date", date: { start: date, ...(time_zone ? { time_zone } : {}) } },
    },
  })
  const said = (row) => checkRows([row], now).findings.map((f) => f.message).filter((m) => m.includes("waits for its Published Date"))
  assert.deepEqual(said(dated("2026-12-01T16:00:00.000", "Europe/London")), ['Post "Opening hours" is ticked and waits for its Published Date: it goes live at 2026-12-01 16:00 UTC, within a minute or two.'])
  assert.deepEqual(said(dated("2027-07-01T16:00:00.000+01:00")), ['Post "Opening hours" is ticked and waits for its Published Date: it goes live at 2027-07-01 15:00 UTC, within a minute or two.'])
  assert.match(said(dated("2026-12-01"))[0], /goes live at 2026-12-01 00:00 UTC \(a date with no time starts at midnight UTC\)/)
  assert.deepEqual(said(dated("2026-11-23T11:00:00.000Z")), [], "a date that has come is nothing to say")
})

test("a text row nothing reads is named while it is ticked; unticking it, as the finding asks, puts it away, yet it still counts as its slot's row", () => {
  const row = (title, published, kind = "Site Copy") => ({ id: title, properties: { Title: { type: "title", title: [{ plain_text: title }] }, Kind: { type: "select", select: { name: kind } }, Published: { type: "checkbox", checkbox: published } } })
  const keys = textRowKeys([row("home.old", false), row("home.gone", true), row("home.hero.title", false), row("A page", true, "Page")])
  assert.deepEqual(keys, { all: ["home.old", "home.gone", "home.hero.title"], ticked: ["home.gone"] })
  assert.deepEqual(checkUnreadRows(keys.ticked, ["home.hero.title"]).map((f) => f.message.slice(0, 20)), ['Text row "home.gone"'])
  assert.deepEqual(checkMissingSlots(keys.all, ["home.hero.title"]), [], "an unticked row is still the slot's row")
})
