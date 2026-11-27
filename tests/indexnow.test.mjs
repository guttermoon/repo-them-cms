// IndexNow (lib/indexnow.ts, app/indexnow.txt, scripts/indexnow.mjs): the
// key comes from the deployment, never the code, the engines fetch it from
// /indexnow.txt, and the request names one host.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { createServer } from "node:http"
import { promisify } from "node:util"

import { changedSince, indexNowKey, indexNowPayload, sitemapEntries, sitemapUrls } from "../lib/indexnow.ts"

const KEY = "0123456789abcdef0123456789abcdef"

test("a key is 8 to 128 letters, digits or dashes; anything else is no key", () => {
  assert.equal(indexNowKey(KEY), KEY)
  assert.equal(indexNowKey(`  ${KEY}\n`), KEY, "trimmed, as pasted")
  assert.equal(indexNowKey("short"), null)
  assert.equal(indexNowKey("x".repeat(129)), null)
  assert.equal(indexNowKey("has spaces in it"), null)
  assert.equal(indexNowKey("../../etc/passwd"), null)
  assert.equal(indexNowKey(undefined), null)
  assert.equal(indexNowKey(""), null)
})

test("no key file is committed: each deployment serves its own", () => {
  const keyFiles = readdirSync(new URL("../public/", import.meta.url)).filter((f) => /^[0-9a-f-]{8,128}\.txt$/i.test(f))
  assert.deepEqual(keyFiles, [])
})

test("/indexnow.txt serves the deployment's key, and is not found without one", async () => {
  const route = await import("../app/indexnow.txt/route.ts")
  const saved = process.env.INDEXNOW_KEY
  try {
    delete process.env.INDEXNOW_KEY
    assert.equal(route.GET().status, 404)
    process.env.INDEXNOW_KEY = "not a key!"
    assert.equal(route.GET().status, 404)
    process.env.INDEXNOW_KEY = KEY
    const res = route.GET()
    assert.equal(res.status, 200)
    assert.equal(await res.text(), KEY)
    assert.match(res.headers.get("content-type"), /^text\/plain/)
  } finally {
    if (saved === undefined) delete process.env.INDEXNOW_KEY
    else process.env.INDEXNOW_KEY = saved
  }
})

test("the request: one host, the key, and where the key is on that host", () => {
  const payload = indexNowPayload("https://www.site.example", KEY, ["https://www.site.example/", "https://www.site.example/blog"])
  assert.deepEqual(payload, {
    host: "www.site.example",
    key: KEY,
    keyLocation: "https://www.site.example/indexnow.txt",
    urlList: ["https://www.site.example/", "https://www.site.example/blog"],
  })
})

test("an address on another host is refused before anything is sent", () => {
  assert.throws(() => indexNowPayload("https://www.site.example", KEY, ["https://site.example/blog"]), /not on www\.site\.example/)
})

test("the sitemap's addresses, in order", () => {
  const xml = `<?xml version="1.0"?><urlset><url><loc>https://a.example/</loc></url><url>
    <loc> https://a.example/blog </loc></url></urlset>`
  assert.deepEqual(sitemapUrls(xml), ["https://a.example/", "https://a.example/blog"])
})

test("each address with the date it last changed, where the sitemap gives one that reads as a date", () => {
  const xml = `<urlset><url><loc>https://a.example/</loc><changefreq>weekly</changefreq></url>
    <url><loc>https://a.example/blog/new</loc><lastmod>2026-11-26T10:05:00.000Z</lastmod></url>
    <url><loc>https://a.example/odd</loc><lastmod>not a date</lastmod></url></urlset>`
  const entries = sitemapEntries(xml)
  assert.deepEqual(entries.map((e) => e.url), ["https://a.example/", "https://a.example/blog/new", "https://a.example/odd"])
  assert.equal(entries[0].lastModified, undefined, "a designed page has no date")
  assert.equal(entries[1].lastModified.toISOString(), "2026-11-26T10:05:00.000Z")
  assert.equal(entries[2].lastModified, undefined)
})

test("the pages edited since a time: those with a date at or after it, and never one without a date", () => {
  const entries = [
    { url: "https://a.example/" },
    { url: "https://a.example/blog/old", lastModified: new Date("2026-11-26T08:00:00Z") },
    { url: "https://a.example/blog/edge", lastModified: new Date("2026-11-26T09:00:00Z") },
    { url: "https://a.example/blog/new", lastModified: new Date("2026-11-26T09:59:00Z") },
  ]
  assert.deepEqual(changedSince(entries, new Date("2026-11-26T09:00:00Z")), ["https://a.example/blog/edge", "https://a.example/blog/new"])
  assert.deepEqual(changedSince(entries, new Date("2026-11-26T11:00:00Z")), [])
})

test("the script submits only the last hour's edits when asked, and nothing at all when there are none", async () => {
  const now = Date.now()
  const iso = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString()
  let sitemap = `<urlset><url><loc>SITE/</loc></url><url><loc>SITE/blog/fresh</loc><lastmod>${iso(10)}</lastmod></url><url><loc>SITE/blog/stale</loc><lastmod>${iso(300)}</lastmod></url></urlset>`
  const server = createServer((req, res) => {
    res.writeHead(req.url === "/sitemap.xml" ? 200 : 404, { "Content-Type": "application/xml" })
    res.end(sitemap.replaceAll("SITE", site))
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const site = `http://127.0.0.1:${server.address().port}`
  const run = (...args) =>
    promisify(execFile)(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--import", "./tests/register-ts.mjs", "scripts/indexnow.mjs", ...args], {
      cwd: new URL("../", import.meta.url),
      env: { ...process.env, SITE_URL: site, INDEXNOW_KEY: KEY },
    })
  try {
    const hour = JSON.parse((await run("--changed-within", "70", "--dry-run")).stdout)
    assert.deepEqual(hour.urlList, [`${site}/blog/fresh`])
    const all = JSON.parse((await run("--dry-run")).stdout)
    assert.deepEqual(all.urlList, [`${site}/`, `${site}/blog/fresh`, `${site}/blog/stale`], "after a deployment, every page")
    sitemap = `<urlset><url><loc>SITE/blog/stale</loc><lastmod>${iso(300)}</lastmod></url></urlset>`
    const quiet = await run("--changed-within", "70", "--dry-run")
    assert.match(quiet.stdout, /nothing edited in the last 70 minutes; nothing submitted/)
    await assert.rejects(run("--changed-within", "soon", "--dry-run"), /takes a number of minutes/)
  } finally {
    server.close()
  }
})

test("the workflow: every page after a production deployment, the hour's edits every hour once asked to", () => {
  const yml = readFileSync(new URL("../.github/workflows/indexnow.yml", import.meta.url), "utf8")
  assert.match(yml, /schedule:\n\s+# .*\n\s+- cron: "17 \* \* \* \*"/, "hourly, off the hour")
  assert.match(yml, /github\.event_name == 'schedule' && vars\.INDEXNOW_HOURLY == 'true'/, "a copy that has not asked spends nothing")
  assert.match(yml, /github\.event_name == 'schedule' && '--changed-within 70'/, "an hour, with ten minutes over")
  assert.match(yml, /deployment_status\.state == 'success'/)
  assert.match(yml, /environment == 'Production'/)
})
