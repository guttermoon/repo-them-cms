/**
 * How the shop takes money, from the deployment's settings
 * (docs/commerce.md). The catalogue is the shop platform's: the Product
 * rows are its copy, brought in by `npm run shop:import`.
 *
 * - `COMMERCE_PROVIDER=shopify` with `SHOPIFY_STORE_DOMAIN`: the cart checks
 *   out at the Shopify shop through a cart permalink. Printify connected to
 *   that shop fulfils the orders as it always does.
 * - `COMMERCE_PROVIDER=printify` (or `links`, the same thing): no cart;
 *   each product's button is its own Link, its page in a Printify Pop-Up
 *   Store.
 * - unset: the shop is an example. It is browsable, its cart works in the
 *   reader's browser, nothing can be bought, it says so, and search engines
 *   are told not to index it, so fictional goods never reach a search
 *   result as products.
 *
 * Imports only the cart's own rules, so `npm test` loads it.
 */
import { shopDomain } from "./cart"

export type Commerce =
  | { mode: "shopify"; domain: string }
  | { mode: "links" }
  | { mode: "demo"; reason: string }

type Env = Record<string, string | undefined>

export function commerce(env: Env = process.env): Commerce {
  const provider = env.COMMERCE_PROVIDER?.trim().toLowerCase()
  if (provider === "shopify") {
    const domain = shopDomain(env.SHOPIFY_STORE_DOMAIN)
    return domain ? { mode: "shopify", domain } : { mode: "demo", reason: "SHOPIFY_STORE_DOMAIN is not a shop address (your-store.myshopify.com)" }
  }
  if (provider === "printify" || provider === "links") return { mode: "links" }
  if (provider) return { mode: "demo", reason: `COMMERCE_PROVIDER "${provider}" is not shopify or printify` }
  return { mode: "demo", reason: "COMMERCE_PROVIDER is not set" }
}

/** Whether things can actually be bought: the shop is real. */
export const shopIsLive = (c: Commerce): boolean => c.mode !== "demo"

/**
 * Whether the header offers a cart: there are products, or a live shop, and
 * the site's cart is where they are bought. A Printify store takes every
 * order itself (each Buy button goes there), so a cart here would only ever
 * be empty.
 */
export const headerCart = (products: number, c: Commerce): boolean => c.mode !== "links" && (products > 0 || shopIsLive(c))

/** What a product's button does, given how the shop sells. */
export type BuyAction = { kind: "cart" } | { kind: "link"; href: string } | { kind: "enquire" } | { kind: "sold-out" }

export function buyAction(
  c: Commerce,
  product: { variants?: { id: string }[]; link?: string; stock?: { name: string } },
): BuyAction {
  if (product.stock?.name.toLowerCase() === "sold out") return { kind: "sold-out" }
  // in the example shop the cart is there to be tried
  if ((c.mode === "shopify" || c.mode === "demo") && product.variants?.length) return { kind: "cart" }
  if (product.link && /^https:\/\//i.test(product.link)) return { kind: "link", href: product.link }
  if (c.mode === "demo") return { kind: "cart" }
  return { kind: "enquire" }
}
