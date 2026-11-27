// The shop's rules (lib/commerce): what the cart accepts back from a
// reader's browser, the Shopify checkout link it becomes, how the shop is
// set up from the environment, and what each product's button does.
import { test } from "node:test"
import assert from "node:assert/strict"

import { addLine, cartPermalink, itemCount, MAX_LINES, MAX_QUANTITY, parseCart, removeLine, setQuantity, shopDomain } from "../lib/commerce/cart.ts"
import { buyAction, commerce, headerCart, shopIsLive } from "../lib/commerce/config.ts"

test("the cart read back from storage: only well-formed lines, whole quantities from 1 to 99, repeats added up", () => {
  assert.deepEqual(parseCart(undefined), [])
  assert.deepEqual(parseCart("not json"), [])
  assert.deepEqual(parseCart('{"slug":"drink"}'), [], "an object is not a list")
  const lines = parseCart(
    JSON.stringify([
      { slug: "drink", quantity: 2 },
      { slug: "drink", quantity: 3 },
      { slug: "corn-flakes", variant: "4012345678901", quantity: 1000 },
      { slug: "../etc/passwd", quantity: 1 },
      { slug: "soap", variant: "javascript:alert(1)", quantity: 1 },
      { slug: "soup", quantity: -4 },
      { slug: "tea", quantity: "2.9" },
      null,
      42,
    ]),
  )
  assert.deepEqual(lines, [
    { slug: "drink", quantity: 5 },
    { slug: "corn-flakes", variant: "4012345678901", quantity: MAX_QUANTITY },
    { slug: "soup", quantity: 1 },
    { slug: "tea", quantity: 2 },
  ])
  const many = parseCart(Array.from({ length: MAX_LINES + 10 }, (_, i) => ({ slug: `item-${i}`, quantity: 1 })))
  assert.equal(many.length, MAX_LINES)
})

test("adding, changing and taking out; one line per product and variant", () => {
  let lines = addLine([], { slug: "drink", quantity: 1 })
  lines = addLine(lines, { slug: "drink", quantity: 2 })
  lines = addLine(lines, { slug: "drink", variant: "4012345678901", quantity: 1 })
  assert.deepEqual(lines, [
    { slug: "drink", quantity: 3 },
    { slug: "drink", variant: "4012345678901", quantity: 1 },
  ])
  assert.equal(itemCount(lines), 4)
  lines = setQuantity(lines, { slug: "drink" }, 7)
  assert.equal(lines[0].quantity, 7)
  lines = setQuantity(lines, { slug: "drink" }, 0)
  assert.deepEqual(lines, [{ slug: "drink", variant: "4012345678901", quantity: 1 }], "nought takes it out")
  assert.deepEqual(removeLine(lines, { slug: "drink", variant: "4012345678901" }), [])
  assert.equal(addLine([{ slug: "a", quantity: 98 }], { slug: "a", quantity: 5 })[0].quantity, MAX_QUANTITY)
})

test("the shop's address: a hostname, however it was pasted", () => {
  assert.equal(shopDomain("your-store.myshopify.com"), "your-store.myshopify.com")
  assert.equal(shopDomain(" https://Shop.Example.com/ "), "shop.example.com")
  assert.equal(shopDomain("shop.example.com/collections"), undefined)
  assert.equal(shopDomain("javascript:alert(1)"), undefined)
  assert.equal(shopDomain("localhost"), undefined)
  assert.equal(shopDomain(""), undefined)
})

test("the Shopify checkout link: every line with a variant, at its quantity, and nothing without one", () => {
  assert.equal(
    cartPermalink("your-store.myshopify.com", [
      { variant: "4012345678901", quantity: 2 },
      { quantity: 1 },
      { variant: "4012345678902", quantity: 500 },
    ]),
    "https://your-store.myshopify.com/cart/4012345678901:2,4012345678902:99",
  )
  assert.equal(cartPermalink("your-store.myshopify.com", [{ quantity: 1 }]), undefined)
  assert.equal(cartPermalink(undefined, [{ variant: "4012345678901", quantity: 1 }]), undefined)
  assert.equal(cartPermalink("evil.example/x?", [{ variant: "4012345678901", quantity: 1 }]), undefined)
})

test("the shop's mode, from the environment: Shopify needs a real address; anything unset or unknown is the example shop", () => {
  assert.deepEqual(commerce({ COMMERCE_PROVIDER: "shopify", SHOPIFY_STORE_DOMAIN: "your-store.myshopify.com" }), { mode: "shopify", domain: "your-store.myshopify.com" })
  assert.equal(commerce({ COMMERCE_PROVIDER: "shopify" }).mode, "demo")
  assert.deepEqual(commerce({ COMMERCE_PROVIDER: " Printify " }), { mode: "links" }, "a Printify Pop-Up Store sells from each product's own page")
  assert.deepEqual(commerce({ COMMERCE_PROVIDER: "links" }), { mode: "links" }, "its older name still works")
  assert.deepEqual(commerce({ COMMERCE_PROVIDER: "stripe" }), { mode: "demo", reason: 'COMMERCE_PROVIDER "stripe" is not shopify or printify' })
  assert.equal(commerce({}).mode, "demo")
  assert.equal(shopIsLive(commerce({})), false)
  assert.equal(shopIsLive(commerce({ COMMERCE_PROVIDER: "links" })), true)
})

test("what a product's button does", () => {
  const shopify = { mode: "shopify", domain: "your-store.myshopify.com" }
  const links = { mode: "links" }
  const demo = { mode: "demo", reason: "" }
  const variant = { variants: [{ id: "4012345678901" }] }
  const popUp = { link: "https://shop.example.com/product/drink" }
  assert.deepEqual(buyAction(shopify, variant), { kind: "cart" })
  assert.deepEqual(buyAction(shopify, popUp), { kind: "link", href: popUp.link }, "a Printify Pop-Up product sells from its own page")
  assert.deepEqual(buyAction(shopify, {}), { kind: "enquire" })
  assert.deepEqual(buyAction(links, { ...variant, ...popUp }), { kind: "link", href: popUp.link }, "the links shop has no cart")
  assert.deepEqual(buyAction(links, { link: "http://plain.example/" }), { kind: "enquire" }, "never a plain-http checkout")
  assert.deepEqual(buyAction(demo, {}), { kind: "cart" }, "the example shop's cart can be tried with anything")
  assert.deepEqual(buyAction(shopify, { ...variant, stock: { name: "Sold out" } }), { kind: "sold-out" })
})

test("the header offers a cart where the cart is how things are bought: never for a Printify store, which takes every order itself", () => {
  assert.equal(headerCart(4, commerce({})), true, "the example shop's cart, marked as one")
  assert.equal(headerCart(0, commerce({})), false, "nothing to put in it")
  assert.equal(headerCart(0, commerce({ COMMERCE_PROVIDER: "shopify", SHOPIFY_STORE_DOMAIN: "your-store.myshopify.com" })), true)
  assert.equal(headerCart(4, commerce({ COMMERCE_PROVIDER: "printify" })), false)
})
