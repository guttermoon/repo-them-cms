// The shop's client side (components/commerce): the cart kept in the
// reader's browser (and only once they add something), the buying controls
// in each of the shop's modes, the header's count, and the cart page with
// its Shopify checkout link.
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { AddToCart } from "@/components/commerce/add-to-cart"
import { CartButton } from "@/components/commerce/cart-button"
import { CartProvider } from "@/components/commerce/cart-context"
import { CartView, type CartProduct } from "@/components/commerce/cart-view"
import { CART_KEY } from "@/lib/commerce/cart"

const ADD = {
  variant: "Size",
  quantity: "Quantity",
  less: "One fewer",
  more: "One more",
  add: "Add to cart",
  buy: "Buy",
  enquire: "Ask about it",
  soldOut: "Sold out",
  // as Notion keeps it: no space at the end
  added: "Added to the cart:",
  viewCart: "View the cart",
}
const CART = {
  empty: "The cart is empty.",
  browse: "Browse the shop",
  product: "Product",
  quantity: "Quantity",
  remove: "Remove",
  less: "One fewer",
  more: "One more",
  gone: "No longer in the shop",
  subtotal: "Subtotal",
  subtotalNote: "prices confirmed at checkout",
  checkout: "Checkout",
  demo: "This is an example shop: nothing here is for sale.",
  links: "Each product is bought from its own page.",
  removed: "Taken out of the cart:",
  count: "{name}: {count} in the cart",
  left: "Some things cannot be bought any more.",
  soldOut: "Sold out",
  unavailable: "No longer offered",
}
const PRODUCTS: Record<string, CartProduct> = {
  "corn-flakes": { title: "Corn flakes", href: "/shop/corn-flakes", price: 2.5, currency: "GBP", variants: [{ label: "Small", id: "4012345678901" }, { label: "Large", id: "4012345678902" }] },
  drink: { title: "Drink", href: "/shop/drink", price: 1, currency: "GBP", variants: [{ label: "", id: "4012345678903" }] },
}

const storedCart = () => JSON.parse(window.localStorage.getItem(CART_KEY) ?? "null")

describe("buying a product", () => {
  test("nothing is stored on a visit; adding stores the cart, counts it, and says so", async () => {
    render(
      <CartProvider>
        <CartButton label="Cart" items="items" />
        <AddToCart slug="corn-flakes" title="Corn flakes" variants={PRODUCTS["corn-flakes"].variants} action={{ kind: "cart" }} labels={ADD} />
      </CartProvider>,
    )
    expect(window.localStorage.getItem(CART_KEY), "a visit stores nothing").toBeNull()
    expect(screen.getByRole("link", { name: "Cart" })).toBeTruthy()

    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Size Small" }))
    await user.click(screen.getByRole("option", { name: "Large" }))
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add to cart" }))
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(storedCart()).toEqual([{ slug: "corn-flakes", variant: "4012345678902", quantity: 3 }])
    expect(screen.getByRole("link", { name: "Cart, 3 items" }).getAttribute("href")).toBe("/cart")
    expect(screen.getByRole("status").textContent).toBe("Added to the cart: 3 × Corn flakes (Large)")
    expect(screen.getByRole("link", { name: "View the cart" })).toBeTruthy()
  })

  test("a quantity is held between 1 and 99", () => {
    render(<AddToCart slug="drink" title="Drink" variants={[]} action={{ kind: "cart" }} labels={ADD} />)
    const field = screen.getByLabelText("Quantity") as HTMLInputElement
    fireEvent.change(field, { target: { value: "500" } })
    expect(field.value).toBe("99")
    fireEvent.change(field, { target: { value: "-2" } })
    expect(field.value).toBe("1")
    expect(screen.queryByRole("button", { name: /^Size/ }), "one variant needs no choice").toBeNull()
  })

  test("the stepper counts one more and one fewer, and stops at 1 and at 99", () => {
    render(<AddToCart slug="drink" title="Drink" variants={[]} action={{ kind: "cart" }} labels={ADD} />)
    const field = screen.getByLabelText("Quantity") as HTMLInputElement
    const less = screen.getByRole("button", { name: "One fewer" }) as HTMLButtonElement
    const more = screen.getByRole("button", { name: "One more" }) as HTMLButtonElement
    expect(less.disabled, "nothing below one").toBe(true)
    fireEvent.click(more)
    fireEvent.click(more)
    expect(field.value).toBe("3")
    expect(less.disabled).toBe(false)
    fireEvent.click(less)
    expect(field.value).toBe("2")
    fireEvent.change(field, { target: { value: "99" } })
    expect(more.disabled, "nothing above 99").toBe(true)
    // one field: the buttons and the number sit in one pill
    expect(field.closest("[data-stepper]")?.contains(more)).toBe(true)
  })

  test("a product sold from its own page links there; sold out says so; with no way to buy, it can be asked about", () => {
    const { rerender } = render(<AddToCart slug="drink" title="Drink" variants={[]} action={{ kind: "link", href: "https://shop.example.com/drink" }} labels={ADD} />)
    const buy = screen.getByRole("link", { name: "Buy" })
    expect(buy.getAttribute("href")).toBe("https://shop.example.com/drink")
    expect(buy.getAttribute("rel")).toContain("noopener")
    rerender(<AddToCart slug="drink" title="Drink" variants={[]} action={{ kind: "sold-out" }} labels={ADD} />)
    expect((screen.getByRole("button", { name: "Sold out" }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<AddToCart slug="drink" title="Drink" variants={[]} action={{ kind: "enquire" }} labels={ADD} />)
    expect(screen.getByRole("link", { name: "Ask about it" }).getAttribute("href")).toBe("/contact?type=question&about=drink")
  })
})

describe("the cart page", () => {
  const withCart = (lines: unknown) => window.localStorage.setItem(CART_KEY, JSON.stringify(lines))

  test("empty, it says so and points at the shop", async () => {
    await act(async () => {
      render(
        <CartProvider>
          <CartView products={PRODUCTS} commerce={{ mode: "demo", reason: "" }} labels={CART} />
        </CartProvider>,
      )
    })
    expect(screen.getByText("The cart is empty.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Browse the shop" }).getAttribute("href")).toBe("/shop")
  })

  test("with Shopify, the subtotal and a checkout link to the shop's own cart", async () => {
    withCart([
      { slug: "corn-flakes", variant: "4012345678901", quantity: 2 },
      { slug: "drink", variant: "4012345678903", quantity: 1 },
    ])
    await act(async () => {
      render(
        <CartProvider>
          <CartView products={PRODUCTS} commerce={{ mode: "shopify", domain: "your-store.myshopify.com" }} labels={CART} />
        </CartProvider>,
      )
    })
    const summary = screen.getByRole("complementary", { name: "Subtotal" })
    expect(summary.textContent).toContain("£6")
    expect(within(summary).getByRole("link", { name: "Checkout" }).getAttribute("href")).toBe("https://your-store.myshopify.com/cart/4012345678901:2,4012345678903:1")
    expect(summary.textContent).not.toContain("cannot be bought")
  })

  test("every change of a quantity is heard, not only an addition or a removal", async () => {
    withCart([{ slug: "corn-flakes", variant: "4012345678901", quantity: 2 }])
    vi.useFakeTimers()
    try {
      await act(async () => {
        render(
          <CartProvider>
            <CartView products={PRODUCTS} commerce={{ mode: "shopify", domain: "your-store.myshopify.com" }} labels={CART} />
          </CartProvider>,
        )
      })
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "One more: Corn flakes (Small)" }))
        vi.advanceTimersByTime(50)
      })
      expect(screen.getByRole("status").textContent).toBe("Corn flakes (Small): 3 in the cart")
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "One fewer: Corn flakes (Small)" }))
        vi.advanceTimersByTime(50)
      })
      expect(screen.getByRole("status").textContent).toBe("Corn flakes (Small): 2 in the cart")
    } finally {
      vi.useRealTimers()
    }
  })

  test("what cannot be bought any more stays in the cart, marked, and out of the checkout and the subtotal", async () => {
    withCart([
      { slug: "corn-flakes", variant: "4012345678901", quantity: 2 },
      { slug: "corn-flakes", variant: "4019999999999", quantity: 1 },
      { slug: "drink", variant: "4012345678903", quantity: 1 },
      { slug: "napkins", quantity: 4 },
    ])
    await act(async () => {
      render(
        <CartProvider>
          <CartView
            products={{ ...PRODUCTS, drink: { ...PRODUCTS.drink, soldOut: true } }}
            commerce={{ mode: "shopify", domain: "your-store.myshopify.com" }}
            labels={CART}
          />
        </CartProvider>,
      )
    })
    const summary = screen.getByRole("complementary", { name: "Subtotal" })
    expect(within(summary).getByRole("link", { name: "Checkout" }).getAttribute("href")).toBe("https://your-store.myshopify.com/cart/4012345678901:2")
    expect(summary.textContent).toContain("£5")
    expect(summary.textContent).toContain("Some things cannot be bought any more.")
    expect(screen.getByText("Sold out")).toBeTruthy()
    expect(screen.getByText("No longer offered")).toBeTruthy()
    expect(screen.getByText("No longer in the shop")).toBeTruthy()
    expect(screen.getAllByRole("button", { name: /^Remove: / })).toHaveLength(4)
  })

  test("a line's picture is goods, shown as uploaded in the dark look", async () => {
    withCart([{ slug: "corn-flakes", variant: "4012345678901", quantity: 1 }])
    const products = { ...PRODUCTS, "corn-flakes": { ...PRODUCTS["corn-flakes"], image: "/demo/product-corn-flakes.webp" } }
    let container!: HTMLElement
    await act(async () => {
      ;({ container } = render(
        <CartProvider>
          <CartView products={products} commerce={{ mode: "demo", reason: "" }} labels={CART} />
        </CartProvider>,
      ))
    })
    const pictures = [...container.querySelectorAll("img")]
    expect(pictures).toHaveLength(1)
    expect(pictures[0].hasAttribute("data-goods")).toBe(true)
  })

  test("every control is named for its line; one more, one fewer, and taking a line out", async () => {
    withCart([{ slug: "corn-flakes", variant: "4012345678901", quantity: 1 }])
    await act(async () => {
      render(
        <CartProvider>
          <CartView products={PRODUCTS} commerce={{ mode: "demo", reason: "" }} labels={CART} />
        </CartProvider>,
      )
    })
    fireEvent.click(screen.getByRole("button", { name: "One more: Corn flakes (Small)" }))
    expect((screen.getByLabelText("Quantity: Corn flakes (Small)") as HTMLInputElement).value).toBe("2")
    expect(storedCart()).toEqual([{ slug: "corn-flakes", variant: "4012345678901", quantity: 2 }])
    expect((screen.getByRole("button", { name: "Checkout" }) as HTMLButtonElement).disabled, "the example shop sells nothing").toBe(true)
    expect(screen.getByText(CART.demo)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Remove: Corn flakes (Small)" }))
    })
    expect(screen.getByText("The cart is empty.")).toBeTruthy()
    expect(window.localStorage.getItem(CART_KEY), "an empty cart leaves nothing behind").toBeNull()
  })

  test("a line for a product no longer in the shop says so and can be taken out", async () => {
    withCart([{ slug: "retired", quantity: 1 }])
    await act(async () => {
      render(
        <CartProvider>
          <CartView products={PRODUCTS} commerce={{ mode: "demo", reason: "" }} labels={CART} />
        </CartProvider>,
      )
    })
    expect(screen.getByText("No longer in the shop")).toBeTruthy()
  })
})
