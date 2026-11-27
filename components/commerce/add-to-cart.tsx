"use client"

import Link from "next/link"
import { useId, useState } from "react"

import { capturePostHogEvent } from "@/components/layout/posthog-analytics"
import { buttonClass } from "@/components/ui/button"
import type { BuyAction } from "@/lib/commerce/config"
import { MAX_QUANTITY } from "@/lib/commerce/cart"

import { SelectLine } from "@/components/system/select-line"

import { useCart } from "./cart-context"
import { QuantityStepper } from "./quantity-stepper"
import { outsideLink } from "@/lib/outside"

/**
 * A product's buying controls: the variant (the site's select, when there
 * is more than one), the quantity (a stepper), and the button, which does
 * what the shop is set up to do (lib/commerce/config.ts): add to the cart,
 * go to the product's own checkout page, ask about it, or say it is sold
 * out.
 */
export type AddToCartLabels = {
  variant: string
  quantity: string
  /** the stepper's buttons */
  less: string
  more: string
  add: string
  buy: string
  enquire: string
  soldOut: string
  /** "Added to the cart: " before the product's name */
  added: string
  viewCart: string
}

export function AddToCart({
  slug,
  title,
  variants,
  action,
  labels,
}: {
  slug: string
  title: string
  variants: { label: string; id: string }[]
  action: BuyAction
  labels: AddToCartLabels
}) {
  const cart = useCart()
  const [variant, setVariant] = useState(variants[0]?.id)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  // how many times this has been added: each one is a fresh pass of the scanner
  const [scans, setScans] = useState(0)
  const id = useId()

  if (action.kind === "sold-out") {
    return (
      <button type="button" disabled className={buttonClass("outline", "w-full sm:w-auto")}>
        {labels.soldOut}
      </button>
    )
  }
  if (action.kind === "link") {
    return (
      <a href={action.href} {...outsideLink(action.href)} className={buttonClass("primary", "w-full sm:w-auto")}>
        {labels.buy}
      </a>
    )
  }
  if (action.kind === "enquire") {
    return (
      <Link href={`/contact?type=question&about=${encodeURIComponent(slug)}`} className={buttonClass("outline", "w-full sm:w-auto")}>
        {labels.enquire}
      </Link>
    )
  }

  const chosen = variants.find((v) => v.id === variant)
  return (
    <form
      className="scanned space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        cart.add({ slug, ...(variant ? { variant } : {}), quantity }, `${labels.added.trimEnd()} ${quantity} × ${title}${chosen?.label ? ` (${chosen.label})` : ""}`)
        capturePostHogEvent("product_added_to_cart", { product_slug: slug, variant_id: variant, quantity })
        setAdded(true)
        setScans((n) => n + 1)
        // a tap under the thumb, where the phone can give one
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12)
      }}
    >
      {/* the scanner's line crosses the form once for each thing added
          (app/globals.css); its key starts it again for the next */}
      {scans ? <span key={scans} aria-hidden="true" className="scan-line" /> : null}
      {variants.length > 1 ? (
        <div className="sm:w-64">
          <span aria-hidden="true" className="mb-1.5 block px-4 text-small font-medium text-ink">
            {labels.variant}
          </span>
          <SelectLine value={variant ?? ""} onChange={setVariant} options={variants.map((v) => ({ value: v.id, label: v.label || v.id }))} label={labels.variant} />
        </div>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <span aria-hidden="true" className="mb-1.5 block px-4 text-small font-medium text-ink">
            {labels.quantity}
          </span>
          <QuantityStepper
            id={`${id}-quantity`}
            value={quantity}
            onLess={() => setQuantity((q) => Math.max(1, q - 1))}
            onMore={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            onType={setQuantity}
            lessDisabled={quantity <= 1}
            labels={{ quantity: labels.quantity, less: labels.less, more: labels.more }}
          />
        </div>
        <button type="submit" className={buttonClass("primary", "min-h-[46px] w-full sm:w-auto")}>
          {labels.add}
        </button>
        {added ? (
          <Link href="/cart" className="inline-flex min-h-[44px] items-center text-ui font-medium text-strong underline underline-offset-4">
            {labels.viewCart}
          </Link>
        ) : null}
      </div>
    </form>
  )
}
