/**
 * Everything the site reads from Notion apart from page bodies, in one
 * query: the copy, the pages, the posts, the resources and the redirects.
 *
 * One query for all of it is the point. Notion allows about three requests a
 * second across the whole integration, and every failure on a render path
 * is silent (a slot shows nothing, or an old answer, which looks exactly
 * like an editor's change being ignored). So the rows are read at most once a
 * minute per deployment, whatever the traffic, and every page, feed and
 * route asks this module rather than Notion.
 */
import { cache } from "react"
import { unstable_cache } from "next/cache"

import { notionConfigured } from "../config"
import { rethrowNextSignal } from "../next-signal"
import { queryPublishedRows } from "../notion/client"
import { readRows, type SiteCopy, type SiteData } from "../notion/rows"
import { notionCopy } from "../slots"
import { STARTER_DATA } from "../demo/starter"
import snapshot from "../snapshot.json"
import { building, hasRows } from "./build-snapshot"

export type { SiteCopy, SiteData }

/** The cache tag every Notion read carries; /api/revalidate clears it. */
export const NOTION_TAG = "notion"

let warnedUnconfigured = false

/** Data read from a connected database: its copy marked as Notion's, so a
 *  slot with no row shows nothing (FROM_NOTION in lib/slots.ts). */
const fromDatabase = (data: SiteData): SiteData => ({ ...data, copy: notionCopy(data.copy) })

const fetchSiteData = async (): Promise<SiteData> => {
  if (!notionConfigured()) return STARTER_DATA
  return fromDatabase(readRows(await queryPublishedRows()))
}

/**
 * The rows, fetched at most once a minute for the whole deployment. Errors
 * escape the cached function on purpose, so a throttle is never stored as
 * "there is no content": the previous answer is served instead and the next
 * request tries again.
 */
const getSiteDataCached = unstable_cache(fetchSiteData, ["site-data-v1"], {
  revalidate: 60,
  tags: [NOTION_TAG],
})

/**
 * The content as Notion had it when this deployment was built
 * (scripts/snapshot.mjs, run by npm's `prebuild`). Committed empty, filled
 * in during the build, so it is never older than the last deploy.
 */
const BUILT = snapshot as SiteData
const SNAPSHOT: SiteData = fromDatabase(BUILT)

/** The last answer Notion gave this server instance: fresher than the
 *  snapshot, and free. */
let lastGood: SiteData | null = null

/**
 * The site's data, with two fallbacks behind it: Notion → this instance's
 * last good answer → the build-time snapshot. Shared by everything that
 * renders in one request, through React's `cache`. Each is marked as
 * Notion's, the snapshot even when the build could read nothing, so a
 * connected site never shows the wording written into the components: a
 * slot Notion has not given words shows nothing (lib/slots.ts).
 *
 * Inside `next build` the snapshot comes first: the prebuild wrote it
 * seconds ago, and the build's many workers each asking Notion again is
 * what trips its rate limit (lib/content/build-snapshot.ts). An empty
 * snapshot (the prebuild couldn't read Notion) sends the build to Notion.
 */
export const getSiteData = cache(async (): Promise<SiteData> => {
  if (!notionConfigured()) {
    if (process.env.NODE_ENV === "production" && !warnedUnconfigured) {
      warnedUnconfigured = true
      console.warn("[notion] NOTION_TOKEN or NOTION_DATABASE_ID is not set; the site is showing the starter content, kept out of search")
    }
    return STARTER_DATA
  }
  if (building() && hasRows(BUILT)) return SNAPSHOT
  try {
    const live = await getSiteDataCached()
    lastGood = live
    return live
  } catch (error) {
    rethrowNextSignal(error)
    console.error(
      "[notion] the database could not be read; showing the last good content:",
      error instanceof Error ? error.message : error,
    )
    return lastGood ?? SNAPSHOT
  }
})

/** The copy alone: slot key → words. */
export const getSiteCopy = async (): Promise<SiteCopy> => (await getSiteData()).copy
