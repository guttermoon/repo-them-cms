/**
 * A stand-in for api.notion.com, serving the starter content
 * (lib/demo/content.ts) exactly as the real API would: a database with one
 * data source, a query that filters on Published and pages through results,
 * block children in pages of a hundred, and the demo pictures as files.
 *
 * For end-to-end runs (scripts/fake-notion.mjs, with NOTION_API_BASE_URL
 * pointing at it) and for the tests. Never used by the site itself.
 */
import { readFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createServer, type Server } from "node:http"
import path from "node:path"

import { DEMO_ROWS, type DemoRow } from "./content"
import { fakeDatabase, fakeId, hostedFiles } from "./notion-shape"
import { SCHEMA } from "../notion/schema"
import { missingCopy } from "../notion/setup"

export const FAKE_DATABASE_ID = fakeId("database")
export const FAKE_DATA_SOURCE_ID = fakeId("data-source")

type Started = { url: string; databaseId: string; server: Server; requests: string[]; close: () => Promise<void> }

const json = (status: number, body: unknown) => ({ status, body: JSON.stringify(body), type: "application/json" })

/**
 * The rows as a copy of the template holds them: the given rows, and a
 * ticked Site Copy row with the code's words for every slot they leave out
 * (copy-keys.json; ROWLESS_SLOTS aside), as `notion:setup` makes them. A
 * connected site shows only words in Notion (FROM_NOTION in lib/slots.ts),
 * so a stand-in without them would show next to nothing.
 */
export function everyWord(rows: DemoRow[]): DemoRow[] {
  const keys = JSON.parse(readFileSync(path.join(process.cwd(), "copy-keys.json"), "utf8")) as Record<string, string>
  const have = new Set(rows.filter((row) => row.kind === "Site Copy").map((row) => row.title))
  return [...rows, ...missingCopy(keys, have).map(([title, text]): DemoRow => ({ kind: "Site Copy", title, published: true, text }))]
}

/** `words`: give the rows every slot's words, as a copy of the template has
 *  (everyWord); false for a database that holds only the rows given. */
export async function startFakeNotion({
  port = 0,
  rows = DEMO_ROWS,
  pageSize,
  words = true,
}: { port?: number; rows?: DemoRow[]; pageSize?: number; words?: boolean } = {}): Promise<Started> {
  const requests: string[] = []
  let base = ""
  let db: ReturnType<typeof fakeDatabase> | null = null
  const all = words ? everyWord(rows) : rows
  const data = () => (db ??= fakeDatabase(all, hostedFiles(base)))

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://fake")
    requests.push(`${req.method} ${url.pathname}`)
    const send = (r: { status: number; body: string | Buffer; type: string }) => {
      res.writeHead(r.status, { "Content-Type": r.type })
      res.end(r.body)
    }

    if (url.pathname.startsWith("/files/")) {
      const name = path.basename(url.pathname)
      try {
        const file = await readFile(path.join(process.cwd(), "public", "demo", name))
        const type = name.endsWith(".webp") ? "image/webp" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".jpg") ? "image/jpeg" : "image/png"
        return send({ status: 200, body: file, type })
      } catch {
        return send(json(404, { object: "error", code: "object_not_found" }))
      }
    }

    if (!req.headers.authorization?.startsWith("Bearer ") || !req.headers["notion-version"]) {
      return send(json(401, { object: "error", status: 401, code: "unauthorized", message: "API token is invalid." }))
    }

    const m = (re: RegExp) => url.pathname.match(re)
    let match: RegExpMatchArray | null

    if ((match = m(/^\/v1\/databases\/([^/]+)$/)) && req.method === "GET") {
      if (match[1].replace(/-/g, "") !== FAKE_DATABASE_ID.replace(/-/g, "")) return send(json(404, { object: "error", status: 404, code: "object_not_found" }))
      return send(json(200, { object: "database", id: FAKE_DATABASE_ID, title: [], data_sources: [{ id: FAKE_DATA_SOURCE_ID, name: "Website content" }] }))
    }

    if ((match = m(/^\/v1\/data_sources\/([^/]+)$/)) && req.method === "GET") {
      const properties = Object.fromEntries(SCHEMA.map((p) => [p.name, { id: p.name, name: p.name, type: p.type, [p.type]: p.options ? { options: p.options } : {} }]))
      return send(json(200, { object: "data_source", id: FAKE_DATA_SOURCE_ID, properties }))
    }

    if ((match = m(/^\/v1\/data_sources\/([^/]+)\/query$/)) && req.method === "POST") {
      const body = await new Promise<string>((resolve) => {
        let s = ""
        req.on("data", (c) => (s += c))
        req.on("end", () => resolve(s))
      })
      type Condition = { property?: string; checkbox?: { equals?: boolean }; select?: { equals?: string } }
      const query = JSON.parse(body || "{}") as { start_cursor?: string; page_size?: number; filter?: Condition & { or?: Condition[] } }
      // the two conditions the site asks for, alone or either of them
      const holds = (page: (typeof results)[number], c: Condition) => {
        const value = (page.properties as Record<string, { checkbox?: boolean; select?: { name?: string } | null } | undefined>)[c.property ?? ""]
        return c.checkbox ? value?.checkbox === c.checkbox.equals : c.select ? value?.select?.name === c.select.equals : true
      }
      let results = data().pages
      const filter = query.filter
      if (filter?.or) results = results.filter((p) => filter.or!.some((c) => holds(p, c)))
      else if (filter?.property) results = results.filter((p) => holds(p, filter))
      const size = Math.min(pageSize ?? query.page_size ?? 100, 100)
      const start = query.start_cursor ? Number(query.start_cursor) : 0
      const slice = results.slice(start, start + size)
      const more = start + size < results.length
      return send(json(200, { object: "list", results: slice, has_more: more, next_cursor: more ? String(start + size) : null }))
    }

    if ((match = m(/^\/v1\/blocks\/([^/]+)\/children$/)) && req.method === "GET") {
      const node = data().tree[match[1]]
      if (!node) return send(json(404, { object: "error", status: 404, code: "object_not_found" }))
      const size = Math.min(pageSize ?? Number(url.searchParams.get("page_size") ?? 100), 100)
      const start = Number(url.searchParams.get("start_cursor") ?? 0)
      const ids = node.children.slice(start, start + size)
      const more = start + size < node.children.length
      return send(json(200, { object: "list", results: ids.map((id) => data().tree[id].block), has_more: more, next_cursor: more ? String(start + size) : null }))
    }

    if ((match = m(/^\/v1\/blocks\/([^/]+)$/)) && req.method === "GET") {
      const node = data().tree[match[1]]
      return node?.block && (node.block as { type?: string }).type ? send(json(200, node.block)) : send(json(404, { object: "error", status: 404, code: "object_not_found" }))
    }

    if ((match = m(/^\/v1\/pages\/([^/]+)$/)) && req.method === "GET") {
      const page = data().pages.find((p) => p.id === match![1])
      return page ? send(json(200, page)) : send(json(404, { object: "error", status: 404, code: "object_not_found" }))
    }

    return send(json(404, { object: "error", status: 404, code: "invalid_request_url" }))
  })

  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}`
  return {
    url: base,
    databaseId: FAKE_DATABASE_ID,
    server,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
