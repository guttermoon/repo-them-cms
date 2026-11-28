/**
 * The Notion database's shape: the contract between the database and the
 * code. One database holds everything: the site's copy, its pages, its
 * blog, a resource list, the printed-QR redirects, and the parts of a SaaS
 * site or a shop (plans, products, quotations, logos, questions). The
 * **Kind** of a row says which it is.
 *
 * The property names below are the names in Notion, exactly. Rename one in
 * Notion and the site stops reading it; `npm run notion:check` says which.
 * `npm run notion:setup` makes a database with exactly this shape.
 *
 * Imports only the price rules (for the currency codes), so the tests and
 * the scripts load it as it is.
 */
import { CURRENCIES } from "../pricing"

export const KINDS = ["Site Copy", "Page", "Post", "Resource", "Redirect", "Plan", "Product", "Quote", "Proof Logos", "Question", "Person", "Review", "Section", "Menu"] as const
export type Kind = (typeof KINDS)[number]

/** A Kind's former name, read as the Kind it became, so a database made
 *  before the rename shows its rows as it did. "Logo" became "Proof Logos"
 *  (a tool in the "goes well with" strip), so that a logo means only the
 *  site's own (`site.logo`). notion:check suggests the new name. */
export const FORMER_KINDS: Readonly<Record<string, Kind>> = { Logo: "Proof Logos" }

/** The properties the site reads, by role. */
export const PROPS = {
  title: "Title",
  kind: "Kind",
  published: "Published",
  text: "Text",
  slug: "Slug",
  description: "Description",
  cover: "Image",
  coverPosition: "Cover Position",
  coverTint: "Cover Tint",
  teamPage: "Team Page",
  order: "Order",
  publishedDate: "Published Date",
  category: "Category",
  tags: "Tags",
  featured: "Featured",
  featureBlock: "Feature Block",
  author: "Author",
  authorBio: "Author Bio",
  action: "Action",
  link: "Link",
  font: "Font",
  fullWidth: "Full width",
  layout: "Layout",
  price: "Price",
  yearlyPrice: "Yearly Price",
  currency: "Currency",
  priceNote: "Price Note",
  compareAt: "Compare-at Price",
  gallery: "Gallery",
  stock: "Stock",
  checkoutId: "Checkout ID",
  button: "Button",
  importId: "Import ID",
  rating: "Rating",
} as const

/** Properties that have been renamed, by their new name: the old name each
 *  had, which a database made before the rename still uses. The site reads
 *  either (lib/notion/rows.ts), the import writes whichever the database has,
 *  and notion:check suggests the new one. "Cover Image" became "Image" so
 *  it is not mistaken for a page's own Notion cover. */
export const FORMER_NAMES: Readonly<Record<string, string>> = { [PROPS.cover]: "Cover Image" }

/** The editors' own Status (a status property: Draft, In Review,
 *  Published), which the site never reads: Published alone decides what
 *  shows. It says where a row is in a card view, where a tickbox would be
 *  one stray click from taking a page off the site. Notion's API can't make a
 *  status property or an automation, so the setup makes neither: the
 *  template has both, two automations keeping Status in step with Published
 *  (docs/notion.md, "Published and Status"), and notion:check names a row
 *  whose Status says otherwise. */
export const EDITOR_STATUS = "Status"

/** Properties the site no longer reads, and what to do with what is in
 *  them. A database made before keeps the column, so notion:check names it
 *  and every row still holding something there. "Author Image" was a
 *  person's second picture: a person has one, their Person row's Image, and
 *  a post's byline is its Person row's alone. "Author Photo Credit" was a
 *  line under that picture, and a byline is the person, not the photograph. */
export const RETIRED_PROPS: Readonly<Record<string, string>> = {
  "Author Image": "A person has one picture: their Person row's Image, shown on the team page and on every post they write. Move the picture there, then delete this property.",
  "Author Photo Credit": "The site no longer prints a credit under a person's picture. Delete this property, or put a credit a photographer asks for in the person's Text.",
}

/** A renamed property's other name: the former one for a new name, the new
 *  one for a former name; any other name is itself. */
export function otherName(name: string): string {
  return FORMER_NAMES[name] ?? Object.entries(FORMER_NAMES).find(([, former]) => former === name)?.[0] ?? name
}

/** Cover Position's choices, and where each cuts a cover, from the top (0)
 *  to the bottom (100) of the picture. */
export const COVER_POSITIONS = { Top: 0, Upper: 25, Middle: 50, Lower: 75, Bottom: 100 } as const

/** Cover Tint's choices: On prints a cover in the look's ink, Off shows it
 *  as uploaded. Empty is On. */
export const COVER_TINTS = ["On", "Off"] as const

/** Team Page's choices: On shows a person on /team and /about, Off keeps
 *  them to the posts they write. Empty is On. */
export const TEAM_PAGE = ["On", "Off"] as const

/** Notion's option colours, as its API names them. */
export type NotionColor =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red"

type Option = { name: string; color: NotionColor }

const CURRENCY_COLORS: NotionColor[] = ["default", "green", "blue", "red", "yellow", "purple", "pink", "orange", "brown", "gray"]

/**
 * The full property list with Notion types, as `notion:setup` creates it and
 * `notion:check` expects it. `required` properties are the ones the site
 * cannot work without; the rest are read when present.
 */
export const SCHEMA: {
  name: string
  type: "title" | "rich_text" | "checkbox" | "select" | "multi_select" | "date" | "number" | "files" | "url" | "status"
  required?: boolean
  options?: Option[]
  description: string
}[] = [
  {
    name: PROPS.title,
    type: "title",
    required: true,
    description: "Site Copy: the slot's name. Section: the section it places (home.reviews). Menu: the page it links (features, or a Notion page's address). Redirect: the short link's slug. Quote, Person and Review: the name. Anything else: its title.",
  },
  {
    name: PROPS.kind,
    type: "select",
    required: true,
    description: "What the row is.",
    options: [
      { name: "Site Copy", color: "gray" },
      { name: "Page", color: "brown" },
      { name: "Post", color: "green" },
      { name: "Resource", color: "blue" },
      { name: "Redirect", color: "purple" },
      { name: "Plan", color: "yellow" },
      { name: "Product", color: "orange" },
      { name: "Quote", color: "pink" },
      { name: "Proof Logos", color: "default" },
      { name: "Question", color: "red" },
      { name: "Person", color: "purple" },
      { name: "Review", color: "yellow" },
      { name: "Section", color: "blue" },
      { name: "Menu", color: "green" },
    ],
  },
  { name: PROPS.published, type: "checkbox", required: true, description: "Ticked: on the site, or from its Published Date when that is still to come. Unticked: off. Nothing ticks it for you: to schedule a row, tick it now and date it ahead. It stays ticked while it waits." },
  {
    name: PROPS.text,
    type: "rich_text",
    description:
      "Site Copy: the slot's words (a picture's row: the picture's words). Plan: its features, one a line (\"Label: value\" fills the table). Quote: the quotation. Question: the answer. Person: a line about them. Review: what they said. Newlines become line breaks; links are kept.",
  },
  { name: PROPS.slug, type: "rich_text", description: "Pages, posts and products: the address, e.g. about or guides/setup. Empty means made from the title. Sections: the page it shows on (home, pricing…); empty, its own. Menus: the menu (header, header-side, footer-product…); empty, its own." },
  { name: PROPS.description, type: "rich_text", description: "One or two sentences for search results, cards and share previews. Person: their role." },
  {
    name: PROPS.cover,
    type: "files",
    description:
      "Pages, posts: the cover if no Notion cover. Products: the first picture. Quotes: their logo. Proof logos: a tool's mark. Person, Review: the portrait. Site Copy: the picture of meta.<page>.image (1200×630), meta.site.image, site.logo, site.logo.dark, site.icon or home.hero.image.",
  },
  {
    name: PROPS.coverPosition,
    type: "select",
    description: "Where the cover or portrait is cut when it is cropped: Top, Upper, Middle (the default), Lower or Bottom. Notion's own Reposition does not reach the site.",
    options: Object.keys(COVER_POSITIONS).map((name) => ({ name, color: "default" as const })),
  },
  {
    name: PROPS.coverTint,
    type: "select",
    description: "Pages, posts and resources: On (the default, when empty) prints the cover in the look's ink; Off shows it as uploaded. Mono still shows it in grey.",
    options: COVER_TINTS.map((name) => ({ name, color: "default" as const })),
  },
  {
    name: PROPS.order,
    type: "number",
    description: "Position in a list, smallest first. Pages: in the footer (empty means not listed). Sections: on their page. Menus: in their menu. Resources, plans, products, quotes, logos, questions, people: in theirs.",
  },
  { name: PROPS.publishedDate, type: "date", description: "Posts: the date printed. Reviews: when it was left. Any ticked row: a future date keeps it hidden until then, and it goes live on its own; with a time and its zone (Include time), from that minute, e.g. 4pm GMT." },
  {
    name: PROPS.category,
    type: "select",
    description:
      "The group a row belongs to. Posts and resources: a category (Releases puts a post on the changelog instead of the blog). Products: a collection in the shop. Plans: the box they sit in on the pricing page. Questions: where they are asked (Pricing puts them on /pricing).",
    options: [
      { name: "General", color: "gray" },
      { name: "News", color: "red" },
      { name: "Guides", color: "blue" },
      { name: "Releases", color: "green" },
      { name: "Pricing", color: "yellow" },
      { name: "Template", color: "default" },
      { name: "Services", color: "purple" },
      { name: "Breakfast", color: "orange" },
      { name: "Drinks", color: "blue" },
      { name: "Household", color: "brown" },
      { name: "Pantry", color: "green" },
      // the starter questions' groups (lib/demo/questions.ts); a Question's
      // Category is the heading it sits under on /questions
      { name: "Orders and delivery", color: "orange" },
      { name: "Returns", color: "pink" },
      { name: "Your account and privacy", color: "purple" },
      { name: "Help", color: "gray" },
    ],
  },
  {
    name: PROPS.tags,
    type: "multi_select",
    description: "Posts: any number of tags. Reviews: Example marks an invented one, shown as an example and only until a real one is published.",
    options: [
      { name: "Technology", color: "blue" },
      { name: "Design", color: "purple" },
      { name: "Business", color: "green" },
      { name: "Tutorial", color: "yellow" },
      { name: "News", color: "red" },
      { name: "Review", color: "brown" },
      // reviews: an invented one (lib/content/select.ts, isExample)
      { name: "Example", color: "gray" },
    ],
  },
  {
    name: PROPS.featured,
    type: "checkbox",
    description: "Posts: shown first on /blog. Products and quotes: shown first. Plans: marked as the recommended one.",
  },
  { name: PROPS.featureBlock, type: "number", description: "Featured posts and products: their order among the featured (1 first)." },
  { name: PROPS.author, type: "rich_text", description: "Posts: the byline, a Person row's name: their portrait (Image), job title and line come from that row. A guest gets a Person row too, with Team Page Off. A name with no Person row is printed alone." },
  { name: PROPS.authorBio, type: "rich_text", description: "Person: the line under their posts (empty: their Text). Quotes: who the speaker is." },
  {
    name: PROPS.teamPage,
    type: "select",
    description: "Person: On (the default, when empty) shows them on /team and /about. Off keeps them to the byline of the posts they write.",
    options: TEAM_PAGE.map((name) => ({ name, color: "default" as const })),
  },
  {
    name: PROPS.action,
    type: "select",
    description: "Resources: the button's verb.",
    options: [
      { name: "Read", color: "blue" },
      { name: "Watch", color: "red" },
      { name: "Download", color: "green" },
      { name: "Link", color: "default" },
    ],
  },
  {
    name: PROPS.link,
    type: "url",
    description: "Where a row's button goes: a resource's, a plan's or a logo's. Person: their profile. Review: where it was left. Products: an outside buy link (https). Redirects: the destination. Menus: an address the link goes to instead of a page, its Title the words.",
  },
  {
    name: PROPS.font,
    type: "select",
    description: "Pages and posts: Notion's three page styles.",
    options: [
      { name: "Default", color: "default" },
      { name: "Serif", color: "brown" },
      { name: "Mono", color: "gray" },
    ],
  },
  { name: PROPS.fullWidth, type: "checkbox", description: "Pages and posts: use the full width, as Notion's page option does." },
  {
    name: PROPS.layout,
    type: "select",
    description: "Pages: Article sets the body as a Notion page; Landing sets its top-level blocks as marketing sections (docs/sections.md).",
    options: [
      { name: "Article", color: "default" },
      { name: "Landing", color: "blue" },
    ],
  },
  { name: PROPS.price, type: "number", description: "Plans and products: the price, as a number. Plans: per month. Empty means custom pricing. Products: your shop's price, written by npm run shop:import; change it there." },
  { name: PROPS.yearlyPrice, type: "number", description: "Plans: the price per month when paid yearly. Shows the monthly/yearly switch." },
  {
    name: PROPS.currency,
    type: "select",
    description: "Plans and products: the price's currency, as its three-letter code. Empty means GBP; a code that is not offered can be typed in.",
    options: CURRENCIES.map((name, n) => ({ name, color: CURRENCY_COLORS[n % CURRENCY_COLORS.length] })),
  },
  { name: PROPS.priceNote, type: "rich_text", description: "Plans: the words after the price, e.g. per seat / month." },
  { name: PROPS.compareAt, type: "number", description: "Products: the old price, shown struck through. Written by npm run shop:import." },
  { name: PROPS.gallery, type: "files", description: "Products: more pictures, after the Image. Each product picture's name, the Image's too, is its alt text, read to screen readers: npm run shop:import writes the shop's." },
  {
    name: PROPS.stock,
    type: "select",
    description: "Products: whether it can be bought. Sold out keeps the page and stops the button. Written by npm run shop:import; Low stock and Pre-order are yours to set.",
    options: [
      { name: "In stock", color: "green" },
      { name: "Low stock", color: "orange" },
      { name: "Sold out", color: "red" },
      { name: "Pre-order", color: "blue" },
    ],
  },
  {
    name: PROPS.checkoutId,
    type: "rich_text",
    description: "Products sold through Shopify: the variant ID, or one \"Label: ID\" a line for several (Small: 4012345678901). Written by npm run shop:import.",
  },
  { name: PROPS.button, type: "rich_text", description: "Plans: the words on the plan's button. Its Link is where it goes." },
  { name: PROPS.rating, type: "number", description: "Reviews: the stars given, 1 to 5." },
  {
    name: PROPS.importId,
    type: "rich_text",
    description: "Products: the product in your shop this row is a copy of (shopify:… or printify:…), so npm run shop:import finds it again. Leave it as it is.",
  },
]

/**
 * First path segments a Notion page may not take, because the site already
 * answers them. A Page whose slug starts with one is skipped and reported by
 * `npm run notion:check`. Keep it in step with app/: tests/nav.test.mjs
 * fails if a top-level route is missing from it.
 */
export const RESERVED_SEGMENTS = [
  "about",
  "api",
  "blog",
  "cart",
  "changelog",
  "contact",
  "docs",
  "faq",
  "features",
  "feed",
  "ga",
  "go",
  "ingest",
  "llms.txt",
  "llms-full.txt",
  "indexnow.txt",
  "manifest.webmanifest",
  "markdown",
  "media",
  "og",
  "pricing",
  "privacy",
  "questions",
  "resources",
  "robots.txt",
  "rss.xml",
  "security",
  "security.txt",
  "services",
  "setup",
  "shop",
  "sitemap.xml",
  "subscribed",
  "team",
  "team-members",
  "_next",
  ".well-known",
] as const
