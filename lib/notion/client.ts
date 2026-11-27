/**
 * The one way this site talks to Notion. Every request goes through the
 * limiter below (three at a time across the server instance), and the
 * official client retries a 429 after the delay Notion asks for.
 *
 * No Next imports, so the build scripts use it too (scripts/snapshot.mjs,
 * scripts/notion-*.mjs).
 */
import * as sdk from "@notionhq/client"

import { notionApiBaseUrl, notionDatabaseId, notionToken } from "../config"
import { limiter } from "./limit"
import { everyRow, publishedRows, type NotionRow, type RowsPage } from "./rows"
import type { ChildrenPage } from "./blocks"

/**
 * The SDK's `Client`. The package is CommonJS and defines its exports through
 * getters Node's ES module loader cannot see, so under plain Node (the build
 * scripts, the tests) the class is on the module object, `default`; Next's
 * bundler hands over the exports directly. Either way, one class.
 */
const { Client } = ((sdk as unknown as { default?: typeof sdk }).default ?? sdk) as typeof sdk
export type NotionClient = InstanceType<typeof Client>

/** The API version the site is written against. */
export const NOTION_VERSION = "2025-09-03"

const run = limiter(3)

let client: NotionClient | null = null
let clientKey = ""

/** A client for a token: the site's own (below), or another integration's,
 *  as `npm run shop:import` uses one that may write. */
export function notionWith(token: string | undefined): NotionClient {
  return new Client({
    auth: token,
    notionVersion: NOTION_VERSION,
    timeoutMs: 15_000,
    retry: { maxRetries: 4, initialRetryDelayMs: 400, maxRetryDelayMs: 10_000 },
    ...(notionApiBaseUrl() ? { baseUrl: notionApiBaseUrl() } : {}),
  })
}

/** One client per token and address, made on first use. */
export function notion(): NotionClient {
  const key = `${notionToken() ?? ""}|${notionApiBaseUrl() ?? ""}`
  if (!client || key !== clientKey) {
    client = notionWith(notionToken())
    clientKey = key
  }
  return client
}

/** Notion's answer for an ID that names something else, or nothing it shares. */
const notThis = (error: unknown) => [400, 404].includes(Number((error as { status?: number }).status))

/**
 * The data source behind NOTION_DATABASE_ID. Since Notion's 2025-09-03 API a
 * database holds one or more data sources and rows are queried from those;
 * the site reads the first. The ID may also be:
 *
 *  - a data source's own, taken as it is;
 *  - a page's, when the database sits in it: the first database among the
 *    page's blocks. Whoever duplicates the template, or keeps the database
 *    on a page of its own, can paste the page's link and still be right.
 *
 * When none of those fits, the first answer (the database's) is thrown, so
 * `npm run notion:check` says what Notion said about the database.
 * `call` wraps each request (the site's limiter).
 */
export async function findDataSource(
  notionClient: NotionClient,
  databaseId: string,
  call: <T>(request: () => Promise<T>) => Promise<T> = (request) => request(),
): Promise<{ id: string; name?: string; count: number; via?: "data source" | "page" }> {
  const fromDatabase = async (id: string) => {
    const database = (await call(() => notionClient.databases.retrieve({ database_id: id }))) as {
      data_sources?: { id: string; name?: string }[]
    }
    const sources = database.data_sources ?? []
    if (!sources.length) throw new Error("the database has no data source")
    return { id: sources[0].id, name: sources[0].name, count: sources.length }
  }

  let first: unknown
  try {
    return await fromDatabase(databaseId)
  } catch (error) {
    if (!notThis(error)) throw error
    first = error
  }
  try {
    await call(() => notionClient.dataSources.retrieve({ data_source_id: databaseId }))
    return { id: databaseId, count: 1, via: "data source" }
  } catch (error) {
    if (!notThis(error)) throw error
  }
  const inside = await databaseOnPage(notionClient, databaseId, call).catch((error) => {
    if (!notThis(error)) throw error
    return undefined
  })
  if (!inside) throw first
  return { ...(await fromDatabase(inside)), via: "page" }
}

/** The first database among a page's own blocks, if it has one. */
async function databaseOnPage(
  notionClient: NotionClient,
  pageId: string,
  call: <T>(request: () => Promise<T>) => Promise<T>,
): Promise<string | undefined> {
  let cursor: string | undefined
  do {
    const page = (await call(() =>
      notionClient.blocks.children.list({ block_id: pageId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    )) as unknown as ChildrenPage
    const database = (page.results as { id: string; type?: string }[]).find((block) => block.type === "child_database")
    if (database) return database.id
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined
  } while (cursor)
  return undefined
}

let dataSource: { databaseId: string; id: string } | null = null

/** The data source behind NOTION_DATABASE_ID (findDataSource), looked up
 *  once per database. */
export async function dataSourceId(): Promise<string> {
  const databaseId = notionDatabaseId()
  if (!databaseId) throw new Error("NOTION_DATABASE_ID is not set")
  if (dataSource?.databaseId === databaseId) return dataSource.id
  const found = await findDataSource(notion(), databaseId, run)
  if (found.count > 1) console.warn(`[notion] the database has ${found.count} data sources; the site reads the first, "${found.name ?? found.id}"`)
  if (found.via === "page") console.info("[notion] NOTION_DATABASE_ID is a page; the site reads the database on it")
  dataSource = { databaseId, id: found.id }
  return found.id
}

/** Every Published row of the database, a hundred to a request, in order. */
export async function queryPublishedRows(): Promise<NotionRow[]> {
  const id = await dataSourceId()
  return publishedRows(
    (body) => run(() => notion().dataSources.query({ data_source_id: id, ...body })) as unknown as Promise<RowsPage>,
  )
}

/** Every row a query's filter matches, ticked or not, a hundred to a
 *  request: `body` gives the query for each page's cursor. */
export async function queryRows(body: (cursor?: string) => Record<string, unknown>): Promise<NotionRow[]> {
  const id = await dataSourceId()
  return everyRow((b) => run(() => notion().dataSources.query({ data_source_id: id, ...b })) as unknown as Promise<RowsPage>, body)
}

/** One page of a block's children. */
export function listChildren(blockId: string, cursor?: string): Promise<ChildrenPage> {
  return run(
    () =>
      notion().blocks.children.list({
        block_id: blockId,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }) as unknown as Promise<ChildrenPage>,
  )
}

export function retrieveBlock(blockId: string): Promise<Record<string, unknown>> {
  return run(() => notion().blocks.retrieve({ block_id: blockId }) as unknown as Promise<Record<string, unknown>>)
}

export function retrievePage(pageId: string): Promise<NotionRow> {
  return run(() => notion().pages.retrieve({ page_id: pageId }) as unknown as Promise<NotionRow>)
}
