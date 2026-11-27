"use client"

import Link from "next/link"

import { capturePostHogEvent } from "@/components/layout/posthog-analytics"
import { fillIn } from "@/components/system/notion-text"
import { buttonClass } from "@/components/ui/button"
import { cartPermalink, itemCount, MAX_QUANTITY, type CartLine } from "@/lib/commerce/cart"
import type { Commerce } from "@/lib/commerce/config"
import { formatPrice } from "@/lib/pricing"

import { useCart } from "./cart-context"
import { picture } from "@/lib/media-sizes"
import { QuantityStepper } from "./quantity-stepper"
import { outsideLink } from "@/lib/outside"

/**
 * The cart page's body: each line with its picture, name, variant, price
 * and quantity (steppers and a field, all labelled), the subtotal, and the
 * way to pay. The subtotal is the shop's prices as Notion has them, and
 * says so: the shop's own checkout prices the order.
 */
export type CartProduct = {
  title: string
  href: string
  image?: string
  price?: number
  currency: string
  variants: { label: string; id: string }[]
  /** Stock is Sold out: kept in the cart, left out of the checkout */
  soldOut?: boolean
}

export type CartLabels = {
  empty: string
  browse: string
  product: string
  quantity: string
  remove: string
  less: string
  more: string
  gone: string
  subtotal: string
  subtotalNote: string
  checkout: string
  demo: string
  links: string
  removed: string
  /** said to a screen reader when a line's quantity changes: `{name}` and
   *  `{count}` filled in */
  count: string
  /** said under the checkout when some lines cannot be bought any more */
  left: string
  /** on a line whose product is sold out */
  soldOut: string
  /** on a line whose size or colour is no longer offered */
  unavailable: string
}

/**
 * A line the shop can still sell: its product is in the shop, not sold out,
 * and the variant chosen (when there was a choice) still exists. Anything
 * else stays in the cart, marked, for the reader to take out, but never
 * reaches the checkout or the subtotal, where Shopify would refuse it.
 */
export function sellable(line: { slug: string; variant?: string }, products: Record<string, CartProduct>): boolean {
  const product = products[line.slug]
  if (!product || product.soldOut) return false
  return line.variant ? product.variants.some((v) => v.id === line.variant) : !product.variants.some((v) => v.id)
}

export function CartView({ products, commerce, labels }: { products: Record<string, CartProduct>; commerce: Commerce; labels: CartLabels }) {
  const cart = useCart()
  if (!cart.ready) return <p className="text-body text-sub">…</p>

  if (!cart.lines.length) {
    return (
      <div className="rounded-card bg-panel p-8 text-center">
        <p className="text-lead text-ink">{labels.empty}</p>
        <Link href="/shop" className={buttonClass("primary", "mt-5")}>
          {labels.browse}
        </Link>
      </div>
    )
  }

  const buyable = cart.lines.filter((line) => sellable(line, products))
  const currencies = new Set<string>()
  let subtotal = 0
  for (const line of buyable) {
    const product = products[line.slug]
    if (product?.price !== undefined) {
      subtotal += product.price * line.quantity
      currencies.add(product.currency)
    }
  }
  const currency = currencies.size === 1 ? [...currencies][0] : undefined
  const checkout = commerce.mode === "shopify" ? cartPermalink(commerce.domain, buyable) : undefined
  const changeQuantity = (line: CartLine, name: string, quantity: number, message?: string) => {
    if (quantity < 1) {
      cart.setQty(line, quantity, message)
      capturePostHogEvent("cart_item_removed", { product_slug: line.slug, variant_id: line.variant })
      return
    }
    const nextQuantity = Math.min(MAX_QUANTITY, Math.floor(quantity))
    // every change is heard, not only an addition or a removal
    const said = message ?? (nextQuantity !== line.quantity ? fillIn(labels.count, { name, count: nextQuantity }) : undefined)
    cart.setQty(line, nextQuantity, said)
    if (nextQuantity !== line.quantity) {
      capturePostHogEvent("cart_item_quantity_updated", {
        product_slug: line.slug,
        variant_id: line.variant,
        previous_quantity: line.quantity,
        quantity: nextQuantity,
      })
    }
  }
  const removeItem = (line: CartLine, message: string) => {
    cart.remove(line, message)
    capturePostHogEvent("cart_item_removed", { product_slug: line.slug, variant_id: line.variant })
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <ul className="divide-y divide-[color:var(--c-line)] border-y border-line">
        {cart.lines.map((line) => {
          const product = products[line.slug]
          const variant = product?.variants.find((v) => v.id === line.variant)
          const name = product ? `${product.title}${variant?.label ? ` (${variant.label})` : ""}` : line.slug
          const key = `${line.slug}:${line.variant ?? ""}`
          return (
            <li key={key} className="flex gap-4 py-5">
              {product?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img {...picture(product.image, 160)} data-goods alt="" className="h-20 w-20 shrink-0 rounded-block border border-line bg-panel object-cover" />
              ) : (
                <span aria-hidden="true" className="h-20 w-20 shrink-0 rounded-block bg-panel" />
              )}
              <div className="min-w-0 flex-1">
                {product ? (
                  <Link href={product.href} className="title-slab inline-flex min-h-target items-center text-head-s hover:underline">
                    {product.title}
                  </Link>
                ) : (
                  <p className="text-ui text-sub">{labels.gone}</p>
                )}
                {variant?.label ? <p className="text-small text-sub">{variant.label}</p> : null}
                {product?.price !== undefined ? <p className="mt-1 text-ui text-ink">{formatPrice(product.price, product.currency)}</p> : null}
                {product && !sellable(line, products) ? (
                  <p className="mt-1 text-small font-medium text-[color:var(--n-red)]">{product.soldOut ? labels.soldOut : labels.unavailable}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <QuantityStepper
                    id={`qty-${key}`}
                    value={line.quantity}
                    onLess={() => changeQuantity(line, name, line.quantity - 1, line.quantity === 1 ? `${labels.removed.trimEnd()} ${name}` : undefined)}
                    onMore={() => changeQuantity(line, name, line.quantity + 1)}
                    onType={(quantity) => changeQuantity(line, name, quantity)}
                    labels={{ quantity: `${labels.quantity}: ${name}`, less: `${labels.less}: ${name}`, more: `${labels.more}: ${name}` }}
                  />
                  <button
                    type="button"
                    aria-label={`${labels.remove}: ${name}`}
                    onClick={() => removeItem(line, `${labels.removed.trimEnd()} ${name}`)}
                    className="ml-2 inline-flex min-h-[44px] items-center text-small font-medium text-strong underline underline-offset-4"
                  >
                    {labels.remove}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <aside aria-label={labels.subtotal} className="receipt h-fit rounded-t-text bg-panel p-6 lg:sticky lg:top-[88px]">
        <p className="flex items-baseline justify-between gap-4">
          <span className="title-slab text-head-s">{labels.subtotal}</span>
          <span className="title-slab text-head-m">{currency ? formatPrice(subtotal, currency) : "–"}</span>
        </p>
        <p className="mt-1 text-small text-sub">
          {itemCount(buyable)} · {labels.subtotalNote}
        </p>
        {buyable.length < cart.lines.length ? <p className="mt-2 text-small text-ink">{labels.left}</p> : null}
        {commerce.mode === "shopify" && checkout ? (
          <a
            href={checkout}
            {...outsideLink(checkout)}
            onClick={() => capturePostHogEvent("checkout_started", { item_count: itemCount(buyable), subtotal, currency })}
            className={buttonClass("primary", "mt-5 min-h-[48px] w-full")}
          >
            {labels.checkout}
          </a>
        ) : (
          <>
            <button type="button" disabled className={buttonClass("primary", "mt-5 min-h-[48px] w-full")}>
              {labels.checkout}
            </button>
            {/* a real shop with nothing left to buy is not an example shop: "left" above has said why */}
            {commerce.mode === "shopify" ? null : <p className="mt-3 text-small leading-relaxed text-ink">{commerce.mode === "links" ? labels.links : labels.demo}</p>}
          </>
        )}
      </aside>
    </div>
  )
}
