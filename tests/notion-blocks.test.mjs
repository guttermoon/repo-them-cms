// A page body fetched as a block tree (lib/notion/blocks.ts), through the
// limiter that keeps the site inside Notion's request budget
// (lib/notion/limit.ts).
import { test } from "node:test"
import assert from "node:assert/strict"

import { blocksText, fetchBlockTree, MAX_BLOCKS } from "../lib/notion/blocks.ts"
import { limiter } from "../lib/notion/limit.ts"

const para = (id, text, has_children = false) => ({
  id,
  type: "paragraph",
  has_children,
  last_edited_time: "2026-11-01T00:00:00.000Z",
  created_by: { id: "someone" },
  paragraph: { rich_text: [{ plain_text: text }] },
})

/** A fake `list`: children by parent ID, paged by `size`. */
function lister(children, size = 100) {
  const calls = []
  const list = async (blockId, cursor) => {
    calls.push([blockId, cursor])
    const all = children[blockId] ?? []
    const start = cursor ? Number(cursor) : 0
    const more = start + size < all.length
    return { results: all.slice(start, start + size), has_more: more, next_cursor: more ? String(start + size) : null }
  }
  return { list, calls }
}

test("children come inline, every page of them, in order", async () => {
  const { list, calls } = lister({ root: [para("a", "A"), para("b", "B", true), para("c", "C")], b: [para("b1", "B1")] }, 2)
  const tree = await fetchBlockTree("root", list)
  assert.deepEqual(tree.map((b) => b.id), ["a", "b", "c"])
  assert.deepEqual(tree[1].children.map((b) => b.id), ["b1"])
  assert.ok(calls.some(([id, cursor]) => id === "root" && cursor === "2"), "the second page was asked for")
  assert.equal(tree[0].created_by, undefined, "only what the renderer reads is kept")
})

test("a child page or database is listed, never descended into", async () => {
  const { list, calls } = lister({ root: [{ id: "cp", type: "child_page", has_children: true, child_page: { title: "Sub" } }] })
  const tree = await fetchBlockTree("root", list)
  assert.equal(tree[0].children, undefined)
  assert.ok(!calls.some(([id]) => id === "cp"))
})

test("a synced block's copy reads the original's children", async () => {
  const { list } = lister({
    root: [{ id: "copy", type: "synced_block", has_children: true, synced_block: { synced_from: { block_id: "orig" } } }],
    orig: [para("o1", "From the original")],
  })
  const tree = await fetchBlockTree("root", list)
  assert.deepEqual(tree[0].children.map((b) => b.id), ["o1"])
})

test("a file block keeps where its file is, never Notion's expiring address", async () => {
  const { list } = lister({
    root: [
      { id: "img", type: "image", last_edited_time: "2026-11-02T00:00:00.000Z", image: { type: "file", file: { url: "https://s3.example/x.png?X-Amz-Signature=secret" }, caption: [{ plain_text: "A cat" }] } },
      { id: "ext", type: "image", image: { type: "external", external: { url: "https://pics.example/y.jpg" }, caption: [] } },
    ],
  })
  const [img, ext] = await fetchBlockTree("root", list)
  assert.deepEqual(img.image.media, { owner: "block", id: "img", field: "block", v: "2026-11-02T00:00:00.000Z" })
  assert.ok(!JSON.stringify(img).includes("X-Amz"), "the signed address is dropped")
  assert.equal(ext.image.media.external, "https://pics.example/y.jpg")
})

test("binned blocks are left out, and a page past the size limit stops there", async () => {
  const many = Array.from({ length: MAX_BLOCKS + 5 }, (_, k) => para(`p${k}`, String(k)))
  const { list } = lister({ root: [{ ...para("gone", "x"), in_trash: true }, ...many] })
  const warn = console.warn
  console.warn = () => {}
  const tree = await fetchBlockTree("root", list)
  console.warn = warn
  assert.equal(tree.length, MAX_BLOCKS)
  assert.ok(!tree.some((b) => b.id === "gone"))
})

test("blocksText reads a tree's words, for a reading time", async () => {
  const { list } = lister({ root: [para("a", "One two", true)], a: [para("b", "three")] })
  assert.equal(blocksText(await fetchBlockTree("root", list)), "One two\nthree")
})

test("a call that throws before it returns a promise still gives its place back", async () => {
  const run = limiter(1)
  const thrown = run(() => {
    throw new Error("before any promise")
  })
  await assert.rejects(thrown, /before any promise/)
  assert.equal(await Promise.race([run(async () => "next"), new Promise((r) => setTimeout(() => r("stuck"), 200))]), "next")
})

test("the limiter never runs more than its share at once, and keeps order", async () => {
  const run = limiter(3)
  let active = 0
  let peak = 0
  const order = []
  await Promise.all(
    Array.from({ length: 10 }, (_, k) =>
      run(async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 5))
        order.push(k)
        active--
        return k
      }),
    ),
  )
  assert.equal(peak, 3)
  assert.equal(order.length, 10)
  await assert.rejects(run(async () => Promise.reject(new Error("boom"))), /boom/)
  assert.equal(await run(async () => "still going"), "still going", "a failure does not jam the queue")
})
