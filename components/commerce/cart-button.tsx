"use client"

import Link from "next/link"

import { itemCount } from "@/lib/commerce/cart"

import { useCart } from "./cart-context"

/** The header's way to the cart, with how many things are in it. Its name
 *  says the count in words ("Cart, 3 items"), the badge only shows it. */
export function CartButton({ label, items }: { label: string; items: string }) {
  const { lines, ready } = useCart()
  const count = ready ? itemCount(lines) : 0
  return (
    <Link
      href="/cart"
      aria-label={count ? `${label}, ${count} ${items}` : label}
      className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink tone hover:bg-wash"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h14l-1.2 10.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </svg>
      {count ? (
        <span aria-hidden="true" className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-btn px-1 text-micro font-semibold text-btn-ink">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  )
}
