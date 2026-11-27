/**
 * What a build reads instead of Notion.
 *
 * `next build` renders the pages in many workers at once (one per core,
 * thirty on a large build machine), and each has its own memory: left to
 * themselves, every one would ask Notion for the rows and for every page
 * body it draws, all in the same few seconds. Notion allows about three
 * requests a second for the whole integration and answers 429 past that;
 * a body that can't be read fails the page, and a failed page fails the
 * deploy.
 *
 * So npm's `prebuild` (scripts/snapshot.mjs) reads Notion once, in one
 * process, patiently: the rows into lib/snapshot.json and the body of every
 * page, post and product into lib/snapshot-bodies.json. While `next build`
 * runs, the store and the bodies come from those files, which are seconds
 * old, and a page whose body is not among them is left for its first
 * visitor rather than prerendered. Once deployed, the site reads Notion as
 * before; the snapshot of the rows stays a fallback, the bodies are build
 * only (a body's cache key is its last edit, kept to the minute, so an
 * older copy can't be trusted for long).
 *
 * No Next imports, so the script and `npm test` load it.
 */
import { fetchBlockTree, type ListChildren, type NBlock } from "../notion/blocks"
import type { Entry, SiteData } from "../notion/rows"
import { livePages, livePosts, liveProducts } from "./select"

/** The phase Next sets in the build and in every worker it starts. */
export const BUILD_PHASE = "phase-production-build"

/** Whether this code is running inside `next build`. */
export const building = (): boolean => process.env.NEXT_PHASE === BUILD_PHASE

/** A page body as the build snapshot keeps it: the blocks, and the edit they are of. */
export type SnapshotBody = { lastEdited: string; blocks: NBlock[] }
export type SnapshotBodies = Record<string, SnapshotBody>

/** Whether a rows snapshot holds anything (it is committed empty). */
export const hasRows = (data: SiteData): boolean => data.entries.length > 0 || Object.keys(data.copy).length > 0

/**
 * The entries whose bodies a page draws: the live pages (app/[...slug]),
 * posts (app/blog/[slug]) and products (app/shop/[slug]), each once.
 */
export function entriesWithBodies(data: SiteData, now: Date = new Date()): Entry[] {
  const seen = new Set<string>()
  return [...livePages(data, now), ...livePosts(data, now), ...liveProducts(data, now)].filter((entry) => !seen.has(entry.id) && seen.add(entry.id))
}

/** The snapshot's body for an entry, if it is of the entry's current edit. */
export function snapshotBody(bodies: SnapshotBodies, entry: Pick<Entry, "id" | "lastEdited">): NBlock[] | undefined {
  const body = Object.hasOwn(bodies, entry.id) ? bodies[entry.id] : undefined
  return body && body.lastEdited === entry.lastEdited ? body.blocks : undefined
}

/**
 * The entries a dynamic route prerenders. Outside a build, or with no
 * Notion (the starter content's bodies are the site's own files), all of
 * them; inside a build, those whose body the snapshot holds. The rest are
 * rendered on their first visit (each route sets `dynamicParams`), so a
 * body the prebuild couldn't read never sends the build to Notion.
 */
export function prerenderable<E extends Pick<Entry, "id" | "lastEdited">>(entries: E[], bodies: SnapshotBodies, notionConfigured: boolean): E[] {
  if (!building() || !notionConfigured) return entries
  return entries.filter((entry) => snapshotBody(bodies, entry) !== undefined)
}

/**
 * Every body, one entry at a time (the tree's own requests go through the
 * site's limiter). An entry whose body can't be read is left out and
 * reported; the build renders that page on its first visit instead.
 */
export async function snapshotBodies(
  entries: Pick<Entry, "id" | "lastEdited" | "slug">[],
  list: ListChildren,
  onError: (entry: Pick<Entry, "slug">, error: unknown) => void = () => {},
): Promise<SnapshotBodies> {
  const bodies: SnapshotBodies = {}
  for (const entry of entries) {
    try {
      bodies[entry.id] = { lastEdited: entry.lastEdited, blocks: await fetchBlockTree(entry.id, list) }
    } catch (error) {
      onError(entry, error)
    }
  }
  return bodies
}

/** How long Notion asked to be left alone, in milliseconds, if it did. */
function retryAfter(error: unknown): number | undefined {
  const e = error as { headers?: { get?: (name: string) => string | null }; additional_data?: { retry_after?: string } }
  const raw = e?.headers?.get?.("retry-after") ?? e?.additional_data?.retry_after
  const seconds = raw === undefined || raw === null ? NaN : Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined
}

/** Whether a failure is Notion asking to wait (429) or briefly unwell (502–504). */
export function transient(error: unknown): boolean {
  const e = error as { status?: number; code?: string }
  return e?.code === "rate_limited" || [429, 502, 503, 504].includes(Number(e?.status))
}

/**
 * A request retried for as long as Notion asks, which the site's own client
 * doesn't do: it gives up after ten seconds a try, so a reader is never kept
 * waiting. A build can wait. Up to `tries` attempts, each after the delay
 * Notion named (or a doubling one), never more than `maxWaitMs`.
 */
export async function patiently<T>(
  request: () => Promise<T>,
  { tries = 8, maxWaitMs = 60_000, sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request()
    } catch (error) {
      if (attempt >= tries || !transient(error)) throw error
      await sleep(Math.min(maxWaitMs, retryAfter(error) ?? 1000 * 2 ** (attempt - 1)))
    }
  }
}
