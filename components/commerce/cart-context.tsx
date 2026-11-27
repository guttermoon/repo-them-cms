"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

import { addLine, CART_KEY, parseCart, removeLine, setQuantity, type CartLine } from "@/lib/commerce/cart"

/**
 * The cart, shared by the header's button, the product pages and /cart.
 *
 * It lives in the reader's browser only. Nothing is written until the
 * reader adds something (a visit is not a reason to store anything), and a
 * browser that refuses storage still has a working cart for the visit. Other
 * tabs follow along through the storage event. Every change is announced in
 * a polite live region, so a screen reader hears "Added to the cart" without
 * losing its place.
 */
type CartApi = {
  lines: CartLine[]
  ready: boolean
  add: (line: CartLine, message?: string) => void
  setQty: (line: Pick<CartLine, "slug" | "variant">, quantity: number, message?: string) => void
  remove: (line: Pick<CartLine, "slug" | "variant">, message?: string) => void
  clear: () => void
}

const CartContext = createContext<CartApi | null>(null)

function read(): CartLine[] {
  try {
    return parseCart(window.localStorage.getItem(CART_KEY))
  } catch {
    return []
  }
}

function write(lines: CartLine[]) {
  try {
    if (lines.length) window.localStorage.setItem(CART_KEY, JSON.stringify(lines))
    else window.localStorage.removeItem(CART_KEY)
  } catch {
    // private browsing or blocked storage: the cart lasts as long as the page
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState("")
  const touched = useRef(false)

  useEffect(() => {
    setLines(read())
    setReady(true)
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_KEY || event.key === null) setLines(read())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    if (touched.current) write(lines)
  }, [lines])

  const change = useCallback((next: (lines: CartLine[]) => CartLine[], words?: string) => {
    touched.current = true
    setLines(next)
    // re-announce the same words: clear first, then set
    if (words) {
      setMessage("")
      window.setTimeout(() => setMessage(words), 30)
    }
  }, [])

  const api = useMemo<CartApi>(
    () => ({
      lines,
      ready,
      add: (line, words) => change((l) => addLine(l, line), words),
      setQty: (line, quantity, words) => change((l) => setQuantity(l, line, quantity), words),
      remove: (line, words) => change((l) => removeLine(l, line), words),
      clear: () => change(() => []),
    }),
    [lines, ready, change],
  )

  return (
    <CartContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
    </CartContext.Provider>
  )
}

/** The cart, inside a CartProvider; outside one, an empty cart that does
 *  nothing (a component rendered alone, in a test or a preview). */
export function useCart(): CartApi {
  return (
    useContext(CartContext) ?? {
      lines: [],
      ready: false,
      add: () => {},
      setQty: () => {},
      remove: () => {},
      clear: () => {},
    }
  )
}
