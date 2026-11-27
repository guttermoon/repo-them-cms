// Prices and plans (lib/pricing.ts): formatted from numbers, never typed as
// words; the yearly saving worked out, never claimed; and the comparison
// table built from each plan's own feature lines.
import { test } from "node:test"
import assert from "node:assert/strict"

import { comparison, currencyOf, featureLines, formatPrice, hasYearly, priceFor, yearlySaving } from "../lib/pricing.ts"

test("prices: in the site's locale and the row's currency, pennies only when there are some", () => {
  assert.equal(formatPrice(8.5, "GBP", "en-GB"), "£8.50")
  assert.equal(formatPrice(12, "GBP", "en-GB"), "£12")
  assert.equal(formatPrice(0, "GBP", "en-GB"), "£0")
  assert.equal(formatPrice(1200, "USD", "en-GB"), "US$1,200")
  assert.equal(formatPrice(9.99, "EUR", "en-GB"), "€9.99")
  assert.equal(currencyOf(" usd "), "USD")
  assert.equal(currencyOf("doubloons"), "GBP", "words are not a currency: the site's own")
  assert.equal(currencyOf(undefined), "GBP")
  assert.equal(currencyOf("brl"), "BRL", "any three-letter code, offered in the select or not")
  assert.equal(formatPrice(10, "BRL", "en-GB"), "R$10")
})

test("yearly: the yearly figure when there is one, the monthly otherwise, and nothing for custom", () => {
  assert.equal(priceFor({ price: 10, yearlyPrice: 8 }, "yearly"), 8)
  assert.equal(priceFor({ price: 10, yearlyPrice: 8 }, "monthly"), 10)
  assert.equal(priceFor({ price: 10 }, "yearly"), 10)
  assert.equal(priceFor({}, "monthly"), undefined)
})

test("the saving is the best one, rounded down, and only a real one", () => {
  assert.equal(yearlySaving([{ price: 10, yearlyPrice: 8 }, { price: 20, yearlyPrice: 17 }]), 20)
  // 29/100 as a float is 28.999…: a whole saving is not rounded down a point
  assert.equal(yearlySaving([{ price: 100, yearlyPrice: 71 }]), 29)
  assert.equal(yearlySaving([{ price: 50, yearlyPrice: 21 }]), 58)
  assert.equal(yearlySaving([{ price: 100, yearlyPrice: 71.5 }]), 28, "and a part of a point still is")
  for (let price = 1; price <= 100; price++) for (let yearly = 0; yearly < price; yearly++) {
    const exact = Math.floor(((price - yearly) * 100) / price)
    assert.equal(yearlySaving([{ price, yearlyPrice: yearly }]), Number.isInteger(((price - yearly) * 100) / price) ? ((price - yearly) * 100) / price : exact, `${price}/${yearly}`)
  }
  assert.equal(yearlySaving([{ price: 3, yearlyPrice: 2 }]), 33, "33.3% is 33%, never 34%")
  assert.equal(yearlySaving([{ price: 10, yearlyPrice: 12 }]), 0, "dearer yearly is no saving")
  assert.equal(yearlySaving([{ price: 0, yearlyPrice: 0 }, {}]), 0)
  assert.equal(hasYearly([{ price: 1 }, {}]), false)
  assert.equal(hasYearly([{ yearlyPrice: 0 }]), true)
})

test("feature lines: included, a value, a group, and bullets the editor typed", () => {
  assert.deepEqual(featureLines("Content:\n- Unlimited pages\nFile uploads: 5 MB\n\n• Read more at https://example.com/x"), [
    { kind: "group", label: "Content" },
    { kind: "included", label: "Unlimited pages" },
    { kind: "value", label: "File uploads", value: "5 MB" },
    { kind: "included", label: "Read more at https://example.com/x" },
  ])
  assert.deepEqual(featureLines("[Docs](https://example.com/docs) included"), [{ kind: "included", label: "[Docs](https://example.com/docs) included" }])
})

test("the comparison table: rows in first-seen order, grouped, and a plan without a feature does not have it", () => {
  const free = { features: featureLines("Content:\nPages: 10\nBlog\nHelp:\nEmail support") }
  const pro = { features: featureLines("Content:\nPages: Unlimited\nBlog\nCustom domain\nHelp:\nEmail support\nSetup call: 1 hour") }
  const groups = comparison([free, pro])
  assert.deepEqual(
    groups.map((g) => [g.name, g.rows.map((r) => [r.label, ...r.cells.map((c) => (c.kind === "value" ? c.text : c.kind))])]),
    [
      [
        "Content",
        [
          ["Pages", "10", "Unlimited"],
          ["Blog", "yes", "yes"],
          ["Custom domain", "no", "yes"],
        ],
      ],
      [
        "Help",
        [
          ["Email support", "yes", "yes"],
          ["Setup call", "no", "1 hour"],
        ],
      ],
    ],
  )
  assert.deepEqual(comparison([{ features: [] }]), [])
  // features before any group heading sit in an unnamed group
  assert.equal(comparison([{ features: featureLines("Blog") }])[0].name, "")
})
