/**
 * `npm run shop:import`, from the command line to Notion: which platform,
 * its settings checked, its products read, the plan printed, and (with
 * `--write`) the plan made. The script (scripts/shop-import.mjs) only hands
 * this its arguments, its environment, `fetch` and a way to make a Notion
 * client, so the tests run the whole thing against stand-ins.
 *
 *   npm run shop:import                       a dry run: what would change
 *   npm run shop:import -- --write            make the changes
 *   npm run shop:import -- --from printify    when both platforms are set up
 *
 * Writing needs NOTION_IMPORT_TOKEN, an integration of its own that may
 * insert and update content. The site's NOTION_TOKEN stays read-only: a
 * leaked read-only token discloses the database, a leaked writing one can
 * rewrite it. A dry run reads with whichever of the two is set.
 *
 * Exit codes: 0 done; 1 a setting to fix; 2 the platform could not be read;
 * 3 Notion could not be read or written.
 */
import { notionId } from "../config"
import { schemaRequest } from "../demo/notion-shape"
import { findDataSource, type NotionClient } from "../notion/client"
import { FORMER_NAMES, PROPS, SCHEMA } from "../notion/schema"
import type { NotionRow, RowsPage } from "../notion/rows"
import { shopDomain } from "./cart"
import { blockBatches, bodyText, existingFromRow, fromPrintify, fromShopify, IMPORT_PROPERTIES, money, planImport, plural, rowsToRead, type BodyBlock, type ExistingProduct, type Mapped, type Plan, type Source } from "./import"
import { fetchPrintify, fetchShopify, ImportError, listPrintifyShops, SHOPIFY_API_VERSION, shopifyVersion, type Sleep } from "./import-sources"

type Env = Record<string, string | undefined>

export type RunOptions = {
  args: string[]
  env: Env
  fetch?: typeof fetch
  sleep?: Sleep
  /** a Notion client for a token */
  notion: (token: string) => NotionClient
  log?: (line: string) => void
}

const HELP = `Imports products from Shopify or Printify into the Notion database as Product rows.

  npm run shop:import                      a dry run: prints what would change, writes nothing
  npm run shop:import -- --write           makes the changes in Notion
  npm run shop:import -- --from shopify    or --from printify, when both are set up

Shopify:  SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_TOKEN (SHOPIFY_API_VERSION, optional)
Printify: PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID (PRINTIFY_CURRENCY, optional; USD)
Notion:   NOTION_DATABASE_ID, and NOTION_IMPORT_TOKEN to write

The shop keeps the catalogue: a row repeats it, and a product's words, price
or pictures changed in Notion are changed back. New rows are unpublished; no
row is ever deleted. See docs/commerce.md.`

const value = (env: Env, name: string) => env[name]?.trim() || undefined

function argument(args: string[], name: string): string | undefined {
  const at = args.findIndex((a) => a === name || a.startsWith(`${name}=`))
  if (at === -1) return undefined
  const arg = args[at]
  return arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : args[at + 1]
}

/** Which platform: the one asked for, or the only one set up. */
export function chooseSource(args: string[], env: Env): { source: Source } | { error: string } {
  const asked = argument(args, "--from")?.trim().toLowerCase()
  if (asked !== undefined) {
    return asked === "shopify" || asked === "printify" ? { source: asked } : { error: `--from takes shopify or printify, not "${asked}".` }
  }
  const shopify = Boolean(value(env, "SHOPIFY_STOREFRONT_TOKEN"))
  const printify = Boolean(value(env, "PRINTIFY_API_TOKEN"))
  if (shopify && printify) return { error: "Both Shopify and Printify are set up: say which with --from shopify or --from printify." }
  if (shopify) return { source: "shopify" }
  if (printify) return { source: "printify" }
  return { error: "Nothing to import from: set SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN, or PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID." }
}

/** The plan as the lines the command prints. */
export function describePlan(plan: Plan, label: string): string[] {
  const out: string[] = []
  if (plan.create.length) {
    out.push("", `New, unpublished until you tick Published (${plan.create.length}):`)
    for (const { product, slug, note } of plan.create) {
      const parts = [
        `/shop/${slug}`,
        money(product.price, product.currency, "no price"),
        product.available ? "in stock" : "sold out",
        plural(product.images.length, "picture"),
        ...(product.variants.length ? [plural(product.variants.length, "variant")] : []),
        ...(product.link ? ["buy link"] : []),
      ]
      out.push(`  + ${product.title}: ${parts.join(" · ")}${note ? ` (${note})` : ""}`)
    }
  }
  if (plan.update.length) {
    out.push("", `Changes (${plan.update.length}):`)
    for (const row of plan.update) {
      out.push(`  ~ ${row.title}: ${row.changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join("; ")}${row.note ? ` (${row.note})` : ""}`)
    }
  }
  if (plan.unchanged.length) {
    out.push("", `Already up to date (${plan.unchanged.length}):`)
    for (const row of plan.unchanged) out.push(`  = ${row.title}${row.note ? ` (${row.note})` : ""}`)
  }
  if (plan.gone.length) {
    out.push("", `No longer in ${label}, left as they are (unpublish them in Notion if they should go):`)
    for (const row of plan.gone) out.push(`  ? ${row.title}`)
  }
  if (plan.byHand.length) {
    out.push("", `Typed into Notion, and not in ${label}: nothing keeps these in step with a shop (${plan.byHand.length}):`)
    for (const row of plan.byHand) out.push(`  ! ${row.title}`)
  }
  if (plan.skipped.length) {
    out.push("", `Not imported (${plan.skipped.length}):`)
    for (const row of plan.skipped) out.push(`  - ${row.title}: ${row.reason}`)
  }
  if (!plan.create.length && !plan.update.length && !plan.unchanged.length && !plan.skipped.length) out.push("", `${label} has no products to import.`)
  return out
}

/** Every Product row, published or not: new rows start unpublished, and a
 *  second import has to find them. */
export async function readProductRows(client: NotionClient, dataSourceId: string): Promise<ExistingProduct[]> {
  const rows: ExistingProduct[] = []
  let cursor: string | undefined
  do {
    const page = (await client.dataSources.query({
      data_source_id: dataSourceId,
      filter: { property: PROPS.kind, select: { equals: "Product" } },
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    } as never)) as unknown as RowsPage
    for (const result of page.results as NotionRow[]) {
      if (result.object === "data_source") continue
      const row = existingFromRow(result)
      if (row) rows.push(row)
    }
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
  } while (cursor)
  return rows
}

/** A row's page as the import compares it: its words, and its blocks' IDs
 *  for the write that would replace them. */
export async function readBody(client: NotionClient, pageId: string): Promise<NonNullable<ExistingProduct["body"]>> {
  const blocks: BodyBlock[] = []
  let cursor: string | undefined
  do {
    const page = (await client.blocks.children.list({ block_id: pageId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })) as unknown as {
      results: BodyBlock[]
      has_more: boolean
      next_cursor: string | null
    }
    blocks.push(...page.results)
    cursor = page.has_more && page.next_cursor ? page.next_cursor : undefined
  } while (cursor)
  return { text: bodyText(blocks), blockIds: blocks.flatMap((block) => block.id ?? []) }
}

/** The properties a write needs that the database does not have, any it
 *  has as the wrong type (which a write cannot fix), and any it has under a
 *  former name (FORMER_NAMES), which the write uses instead of adding the
 *  new one beside it. */
export function propertyGaps(found: Record<string, { type?: string } | undefined>): { missing: string[]; wrong: string[]; renamed: Record<string, string> } {
  const missing: string[] = []
  const wrong: string[] = []
  const renamed: Record<string, string> = {}
  for (const name of IMPORT_PROPERTIES) {
    const want = SCHEMA.find((p) => p.name === name)?.type
    const former = FORMER_NAMES[name]
    if (!found[name] && former && found[former]) renamed[name] = former
    const have = found[renamed[name] ?? name]?.type
    // the title property may be called anything; the site finds it by type
    if (name === PROPS.title) {
      if (!Object.values(found).some((p) => p?.type === "title")) missing.push(name)
      continue
    }
    if (!have) missing.push(name)
    else if (have !== want) wrong.push(`"${renamed[name] ?? name}" is ${have}; the import writes ${want}`)
  }
  return { missing, wrong, renamed }
}

/** A row's properties under the names the database has them by. */
export function asNamed<T>(properties: Record<string, T>, renamed: Record<string, string>): Record<string, T> {
  return Object.fromEntries(Object.entries(properties).map(([name, value]) => [renamed[name] ?? name, value]))
}

export async function runImport(options: RunOptions): Promise<number> {
  const { args, env, fetch: fetchFn = fetch, sleep, notion } = options
  const log = (...lines: string[]) => {
    for (const line of lines) (options.log ?? console.log)(line)
  }
  if (args.includes("--help") || args.includes("-h")) {
    log(HELP)
    return 0
  }
  const write = args.includes("--write")
  const chosen = chooseSource(args, env)
  if ("error" in chosen) {
    log(`✗ ${chosen.error}`)
    return 1
  }
  const { source } = chosen

  // ── the Notion side, checked before the platform is asked for anything
  const databaseId = notionId(env.NOTION_DATABASE_ID)
  const importToken = value(env, "NOTION_IMPORT_TOKEN")
  const siteToken = value(env, "NOTION_TOKEN")
  if (write && !importToken) {
    log("✗ --write needs NOTION_IMPORT_TOKEN: an integration of its own that may read, insert and update content (docs/commerce.md). The site's NOTION_TOKEN stays read-only.")
    return 1
  }
  if (write && !databaseId) {
    log("✗ --write needs NOTION_DATABASE_ID: the database the site reads.")
    return 1
  }
  if (write && importToken && importToken === siteToken) {
    log("! NOTION_IMPORT_TOKEN is the site's own NOTION_TOKEN, so the site's token can write to Notion. Give the import an integration of its own and set the site's back to Read content only.")
  }

  // ── the platform
  let mapped: Mapped
  let label: string
  try {
    if (source === "shopify") {
      const domain = shopDomain(env.SHOPIFY_STORE_DOMAIN)
      const token = value(env, "SHOPIFY_STOREFRONT_TOKEN")
      const version = value(env, "SHOPIFY_API_VERSION")
      if (!domain) {
        log("✗ SHOPIFY_STORE_DOMAIN must be the shop's address, e.g. your-store.myshopify.com.")
        return 1
      }
      if (!token) {
        log("✗ SHOPIFY_STOREFRONT_TOKEN is not set: a Storefront API access token (Shopify admin → Sales channels → Headless).")
        return 1
      }
      if (version && !shopifyVersion(version)) {
        log(`✗ SHOPIFY_API_VERSION must be a Storefront API version such as ${SHOPIFY_API_VERSION}, or be left unset.`)
        return 1
      }
      label = "Shopify"
      log(`Reading products from Shopify (${domain})…`)
      mapped = fromShopify(await fetchShopify({ domain, token, version: shopifyVersion(version), fetch: fetchFn, sleep, log }))
    } else {
      const token = value(env, "PRINTIFY_API_TOKEN")
      const shopId = value(env, "PRINTIFY_SHOP_ID")
      const currency = (value(env, "PRINTIFY_CURRENCY") ?? "USD").toUpperCase()
      if (!token) {
        log("✗ PRINTIFY_API_TOKEN is not set: a personal access token (Printify: My Profile → Connections).")
        return 1
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        log("✗ PRINTIFY_CURRENCY must be a three-letter currency code, such as USD or GBP.")
        return 1
      }
      if (!shopId || !/^\d+$/.test(shopId)) {
        const shops = await listPrintifyShops({ token, fetch: fetchFn, sleep })
        log(shopId ? `✗ PRINTIFY_SHOP_ID must be a shop's number, not "${shopId}".` : "✗ PRINTIFY_SHOP_ID is not set.")
        if (shops.length) {
          log("  The token can see these shops; set PRINTIFY_SHOP_ID to one of them:")
          for (const shop of shops) log(`    ${shop.id}  ${shop.title}${shop.channel ? ` (${shop.channel})` : ""}`)
        } else {
          log("  The token can see no shops.")
        }
        return 1
      }
      label = "Printify"
      log(`Reading products from Printify (shop ${shopId})…`)
      mapped = fromPrintify(await fetchPrintify({ token, shopId, fetch: fetchFn, sleep, log }), currency)
    }
  } catch (error) {
    if (!(error instanceof ImportError)) throw error
    log(`✗ ${error.message}`)
    return 2
  }
  log(`  ${plural(mapped.products.length, "product")} to import${mapped.skipped.length ? `, ${mapped.skipped.length} not` : ""}.`)

  // ── what is in Notion
  const readToken = importToken ?? siteToken
  let client: NotionClient | undefined
  let dataSourceId: string | undefined
  let existing: ExistingProduct[] = []
  let missing: string[] = []
  let renamed: Record<string, string> = {}
  if (databaseId && readToken) {
    try {
      client = notion(readToken)
      dataSourceId = (await findDataSource(client, databaseId)).id
      const found = ((await client.dataSources.retrieve({ data_source_id: dataSourceId })) as { properties?: Record<string, { type?: string }> }).properties ?? {}
      const gaps = propertyGaps(found)
      if (gaps.wrong.length) {
        for (const line of gaps.wrong) log(`✗ The database's property ${line}. Change its type in Notion, then run the import again.`)
        return 3
      }
      missing = gaps.missing
      renamed = gaps.renamed
      if (!found[PROPS.kind]) {
        log(`✗ The database has no "${PROPS.kind}" property: is NOTION_DATABASE_ID the site's database? (npm run notion:check)`)
        return 3
      }
      existing = await readProductRows(client, dataSourceId)
      log(`Notion has ${plural(existing.length, "Product row")}.`)
      // one page at a time, well inside Notion's limit
      for (const row of rowsToRead(existing, mapped)) row.body = await readBody(client, row.id)
    } catch (error) {
      log(`✗ Notion could not be read: ${error instanceof Error ? error.message : String(error)}`)
      return 3
    }
  } else {
    log("Notion is not set up here (NOTION_DATABASE_ID and a token), so everything below is shown as new.")
  }

  const plan = planImport(existing, mapped, source)
  for (const line of describePlan(plan, label)) log(line)
  if (missing.length) log("", `${write ? "Adding" : "Would add"} the propert${missing.length === 1 ? "y" : "ies"} ${missing.map((m) => `"${m}"`).join(", ")} to the database.`)

  if (!write) {
    log("", "Dry run: nothing was written. Run it again with --write to make these changes.")
    return 0
  }
  if (!client || !dataSourceId) return 3

  // ── the write
  try {
    if (missing.length) {
      const config = schemaRequest() as Record<string, unknown>
      await client.dataSources.update({ data_source_id: dataSourceId, properties: Object.fromEntries(missing.map((name) => [name, config[name]])) } as never)
    }
  } catch (error) {
    log(`✗ Notion would not add the properties: ${error instanceof Error ? error.message : String(error)}`)
    return 3
  }
  let failed = 0
  let made = 0
  let changed = 0
  for (const row of plan.create) {
    try {
      // a page is made with its first hundred blocks, and takes the rest after
      const [first = [], ...rest] = blockBatches(row.children)
      const page = (await client.pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: asNamed(row.properties, renamed),
        ...(first.length ? { children: first } : {}),
      } as never)) as { id: string }
      for (const children of rest) await client.blocks.children.append({ block_id: page.id, children } as never)
      made++
    } catch (error) {
      failed++
      log(`✗ Could not make "${row.product.title}": ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  for (const row of plan.update) {
    try {
      if (Object.keys(row.properties).length) await client.pages.update({ page_id: row.id, properties: asNamed(row.properties, renamed) } as never)
      if (row.body) {
        // the shop's words go in before the old ones come out: a request
        // that fails part-way leaves a page with too much on it, which the
        // next import puts right, never one with its words gone
        for (const children of blockBatches(row.body.children)) await client.blocks.children.append({ block_id: row.id, children } as never)
        for (const blockId of row.body.remove) await client.blocks.delete({ block_id: blockId })
      }
      changed++
    } catch (error) {
      failed++
      log(`✗ Could not change "${row.title}": ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  log(
    "",
    `Done: ${plural(made, "row")} made, ${changed} changed${failed ? `, ${failed} failed` : ""}.`,
    ...(made ? ["The new rows are unpublished: check each one in Notion, then tick Published."] : []),
  )
  return failed ? 3 : 0
}
