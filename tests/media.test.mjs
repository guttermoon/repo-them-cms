// The /media/ addresses (lib/content/media.ts): signed, so the media route
// serves only files the site printed and is no open proxy.
import { test } from "node:test"
import assert from "node:assert/strict"

process.env.NOTION_TOKEN = "test-token-one"
const { mediaName, mediaUrl, signMedia, verifyMedia } = await import("../lib/content/media.ts")

const ref = { owner: "block", id: "11111111-2222-4333-8444-555555555555", field: "block", v: "2026-11-23T09:00:00.000Z" }

test("a token reads back as the reference it was made from", () => {
  assert.deepEqual(verifyMedia(signMedia(ref)), ref)
  const page = { owner: "page", id: ref.id, field: "prop", prop: "Image", index: 0, v: "x", external: "https://pics.example/a.jpg" }
  assert.deepEqual(verifyMedia(signMedia(page)), page)
})

test("a changed token is refused: no fetching anything the site did not print", () => {
  const token = signMedia(ref)
  const [body, sig] = token.split(".")
  const forged = Buffer.from(JSON.stringify({ o: "b", i: "f".repeat(32), f: "b", v: "x" })).toString("base64url")
  assert.equal(verifyMedia(`${forged}.${sig}`), null)
  assert.equal(verifyMedia(`${body}.${sig.slice(0, -2)}AA`), null)
  assert.equal(verifyMedia(body), null)
  assert.equal(verifyMedia(""), null)
  assert.equal(verifyMedia("x".repeat(5000)), null)
})

test("a new Notion token retires every old address", () => {
  const token = signMedia(ref)
  process.env.NOTION_TOKEN = "test-token-two"
  assert.equal(verifyMedia(token), null)
  process.env.NOTION_TOKEN = "test-token-one"
  assert.deepEqual(verifyMedia(token), ref)
})

test("with no secret set, no address verifies: nobody can sign one with a key everybody knows", async () => {
  const { createHash, createHmac } = await import("node:crypto")
  const saved = process.env.NOTION_TOKEN
  delete process.env.NOTION_TOKEN
  delete process.env.MEDIA_SIGNING_KEY
  try {
    const outside = { owner: "page", id: ref.id, field: "cover", v: "1", external: "https://anything.example/big.bin" }
    // what a forger would sign with if an empty secret made a key
    const body = Buffer.from(JSON.stringify({ o: "p", i: ref.id.replace(/-/g, ""), f: "c", v: "1", x: outside.external })).toString("base64url")
    const emptyKey = createHash("sha256").update("media-v1:").digest()
    const sig = createHmac("sha256", emptyKey).update(body).digest().subarray(0, 16).toString("base64url")
    assert.equal(verifyMedia(`${body}.${sig}`), null)
    assert.equal(verifyMedia(signMedia(outside)), null, "the site's own addresses do not verify either")
  } finally {
    process.env.NOTION_TOKEN = saved
  }
})

test("MEDIA_SIGNING_KEY, when set, signs instead of the Notion token, and outlives a new one", () => {
  process.env.MEDIA_SIGNING_KEY = "a-key-of-its-own"
  try {
    const token = signMedia(ref)
    process.env.NOTION_TOKEN = "test-token-two"
    assert.deepEqual(verifyMedia(token), ref)
  } finally {
    delete process.env.MEDIA_SIGNING_KEY
    process.env.NOTION_TOKEN = "test-token-one"
  }
})

test("the address ends in a readable file name", () => {
  assert.match(mediaUrl(ref, "image"), /^\/media\/[\w-]+\.[\w-]+\/image$/)
  assert.equal(mediaName({ ...ref, name: "Holiday Photo (1).JPG" }), "holiday-photo-1.jpg")
  assert.equal(mediaName({ ...ref, external: "https://pics.example/path/sunset.webp?x=1" }), "sunset.webp")
  // a "%" that escapes nothing is a name like any other, not a page that fails to draw
  assert.equal(mediaName({ ...ref, external: "https://pics.example/caf%E9.jpg" }), "caf-e9.jpg")
  assert.equal(mediaName({ ...ref, external: "https://pics.example/50%-off.png" }), "50-off.png")
  assert.match(mediaUrl({ ...ref, external: "https://pics.example/50%-off.png" }), /^\/media\/[\w.-]+\/50-off\.png$/)
  assert.equal(mediaName(ref, "cover"), "cover")
})

test("an answer from Notion is used for 50 minutes, and never within a minute of an address's expiry", async () => {
  const { FRESH_MS, stillFresh } = await import("../lib/content/media.ts")
  const at = Date.parse("2026-11-26T12:00:00.000Z")
  const min = 60 * 1000
  assert.equal(FRESH_MS, 50 * min)
  assert.equal(stillFresh(at, undefined, at + 49 * min), true)
  assert.equal(stillFresh(at, undefined, at + 50 * min), false, "Notion's hour, less ten minutes")
  // Notion said its addresses last five minutes: used for four
  assert.equal(stillFresh(at, at + 5 * min, at + 3 * min), true)
  assert.equal(stillFresh(at, at + 5 * min, at + 4 * min), false)
  // a far expiry never stretches the 50 minutes
  assert.equal(stillFresh(at, at + 24 * 60 * min, at + 51 * min), false)
})
