// The content's fallbacks (lib/content/store.ts): Notion, then this server's
// last good answer, then the snapshot the build wrote, each marked as
// Notion's, so a connected site never falls back to the wording written into
// the components. A site with no Notion set up is not a failure and must not
// be logged as one on every local build.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { DEMO_ROWS } from "@/lib/demo/content"
import { fakeDatabase, hostedFiles } from "@/lib/demo/notion-shape"
import { FROM_NOTION, fromNotion } from "@/lib/slots"

const query = vi.fn()
const list = vi.fn()
vi.mock("@/lib/notion/client", () => ({ queryPublishedRows: () => query(), listChildren: (id: string, cursor?: string) => list(id, cursor) }))
vi.mock("@/lib/snapshot.json", () => ({ default: { copy: { "hero.title": "from the snapshot" }, entries: [] } }))
// the bodies the prebuild read: one page, at the edit it was read at
const BODY = [{ id: "b-1", type: "paragraph", paragraph: { rich_text: [] } }]
vi.mock("@/lib/snapshot-bodies.json", () => ({ default: { "page-1": { lastEdited: "2026-11-20T10:00:00.000Z", blocks: [{ id: "b-1", type: "paragraph", paragraph: { rich_text: [] } }] } } }))

/** Real-shaped rows: the starter content as Notion's API returns it. */
const ROWS = fakeDatabase(DEMO_ROWS, hostedFiles("http://files.example")).pages.filter((p) => (p.properties.Published as { checkbox: boolean }).checkbox)

async function load(env: Record<string, string>) {
  vi.resetModules()
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
  return import("@/lib/content/store")
}

const CONFIGURED = { NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: "0123456789abcdef0123456789abcdef" }

let errors: ReturnType<typeof vi.spyOn>
let warnings: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  query.mockReset()
  list.mockReset()
  errors = vi.spyOn(console, "error").mockImplementation(() => {})
  warnings = vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("the site's data", () => {
  test("with Notion not set up: the starter content, quietly, and Notion is never asked", async () => {
    const { getSiteData } = await load({ NOTION_TOKEN: "", NOTION_DATABASE_ID: "" })
    const data = await getSiteData()
    // the generic site a fresh copy shows: its shop, posts, plans and team
    for (const kind of ["Product", "Post", "Plan", "Person", "Question", "Page"]) {
      expect(data.entries.some((e) => e.kind === kind), kind).toBe(true)
    }
    // pictures are the site's own files, not Notion's
    expect(data.entries.find((e) => e.kind === "Product")?.cover?.external).toMatch(/^\/demo\/product-/)
    // the starter's copy is not Notion's: a slot with no row there shows the code's words
    expect(fromNotion(data.copy)).toBe(false)
    expect(query).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    expect(warnings).not.toHaveBeenCalled()
  })

  test("in production, a site with no Notion says so, once", async () => {
    const { getSiteData } = await load({ NOTION_TOKEN: "", NOTION_DATABASE_ID: "", NODE_ENV: "production" })
    await getSiteData()
    await getSiteData()
    expect(warnings).toHaveBeenCalledTimes(1)
    expect(String(warnings.mock.calls[0][0])).toMatch(/^\[notion\] NOTION_TOKEN or NOTION_DATABASE_ID is not set; the site is showing the starter content/)
  })

  test("Notion's published rows are the copy and the entries, a blank row kept (it hides a slot)", async () => {
    query.mockResolvedValue(ROWS)
    const { getSiteData, getSiteCopy } = await load(CONFIGURED)
    const data = await getSiteData()
    expect(data.entries.length).toBeGreaterThan(10)
    expect(data.entries.every((e) => e.kind !== ("Site Copy" as string))).toBe(true)
    expect(await getSiteCopy()).toEqual(data.copy)
    // Notion's copy is marked, so a slot with no row shows nothing (lib/slots.ts)
    expect(fromNotion(data.copy)).toBe(true)
  })

  test("a Notion that cannot be read: the last good answer stays, and it is logged", async () => {
    query.mockResolvedValueOnce(ROWS).mockRejectedValue(new Error("Notion is down"))
    const { getSiteData } = await load(CONFIGURED)
    const first = await getSiteData()
    expect(await getSiteData()).toEqual(first)
    expect(String(errors.mock.calls.at(-1)?.[0])).toMatch(/^\[notion\] the database could not be read/)
  })

  test("a Notion that cannot be read before it ever answered: the snapshot the build wrote", async () => {
    query.mockRejectedValue(new Error("Notion is down"))
    const { getSiteData } = await load(CONFIGURED)
    expect((await getSiteData()).copy).toEqual({ [FROM_NOTION]: "1", "hero.title": "from the snapshot" })
  })

  test("a Notion that cannot be read, with nothing before it: no words at all, never the code's", async () => {
    vi.doMock("@/lib/snapshot.json", () => ({ default: { copy: {}, entries: [] } }))
    try {
      query.mockRejectedValue(new Error("Notion is down"))
      const { getSiteData } = await load(CONFIGURED)
      const data = await getSiteData()
      expect(data.copy).toEqual({ [FROM_NOTION]: "1" })
      expect(data.entries).toEqual([])
    } finally {
      vi.doMock("@/lib/snapshot.json", () => ({ default: { copy: { "hero.title": "from the snapshot" }, entries: [] } }))
    }
  })
})

// `next build` renders in many workers at once; each asking Notion is what
// tripped its rate limit and failed a deploy (lib/content/build-snapshot.ts)
describe("inside next build", () => {
  const BUILD = { ...CONFIGURED, NEXT_PHASE: "phase-production-build" }

  test("the rows come from the prebuild's snapshot, and Notion is never asked", async () => {
    query.mockResolvedValue(ROWS)
    const { getSiteData } = await load(BUILD)
    expect((await getSiteData()).copy).toEqual({ [FROM_NOTION]: "1", "hero.title": "from the snapshot" })
    expect(query).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
  })

  test("with an empty snapshot (the prebuild couldn't read Notion), the build reads Notion itself", async () => {
    vi.doMock("@/lib/snapshot.json", () => ({ default: { copy: {}, entries: [] } }))
    try {
      query.mockResolvedValue(ROWS)
      const { getSiteData } = await load(BUILD)
      expect((await getSiteData()).entries.length).toBeGreaterThan(10)
      expect(query).toHaveBeenCalledTimes(1)
    } finally {
      vi.doMock("@/lib/snapshot.json", () => ({ default: { copy: { "hero.title": "from the snapshot" }, entries: [] } }))
    }
  })

  test("a body of the snapshot's edit comes from the snapshot; Notion is never asked", async () => {
    vi.resetModules()
    for (const [name, value] of Object.entries(BUILD)) vi.stubEnv(name, value)
    const { getBlocks, prerenderable } = await import("@/lib/content/blocks")
    expect(await getBlocks({ id: "page-1", lastEdited: "2026-11-20T10:00:00.000Z" })).toEqual(BODY)
    expect(list).not.toHaveBeenCalled()
    // a page without a body in the snapshot, or edited since, waits for its first visit
    const entries = [
      { id: "page-1", lastEdited: "2026-11-20T10:00:00.000Z" },
      { id: "page-1", lastEdited: "2026-11-20T10:07:00.000Z" },
      { id: "page-2", lastEdited: "2026-11-20T10:00:00.000Z" },
    ]
    expect(prerenderable(entries)).toEqual([entries[0]])
  })

  test("once deployed, a body is read from Notion (the snapshot's can't be trusted past the build)", async () => {
    list.mockResolvedValue({ results: [], has_more: false, next_cursor: null })
    vi.resetModules()
    for (const [name, value] of Object.entries(CONFIGURED)) vi.stubEnv(name, value)
    const { getBlocks, prerenderable } = await import("@/lib/content/blocks")
    expect(await getBlocks({ id: "page-1", lastEdited: "2026-11-20T10:00:00.000Z" })).toEqual([])
    expect(list).toHaveBeenCalledWith("page-1", undefined)
    const entries = [{ id: "page-2", lastEdited: "x" }]
    expect(prerenderable(entries)).toEqual(entries)
  })
})
