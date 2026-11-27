// What a build reads instead of Notion (lib/content/build-snapshot.ts): the
// prebuild's rows and bodies, so `next build`'s many workers never queue up
// at Notion's rate limit, and the prebuild's own patience with a 429.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  BUILD_PHASE,
  building,
  entriesWithBodies,
  hasRows,
  patiently,
  prerenderable,
  snapshotBodies,
  snapshotBody,
  transient,
} from "../lib/content/build-snapshot.ts"
import { sourceFiles } from "./support/sources.mjs"

const entry = (over) => ({ id: "e1", kind: "Page", title: "A page", slug: "a-page", description: "", created: "", lastEdited: "2026-11-20T10:00:00.000Z", tags: [], featured: false, order: 0, ...over })
const DATA = {
  copy: {},
  entries: [
    entry({ id: "p1", kind: "Page", slug: "about-us" }),
    entry({ id: "b1", kind: "Post", slug: "hello" }),
    entry({ id: "s1", kind: "Product", slug: "drink" }),
    entry({ id: "q1", kind: "Question", slug: "why" }),
    entry({ id: "l1", kind: "Plan", slug: "free" }),
    // not live yet: a post dated next year is rendered on its day, not now
    entry({ id: "b2", kind: "Post", slug: "later", date: "2999-01-01" }),
  ],
}

/** Runs `fn` as if inside `next build`, then puts the phase back. */
function inBuild(fn) {
  const before = process.env.NEXT_PHASE
  process.env.NEXT_PHASE = BUILD_PHASE
  try {
    return fn()
  } finally {
    if (before === undefined) delete process.env.NEXT_PHASE
    else process.env.NEXT_PHASE = before
  }
}

test("the build phase is the one Next sets in the build and its workers", () => {
  assert.equal(BUILD_PHASE, "phase-production-build")
  assert.equal(building(), false)
  assert.equal(inBuild(building), true)
})

test("an empty snapshot (as committed) holds nothing; one with a row or a slot does", () => {
  assert.equal(hasRows({ copy: {}, entries: [] }), false)
  assert.equal(hasRows({ copy: { "home.title": "x" }, entries: [] }), true)
  assert.equal(hasRows(DATA), true)
  assert.deepEqual(JSON.parse(readFileSync(new URL("../lib/snapshot.json", import.meta.url), "utf8")), { copy: {}, entries: [] }, "lib/snapshot.json is committed empty")
  assert.deepEqual(JSON.parse(readFileSync(new URL("../lib/snapshot-bodies.json", import.meta.url), "utf8")), {}, "lib/snapshot-bodies.json is committed empty")
})

test("the bodies snapshotted are those a page draws: the live pages, posts and products", () => {
  assert.deepEqual(
    entriesWithBodies(DATA).map((e) => e.id).sort(),
    ["b1", "p1", "s1"],
  )
})

test("a snapshot body serves only the edit it was read at", () => {
  const blocks = [{ id: "x", type: "paragraph" }]
  const bodies = { p1: { lastEdited: "2026-11-20T10:00:00.000Z", blocks } }
  assert.equal(snapshotBody(bodies, { id: "p1", lastEdited: "2026-11-20T10:00:00.000Z" }), blocks)
  assert.equal(snapshotBody(bodies, { id: "p1", lastEdited: "2026-11-20T10:05:00.000Z" }), undefined, "edited since: read Notion")
  assert.equal(snapshotBody(bodies, { id: "p2", lastEdited: "2026-11-20T10:00:00.000Z" }), undefined)
  // an id is a key of the file, never of Object.prototype
  assert.equal(snapshotBody(bodies, { id: "constructor", lastEdited: "" }), undefined)
  assert.equal(snapshotBody(bodies, { id: "__proto__", lastEdited: "" }), undefined)
})

test("inside a build with Notion, a route prerenders only the entries whose body the snapshot holds; otherwise all of them", () => {
  const entries = [
    { id: "p1", lastEdited: "t1" },
    { id: "p2", lastEdited: "t1" },
    { id: "p3", lastEdited: "t2" },
  ]
  const bodies = { p1: { lastEdited: "t1", blocks: [] }, p3: { lastEdited: "t1", blocks: [] } }
  assert.deepEqual(prerenderable(entries, bodies, true), entries, "a deployed site renders whatever is asked for")
  assert.deepEqual(inBuild(() => prerenderable(entries, bodies, false)), entries, "with no Notion, the starter's bodies are the site's own")
  assert.deepEqual(inBuild(() => prerenderable(entries, bodies, true)).map((e) => e.id), ["p1"], "p2 has no body, p3 an older one")
  assert.deepEqual(inBuild(() => prerenderable(entries, {}, true)), [], "the prebuild read nothing: everything waits for its first visit")
})

test("every route that draws a body passes its prerendered pages through prerenderable", () => {
  const routes = sourceFiles("app").filter((file) => /\bgetBlocks\(/.test(readFileSync(file, "utf8")))
  assert.ok(routes.length >= 3, `only ${routes.length} routes draw a body`)
  for (const file of routes) {
    const source = readFileSync(file, "utf8")
    // a route never prerendered (the Markdown copies) reads a body only on
    // a visit, never inside the build: it has no params to filter
    if (/export const dynamic = "force-dynamic"/.test(source)) {
      assert.doesNotMatch(source, /generateStaticParams/, `${file}: force-dynamic, and yet it lists pages to prerender`)
      continue
    }
    const params = source.slice(source.indexOf("export async function generateStaticParams"), source.indexOf("\n}\n", source.indexOf("export async function generateStaticParams")))
    assert.match(params, /prerenderable\(/, `${file}: generateStaticParams is not filtered by prerenderable`)
  }
})

test("the prebuild reads each body once, and leaves out (and reports) one it can't read", async () => {
  const asked = []
  const list = async (blockId) => {
    asked.push(blockId)
    if (blockId === "s1") throw Object.assign(new Error("gone"), { status: 404 })
    return { results: [{ id: `${blockId}-a`, type: "paragraph", has_children: false, paragraph: { rich_text: [] } }], has_more: false, next_cursor: null }
  }
  const failed = []
  const bodies = await snapshotBodies(entriesWithBodies(DATA), list, (e, error) => failed.push([e.slug, error.message]))
  assert.deepEqual(Object.keys(bodies).sort(), ["b1", "p1"])
  assert.equal(bodies.p1.lastEdited, "2026-11-20T10:00:00.000Z")
  assert.equal(bodies.p1.blocks[0].id, "p1-a")
  assert.deepEqual(failed, [["drink", "gone"]])
  assert.deepEqual(asked.sort(), ["b1", "p1", "s1"])
})

test("the prebuild waits as long as Notion asks, a doubling wait when it doesn't say, never past the cap", async () => {
  const limited = (after) => Object.assign(new Error("You have been rate limited."), { status: 429, code: "rate_limited", headers: new Headers(after ? { "retry-after": after } : {}) })
  const waits = []
  const sleep = async (ms) => void waits.push(ms)

  let calls = 0
  const answer = await patiently(
    async () => {
      calls++
      if (calls === 1) throw limited("34")
      if (calls === 2) throw limited(undefined)
      if (calls === 3) throw Object.assign(new Error("bad gateway"), { status: 502 })
      if (calls === 4) throw limited("120")
      return "rows"
    },
    { sleep },
  )
  assert.equal(answer, "rows")
  assert.deepEqual(waits, [34_000, 2_000, 4_000, 60_000])

  // the body's own retry_after counts when there is no header
  waits.length = 0
  calls = 0
  await patiently(
    async () => {
      if (calls++ === 0) throw Object.assign(new Error("slow down"), { code: "rate_limited", additional_data: { retry_after: "3" } })
      return "ok"
    },
    { sleep },
  )
  assert.deepEqual(waits, [3_000])
})

test("the prebuild gives up after its tries, and at once on anything that isn't a wait", async () => {
  const sleep = async () => {}
  let calls = 0
  await assert.rejects(
    patiently(
      async () => {
        calls++
        throw Object.assign(new Error("limited"), { status: 429 })
      },
      { tries: 3, sleep },
    ),
    /limited/,
  )
  assert.equal(calls, 3)

  calls = 0
  await assert.rejects(
    patiently(
      async () => {
        calls++
        throw Object.assign(new Error("Could not find database"), { status: 404, code: "object_not_found" })
      },
      { sleep },
    ),
    /Could not find database/,
  )
  assert.equal(calls, 1)
  assert.equal(transient({ status: 401 }), false)
  assert.equal(transient(new Error("network")), false)
})
