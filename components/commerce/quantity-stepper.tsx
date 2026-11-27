"use client"

import { MAX_QUANTITY } from "@/lib/commerce/cart"

/**
 * A quantity, as one field: a pill holding one fewer, the number and one
 * more (docs/design.md, "Shape"). The number can be typed as well; the
 * buttons are round, 44px, and named for the thing they count ("One more:
 * Coffee"). What a press does is the caller's: the cart takes a line out at
 * one fewer than one, a product page stops at one.
 */
export function QuantityStepper({
  id,
  value,
  onLess,
  onMore,
  onType,
  labels,
  lessDisabled = false,
  className = "",
}: {
  id: string
  value: number
  onLess: () => void
  onMore: () => void
  /** a number typed into the field, kept between 1 and MAX_QUANTITY */
  onType: (quantity: number) => void
  /** the field's name and the two buttons', each with the thing counted */
  labels: { quantity: string; less: string; more: string }
  lessDisabled?: boolean
  className?: string
}) {
  const BUTTON =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lead text-ink tone hover:bg-wash disabled:cursor-not-allowed disabled:text-sub disabled:hover:bg-transparent"
  return (
    <div data-stepper className={`field inline-flex min-h-[46px] w-auto items-center px-0 ${className}`.trim()}>
      <button type="button" aria-label={labels.less} onClick={onLess} disabled={lessDisabled} className={BUTTON}>
        −
      </button>
      <label className="sr-only" htmlFor={id}>
        {labels.quantity}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_QUANTITY}
        value={value}
        onChange={(event) => onType(Math.min(MAX_QUANTITY, Math.max(1, Number(event.target.value) || 1)))}
        className="h-11 w-11 rounded-full text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button type="button" aria-label={labels.more} onClick={onMore} disabled={value >= MAX_QUANTITY} className={BUTTON}>
        +
      </button>
    </div>
  )
}
