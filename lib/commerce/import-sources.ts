/**
 * Reading products from Shopify and from Printify, for `npm run
 * shop:import`. Both take `fetch` and `sleep` as arguments, so the tests run
 * them against stand-ins (tests/shop-import.test.mjs), and both say what
 * went wrong in words that point at the setting to fix. No message ever
 * carries a token.
 *
 * - **Shopify**: the Storefront API, the one a shop's own storefront uses,
 *   with a Storefront access token (`SHOPIFY_STOREFRONT_TOKEN`, from the
 *   Headless sales channel). It reads what the shop publishes and nothing
 *   else: no orders, no customers.
 * - **Printify**: its REST API with a personal access token
 *   (`PRINTIFY_API_TOKEN`) that can read products.
 *
 * Neither publishes a hard page-size limit this code can rely on, so both
 * adapt: a Shopify query that is too costly is asked again for fewer
 * products a page, and a Printify page size it refuses is dropped for its
 * default. Busy answers (429, Shopify's 430, 5xx) are retried with backoff.
 */
import { MAX_IMAGES, plural, type PrintifyProduct, type ShopifyProduct, type ShopifyVariant } from "./import"

/** A failure the person running the import can act on; its message says how. */
export class ImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ImportError"
  }
}

type Fetch = typeof fetch
export type Sleep = (ms: number) => Promise<void>
type Log = (line: string) => void
const wait: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const short = (text: string) => (text.length > 300 ? `${text.slice(0, 300)}…` : text).replace(/\s+/g, " ").trim()

/** One request, retried while the other end says it is busy. */
async function send(fetchFn: Fetch, url: string, init: RequestInit, what: string, sleep: Sleep, tries = 4): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let res: Response
    try {
      res = await fetchFn(url, init)
    } catch (error) {
      if (attempt >= tries) throw new ImportError(`${what} could not be reached (${error instanceof Error ? error.message : String(error)}).`)
      await sleep(backoff(attempt))
      continue
    }
    const busy = res.status === 429 || res.status === 430 || res.status >= 500
    if (busy && attempt < tries) {
      await res.body?.cancel().catch(() => {})
      await sleep(retryAfter(res) ?? backoff(attempt))
      continue
    }
    return res
  }
}

const backoff = (attempt: number) => Math.min(8_000, 500 * 2 ** (attempt - 1))
const retryAfter = (res: Response): number | undefined => {
  const seconds = Number(res.headers.get("retry-after"))
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 30_000) : undefined
}

// ---------------------------------------------------------------- Shopify

/**
 * The Storefront API version the queries are written against. Shopify
 * supports each quarterly version for at least a year, and its fields used
 * here have not changed in years; `SHOPIFY_API_VERSION` picks another.
 */
export const SHOPIFY_API_VERSION = "2026-10"

/** A Storefront API version: a quarter's ("2026-10") or "unstable". */
export const shopifyVersion = (raw: string | undefined): string | undefined => {
  const value = raw?.trim()
  return value && /^(\d{4}-(01|04|07|10)|unstable)$/.test(value) ? value : undefined
}

const VARIANT_FIELDS = "id title availableForSale price { amount currencyCode } compareAtPrice { amount currencyCode }"

export const PRODUCTS_QUERY = `query Products($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: ID) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title descriptionHtml productType tags availableForSale onlineStoreUrl
      images(first: ${MAX_IMAGES}) { nodes { url altText } }
      variants(first: 100) { pageInfo { hasNextPage endCursor } nodes { ${VARIANT_FIELDS} } }
    }
  }
}`

export const VARIANTS_QUERY = `query Variants($id: ID!, $after: String) {
  product(id: $id) {
    variants(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes { ${VARIANT_FIELDS} } }
  }
}`

type GraphQLError = { message?: string; extensions?: { code?: string } }
type GraphQLAnswer<T> = { data?: T | null; errors?: GraphQLError[] }
type Page<T> = { pageInfo?: { hasNextPage: boolean; endCursor: string | null }; nodes?: T[] }

export type ShopifyOptions = {
  domain: string
  token: string
  version?: string
  fetch?: Fetch
  sleep?: Sleep
  log?: Log
  /** products asked for a page, halved while Shopify says a query costs too much */
  pageSize?: number
}

/** Every product the shop publishes to the Storefront API, with all their variants. */
export async function fetchShopify(options: ShopifyOptions): Promise<ShopifyProduct[]> {
  const { domain, token, version = SHOPIFY_API_VERSION, fetch: fetchFn = fetch, sleep = wait, log = () => {} } = options
  const url = `https://${domain}/api/${version}/graphql.json`

  const post = async <T>(query: string, variables: Record<string, unknown>): Promise<GraphQLAnswer<T>> => {
    const res = await send(
      fetchFn,
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "X-Shopify-Storefront-Access-Token": token },
        body: JSON.stringify({ query, variables }),
      },
      `Shopify (${domain})`,
      sleep,
    )
    if (res.status === 401 || res.status === 403) {
      throw new ImportError(
        `Shopify refused the Storefront token (${res.status}). SHOPIFY_STOREFRONT_TOKEN must be a Storefront API access token for ${domain} (the Headless sales channel's public one), not an Admin API token.`,
      )
    }
    if (res.status === 402) throw new ImportError(`Shopify says the shop ${domain} is not open (402: unpaid, frozen or paused).`)
    if (res.status === 404) {
      throw new ImportError(`There is no Storefront API at ${url}. Check SHOPIFY_STORE_DOMAIN (your-store.myshopify.com) and SHOPIFY_API_VERSION.`)
    }
    if (!res.ok) throw new ImportError(`Shopify answered ${res.status} ${res.statusText}: ${short(await res.text().catch(() => ""))}`)
    const body = (await res.json().catch(() => null)) as GraphQLAnswer<T> | null
    if (!body || typeof body !== "object") throw new ImportError("Shopify's answer was not JSON.")
    return body
  }

  const describe = (errors: GraphQLError[]) => errors.map((e) => e.message ?? e.extensions?.code ?? "an error").join("; ")

  /** The variants past a product's first hundred. */
  async function moreVariants(id: string, cursor: string | null): Promise<ShopifyVariant[]> {
    const out: ShopifyVariant[] = []
    let after = cursor
    for (let pages = 0; after && pages < 100; pages++) {
      const body = await post<{ product: { variants: Page<ShopifyVariant> } | null }>(VARIANTS_QUERY, { id, after })
      const variants = body.data?.product?.variants
      if (!variants) throw new ImportError(`Shopify would not list the rest of a product's variants: ${describe(body.errors ?? [])}`)
      out.push(...(variants.nodes ?? []))
      after = variants.pageInfo?.hasNextPage ? variants.pageInfo.endCursor : null
    }
    return out
  }

  const products: ShopifyProduct[] = []
  let first = Math.max(1, Math.min(250, options.pageSize ?? 50))
  let after: string | null = null
  let throttled = 0
  for (let pages = 0; ; ) {
    const body: GraphQLAnswer<{ products: Page<ShopifyProduct> }> = await post(PRODUCTS_QUERY, { first, after })
    const errors = body.errors ?? []
    if (errors.length && !body.data?.products) {
      const codes = errors.map((e) => `${e.extensions?.code ?? ""} ${e.message ?? ""}`).join(" ")
      if (/THROTTLED/i.test(codes) && throttled < 5) {
        throttled++
        await sleep(2_000 * throttled)
        continue
      }
      if (/COST|COMPLEX/i.test(codes) && first > 1) {
        first = Math.max(1, Math.floor(first / 2))
        log(`Shopify found the query too costly; asking for ${plural(first, "product")} a page.`)
        continue
      }
      throw new ImportError(`Shopify refused the query: ${describe(errors)}`)
    }
    const connection = body.data?.products
    if (!connection) throw new ImportError("Shopify's answer had no products in it.")
    for (const node of connection.nodes ?? []) {
      const variants = node.variants ?? { nodes: [] }
      if (variants.pageInfo?.hasNextPage) variants.nodes = [...(variants.nodes ?? []), ...(await moreVariants(node.id, variants.pageInfo.endCursor))]
      products.push({ ...node, variants })
    }
    if (!connection.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break
    after = connection.pageInfo.endCursor
    if (++pages >= 1000) throw new ImportError("Shopify was still listing products after 1,000 pages; stopping there.")
  }
  return products
}

// ---------------------------------------------------------------- Printify

export const PRINTIFY_API = "https://api.printify.com"
/** Printify asks API clients to name themselves; this names the template,
 *  never the person running it. */
export const PRINTIFY_USER_AGENT = "repo-them-shop-import"

export type PrintifyOptions = {
  token: string
  fetch?: Fetch
  sleep?: Sleep
  log?: Log
  base?: string
}

const printifyHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": PRINTIFY_USER_AGENT })

async function printifyFailure(res: Response, shopId?: string): Promise<ImportError> {
  if (res.status === 401 || res.status === 403) {
    return new ImportError(
      `Printify refused the token (${res.status}). PRINTIFY_API_TOKEN must be a personal access token (Printify: My Profile → Connections) that can read shops and products.`,
    )
  }
  if (res.status === 404 && shopId) {
    return new ImportError(`Printify has no shop ${shopId} for this token. Leave PRINTIFY_SHOP_ID unset and the import lists the shops it can see.`)
  }
  return new ImportError(`Printify answered ${res.status} ${res.statusText}: ${short(await res.text().catch(() => ""))}`)
}

/** The shops a token can see, so somebody can pick PRINTIFY_SHOP_ID. */
export async function listPrintifyShops(options: PrintifyOptions): Promise<{ id: string; title: string; channel: string }[]> {
  const { token, fetch: fetchFn = fetch, sleep = wait, base = PRINTIFY_API } = options
  const res = await send(fetchFn, `${base}/v1/shops.json`, { headers: printifyHeaders(token) }, "Printify", sleep)
  if (!res.ok) throw await printifyFailure(res)
  const body = (await res.json().catch(() => null)) as { id?: number | string; title?: string; sales_channel?: string }[] | null
  if (!Array.isArray(body)) throw new ImportError("Printify's list of shops was not a list.")
  return body.map((shop) => ({ id: String(shop.id ?? ""), title: shop.title ?? "", channel: shop.sales_channel ?? "" }))
}

/** Every product in a Printify shop, a page at a time. */
export async function fetchPrintify(options: PrintifyOptions & { shopId: string; limit?: number }): Promise<PrintifyProduct[]> {
  const { token, shopId, fetch: fetchFn = fetch, sleep = wait, log = () => {}, base = PRINTIFY_API, limit = 50 } = options
  const products: PrintifyProduct[] = []
  let sized = true
  for (let page = 1; page <= 1000; ) {
    const url = `${base}/v1/shops/${encodeURIComponent(shopId)}/products.json?page=${page}${sized ? `&limit=${limit}` : ""}`
    const res = await send(fetchFn, url, { headers: printifyHeaders(token) }, "Printify", sleep)
    if (res.status === 400 && sized) {
      const text = await res.text().catch(() => "")
      if (/limit/i.test(text)) {
        sized = false
        log(`Printify would not send ${limit} products a page; reading its own page size instead.`)
        continue
      }
      throw new ImportError(`Printify refused the request (400): ${short(text)}`)
    }
    if (!res.ok) throw await printifyFailure(res, shopId)
    const body = (await res.json().catch(() => null)) as { data?: PrintifyProduct[]; last_page?: number; current_page?: number } | null
    if (!body || !Array.isArray(body.data)) throw new ImportError("Printify's answer had no list of products in it.")
    products.push(...body.data)
    const last = Number(body.last_page)
    if (!body.data.length || !Number.isFinite(last) || page >= last) return products
    page++
  }
  throw new ImportError("Printify was still listing products after 1,000 pages; stopping there.")
}
