/**
 * The shop's words that cannot be <T> elements (attributes, options,
 * strings handed to client components), read from the copy with
 * `plainText` so each still has its Notion slot (`shop.*`, `cart.*`).
 */
import { plainText, type SiteCopy } from "@/components/system/notion-text"

import type { SearchLabels } from "@/components/system/search-box"

import type { AddToCartLabels } from "./add-to-cart"
import type { CartLabels } from "./cart-view"
import type { GridLabels } from "./product-grid"

export function gridLabels(content: SiteCopy): GridLabels {
  return {
    sort: plainText(content, "shop.sort", "Sort by"),
    featured: plainText(content, "shop.sort.featured", "Featured"),
    priceLow: plainText(content, "shop.sort.low", "Price, low to high"),
    priceHigh: plainText(content, "shop.sort.high", "Price, high to low"),
    newest: plainText(content, "shop.sort.newest", "Newest"),
    soldOut: plainText(content, "shop.soldout", "Sold out"),
    lowStock: plainText(content, "shop.lowstock", "Only a few left"),
    was: plainText(content, "shop.was", "Was"),
    empty: plainText(content, "shop.empty", "Nothing on the shelves yet. Add a row in Notion with Kind set to Product and tick Published."),
  }
}

/** The four stock options the code knows (lib/notion/schema.ts), each read
 *  by its name to decide what can be bought, and each printed through a slot
 *  of its own, so renaming the words never means renaming the option. */
const STOCK: Record<string, [key: string, words: string]> = {
  "in stock": ["shop.instock", "In stock"],
  "low stock": ["shop.lowstock", "Only a few left"],
  "sold out": ["shop.soldout", "Sold out"],
  "pre-order": ["shop.preorder", "Pre-order"],
}

/** A product's stock as a reader is told it: the slot for one of the four
 *  options, or an option an editor added in Notion as its own name. */
export function stockLabel(content: SiteCopy, stock: string): string {
  const known = STOCK[stock.toLowerCase()]
  return known ? plainText(content, known[0], known[1]) : stock
}

/** The shelf's search field: its name, its hint, and what it finds. */
export function shopSearchLabels(content: SiteCopy): SearchLabels {
  return {
    label: plainText(content, "shop.search.label", "Search the shelf"),
    placeholder: plainText(content, "shop.search.placeholder", "search the shelf"),
    found: plainText(content, "shop.search.found", "found"),
    none: plainText(content, "shop.search.none", "Nothing on the shelf matches that. Try a plainer word."),
  }
}

export function addLabels(content: SiteCopy): AddToCartLabels {
  return {
    variant: plainText(content, "shop.variant", "Option"),
    quantity: plainText(content, "shop.quantity", "Quantity"),
    // the same words as the cart's stepper, from the same rows
    less: plainText(content, "cart.less", "One fewer"),
    more: plainText(content, "cart.more", "One more"),
    add: plainText(content, "shop.add", "Add to cart"),
    buy: plainText(content, "shop.buy", "Buy"),
    enquire: plainText(content, "shop.enquire", "Ask about it"),
    soldOut: plainText(content, "shop.soldout", "Sold out"),
    // the words before what was added; the code puts the space after them,
    // since Notion keeps no space at the end of a row
    added: plainText(content, "shop.added", "Added to the cart:"),
    viewCart: plainText(content, "shop.viewcart", "View the cart"),
  }
}

export function cartLabels(content: SiteCopy): CartLabels {
  return {
    empty: plainText(content, "cart.empty", "The cart is empty."),
    browse: plainText(content, "cart.browse", "Browse the shop"),
    product: plainText(content, "cart.product", "Product"),
    quantity: plainText(content, "cart.quantity", "Quantity"),
    remove: plainText(content, "cart.remove", "Remove"),
    less: plainText(content, "cart.less", "One fewer"),
    more: plainText(content, "cart.more", "One more"),
    gone: plainText(content, "cart.gone", "No longer in the shop"),
    subtotal: plainText(content, "cart.subtotal", "Subtotal"),
    subtotalNote: plainText(content, "cart.subtotal.note", "prices confirmed at checkout"),
    checkout: plainText(content, "cart.checkout", "Checkout"),
    demo: plainText(content, "cart.demo", "This is an example shop: nothing here is for sale, so the checkout is switched off."),
    links: plainText(content, "cart.links", "This shop sells each product from its own page. Open a product and use its Buy button."),
    removed: plainText(content, "cart.removed", "Taken out of the cart:"),
    count: plainText(content, "cart.count", "{name}: {count} in the cart"),
    left: plainText(content, "cart.left", "Some things in the cart cannot be bought any more, so they are left out of the checkout."),
    soldOut: plainText(content, "cart.soldout", "Sold out, so not in the checkout"),
    unavailable: plainText(content, "cart.unavailable", "This choice is no longer offered, so it is not in the checkout"),
  }
}
