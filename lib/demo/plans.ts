/**
 * The starter content's four plans: a free plan, two paid ones with a
 * yearly price, and one priced to the customer. lib/demo/content.ts makes a
 * Plan row of each, and the setup writes those rows to Notion; the pages
 * read the rows. "Label: value" lines fill the comparison table; a bare line
 * is a feature the plan includes.
 *
 * Imports nothing, so `npm test` loads it as it is.
 */
export type StarterPlan = {
  key: string
  name: string
  description: string
  price?: number
  /** the price a month when paid for the year */
  yearlyPrice?: number
  priceNote?: string
  features: string
  recommended?: boolean
  button: string
  /** where the button goes */
  href: string
}

export const STARTER_PLANS: StarterPlan[] = [
  {
    key: "free",
    name: "Free",
    description: "The shelf at shelf prices, for as long as you like.",
    price: 0,
    priceNote: "for ever",
    features: ["Delivery: standard", "Returns: 30 days", "Help: the questions page"].join("\n"),
    button: "Start shopping",
    href: "/shop",
  },
  {
    key: "plus",
    name: "Plus",
    description: "Member prices and free delivery, for people who come back.",
    price: 5,
    yearlyPrice: 4,
    priceNote: "a month",
    features: ["Member prices on everything", "Delivery: free", "Returns: 60 days", "Help: email, the same day"].join("\n"),
    recommended: true,
    button: "Choose Plus",
    href: "/contact?type=plan",
  },
  {
    key: "business",
    name: "Business",
    description: "For an office, a café or anywhere that gets through a lot of corn flakes.",
    price: 19,
    yearlyPrice: 15,
    priceNote: "a month",
    features: ["Member prices on everything", "Delivery: free, the next day", "Returns: 60 days", "Help: a named person", "Invoices: monthly"].join("\n"),
    button: "Choose Business",
    href: "/contact?type=plan",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Whatever you need, agreed in writing.",
    priceNote: "priced to you",
    features: ["Member prices on everything", "Delivery: on your schedule", "Returns: agreed with you", "Help: a named person", "Invoices: your way"].join("\n"),
    button: "Talk to us",
    href: "/contact?type=plan",
  },
]
