// Which database NOTION_DATABASE_ID means (findDataSource in
// lib/notion/client.ts): a database's ID, a data source's, or a page's with
// the database on it, the way somebody who duplicated the template might
// paste it. Anything else is the database's own error, for notion:check.
import { test } from "node:test"
import assert from "node:assert/strict"

import { findDataSource } from "../lib/notion/client.ts"

const missing = (what) => Object.assign(new Error(`Could not find ${what}`), { status: 404, code: "object_not_found" })
const wrongKind = (what) => Object.assign(new Error(`${what} is a page, not a database`), { status: 400, code: "validation_error" })

/** A stand-in Notion: databases by ID, data sources by ID, and each page's
 *  blocks, paged `size` at a time. Every request is recorded. */
function notion({ databases = {}, dataSources = [], pages = {}, size = 100, fail } = {}) {
  const asked = []
  return {
    asked,
    databases: {
      retrieve: async ({ database_id }) => {
        asked.push(["database", database_id])
        if (fail) throw fail
        if (databases[database_id]) return { id: database_id, data_sources: databases[database_id] }
        throw pages[database_id] ? wrongKind(database_id) : missing(database_id)
      },
    },
    dataSources: {
      retrieve: async ({ data_source_id }) => {
        asked.push(["data source", data_source_id])
        if (dataSources.includes(data_source_id)) return { id: data_source_id }
        throw missing(data_source_id)
      },
    },
    blocks: {
      children: {
        list: async ({ block_id, start_cursor }) => {
          asked.push(["blocks", block_id, start_cursor ?? null])
          const blocks = pages[block_id]
          if (!blocks) throw missing(block_id)
          const from = Number(start_cursor ?? 0)
          const next = from + size < blocks.length ? String(from + size) : null
          return { results: blocks.slice(from, from + size), has_more: next !== null, next_cursor: next }
        },
      },
    },
  }
}

test("a database's ID: its first data source, in one request", async () => {
  const client = notion({ databases: { db: [{ id: "ds-1", name: "Website content" }, { id: "ds-2" }] } })
  assert.deepEqual(await findDataSource(client, "db"), { id: "ds-1", name: "Website content", count: 2 })
  assert.equal(client.asked.length, 1)
})

test("a data source's ID is taken as it is", async () => {
  const client = notion({ dataSources: ["ds-9"] })
  assert.deepEqual(await findDataSource(client, "ds-9"), { id: "ds-9", count: 1, via: "data source" })
})

test("a page's ID: the database on the page, however far down its blocks", async () => {
  const blocks = [
    { id: "p1", type: "paragraph" },
    { id: "h1", type: "heading_2" },
    { id: "p2", type: "paragraph" },
    { id: "db", type: "child_database" },
    { id: "db-2", type: "child_database" },
  ]
  const client = notion({ databases: { db: [{ id: "ds-1" }], "db-2": [{ id: "ds-2" }] }, pages: { copy: blocks }, size: 2 })
  assert.deepEqual(await findDataSource(client, "copy"), { id: "ds-1", name: undefined, count: 1, via: "page" })
  assert.deepEqual(
    client.asked.filter(([kind]) => kind === "blocks"),
    [
      ["blocks", "copy", null],
      ["blocks", "copy", "2"],
    ],
    "pages through the blocks, and stops at the first database",
  )
})

test("a page with no database on it, or an ID shared with nothing: Notion's answer about the database", async () => {
  await assert.rejects(findDataSource(notion({ pages: { notes: [{ id: "p", type: "paragraph" }] } }), "notes"), /notes is a page, not a database/)
  // the integration is not connected to it: every request is a 404
  await assert.rejects(findDataSource(notion(), "unshared"), (error) => error.status === 404 && /Could not find unshared/.test(error.message))
})

test("a refused token or a rate limit stops at once: nothing else is tried", async () => {
  const refused = notion({ fail: Object.assign(new Error("API token is invalid."), { status: 401 }) })
  await assert.rejects(findDataSource(refused, "db"), /API token is invalid/)
  assert.equal(refused.asked.length, 1)
  const limited = notion({ fail: Object.assign(new Error("rate limited"), { status: 429 }) })
  await assert.rejects(findDataSource(limited, "db"), /rate limited/)
  assert.equal(limited.asked.length, 1)
})

test("every request goes through the caller's wrapper (the site's limiter)", async () => {
  let wrapped = 0
  const call = (request) => {
    wrapped++
    return request()
  }
  const client = notion({ databases: { db: [{ id: "ds-1" }] }, pages: { copy: [{ id: "db", type: "child_database" }] } })
  await findDataSource(client, "copy", call)
  assert.equal(wrapped, client.asked.length)
})
