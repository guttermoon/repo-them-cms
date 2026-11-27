/**
 * IndexNow: telling search engines a page has changed instead of waiting to
 * be recrawled. Bing takes it (and through Bing, ChatGPT's search, Copilot
 * and DuckDuckGo), as do Yandex, Seznam, Naver and Yep; Google reads the
 * sitemap instead.
 *
 * The key proves a submission comes from whoever runs the site, so it is
 * served from the site: INDEXNOW_KEY (8 to 128 letters, digits or dashes,
 * your own) at /indexnow.txt, which the submission names as its
 * keyLocation. It is set per deployment, so no key lives in the code and a
 * fork never submits under somebody else's.
 *
 * `scripts/indexnow.mjs` submits the sitemap's addresses;
 * `.github/workflows/indexnow.yml` runs it after each production deployment
 * when the repository has the INDEXNOW_KEY and SITE_URL secrets, and, once
 * it is asked to, every hour for the pages edited in Notion since (their
 * dates in the sitemap are Notion's own), so a post published between
 * deployments is not left for the crawler to find. Imports nothing, so the
 * script loads it as it is.
 */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

/** The key from the environment, when it is a valid IndexNow key. */
export function indexNowKey(raw: string | undefined): string | null {
  const key = raw?.trim()
  return key && /^[A-Za-z0-9-]{8,128}$/.test(key) ? key : null
}

/** The body IndexNow wants: every address on one host, the key, and where
 *  to find it. Throws on an address from another host, which IndexNow would
 *  reject whole. */
export function indexNowPayload(siteUrl: string, key: string, urls: string[]) {
  const site = new URL(siteUrl)
  for (const url of urls) {
    if (new URL(url).host !== site.host) throw new Error(`${url} is not on ${site.host}`)
  }
  return { host: site.host, key, keyLocation: `${site.origin}/indexnow.txt`, urlList: urls }
}

/** One address in a sitemap, with when it last changed where it says. */
export type SitemapEntry = { url: string; lastModified?: Date }

/** The addresses in a sitemap, in its order, each with its date. A date
 *  that does not read as one is no date. */
export function sitemapEntries(xml: string): SitemapEntry[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap(([, entry]) => {
    const url = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(entry)?.[1]
    if (!url) return []
    const date = new Date(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(entry)?.[1] ?? "")
    return [{ url, ...(Number.isNaN(date.getTime()) ? {} : { lastModified: date }) }]
  })
}

/** The addresses in a sitemap, in its order. */
export function sitemapUrls(xml: string): string[] {
  return sitemapEntries(xml).map((entry) => entry.url)
}

/**
 * The addresses changed at or after `since`: the pages, posts and products
 * written in Notion whose last edit is that recent. A page with no date (a
 * designed one, changed only by a deployment) is left to the submission
 * that follows each deployment.
 */
export function changedSince(entries: SitemapEntry[], since: Date): string[] {
  return entries.filter((entry) => entry.lastModified && entry.lastModified.getTime() >= since.getTime()).map((entry) => entry.url)
}
