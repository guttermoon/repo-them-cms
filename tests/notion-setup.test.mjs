// `npm run notion:setup` (lib/notion/setup.ts) against a recording stand-in
// for the client: the database made with every property the site reads,
// bodies sent two levels at a time as Notion's API requires, a hundred blocks
// to a request, and a picture that will not upload left out rather than
// stopping the whole setup.
import { test } from "node:test"
import assert from "node:assert/strict"

import { appendTree, contentType, createCopyRow, createDatabase, createRow, missingCopy, uploadFiles } from "../lib/notion/setup.ts"
import { schemaRequest } from "../lib/demo/notion-shape.ts"
import { KINDS, SCHEMA } from "../lib/notion/schema.ts"

/** A client that records each call and hands out IDs. */
function recorder({ failUpload } = {}) {
  const calls = []
  let n = 0
  const id = () => `id-${++n}`
  return {
    calls,
    blocks: {
      children: {
        append: async ({ block_id, children }) => {
          calls.push(["append", block_id, children])
          return { results: children.map(() => ({ id: id() })) }
        },
      },
    },
    databases: {
      create: async (body) => {
        calls.push(["database", body])
        return { id: "db-1", data_sources: [{ id: "ds-1" }] }
      },
    },
    pages: {
      create: async (body) => {
        calls.push(["page", body])
        return { id: id() }
      },
    },
    fileUploads: {
      create: async (body) => {
        calls.push(["upload", body])
        if (failUpload && body.filename === failUpload) throw new Error("too large")
        return { id: `upload-${body.filename}` }
      },
      send: async (body) => {
        calls.push(["send", body.file_upload_id, body.file.data instanceof Blob, body.file.data.type])
        return {}
      },
    },
  }
}

const para = (text, children) => ({ type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text } }], ...(children ? { children } : {}) } })

test("the database is made under the given page, with every property in the schema", async () => {
  const client = recorder()
  assert.deepEqual(await createDatabase(client, "parent-page", "Website content"), { databaseId: "db-1", dataSourceId: "ds-1" })
  const [[, body]] = client.calls
  assert.deepEqual(body.parent, { type: "page_id", page_id: "parent-page" })
  assert.deepEqual(body.title, [{ type: "text", text: { content: "Website content" } }])
  assert.deepEqual(Object.keys(body.initial_data_source.properties).sort(), SCHEMA.map((p) => p.name).sort())
  assert.deepEqual(body.initial_data_source.properties, schemaRequest())
})

test("a body goes in two levels at a time: deeper children are appended under the block they belong to", async () => {
  const client = recorder()
  await appendTree(client, "page", [para("top", [para("child", [para("grandchild")])]), para("sibling")])
  const appends = client.calls.filter(([kind]) => kind === "append")
  assert.equal(appends.length, 3)
  assert.equal(appends[0][1], "page")
  assert.deepEqual(appends[0][2].map((b) => b.paragraph.rich_text[0].text.content), ["top", "sibling"])
  assert.equal(appends[0][2][0].paragraph.children, undefined, "children never travel with their parent")
  assert.equal(appends[1][1], "id-1", "the child under the block Notion just made")
  assert.deepEqual(appends[2][2].map((b) => b.paragraph.rich_text[0].text.content), ["grandchild"])
})

test("columns and tables travel whole: their parts cannot be made empty", async () => {
  const client = recorder()
  const columns = { type: "column_list", column_list: { children: [{ type: "column", column: { children: [para("a")] } }, { type: "column", column: { children: [para("b")] } }] } }
  await appendTree(client, "page", [columns])
  const appends = client.calls.filter(([kind]) => kind === "append")
  assert.equal(appends.length, 1)
  assert.deepEqual(appends[0][2][0], columns)
})

test("a long body goes a hundred blocks to a request", async () => {
  const client = recorder()
  await appendTree(client, "page", Array.from({ length: 250 }, (_, k) => para(String(k))))
  const sizes = client.calls.filter(([kind]) => kind === "append").map(([, , children]) => children.length)
  assert.deepEqual(sizes, [100, 100, 50])
})

test("pictures are uploaded with their own type; one that fails is reported and left out", async () => {
  const client = recorder({ failUpload: "b.jpg" })
  const said = []
  const uploads = await uploadFiles(client, [{ name: "a.png", data: new Uint8Array([1, 2]) }, { name: "b.jpg", data: new Uint8Array([3]) }], (line) => said.push(line))
  assert.deepEqual(uploads, { "a.png": "upload-a.png" })
  assert.deepEqual(client.calls.find(([kind]) => kind === "send"), ["send", "upload-a.png", true, "image/png"])
  assert.match(said.join("\n"), /could not upload b\.jpg \(too large\)/)
  assert.equal(contentType("x.JPEG"), "image/jpeg")
  assert.equal(contentType("x.unknown"), "application/octet-stream")
})

test("a starter row: its properties and icon in the data source, then its body", async () => {
  const client = recorder()
  await createRow(client, "ds-1", { kind: "Page", title: "About", slug: "about", published: true, icon: "tag", blocks: [para("Hello")] }, {})
  const [[, page], [, parent, children]] = client.calls
  assert.deepEqual(page.parent, { type: "data_source_id", data_source_id: "ds-1" })
  // one of Notion's own icons, by name: Notion refuses a name it does not have
  assert.deepEqual(page.icon, { type: "icon", icon: { name: "tag", color: "gray" } })
  assert.equal(page.properties.Title.title[0].text.content, "About")
  assert.equal(parent, "id-1")
  assert.equal(children.length, 1)
})

test("every icon in the starter content is one of Notion's own, and the site draws each with its own icon", async () => {
  const { DEMO_ROWS } = await import("../lib/demo/content.ts")
  const { iconForNotion } = await import("../lib/icons.ts")
  const names = []
  const walk = (blocks = []) => {
    for (const b of blocks) {
      const icon = b[b.type]?.icon
      if (icon) {
        assert.equal(icon.type, "icon", `a ${b.type} with an icon that is not Notion's own`)
        names.push(icon.icon.name)
      }
      walk(b[b.type]?.children)
      if (b.type === "column_list") for (const col of b.column_list.children ?? []) walk(col.column.children)
    }
  }
  for (const row of DEMO_ROWS) {
    if (row.icon) names.push(row.icon)
    walk(row.blocks)
  }
  assert.ok(names.length > 10)
  const undrawn = [...new Set(names)].filter((name) => !iconForNotion(name))
  assert.deepEqual(undrawn, [], "a Notion icon name with no icon in lib/icons.ts")
  assert.ok(!names.some((name) => /\p{Extended_Pictographic}/u.test(name)), "an emoji where a Notion icon name belongs")
})

test("an invented starter row (a review) is written tagged Example, with its stars, so a connected site shows it marked and never as real", async () => {
  const { DEMO_ROWS } = await import("../lib/demo/content.ts")
  const { propertiesRequest } = await import("../lib/demo/notion-shape.ts")
  const reviews = DEMO_ROWS.filter((row) => row.kind === "Review")
  assert.ok(reviews.length >= 3)
  for (const review of reviews) {
    assert.equal(review.example, true, `${review.title} is invented, so it is marked as an example`)
    const props = propertiesRequest(review)
    assert.equal(props.Published.checkbox, true)
    assert.deepEqual(props.Tags.multi_select, [{ name: "Example" }])
    assert.equal(props.Rating.number, review.rating)
  }
  // a row that is not invented is never tagged as one
  assert.ok(!(propertiesRequest(DEMO_ROWS.find((row) => row.kind === "Post")).Tags?.multi_select ?? []).some((tag) => tag.name === "Example"))
})

test("every select value the starter rows use is an option the setup creates, so none arrives uncoloured", async () => {
  const { DEMO_ROWS } = await import("../lib/demo/content.ts")
  const { PROPS } = await import("../lib/notion/schema.ts")
  const options = (name) => new Set(SCHEMA.find((p) => p.name === name).options.map((o) => o.name))
  const fields = { kind: PROPS.kind, category: PROPS.category, action: PROPS.action, font: PROPS.font, layout: PROPS.layout, currency: PROPS.currency, stock: PROPS.stock }
  const missing = []
  for (const row of DEMO_ROWS) {
    for (const [field, prop] of Object.entries(fields)) {
      if (row[field] !== undefined && !options(prop).has(row[field])) missing.push(`${row.title}: ${prop} "${row[field]}"`)
    }
    for (const tag of row.tags ?? []) if (!options(PROPS.tags).has(tag)) missing.push(`${row.title}: ${PROPS.tags} "${tag}"`)
  }
  assert.deepEqual(missing, [])
})

test("a link to a page here goes as Notion keeps one (its API refuses a path), in text, captions and table cells", async () => {
  const { blocksRequest } = await import("../lib/demo/notion-shape.ts")
  const run = (content, url) => ({ type: "text", text: { content, ...(url ? { link: { url } } : {}) } })
  const [para, image, table] = blocksRequest(
    [
      { type: "paragraph", paragraph: { rich_text: [run("See the plans", "/pricing"), run(" or "), run("the docs", "https://developers.notion.com/")] } },
      { type: "image", image: { type: "demo_file", demo_file: "a.png", caption: [run("Plans", "/pricing")] } },
      { type: "table", table: { table_width: 1, children: [{ type: "table_row", table_row: { cells: [[run("Ask", "/contact")]] } }] } },
    ],
    { "a.png": "upload-a" },
  )
  assert.deepEqual(
    para.paragraph.rich_text.map((r) => r.text.link?.url),
    ["https://app.notion.com/pricing", undefined, "https://developers.notion.com/"],
  )
  assert.equal(image.image.caption[0].text.link.url, "https://app.notion.com/pricing")
  assert.equal(table.table.children[0].table_row.cells[0][0].text.link.url, "https://app.notion.com/contact")
})

test("every link in the starter pages' bodies is a full address, so notion:setup does not stop half way", async () => {
  const { DEMO_ROWS } = await import("../lib/demo/content.ts")
  const { blocksRequest } = await import("../lib/demo/notion-shape.ts")
  const links = []
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === "object") {
      if (value.link?.url) links.push(value.link.url)
      Object.values(value).forEach(walk)
    }
  }
  for (const row of DEMO_ROWS) walk(blocksRequest(row.blocks ?? [], {}))
  assert.ok(links.length > 3, "the starter bodies link somewhere")
  assert.deepEqual(
    links.filter((url) => !/^https?:\/\/[^/]/.test(url)),
    [],
  )
})

test("every property's description fits Notion's limit, so the setup can write it", () => {
  // Notion refuses a property description over 280 characters, and the
  // setup writes every one of these (lib/notion/setup.ts)
  for (const prop of SCHEMA) assert.ok(prop.description.length <= 280, `${prop.name}: ${prop.description.length} characters`)
})

test("the Kind select offers every Kind the site reads, and no other", () => {
  // a Kind the code reads but the setup never offers is one nobody can choose
  const kind = SCHEMA.find((p) => p.name === "Kind")
  assert.deepEqual(kind.options.map((o) => o.name).sort(), [...KINDS].sort())
})

test("the rows of wording a database lacks: every slot with no row, but the one meant to have none", () => {
  const keys = { "home.hero.title": "website", "home.lead": "Suggested", "demo.default": "No row on purpose" }
  assert.deepEqual(missingCopy(keys, new Set(["home.hero.title"])), [["home.lead", "Suggested"]])
  assert.deepEqual(missingCopy(keys, new Set(["home.hero.title", "home.lead"])), [])
})

test("a row of wording is Site Copy, unticked unless asked, its link a real Notion link", async () => {
  const client = recorder()
  await createCopyRow(client, "ds-1", "home.lead", "Read [the docs](https://developers.notion.com/).", false)
  await createCopyRow(client, "ds-1", "home.hero.title", "website", true)
  const [first, second] = client.calls.map(([, body]) => body)
  assert.deepEqual(first.parent, { type: "data_source_id", data_source_id: "ds-1" })
  assert.equal(first.properties.Title.title[0].text.content, "home.lead")
  assert.deepEqual(first.properties.Kind, { select: { name: "Site Copy" } })
  assert.deepEqual(first.properties.Published, { checkbox: false }, "nothing reaches the site before somebody reads it")
  assert.deepEqual(
    first.properties.Text.rich_text.find((run) => run.text.link),
    { type: "text", text: { content: "the docs", link: { url: "https://developers.notion.com/" } } },
  )
  assert.deepEqual(second.properties.Published, { checkbox: true })
})
