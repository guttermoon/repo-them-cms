// Authors are Person rows (withAuthors in lib/notion/rows.ts, docs/notion.md,
// "Authors"): a post's Author names a person once, and their one picture
// (Image), job title and bio come from that one row, shared with the team.
// Team Page Off keeps a person, a guest among them, to their posts.
import { test } from "node:test"
import assert from "node:assert/strict"

import { personKey, readRows, withAuthors } from "../lib/notion/rows.ts"
import { livePeople } from "../lib/content/select.ts"
import { checkRetiredRows, checkRows, retiredQuery, retiredRows } from "../lib/notion/check.ts"
import { STARTER_DATA } from "../lib/demo/starter.ts"

let n = 0
const rt = (content) => ({ plain_text: content, href: null, annotations: {} })
const file = (name) => [{ name, type: "external", external: { url: `https://images.example.com/${name}` } }]
const row = (props) => ({
  object: "page",
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  created_time: "2026-11-01T10:00:00.000Z",
  last_edited_time: "2026-11-02T10:00:00.000Z",
  properties: {
    Title: { type: "title", title: [rt(props.title)] },
    Kind: { type: "select", select: { name: props.kind, color: "gray" } },
    Published: { type: "checkbox", checkbox: props.published ?? true },
    Text: { type: "rich_text", rich_text: props.text ? [rt(props.text)] : [] },
    Slug: { type: "rich_text", rich_text: props.slug ? [rt(props.slug)] : [] },
    Description: { type: "rich_text", rich_text: props.description ? [rt(props.description)] : [] },
    "Published Date": { type: "date", date: props.kind === "Post" ? { start: "2026-10-01" } : null },
    Author: { type: "rich_text", rich_text: props.author ? [rt(props.author)] : [] },
    "Author Bio": { type: "rich_text", rich_text: props.authorBio ? [rt(props.authorBio)] : [] },
    "Author Image": { type: "files", files: props.authorImage ? file(props.authorImage) : [] },
    "Author Photo Credit": { type: "rich_text", rich_text: props.credit ? [rt(props.credit)] : [] },
    Image: { type: "files", files: props.image ? file(props.image) : [] },
    "Cover Position": { type: "select", select: props.at ? { name: props.at, color: "default" } : null },
    "Team Page": { type: "select", select: props.teamPage ? { name: props.teamPage, color: "default" } : null },
    Order: { type: "number", number: props.order ?? null },
  },
})

const jo = (props = {}) => row({ kind: "Person", title: "Jo Regular", description: "Support", text: "Reads every message.", image: "jo.webp", ...props })
const post = (props = {}) => row({ kind: "Post", title: "Opening hours", slug: "opening-hours", author: "Jo Regular", ...props })
const postOf = (data) => data.entries.find((e) => e.kind === "Post")

test("a post's author is their Person row: the name as it writes it, job title, picture and bio", () => {
  const data = readRows([jo({ authorBio: "Writes the help pages.", credit: "A. Photographer" }), post({ author: "  jo   REGULAR ", authorBio: "an old line", authorImage: "old.webp" })])
  const author = postOf(data).author
  assert.equal(author.name, "Jo Regular")
  assert.equal(author.role, "Support")
  assert.equal(author.bio, "Writes the help pages.", "the Person's Author Bio, not the post's own")
  assert.equal("credit" in author, false, "a photograph's credit is printed nowhere")
  assert.match(author.image.external, /jo\.webp$/, "the portrait is the Person's Image, the one the team card shows")
  assert.equal(author.image.prop, "Image")
})

test("a person has one picture, their Image: the retired Author Image is read nowhere, on a Person or a post", () => {
  const data = readRows([jo({ authorImage: "jo-author.webp" }), post({ authorImage: "old.webp" })])
  const person = data.entries.find((e) => e.kind === "Person")
  assert.match(person.cover.external, /jo\.webp$/, "the team card's")
  assert.deepEqual(postOf(data).author.image, person.cover, "the byline's the same")
  const without = readRows([jo({ image: undefined, authorImage: "jo-author.webp" }), post({ authorImage: "old.webp" })])
  assert.equal(without.entries.find((e) => e.kind === "Person").cover, undefined, "no Image, no picture: an Author Image does not stand in")
  assert.equal(postOf(without).author.image, undefined)
})

test("the Person row is the whole byline: a post's own fields fill in for nothing the row leaves empty", () => {
  const author = postOf(readRows([jo({ image: undefined, text: undefined }), post({ authorBio: "an old line", authorImage: "old.webp", credit: "Old credit" })])).author
  assert.equal(author.image, undefined, "no picture on the row, none on the byline")
  assert.equal(author.bio, "")
})

test("the byline's portrait is cut where the Person row's Cover Position says, as the team card's is", () => {
  const data = readRows([jo({ at: "Top" }), post()])
  assert.equal(data.entries.find((e) => e.kind === "Person").coverAt, 0)
  assert.equal(postOf(data).author.at, 0)
  assert.equal(postOf(readRows([jo(), post()])).author.at, undefined, "no Cover Position, the middle")
})

test("a person with no Author Bio is introduced by their team line (Text)", () => {
  const author = postOf(readRows([jo(), post({ authorBio: "an old line" })])).author
  assert.equal(author.bio, "Reads every message.")
})

test("a name with no Person row is printed alone: a post's own bio, picture and credit are read for nobody", () => {
  const author = postOf(readRows([jo(), post({ author: "A. Guest", authorBio: "Visiting.", authorImage: "guest.webp", credit: "Somebody" })])).author
  assert.deepEqual(author, { name: "A. Guest", bio: "" })
})

test("a guest is a Person row with Team Page Off: their picture and line on their posts, and off the team", () => {
  const guest = row({ kind: "Person", title: "A. Guest", description: "Visiting writer", authorBio: "Visiting.", image: "guest.webp", teamPage: "Off" })
  const data = readRows([jo(), guest, post({ author: "A. Guest" })])
  const author = postOf(data).author
  assert.equal(author.bio, "Visiting.")
  assert.match(author.image.external, /guest\.webp$/)
  assert.equal(author.role, "Visiting writer")
  assert.deepEqual(livePeople(data).map((p) => p.title), ["Jo Regular"])
})

test("names match in any case and spacing, and the first of two people of a name wins", () => {
  assert.equal(personKey(" Jo  Regular "), personKey("jo regular"))
  const data = readRows([jo({ description: "First" }), jo({ description: "Second" }), post()])
  assert.equal(postOf(data).author.role, "First")
})

test("Team Page Off keeps a person off /team and /about, and on their posts' byline; empty is On", () => {
  const data = readRows([jo({ teamPage: "Off" }), row({ kind: "Person", title: "Sam Plain", order: 2 }), row({ kind: "Person", title: "Pat Generic", teamPage: "On", order: 1 }), post()])
  assert.deepEqual(livePeople(data).map((p) => p.title), ["Pat Generic", "Sam Plain"])
  assert.equal(postOf(data).author.role, "Support", "still the author of their posts")
  assert.equal(data.entries.find((e) => e.title === "Sam Plain").team, true)
  assert.equal(data.entries.find((e) => e.kind === "Post").team, undefined, "only a Person has a Team Page")
})

test("withAuthors leaves every other kind alone, and a quotation's speaker too", () => {
  const entries = [{ id: "q", kind: "Quote", title: "Jo Regular", author: { name: "Jo Regular", bio: "on hold music" } }]
  assert.deepEqual(withAuthors([...entries, readRows([jo()]).entries[0]])[0], entries[0])
})

test("the starter's posts are written by its team: one portrait and bio, shared with the team cards", () => {
  const posts = STARTER_DATA.entries.filter((e) => e.kind === "Post" && e.author)
  assert.ok(posts.length >= 3)
  const people = new Map(STARTER_DATA.entries.filter((e) => e.kind === "Person").map((p) => [p.title, p]))
  for (const p of posts) {
    const person = people.get(p.author.name)
    assert.ok(person, `${p.title}: ${p.author.name} has a Person row`)
    assert.deepEqual(p.author.image, person.cover, `${p.title}: the team card's portrait`)
    assert.equal(p.author.bio, person.text)
    assert.equal(p.author.role, person.description)
  }
})

test("notion:check names what no page reads (the retired Author Image, a post's own author fields), a byline with no Person row, a person shown nowhere, and two of one name", () => {
  const said = (rows) => checkRows(rows).findings.map((f) => f.message).join("\n")
  assert.match(said([jo(), post({ authorBio: "an old line" })]), /Post "Opening hours" has its own Author Bio, which no page reads: a byline is its author's Person row/)

  assert.doesNotMatch(said([jo(), post()]), /has its own Author/)
  // a byline with no Person row
  assert.match(said([post({ author: "A. Guest" })]), /Post "Opening hours" is by "A\. Guest", who has no Person row, so the byline is the name alone/)
  assert.doesNotMatch(said([jo(), post()]), /no Person row/)
  assert.match(said([jo({ teamPage: "Off" })]), /Person "Jo Regular" has Team Page Off and writes no post, so they are shown nowhere/)
  assert.doesNotMatch(said([jo({ teamPage: "Off" }), post()]), /shown nowhere/)
  assert.match(said([jo(), jo()]), /Two Person rows are called "Jo Regular"/)
})

test("before a retired column is deleted, notion:check names every row holding something in it, drafts too", () => {
  // the query asks for the rows holding something, ticked or not
  const files = retiredQuery("Author Image", "files")
  assert.deepEqual(files.filter, { property: "Author Image", files: { is_not_empty: true } })
  assert.ok(!JSON.stringify(files).includes("Published"), "no Published filter: a draft's picture is the editor's too")
  assert.deepEqual(retiredQuery("Author Photo Credit", "rich_text", "next").filter, { property: "Author Photo Credit", rich_text: { is_not_empty: true } })
  assert.equal(retiredQuery("Author Photo Credit", "rich_text", "next").start_cursor, "next")

  const said = (rows) => checkRetiredRows(rows).map((f) => f.message).join("\n")
  assert.match(said([jo({ authorImage: "jo-author.webp" })]), /^Person "Jo Regular" has something in "Author Image", which is no longer read\. A person has one picture: their Person row's Image/)
  assert.match(said([post({ authorImage: "old.webp", published: false })]), /^Post "Opening hours", a draft, has something in "Author Image"/)
  assert.match(said([jo({ credit: "A. Photographer" })]), /Person "Jo Regular" has something in "Author Photo Credit", which is no longer read\. The site no longer prints a credit/)
  assert.equal(said([jo(), post()]), "", "a row holding nothing there is not named")
  // and the published rows' own check leaves them to this one, so nothing is said twice
  assert.doesNotMatch(checkRows([jo({ authorImage: "jo-author.webp" })]).findings.map((f) => f.message).join("\n"), /Author Image/)
})

test("a row filling both retired columns is named once for each, not once for each query that found it", async () => {
  const both = jo({ authorImage: "jo-author.webp", credit: "A. Photographer" })
  const image = post({ authorImage: "old.webp" })
  const asked = []
  // the database answers each column's query with the rows holding something there
  const query = async (body) => {
    const { filter } = body()
    asked.push(filter.property)
    return filter.property === "Author Image" ? [both, image] : [both]
  }
  const properties = { "Author Image": { type: "files" }, "Author Photo Credit": { type: "rich_text" } }
  const rows = await retiredRows(properties, query)
  assert.deepEqual(asked, ["Author Image", "Author Photo Credit"], "one query for each retired column the database has")
  assert.deepEqual(rows.map((row) => row.id), [both.id, image.id], "each row once")
  const said = checkRetiredRows(rows).map((f) => f.message)
  assert.equal(said.length, 3, said.join("\n"))
  assert.equal(said.filter((m) => m.startsWith('Person "Jo Regular" has something in "Author Image"')).length, 1)
  assert.equal(said.filter((m) => m.startsWith('Person "Jo Regular" has something in "Author Photo Credit"')).length, 1)
  assert.deepEqual(await retiredRows({ "Author Image": { type: "files" } }, async (body) => (body().filter.property === "Author Image" ? [image] : [])), [image], "a column the database no longer has is not asked about")
})
