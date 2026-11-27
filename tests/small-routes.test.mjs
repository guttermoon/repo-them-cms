// The small routes, called as Next calls them, reading the starter content
// through the real Notion client from a stand-in Notion over HTTP
// (lib/demo/fake-notion.ts): the printed-QR redirector (/go/<slug>), the
// media proxy (/media/<token>/<name>), the feed, robots.txt and the sitemap.
import { after, before, test } from "node:test"
import assert from "node:assert/strict"
import sharp from "sharp"

const saved = { ...process.env }
const realFetch = globalThis.fetch
const { FAKE_DATABASE_ID, startFakeNotion } = await import("../lib/demo/fake-notion.ts")
const fake = await startFakeNotion()
Object.assign(process.env, { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: FAKE_DATABASE_ID, NOTION_API_BASE_URL: fake.url })

const quiet = console.warn
before(() => {
  console.warn = () => {}
})
after(async () => {
  console.warn = quiet
  globalThis.fetch = realFetch
  process.env = saved
  await fake.close()
})

const { NextRequest } = await import("next/server")
const go = await import("../app/go/[slug]/route.ts")
const media = await import("../app/media/[...parts]/route.ts")
const rss = await import("../app/blog/rss.xml/route.ts")
const { default: robots } = await import("../app/robots.ts")
const { default: sitemap } = await import("../app/sitemap.ts")
const { getSiteData } = await import("../lib/content/store.ts")
const { mediaUrl, signMedia } = await import("../lib/content/media.ts")
// outside hosts answer through the media route's sender (lib/outbound.ts)
const { outbound } = await import("../lib/outbound.ts")
const { INDEXED_PAGES } = await import("../lib/nav.ts")
const { MAKER, SITE_URL } = await import("../lib/site.ts")

const ORIGIN = "https://site.example"
let ip = 0
const request = (path) => new NextRequest(`${ORIGIN}${path}`, { headers: { "x-forwarded-for": `10.2.0.${++ip}` } })
const scan = (slug) => go.GET(request(`/go/${slug}`), { params: { slug } })
/** A reference to a picture outside Notion, as a page's cover would carry it. */
const outside = (external) => ({ owner: "page", id: "11111111-2222-4333-8444-555555555555", field: "cover", v: "1", external })
const fetchMedia = (url) => {
  const parts = url.replace(/^\/media\//, "").replace(/\?.*$/, "").split("/")
  return media.GET(request(url), { params: { parts } })
}

// ------------------------------------------------------------ /go

test("go: a printed code goes where its Redirect row says, any case, by a 307 nobody caches", async () => {
  const res = await scan("Maker")
  assert.equal(res.status, 307)
  assert.equal(res.headers.get("location"), new URL(MAKER.url).href)
  assert.equal(res.headers.get("cache-control"), "no-store")
  assert.equal((await scan("help")).headers.get("location"), `${ORIGIN}/contact`)
})

test("go: an unknown slug lands on the homepage, not a dead end", async () => {
  const res = await scan("nothing-here")
  assert.equal(res.status, 307)
  assert.equal(res.headers.get("location"), `${ORIGIN}/`)
})

test("go: a Notion that cannot be read still sends the scan somewhere", async () => {
  const silence = console.error
  console.error = () => {}
  process.env.NOTION_API_BASE_URL = "http://127.0.0.1:9"
  try {
    const res = await scan("maker")
    assert.equal(res.status, 307, "the last good answer, or home: never an error page")
  } finally {
    process.env.NOTION_API_BASE_URL = fake.url
    console.error = silence
  }
})

// ------------------------------------------------------------ /media

test("media: a cover from Notion is served from this site, cached for good, and never run as a page", async () => {
  const data = await getSiteData()
  const post = data.entries.find((e) => e.slug === "introducing-generic")
  assert.ok(post?.cover, "the demo post has a cover")
  const res = await fetchMedia(mediaUrl(post.cover, "cover.png"))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "image/png")
  assert.match(res.headers.get("cache-control"), /public, max-age=31536000, s-maxage=31536000, immutable/)
  assert.equal(res.headers.get("x-content-type-options"), "nosniff")
  assert.match(res.headers.get("content-security-policy"), /sandbox/)
  assert.equal(res.headers.get("cross-origin-resource-policy"), "same-origin")
  assert.match(res.headers.get("content-disposition"), /^inline; filename="cover-introducing\.png"$/)
  const bytes = new Uint8Array(await res.arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], "the PNG itself")
})

test("media: a forged or altered token is a 404 and fetches nothing", async () => {
  const before = fake.requests.length
  const forged = signMedia({ owner: "page", id: "x", field: "cover", v: "1" }).replace(/^./, "A")
  assert.equal((await fetchMedia(`/media/${forged}/x.png`)).status, 404)
  assert.equal((await fetchMedia("/media/not-a-token/x.png")).status, 404)
  assert.equal(fake.requests.length, before)
})

test("media: an outside picture is fetched over https only, and a page-shaped file is a download", async () => {
  const seen = []
  outbound.send = async (input) => {
    seen.push(String(input))
    return new Response("<script>alert(1)</script>", { headers: { "content-type": "text/html; charset=utf-8" } })
  }
  try {
    const plain = await fetchMedia(mediaUrl(outside("http://pics.example/a.png"), "a.png"))
    assert.equal(plain.status, 404)
    assert.deepEqual(seen, [], "plain http is not fetched")
    const res = await fetchMedia(mediaUrl(outside("https://pics.example/a.html"), "a.html"))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get("content-type"), "application/octet-stream")
    assert.match(res.headers.get("content-disposition"), /^attachment;/)
  } finally {
    outbound.send = null
  }
})

test("media: a cover from Notion's Unsplash gallery is fetched at the width asked for, never as the original", async () => {
  const seen = []
  outbound.send = async (input) => {
    seen.push(String(input))
    return new Response("not really a picture", { headers: { "content-type": "image/jpeg" } })
  }
  try {
    const cover = mediaUrl(outside("https://images.unsplash.com/photo-1500000000000-abc?ixlib=rb-4.0.3&q=85&fm=jpg"), "cover.jpg")
    await fetchMedia(`${cover}?w=640`)
    assert.equal(new URL(seen.at(-1)).searchParams.get("w"), "640")
    await fetchMedia(cover)
    assert.equal(new URL(seen.at(-1)).searchParams.get("w"), null, "with no width asked for, the picture as it is")
  } finally {
    outbound.send = null
  }
})

test("media: a file past the size limit is refused before it is streamed", async () => {
  outbound.send = async () => new Response("x", { headers: { "content-type": "video/mp4", "content-length": String(101 * 1024 * 1024) } })
  try {
    const res = await fetchMedia(mediaUrl(outside("https://pics.example/big.mp4"), "big.mp4"))
    assert.equal(res.status, 413)
  } finally {
    outbound.send = null
  }
})

test("media: a picture asked for at a width comes back that wide, as WebP, cached as the original is", async () => {
  const data = await getSiteData()
  const post = data.entries.find((e) => e.slug === "introducing-generic")
  const url = mediaUrl(post.cover, "cover.png")
  const original = new Uint8Array(await (await fetchMedia(url)).arrayBuffer())
  const res = await fetchMedia(`${url}?w=100`)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "image/webp")
  assert.match(res.headers.get("content-disposition"), /^inline; filename="cover-introducing\.webp"$/)
  assert.match(res.headers.get("cache-control"), /s-maxage=31536000, immutable/)
  assert.match(res.headers.get("content-security-policy"), /sandbox/)
  const bytes = Buffer.from(await res.arrayBuffer())
  assert.equal(res.headers.get("content-length"), String(bytes.length))
  assert.equal((await sharp(bytes).metadata()).width, 128, "100 is rounded up to a width that is made")
  assert.ok(bytes.length < original.length / 4, `${bytes.length} of ${original.length} bytes`)
  // what is not a width is not a resize
  for (const none of ["0", "-1", "wide", ""]) {
    assert.equal((await fetchMedia(`${url}?w=${none}`)).headers.get("content-type"), "image/png", none)
  }
})

test("media: an icon asked for at its size comes back a square PNG that size, and no other size is made", async () => {
  const data = await getSiteData()
  const post = data.entries.find((e) => e.slug === "introducing-generic")
  const url = mediaUrl(post.cover, "cover.png")
  const res = await fetchMedia(`${url}?icon=192`)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type"), "image/png")
  assert.match(res.headers.get("content-disposition"), /^inline; filename="cover-introducing\.png"$/)
  assert.match(res.headers.get("cache-control"), /s-maxage=31536000, immutable/)
  const bytes = Buffer.from(await res.arrayBuffer())
  assert.equal(res.headers.get("content-length"), String(bytes.length))
  const meta = await sharp(bytes).metadata()
  assert.deepEqual([meta.format, meta.width, meta.height], ["png", 192, 192])
  // a size not in the set is no icon, and no width either
  for (const none of ["100", "1024", "big", ""]) {
    const other = await fetchMedia(`${url}?icon=${none}`)
    assert.equal(other.headers.get("content-type"), "image/png", none)
    assert.notEqual((await sharp(Buffer.from(await other.arrayBuffer())).metadata()).width, Number(none) || 192, none)
  }
  // an icon wins over a width asked for beside it
  assert.equal((await sharp(Buffer.from(await (await fetchMedia(`${url}?icon=32&w=640`)).arrayBuffer())).metadata()).width, 32)
})

test("media: a drawing, a part of a file and a page-shaped file are never resized", async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"/>'
  const answers = {
    "https://pics.example/logo.svg": () => new Response(svg, { headers: { "content-type": "image/svg+xml", "content-length": String(svg.length) } }),
    "https://pics.example/a.html": () => new Response("<p>x</p>", { headers: { "content-type": "text/html", "content-length": "8" } }),
  }
  outbound.send = async (input) => answers[String(input)]()
  try {
    const drawing = await fetchMedia(`${mediaUrl(outside("https://pics.example/logo.svg"), "logo.svg")}?w=64`)
    assert.equal(drawing.headers.get("content-type"), "image/svg+xml")
    assert.equal(await drawing.text(), svg)
    const icon = await fetchMedia(`${mediaUrl(outside("https://pics.example/logo.svg"), "logo.svg")}?icon=192`)
    assert.equal(icon.headers.get("content-type"), "image/svg+xml", "nor made into an icon")
    assert.equal(await icon.text(), svg)
    const page = await fetchMedia(`${mediaUrl(outside("https://pics.example/a.html"), "a.html")}?w=64`)
    assert.equal(page.headers.get("content-type"), "application/octet-stream")
  } finally {
    outbound.send = null
  }
})

test("media: the pictures of one page ask Notion once between them", async () => {
  const data = await getSiteData()
  const product = data.entries.find((e) => e.cover && !e.cover.external && e.gallery?.some((g) => !g.external))
  assert.ok(product, "a starter product with a cover and a gallery in Notion")
  const refs = [product.cover, ...product.gallery.filter((g) => !g.external)]
  const before = fake.requests.length
  const answers = await Promise.all(refs.map((ref, i) => fetchMedia(mediaUrl(ref, `picture-${i}`))))
  assert.deepEqual(answers.map((r) => r.status), refs.map(() => 200))
  const asked = fake.requests.slice(before).filter((r) => r.startsWith("GET /v1/pages/"))
  assert.equal(asked.length, 1, `${refs.length} pictures, one request: ${asked.join(", ")}`)
})

test("media: a redirect to inside the network is refused, and never followed", async () => {
  const seen = []
  outbound.send = async (input, init) => {
    seen.push(String(input))
    assert.equal(init.redirect, "manual")
    return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } })
  }
  try {
    const res = await fetchMedia(mediaUrl(outside("https://pics.example/moved.png"), "moved.png"))
    assert.equal(res.status, 404)
    assert.equal(res.headers.get("cache-control"), "no-store")
    assert.deepEqual(seen, ["https://pics.example/moved.png"])
    seen.length = 0
    for (const inside of ["https://127.0.0.1/a.png", "https://169.254.169.254/a.png", "https://localhost/a.png", "https://[::1]/a.png"]) {
      assert.equal((await fetchMedia(mediaUrl(outside(inside), "a.png"))).status, 404, inside)
    }
    assert.deepEqual(seen, [], "an address inside the network is never asked")
  } finally {
    outbound.send = null
  }
})

test("media: a name that is not valid percent-encoding is still a file, not an error", async () => {
  outbound.send = async () => new Response("x", { headers: { "content-type": "application/pdf" } })
  try {
    const url = mediaUrl(outside("https://pics.example/a.pdf"), "a.pdf").replace(/[^/]+$/, "100%.pdf")
    const res = await fetchMedia(url)
    assert.equal(res.status, 200)
    assert.match(res.headers.get("content-disposition"), /^inline; filename="100-.pdf"$/)
  } finally {
    outbound.send = null
  }
})

test("media: an answer from Notion is used for 50 minutes and never after, whatever the cache hands back", async (t) => {
  const { kept } = await import("./support/next-cache.mjs")
  kept.answers = new Map()
  t.after(() => {
    kept.answers = null
  })
  const data = await getSiteData()
  const post = data.entries.find((e) => e.slug === "introducing-generic")
  const url = mediaUrl(post.cover, "cover.png")
  const asked = () => fake.requests.filter((r) => r.startsWith("GET /v1/pages/")).length
  const start = asked()
  assert.equal((await fetchMedia(url)).status, 200)
  assert.equal(asked() - start, 1)
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() })
  t.mock.timers.tick(49 * 60 * 1000)
  assert.equal((await fetchMedia(url)).status, 200)
  assert.equal(asked() - start, 1, "inside 50 minutes the kept answer serves")
  t.mock.timers.tick(2 * 60 * 1000)
  assert.equal((await fetchMedia(url)).status, 200)
  assert.equal(asked() - start, 2, "past it Notion is asked again: its addresses die at the hour")
})

test("media: an answer is let go a minute before the first of its addresses expires, whatever its age", async (t) => {
  const { kept } = await import("./support/next-cache.mjs")
  kept.answers = new Map()
  t.after(() => {
    kept.answers = null
  })
  const data = await getSiteData()
  const post = data.entries.find((e) => e.slug === "introducing-generic")
  const url = mediaUrl(post.cover, "cover.png")
  const asked = () => fake.requests.filter((r) => r.startsWith("GET /v1/pages/")).length
  // the stand-in's addresses expire at 2099-01-01: thirty seconds before,
  // an answer is already too near its end to use, so each request asks
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2098-12-31T23:59:30.000Z") })
  const start = asked()
  assert.equal((await fetchMedia(url)).status, 200)
  assert.equal((await fetchMedia(url)).status, 200)
  assert.equal(asked() - start, 2, "an address about to die is never kept")
})

test("media: a file host that refuses an address is tried once more, with the address Notion gives now", async () => {
  const { kept, revalidated } = await import("./support/next-cache.mjs")
  kept.answers = new Map()
  const data = await getSiteData()
  const post = data.entries.find((e) => e.slug === "introducing-generic")
  const url = mediaUrl(post.cover, "cover.png")
  const asked = () => fake.requests.filter((r) => r.startsWith("GET /v1/pages/")).length
  let refused = 0
  globalThis.fetch = async (input, init) => {
    // Notion's file host, once: an address past its time answers 403
    if (String(input).includes("/files/") && refused++ === 0) return new Response("<Error>AccessDenied</Error>", { status: 403 })
    return realFetch(input, init)
  }
  try {
    const start = asked()
    const res = await fetchMedia(url)
    assert.equal(res.status, 200, "the reader gets the picture, not a broken one")
    assert.equal(refused, 2)
    assert.equal(asked() - start, 2, "Notion is asked for the address afresh")
    assert.ok(revalidated.includes(`tag:media-owner:${post.cover.owner}:${post.cover.id}`), "and the kept answer is let go")
  } finally {
    globalThis.fetch = realFetch
    kept.answers = null
  }
})

test("media: a file host out of reach is tried once more; twice, and it is a 502 with the host logged, never the address", async (t) => {
  const data = await getSiteData()
  const post = data.entries.find((e) => e.slug === "introducing-generic")
  const url = mediaUrl(post.cover, "cover.png")
  const warned = []
  t.mock.method(console, "warn", (...args) => warned.push(args.join(" ")))
  let tries = 0
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("/files/") && tries++ === 0) throw new TypeError("fetch failed")
    return realFetch(input, init)
  }
  try {
    assert.equal((await fetchMedia(url)).status, 200, "a moment's failure is not a broken picture")
    assert.deepEqual(warned, [])
    globalThis.fetch = async (input, init) => (String(input).includes("/files/") ? new Response("down", { status: 503 }) : realFetch(input, init))
    const res = await fetchMedia(url)
    assert.equal(res.status, 502)
    assert.equal(res.headers.get("cache-control"), "no-store")
    assert.equal(warned.length, 1)
    assert.match(warned[0], /^\[media\] the file's host answered 503, twice: 127\.0\.0\.1:\d+$/)
    // and a 404 is an answer, not a failure: nothing is tried again or logged
    let asked404 = 0
    globalThis.fetch = async (input, init) => (String(input).includes("/files/") ? (asked404++, new Response("gone", { status: 404 })) : realFetch(input, init))
    assert.equal((await fetchMedia(url)).status, 404)
    assert.equal(asked404, 1)
    assert.equal(warned.length, 1)
  } finally {
    globalThis.fetch = realFetch
  }
})

test("media: a compressed file is not sent with the length of its compressed bytes", async () => {
  const body = "x".repeat(3000)
  outbound.send = async (input) =>
    String(input).endsWith(".svg")
      ? new Response(body, { headers: { "content-type": "image/svg+xml", "content-encoding": "gzip", "content-length": "118" } })
      : new Response(body, { headers: { "content-type": "application/pdf", "content-length": "3000" } })
  try {
    const packed = await fetchMedia(mediaUrl(outside("https://pics.example/a.svg"), "a.svg"))
    assert.equal(packed.headers.get("content-length"), null)
    assert.equal((await packed.text()).length, 3000)
    const plain = await fetchMedia(mediaUrl(outside("https://pics.example/a.pdf"), "a.pdf"))
    assert.equal(plain.headers.get("content-length"), "3000", "an uncompressed one keeps its length")
  } finally {
    outbound.send = null
  }
})

test("media: a file that does not say how long it is is still cut off at the limit", async () => {
  const megabyte = new Uint8Array(1024 * 1024)
  let sent = 0
  outbound.send = async () =>
    new Response(
      new ReadableStream({
        pull(controller) {
          if (sent++ < 120) controller.enqueue(megabyte)
          else controller.close()
        },
      }),
      { headers: { "content-type": "video/mp4" } },
    )
  try {
    const res = await fetchMedia(mediaUrl(outside("https://pics.example/endless.mp4"), "endless.mp4"))
    assert.equal(res.status, 200, "nothing said it was too long")
    let read = 0
    await assert.rejects(async () => {
      for await (const chunk of res.body) read += chunk.length
    }, /larger than this site serves/)
    assert.ok(read <= 100 * 1024 * 1024, `${read} bytes went out`)
  } finally {
    outbound.send = null
  }
})

test("go: a slug every object answers to is a slug like any other", async () => {
  for (const slug of ["constructor", "__proto__", "toString"]) {
    const res = await scan(slug)
    assert.equal(res.status, 307, slug)
    assert.equal(res.headers.get("location"), `${ORIGIN}/`)
  }
})

// ------------------------------------------------------------ the feed

test("rss: the blog's live posts, newest first, as valid RSS; a release is the changelog's", async () => {
  const res = await rss.GET()
  assert.match(res.headers.get("content-type"), /^application\/rss\+xml/)
  const xml = await res.text()
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<rss version="2\.0"/)
  const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)].map((m) => m[1])
  assert.deepEqual(links, ["introducing-generic", "five-questions"].map((s) => `${SITE_URL}/blog/${s}`))
  assert.match(xml, /<category>News<\/category>/)
  assert.match(xml, /<pubDate>Fri, 20 Nov 2026 00:00:00 GMT<\/pubDate>/)
  assert.doesNotMatch(xml, /<title>[^<]*[<>&][^<]*<\/title>/)
})

// ------------------------------------------------------------ robots and the sitemap

test("robots: every crawler, the assistants' named, reads the whole site but the plumbing", () => {
  const { rules, sitemap: map } = robots()
  assert.equal(map, `${SITE_URL}/sitemap.xml`)
  for (const rule of rules) {
    assert.deepEqual(rule.allow, ["/"])
    assert.deepEqual(rule.disallow, ["/api/", "/ingest/", "/ga/"])
    assert.ok(![rule.disallow].flat().includes("/"), "no group is shut out of the whole site")
  }
  const named = rules.find((r) => Array.isArray(r.userAgent)).userAgent
  for (const bot of ["GPTBot", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "OAI-SearchBot", "ChatGPT-User", "MistralAI-User", "Applebot-Extended"]) {
    assert.ok(named.includes(bot), bot)
  }
  assert.equal(new Set(named.map((bot) => bot.toLowerCase())).size, named.length, "no crawler named twice")
})

test("the manifest names the site as the copy does, and lists icons that are there at the sizes it says", async () => {
  const { readFileSync } = await import("node:fs")
  const { default: manifest } = await import("../app/manifest.ts")
  const { siteName } = await import("../lib/slots.ts")
  const { MARK_BRAND } = await import("../lib/brand/mark.ts")
  const m = await manifest()
  const name = siteName((await getSiteData()).copy)
  assert.equal(m.name, name)
  assert.equal(m.short_name, name)
  assert.equal(m.theme_color, MARK_BRAND)
  assert.equal(m.start_url, "/")
  for (const icon of m.icons) {
    const png = readFileSync(new URL(`../public${icon.src}`, import.meta.url))
    const [w, h] = icon.sizes.split("x").map(Number)
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [w, h], icon.src)
  }
})

test("sitemap: the designed pages, then the pages and posts written in Notion, with their real dates", async () => {
  delete process.env.COMMERCE_PROVIDER
  const entries = await sitemap()
  const urls = entries.map((e) => e.url)
  for (const { href } of INDEXED_PAGES) {
    if (href === "/shop") assert.ok(!urls.includes(`${SITE_URL}/shop`), "the example shop is noindex, so it is not listed")
    else assert.ok(urls.includes(`${SITE_URL}${href === "/" ? "/" : href}`), href)
  }
  assert.ok(!urls.some((u) => u.includes("/shop/")), "nor are its fictional products")
  for (const path of ["/colophon", "/every-block", "/landing", "/blog/introducing-generic", "/blog/version-1", "/blog/category/guides", "/blog/tag/news"]) {
    assert.ok(urls.includes(`${SITE_URL}${path}`), path)
  }
  assert.ok(!urls.some((u) => /\/subscribed|\/go\/|\/api\//.test(u)))
  // a release has its page, but Releases is the changelog, not one of the
  // blog's categories, whose page is a 404
  assert.ok(!urls.includes(`${SITE_URL}/blog/category/releases`), "no category page for the changelog's posts")
  assert.equal(new Set(urls).size, urls.length, "no address twice")
  const colophon = entries.find((e) => e.url === `${SITE_URL}/colophon`)
  assert.match(colophon.lastModified, /^\d{4}-\d\d-\d\dT/)
  assert.equal(entries.find((e) => e.url === `${SITE_URL}/team`).lastModified, undefined, "no date the build cannot vouch for")
})

test("sitemap: a real shop lists itself, its products and its collections", async () => {
  process.env.COMMERCE_PROVIDER = "links"
  try {
    const urls = (await sitemap()).map((e) => e.url)
    for (const path of ["/shop", "/shop/drink", "/shop/corn-flakes", "/shop/collection/breakfast"]) assert.ok(urls.includes(`${SITE_URL}${path}`), path)
  } finally {
    delete process.env.COMMERCE_PROVIDER
  }
})

test("with no Notion connected, the starter content is kept out of search: every page noindex, robots shut", async () => {
  const { INDEXABLE_ROBOTS, pageMeta } = await import("../lib/seo.ts")
  const meta = () => pageMeta({ path: "/somewhere", title: "Somewhere", description: "A page." })
  // connected, a page is offered to search, its picture shown large (Discover
  // passes over a small one) and its snippet at whatever length it needs
  assert.deepEqual(meta().robots, { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 })
  assert.deepEqual(meta().robots, { ...INDEXABLE_ROBOTS })
  assert.deepEqual(pageMeta({ path: "/cart", title: "Cart", description: "A page.", noindex: true }).robots, { index: false, follow: true }, "noindex is noindex, nothing more")
  const saved = process.env.NOTION_TOKEN
  process.env.NOTION_TOKEN = ""
  try {
    assert.deepEqual(meta().robots, { index: false, follow: true })
    for (const rule of robots().rules) {
      assert.deepEqual([rule.disallow].flat(), ["/"])
      assert.equal(rule.allow, undefined)
    }
  } finally {
    process.env.NOTION_TOKEN = saved
  }
})
