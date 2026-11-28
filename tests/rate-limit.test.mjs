// The public routes' limiter (lib/rate-limit.ts): a caller past its limit
// is refused until its window ends; however many addresses call, the
// limiter's memory has a ceiling; and with a shared store the count holds
// across instances and cold starts, the store never sees an address, and a
// store that is down leaves each instance counting alone.
import { after, afterEach, before, test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { createHash, createHmac } from "node:crypto"

const { NextRequest } = await import("next/server")
const { MAX_BUCKETS, STORE_TIMEOUT_MS, callerSecret, forgetCallers, forgetWarning, rateLimit, rememberedCallers, sharedStore, storeKey } = await import("../lib/rate-limit.ts")

const from = (ip) => new NextRequest("https://site.example/api/x", { headers: { "x-forwarded-for": ip } })

// ------------------------------------------------ a stand-in Upstash Redis

/** Upstash's REST pipeline, for the four commands the limiter sends. */
const redis = { keys: new Map(), asked: [], down: false, slow: false, token: "test-store-token" }
const server = createServer((req, res) => {
  let body = ""
  req.on("data", (chunk) => (body += chunk))
  req.on("end", async () => {
    if (redis.slow) await new Promise((done) => setTimeout(done, STORE_TIMEOUT_MS + 200))
    if (redis.down || req.url !== "/pipeline" || req.headers.authorization !== `Bearer ${redis.token}`) {
      res.writeHead(redis.down ? 503 : 401).end()
      return
    }
    const now = Date.now()
    const live = (key) => {
      const entry = redis.keys.get(key)
      if (entry && entry.expiresAt !== null && entry.expiresAt <= now) redis.keys.delete(key)
      return redis.keys.get(key)
    }
    const answers = JSON.parse(body).map(([command, key, ...args]) => {
      redis.asked.push([command, key, ...args])
      if (command === "SET") {
        if (live(key)) return { result: null }
        redis.keys.set(key, { value: Number(args[0]), expiresAt: args[1] === "PX" ? now + Number(args[2]) : null })
        return { result: "OK" }
      }
      if (command === "INCR") {
        const entry = live(key) ?? { value: 0, expiresAt: null }
        entry.value += 1
        redis.keys.set(key, entry)
        return { result: entry.value }
      }
      if (command === "PTTL") {
        const entry = live(key)
        return { result: !entry ? -2 : entry.expiresAt === null ? -1 : entry.expiresAt - now }
      }
      if (command === "PEXPIRE") {
        const entry = live(key)
        if (entry) entry.expiresAt = now + Number(args[0])
        return { result: entry ? 1 : 0 }
      }
      return { error: `ERR unknown command '${command}'` }
    })
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(answers))
  })
})
const saved = { ...process.env }
before(async () => {
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
})
after(async () => {
  process.env = saved
  await new Promise((done) => server.close(done))
})
afterEach(() => {
  for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "NOTION_TOKEN", "MEDIA_SIGNING_KEY"]) delete process.env[name]
  Object.assign(redis, { down: false, slow: false })
  redis.keys.clear()
  redis.asked.length = 0
  forgetCallers()
  forgetWarning()
})
const STORE = () => ({ url: `http://127.0.0.1:${server.address().port}`, token: redis.token })
/** A store, and a secret of the site's own to hash callers with. */
const useStore = () => Object.assign(process.env, { UPSTASH_REDIS_REST_URL: STORE().url, UPSTASH_REDIS_REST_TOKEN: redis.token, MEDIA_SIGNING_KEY: "the-sites-own-secret" })
/** The store's key for a caller, as the limiter makes it. */
const keyFor = (key, caller) => storeKey(callerSecret(), key, caller)

// ------------------------------------------------------------ in memory

test("a caller past its limit is refused with how long to wait, and another caller is not", async () => {
  const rule = { key: "t-limit", max: 2, windowMs: 60_000 }
  assert.equal((await rateLimit(from("203.0.113.1"), rule)).ok, true)
  assert.equal((await rateLimit(from("203.0.113.1"), rule)).ok, true)
  const refused = await rateLimit(from("203.0.113.1"), rule)
  assert.equal(refused.ok, false)
  assert.equal(refused.response.status, 429)
  assert.ok(Number(refused.response.headers.get("retry-after")) >= 1)
  assert.equal((await rateLimit(from("203.0.113.2"), rule)).ok, true)
})

test("a flood of addresses never grows the limiter past its ceiling", async () => {
  const rule = { key: "t-flood", max: 5, windowMs: 60_000 }
  const ip = (i) => `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`
  for (let i = 0; i < MAX_BUCKETS * 3; i++) await rateLimit(from(ip(i)), rule)
  assert.ok(rememberedCallers() <= MAX_BUCKETS, `${rememberedCallers()} callers remembered`)
  // the newest callers are the ones kept, and are still counted
  const last = ip(MAX_BUCKETS * 3 - 1)
  for (let i = 0; i < 4; i++) await rateLimit(from(last), rule)
  assert.equal((await rateLimit(from(last), rule)).ok, false)
})

// --------------------------------------------------------- a shared store

test("the store is Upstash's pair or Vercel's, each taken whole, over https (or a stand-in here, outside production)", () => {
  const OWN = { MEDIA_SIGNING_KEY: "own" }
  const where = (env) => {
    const store = sharedStore({ ...OWN, ...env })
    return store && { url: store.url, token: store.token }
  }
  assert.equal(where({}), null)
  assert.deepEqual(where({ UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io/", UPSTASH_REDIS_REST_TOKEN: " t1 " }), { url: "https://eu1-x.upstash.io", token: "t1" })
  assert.deepEqual(where({ KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "t2" }), { url: "https://kv.example", token: "t2" })
  assert.equal(where({ UPSTASH_REDIS_REST_URL: "https://a.example", KV_REST_API_TOKEN: "t2" }), null, "never one half of each")
  assert.deepEqual(where({ UPSTASH_REDIS_REST_URL: "https://a.example", KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "t2" }), { url: "https://kv.example", token: "t2" }, "a half pair gives way to a whole one")
  assert.equal(where({ UPSTASH_REDIS_REST_URL: "http://redis.example", UPSTASH_REDIS_REST_TOKEN: "t" }), null, "a token is never sent in the clear")
  assert.equal(where({ UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8079", UPSTASH_REDIS_REST_TOKEN: "t", NODE_ENV: "production" }), null)
  assert.ok(where({ UPSTASH_REDIS_REST_URL: "http://127.0.0.1:8079", UPSTASH_REDIS_REST_TOKEN: "t", NODE_ENV: "test" }))
})

test("with no secret of the site's own, a store is never asked: a hash keyed with what the store knows could be undone", async () => {
  assert.equal(callerSecret({}), null)
  assert.equal(sharedStore({ UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t1" }), null, "a starter site with a store and no Notion counts in memory")
  assert.ok(sharedStore({ UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t1", NOTION_TOKEN: "x" }))
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: STORE().url, UPSTASH_REDIS_REST_TOKEN: redis.token })
  const rule = { key: "t-no-secret", max: 1, windowMs: 60_000 }
  assert.equal((await rateLimit(from("198.51.100.20"), rule)).ok, true)
  assert.equal((await rateLimit(from("198.51.100.20"), rule)).ok, false, "memory still counts")
  assert.deepEqual(redis.asked, [], "and the store was never told anything")
})

test("with a store, the count holds across instances: a cold start does not reset it", async () => {
  useStore()
  const rule = { key: "t-shared", max: 3, windowMs: 60_000 }
  for (let i = 0; i < 3; i++) {
    // every request lands on a fresh instance, whose memory has never seen it
    forgetCallers()
    assert.equal((await rateLimit(from("198.51.100.7"), rule)).ok, true, `request ${i + 1}`)
  }
  forgetCallers()
  const refused = await rateLimit(from("198.51.100.7"), rule)
  assert.equal(refused.ok, false, "the fourth is refused, though this instance never saw the first three")
  const wait = Number(refused.response.headers.get("retry-after"))
  assert.ok(wait >= 1 && wait <= 60, `told to wait ${wait}s, the window's rest`)
  forgetCallers()
  assert.equal((await rateLimit(from("198.51.100.8"), rule)).ok, true, "another caller has a count of their own")
})

test("the store never sees an address, nor the key that would undo the hash, and each count ends with its window", async () => {
  useStore()
  await rateLimit(from("198.51.100.9"), { key: "t-private", max: 5, windowMs: 60_000 })
  const keys = [...redis.keys.keys()]
  assert.equal(keys.length, 1)
  assert.ok(!keys[0].includes("198.51.100.9") && !keys[0].includes("198-51-100-9"), keys[0])
  assert.equal(keys[0], keyFor("t-private", "198.51.100.9"))
  // the store has its own token, so a hash keyed with anything made from it
  // could be undone by hashing every address there is
  for (const fromToken of [redis.token, createHash("sha256").update(`rate-limit-v1:${redis.token}`).digest("base64url")]) {
    assert.ok(!keys[0].endsWith(createHmac("sha256", fromToken).update("198.51.100.9").digest("base64url").slice(0, 22)), "not keyed with the store's token")
  }
  assert.notEqual(callerSecret({ MEDIA_SIGNING_KEY: "a-key-of-its-own", NOTION_TOKEN: "x" }), callerSecret({ NOTION_TOKEN: "x" }), "MEDIA_SIGNING_KEY first")
  const [set] = redis.asked
  assert.deepEqual(set, ["SET", keys[0], "0", "PX", "60000", "NX"])
  assert.ok(redis.keys.get(keys[0]).expiresAt !== null, "every count expires")
})

test("memory's window ends where the store's does: a caller the store has started afresh is never refused here", async () => {
  useStore()
  const rule = { key: "t-aligned", max: 2, windowMs: 900 }
  const caller = "198.51.100.30"
  // another instance opens the store's window
  assert.equal((await rateLimit(from(caller), rule)).ok, true)
  await new Promise((done) => setTimeout(done, 500))
  // this instance first sees the caller half way through it
  forgetCallers()
  assert.equal((await rateLimit(from(caller), rule)).ok, true, "the second in the window")
  assert.equal((await rateLimit(from(caller), rule)).ok, false, "the third: over the store's limit")
  assert.equal((await rateLimit(from(caller), rule)).ok, false, "and refused here, from memory")
  // the store's window is over; this instance's own would have run 400ms more
  await new Promise((done) => setTimeout(done, 550))
  assert.equal((await rateLimit(from(caller), rule)).ok, true, "a new window, here as in the store")
})

test("a caller already over the limit here is refused without asking the store", async () => {
  useStore()
  const rule = { key: "t-local-first", max: 1, windowMs: 60_000 }
  await rateLimit(from("198.51.100.10"), rule)
  const before = redis.asked.length
  assert.equal((await rateLimit(from("198.51.100.10"), rule)).ok, false)
  assert.equal(redis.asked.length, before, "no request for a refusal this instance can give alone")
})

test("a store that is down or slow leaves each instance counting alone, said once, and the site answering", async () => {
  useStore()
  const rule = { key: "t-down", max: 2, windowMs: 60_000 }
  const warnings = []
  const warn = console.warn
  console.warn = (line) => warnings.push(String(line))
  try {
    redis.down = true
    assert.equal((await rateLimit(from("198.51.100.11"), rule)).ok, true)
    assert.equal((await rateLimit(from("198.51.100.11"), rule)).ok, true)
    assert.equal((await rateLimit(from("198.51.100.11"), rule)).ok, false, "memory still counts")
    redis.down = false
    redis.slow = true
    const started = Date.now()
    assert.equal((await rateLimit(from("198.51.100.12"), rule)).ok, true)
    assert.ok(Date.now() - started < STORE_TIMEOUT_MS + 150, "never waits past the store's time")
  } finally {
    console.warn = warn
  }
  assert.equal(warnings.length, 1, "said once")
  assert.match(warnings[0], /\[rate-limit\] the shared store could not be asked/)
  assert.ok(!warnings[0].includes("198.51.100"), "never the caller's address")
})

test("a count that lost its expiry is given it again, so nobody is shut out for good", async () => {
  useStore()
  const rule = { key: "t-heal", max: 5, windowMs: 60_000 }
  const id = keyFor("t-heal", "198.51.100.13")
  redis.keys.set(id, { value: 2, expiresAt: null })
  await rateLimit(from("198.51.100.13"), rule)
  await new Promise((done) => setTimeout(done, 50))
  assert.ok(redis.asked.some(([command, key]) => command === "PEXPIRE" && key === id))
  assert.ok(redis.keys.get(id).expiresAt !== null)
})

// ------------------------------------------------------------- the routes

test("every route a reader can call awaits the limiter, and only the analytics proxies keep it to memory", () => {
  const routes = {
    "app/api/contact/route.ts": true,
    "app/api/subscribe/route.ts": true,
    "app/api/feedback/route.ts": true,
    "app/api/revalidate/route.ts": true,
    "app/api/notion-webhook/route.ts": true,
    "app/go/[slug]/route.ts": true,
    "app/markdown/[...path]/route.ts": true,
    "app/media/[...parts]/route.ts": true,
    "app/og/[[...path]]/route.tsx": true,
    "app/ingest/[...path]/route.ts": false,
    "app/ga/[...path]/route.ts": false,
  }
  for (const [path, shared] of Object.entries(routes)) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
    assert.match(source, /const limit = await rateLimit\(/, `${path} awaits the limiter`)
    assert.equal(/shared: false/.test(source), !shared, `${path}: ${shared ? "the shared count" : "memory alone"}`)
  }
})
