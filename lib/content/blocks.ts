/**
 * A page's, post's or product's body, cached by its last edit.
 *
 * The cache key carries the row's `last_edited_time`, which Notion moves
 * whenever anything on the page changes, so an unedited page is fetched
 * from Notion once and never again, and an edited one the next time it is
 * asked for. Notion keeps that time to the minute, so a second edit inside
 * the same minute would share the key; the ten-minute expiry below catches
 * it.
 *
 * A failure throws on purpose: inside an incremental render that keeps the
 * last good page being served, which is the right answer when Notion is
 * having a bad afternoon.
 */
import { unstable_cache } from "next/cache"

import { notionConfigured } from "../config"
import { starterChildren } from "../demo/starter"
import { listChildren } from "../notion/client"
import { fetchBlockTree, type NBlock } from "../notion/blocks"
import type { Entry } from "../notion/rows"
import bodies from "../snapshot-bodies.json"
import { building, prerenderable as prerenderableWith, snapshotBody, type SnapshotBodies } from "./build-snapshot"
import { NOTION_TAG } from "./store"

export type { NBlock }

/**
 * The bodies the prebuild read (scripts/snapshot.mjs), for `next build`
 * alone. Committed empty, like lib/snapshot.json.
 */
const SNAPSHOT_BODIES = bodies as SnapshotBodies

/** The entries a dynamic route prerenders: inside a build, those whose body
 *  the snapshot holds (lib/content/build-snapshot.ts). */
export const prerenderable = <E extends Pick<Entry, "id" | "lastEdited">>(entries: E[]): E[] => prerenderableWith(entries, SNAPSHOT_BODIES, notionConfigured())

export function getBlocks(entry: Pick<Entry, "id" | "lastEdited">): Promise<NBlock[]> {
  // with no Notion connected, the starter content's bodies (lib/demo/starter.ts)
  if (!notionConfigured()) return fetchBlockTree(entry.id, starterChildren)
  // inside `next build`, the body the prebuild read, if it is of this edit
  const built = building() ? snapshotBody(SNAPSHOT_BODIES, entry) : undefined
  if (built) return Promise.resolve(built)
  return unstable_cache(() => fetchBlockTree(entry.id, listChildren), ["blocks-v1", entry.id, entry.lastEdited], {
    revalidate: 600,
    tags: [NOTION_TAG, `blocks:${entry.id}`],
  })()
}
