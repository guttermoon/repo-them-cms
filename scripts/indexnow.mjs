// Tells IndexNow (Bing, and through Bing ChatGPT's search, Copilot and
// DuckDuckGo; Yandex, Seznam, Naver, Yep) that the site's pages have changed,
// so they are recrawled now rather than whenever the crawler next comes
// round. See lib/indexnow.ts.
//
//   npm run indexnow                          every address in the live sitemap
//   npm run indexnow -- /blog /questions      just these pages
//   npm run indexnow -- --changed-within 70   the pages edited in the last 70
//                                             minutes (their sitemap dates)
//   npm run indexnow -- --dry-run             print the request, send nothing
//
// SITE_URL is the live site (the address every page canonicalises to) and
// INDEXNOW_KEY the key it serves at /indexnow.txt. Run after a deployment is
// live: the engines fetch the key from the site to check the submission.
//
// Never fails loudly enough to matter: a refused or unreachable IndexNow is
// reported and the exit code says so, but nothing here can affect the site.
import "./load-env.mjs"
import { changedSince, INDEXNOW_ENDPOINT, indexNowKey, indexNowPayload, sitemapEntries } from "../lib/indexnow.ts"

const SITE = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")
const KEY = indexNowKey(process.env.INDEXNOW_KEY)
if (!SITE || !KEY) {
  console.log("[indexnow] SITE_URL and INDEXNOW_KEY are not both set; nothing submitted")
  process.exit(0)
}
const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const paths = args.filter((a) => a.startsWith("/"))
const within = args.includes("--changed-within") ? Number(args[args.indexOf("--changed-within") + 1]) : undefined
if (within !== undefined && !(within > 0)) {
  console.error("[indexnow] --changed-within takes a number of minutes")
  process.exit(2)
}

async function addresses() {
  if (paths.length) return paths.map((p) => `${SITE}${p === "/" ? "/" : p}`)
  const res = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${SITE}/sitemap.xml answered ${res.status}`)
  const entries = sitemapEntries(await res.text())
  if (!entries.length) throw new Error(`${SITE}/sitemap.xml lists no pages`)
  if (within === undefined) return entries.map((entry) => entry.url)
  return changedSince(entries, new Date(Date.now() - within * 60_000))
}

const urls = await addresses()
if (!urls.length) {
  console.log(`[indexnow] nothing edited in the last ${within} minutes; nothing submitted`)
  process.exit(0)
}
const payload = indexNowPayload(SITE, KEY, urls)

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2))
  process.exit(0)
}

const res = await fetch(INDEXNOW_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(15_000),
})
// 200: received. 202: received, the key still being checked (the first time,
// or just after the key file changed). Anything else is a refusal: 403 means
// the key file was not found at keyLocation, 422 an address not on the host.
const ok = res.status === 200 || res.status === 202
console.log(`[indexnow] ${payload.urlList.length} addresses on ${payload.host}: ${res.status} ${res.statusText}`)
if (!ok) {
  console.error(`[indexnow] refused: ${(await res.text()).slice(0, 500)}`)
  process.exit(1)
}
