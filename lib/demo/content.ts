/**
 * The starter content: the generic site a copy of the template starts as.
 * It is what `npm run notion:setup` puts in a new database, what the site
 * shows before any database is connected (lib/demo/starter.ts), what
 * scripts/fake-notion.mjs serves for an end-to-end run, and what the tests
 * render: two demo slot rows, three pages (one a landing page), three
 * posts, four resources, two short links, four plans, an example shop of
 * generic goods, a team of four, one public-domain quotation and the
 * questions, written in the house voice.
 *
 * Nothing here pretends: the shop's goods are fictional and the shop says
 * so until a way to sell is set up; the team are generic people drawn as
 * packs; the quotation is William Morris's, not a customer's; there are no
 * logos, because nobody has said yes to one.
 *
 * Every block type the renderer draws appears somewhere here, most of them
 * on the "Every block" page, so a fresh site shows what it can do.
 */
import type { Kind } from "../notion/schema"
import { MENU_NAMES, MENUS } from "../menus"
import { SECTIONS, type SectionKey } from "../sections"
import { STARTER_PLANS } from "./plans"
import { answerText, GROUPS, TEMPLATE_GROUP } from "./questions"
import { MAKER } from "../site"
import {
  b,
  bookmark,
  bullet,
  callout,
  code,
  codeBlock,
  color,
  columns,
  divider,
  equation,
  h1,
  h2,
  h3,
  i,
  image,
  link,
  math,
  numbered,
  p,
  quote,
  s,
  table,
  toc,
  todo,
  toggle,
  toggleHeading,
  u,
  video,
  type Block,
} from "./blocks"

export type DemoRow = {
  kind: Kind
  title: string
  published: boolean
  text?: string
  slug?: string
  description?: string
  /** one of Notion's own icons, by its name in Notion (drawn gray) */
  icon?: string
  /** a file in public/demo */
  cover?: string
  date?: string
  category?: string
  tags?: string[]
  author?: string
  authorBio?: string
  /** a Person: On or Off on /team and /about (empty: On) */
  teamPage?: "On" | "Off"
  featured?: boolean
  featureBlock?: number
  order?: number
  action?: string
  link?: string
  font?: "Default" | "Serif" | "Mono"
  layout?: "Article" | "Landing"
  /** plans and products */
  price?: number
  yearlyPrice?: number
  currency?: string
  priceNote?: string
  compareAt?: number
  /** more files in public/demo, after the cover */
  gallery?: string[]
  stock?: "In stock" | "Low stock" | "Sold out" | "Pre-order"
  checkoutId?: string
  /** products: where an import found it (shopify:… or printify:…) */
  importId?: string
  button?: string
  /** Reviews: the stars, 1 to 5 */
  rating?: number
  /** invented, as the starter reviews are: tagged Example, here and in
   *  Notion, so it is shown marked as an example wherever it shows */
  example?: true
  blocks?: Block[]
}

/** The starter team: generic names, generic portraits (public/demo, drawn
 *  by scripts/build-demo-images.mjs), nobody real. */
export const TEAM = {
  founder: { name: "Pat Generic", role: "Founder", bio: "Started the company with one product and a plain label. Still answers the email.", portrait: "person-founder.webp" },
  product: { name: "Sam Plain", role: "Product", bio: "Decides what goes in the tin and, more often, what stays out.", portrait: "person-product.webp" },
  design: { name: "Alex Standard", role: "Design", bio: "Drew the stripe. Will not add a second colour without a meeting.", portrait: "person-design.webp" },
  support: { name: "Jo Regular", role: "Support", bio: "Reads every message and replies in sentences, usually the same day.", portrait: "person-support.webp" },
}

const everyBlock: Block[] = [
  callout("grid", ["This page was written in Notion. Every block type the site draws is on it, so you can see each one next to its source."]),
  toc(),
  h1("Text"),
  p(
    "Plain words, then ",
    b("bold"),
    ", ",
    i("italic"),
    ", ",
    s("struck through"),
    ", ",
    u("underlined"),
    ", ",
    code("inline code"),
    ", ",
    color("red", "red"),
    ", ",
    color("blue", "blue"),
    ", ",
    color("a highlight", "yellow_background"),
    " and ",
    link("a link", "https://developers.notion.com/"),
    ". An equation can sit in a sentence: ",
    math("E = mc^2"),
    ".",
  ),
  h2("Headings"),
  h3("A third-level heading"),
  toggleHeading(3, ["A heading that folds"], [p("Notion's toggle headings fold like toggles do.")]),
  h1("Lists"),
  bullet(["Bulleted"], [bullet(["Nested once"], [bullet(["Nested twice"])])]),
  bullet(["Another"]),
  numbered(["Numbered"]),
  numbered(["In order"], [numbered(["With a sub-step"])]),
  todo(["A to-do, done"], true),
  todo(["A to-do, not yet"]),
  h1("Blocks that hold things"),
  toggle(["A toggle"], [p("Hidden until opened. Toggles can hold anything."), bullet(["Even lists"])]),
  quote("A quote. Larger, with a rule down the side."),
  callout("light-bulb", ["A callout, grey."]),
  callout("checkmark", ["A callout, green."], "green_background"),
  callout("warning", ["A callout, yellow."], "yellow_background"),
  divider(),
  columns(
    [h3("Left column"), p("Columns sit side by side on a wide screen and stack on a phone.")],
    [h3("Right column"), p("Each keeps its own blocks.")],
  ),
  h1("Code and maths"),
  codeBlock("typescript", 'const site = await getSiteData()\nconsole.log(site.entries.length, "rows from Notion")', "Highlighted on the server, in every look."),
  codeBlock("bash", "npm run notion:check"),
  equation("\\int_0^1 x^2\\,dx = \\frac{1}{3}"),
  h1("Tables"),
  table([
    ["Kind", "Lives at", "Written in"],
    ["Page", "/its-slug", "The row's own page"],
    ["Post", "/blog/its-slug", "The row's own page"],
    ["Site Copy", "Wherever its slot is", "The Text column"],
  ]),
  h1("Pictures, video and links"),
  // the caption's second line is the picture's alt text: read, not shown
  image("sampler.png", "A picture uploaded to Notion, served from this site's own address.\nAlt: The word “picture” over a blue band, above the words “served from this site, not from Notion”"),
  video("https://www.youtube.com/watch?v=aqz-KE-bpKQ", "Big Buck Bunny (Blender Foundation, CC BY 3.0). Nothing loads from YouTube until you press play."),
  bookmark("https://developers.notion.com/reference/intro", "A bookmark: Notion's API documentation."),
]

export const DEMO_ROWS: DemoRow[] = [
  // ── the two published slots the homepage's demo shows ──
  { kind: "Site Copy", title: "demo.published", published: true, text: "This sentence came from Notion. Somebody typed it there." },
  { kind: "Site Copy", title: "demo.hidden", published: true, text: "" },

  // ── pages ──
  {
    kind: "Page",
    title: "Colophon",
    slug: "colophon",
    published: true,
    order: 2,
    icon: "receipt",
    description: "What this site is made of, heaviest first: the tools it runs on and the typefaces it is set in, then the rules it keeps about your privacy and its pictures.",
    blocks: [
      p("The ingredients, in descending order of weight."),
      table([
        ["Ingredient", "What for"],
        ["Notion", "Every word, page and post"],
        ["Next.js", "The site itself"],
        ["Inter, Source Serif 4, IBM Plex Mono", "Notion's three page styles, served from this site"],
        ["shiki", "Code colours, on the server"],
        ["KaTeX", "Equations, as MathML"],
      ]),
      h2("Rules it keeps"),
      bullet(["Nothing from another site loads in your browser."]),
      bullet(["Nothing is counted unless you say yes."]),
      bullet(["Every picture has words for people who cannot see it."]),
    ],
  },
  {
    kind: "Page",
    title: "Every block",
    slug: "every-block",
    published: true,
    icon: "grid",
    description: "Every Notion block the site can draw, on one page: text, lists, to-dos, toggles, callouts, quotes, code, equations, tables, columns, pictures and video.",
    blocks: everyBlock,
  },

  // ── posts: three generic ones, newest first (the homepage shows them) ──
  {
    kind: "Post",
    title: "Introducing generic",
    slug: "introducing-generic",
    published: true,
    date: "2026-11-20",
    category: "News",
    tags: ["News"],
    author: TEAM.founder.name,
    featured: true,
    featureBlock: 1,
    icon: "alien",
    cover: "cover-introducing.png",
    description: "A shop with nothing to hide: plain products in plain packs, labels that say what is inside, and prices you can read from across the room. Here is why.",
    blocks: [
      p("We make plain things and sell them plainly. The label says what is inside; the price says what it costs; the small print is large."),
      h2("What is on the shelf"),
      bullet(["Drink, corn flakes, shrimp, coffee, instant noodles and food. One of each, done properly."]),
      bullet(["Each with its ingredients on the side and its price on the front."]),
      h2("What is not"),
      bullet(["Logos shouting at you from across the aisle."]),
      bullet(["Subscriptions you did not ask for, and contracts you cannot leave."]),
      quote("Have nothing in your houses that you do not know to be useful, or believe to be beautiful."),
      callout("receipt", ["Want it delivered for less? ", link("The plans", "/pricing"), " start at nothing."], "blue_background"),
    ],
  },
  {
    kind: "Post",
    title: "Five questions to ask before you buy anything",
    slug: "five-questions",
    published: true,
    date: "2026-11-12",
    category: "Guides",
    tags: ["Tutorial"],
    author: TEAM.support.name,
    icon: "search",
    cover: "cover-questions.png",
    description: "A short checklist for any purchase, generic or not: what is in it, what it costs all in, how you get out of it, and who answers when it goes wrong.",
    blocks: [
      p("The questions we ask of everything we sell, and the ones worth asking of anybody selling to you."),
      numbered([b("What is in it?"), " If the label will not say, ask why."]),
      numbered([b("What does it cost, all in?"), " Delivery, fees and the price after the offer ends."]),
      numbered([b("How do I get out?"), " A plan you cannot leave is not a plan; it is a trap."]),
      numbered([b("Who answers when it goes wrong?"), " A person, a form, or nobody at all."]),
      numbered([b("Do I need it?"), " The cheapest thing in the shop is the one you leave on the shelf."]),
      h2("Our answers, side by side"),
      table([
        ["Question", "Our answer"],
        ["What is in it?", "On the side of every pack"],
        ["What does it cost?", "On the front, with VAT"],
        ["How do I get out?", "Stop any time"],
        ["Who answers?", "A person, the same day"],
      ]),
      toggle(["And if the answer is no?"], [p("Then do not buy it. We will still be here next time.")]),
    ],
  },
  {
    kind: "Post",
    title: "Version 1.0: generic, finally",
    slug: "version-1",
    published: true,
    date: "2026-11-04",
    category: "Releases",
    tags: ["News"],
    author: TEAM.product.name,
    icon: "tag",
    cover: "cover-release.png",
    description: "The first release: four plans from free to Enterprise, member prices, free delivery on Plus, and a returns policy short enough to fit on a label.",
    blocks: [
      p("The first version is out. Here is what is in it, in the order you will notice it."),
      h2("New"),
      bullet(["Four plans: Free, Plus, Business and Enterprise, monthly or yearly."]),
      bullet(["Member prices on everything for Plus and Business."]),
      bullet(["Free delivery on Plus, and next-day delivery on Business."]),
      h2("Changed"),
      bullet(["Returns: thirty days on Free, sixty on the rest."]),
      h2("Still to come"),
      todo(["Delivery abroad"], false),
      todo(["A second colour"], false),
      callout("chat", ["Something missing? ", link("Tell us", "/contact"), "."], "gray_background"),
    ],
  },

  // ── resources ──
  {
    kind: "Resource",
    title: "Generic brand, on Wikipedia",
    published: true,
    order: 1,
    category: "General",
    action: "Read",
    link: "https://en.wikipedia.org/wiki/Generic_brand",
    description: "Where the plain packaging comes from: the history of generic goods and their labels.",
  },
  {
    kind: "Resource",
    title: "The full list of ingredients",
    published: true,
    order: 1,
    category: "Template",
    action: "Read",
    link: "/resources/ingredients",
    description: "Everything the template does, group by group, and what it leaves out.",
  },
  {
    kind: "Resource",
    title: "The plans, compared",
    published: true,
    order: 2,
    category: "Guides",
    action: "Read",
    link: "/pricing",
    description: "Every plan, feature by feature, on one page, with the price of each.",
  },
  {
    kind: "Resource",
    title: "Delivery and returns, in brief",
    published: true,
    order: 3,
    category: "Guides",
    action: "Read",
    link: "/questions",
    description: "The short version of how an order arrives, and how to send one back.",
  },
  {
    kind: "Resource",
    title: "Five questions to ask before you buy anything",
    published: true,
    order: 4,
    category: "Guides",
    action: "Read",
    link: "/blog/five-questions",
    description: "A checklist for any purchase, generic or not.",
  },

  // ── short links ──
  { kind: "Redirect", title: "help", published: true, link: "/contact" },
  { kind: "Redirect", title: "maker", published: true, link: MAKER.url },

  // ── a landing page, written as blocks (Layout: Landing) ──
  {
    kind: "Page",
    title: "Generic Plus",
    slug: "landing",
    published: true,
    order: 4,
    layout: "Landing",
    icon: "tag",
    description: "Generic Plus: member prices on everything, free delivery and a person on the other end of the email, for five pounds a month or four paid yearly.",
    blocks: [
      p("Member prices on everything, free delivery and a person on the other end of the email. Five pounds a month, or four if you pay for the year."),
      p(link("See the plans", "/pricing"), " ", link("Ask a question", "/contact")),
      h1("What you get"),
      p("Three things, plainly."),
      columns([h3("Member prices"), p("Less on everything, every time.")], [h3("Free delivery"), p("However small the order.")], [h3("A person"), p("Replies in sentences, the same day.")]),
      callout("calendar", ["£4\na month, paid for the year"]),
      callout("clock", ["60\ndays to change your mind"]),
      callout("unlock", ["0\ncontracts you cannot leave"]),
      h1("Plus, side by side"),
      p("The free plan is good. Plus is better, and says why."),
      table(
        [
          ["Feature", "Free", "Plus"],
          ["Member prices", "—", "✓"],
          ["Delivery", "Standard", "Free"],
          ["Help", "The questions page", "Email, the same day"],
          ["Returns", "30 days", "60 days"],
        ],
        true,
        true,
      ),
      h1("Questions"),
      toggle(["Can I stop any time?"], [p("Yes. Plus runs to the end of what you paid for, then stops.")]),
      toggle(["Do member prices start straight away?"], [p("Yes, from your next order.")]),
      h1("Get Plus"),
      p("Generic on purpose. Good value on purpose, too."),
      p(link("Choose Plus", "/pricing")),
    ],
  },

  // ── the plans (lib/demo/plans.ts) ──
  ...STARTER_PLANS.map(
    (plan, i): DemoRow => ({
      kind: "Plan",
      title: plan.name,
      published: true,
      order: i + 1,
      description: plan.description,
      ...(plan.price !== undefined ? { price: plan.price, currency: "GBP" } : {}),
      ...(plan.yearlyPrice !== undefined ? { yearlyPrice: plan.yearlyPrice } : {}),
      ...(plan.priceNote ? { priceNote: plan.priceNote } : {}),
      text: plan.features,
      featured: Boolean(plan.recommended),
      button: plan.button,
      link: plan.href,
    }),
  ),

  // ── an example shop: generic goods, nothing for sale ──
  {
    kind: "Product",
    title: "Drink",
    slug: "drink",
    published: true,
    featured: true,
    order: 1,
    category: "Drinks",
    price: 1,
    currency: "GBP",
    stock: "In stock",
    checkoutId: "Single can: 40000000000001\nSix-pack: 40000000000002",
    description: "A can of drink. Cold, wet and generic.",
    cover: "product-drink.webp",
    gallery: ["product-drink-back.webp"],
    blocks: [p("Ingredients: water, sugar, a little fizz, and the flavour of drink."), bullet(["Serve cold"]), bullet(["Contains no trackers"])],
  },
  {
    kind: "Product",
    title: "Corn flakes",
    slug: "corn-flakes",
    published: true,
    featured: true,
    order: 2,
    category: "Breakfast",
    price: 2.5,
    compareAt: 3,
    currency: "GBP",
    stock: "In stock",
    checkoutId: "Regular: 40000000000003\nFamily size: 40000000000004",
    description: "Toasted flakes of corn. Pour, add milk, eat.",
    cover: "product-corn-flakes.webp",
    gallery: ["product-corn-flakes-back.webp"],
    blocks: [p("Toasted corn cereal, the plain kind. Milk not included.")],
  },
  {
    kind: "Product",
    title: "Shrimp",
    slug: "shrimp",
    published: true,
    order: 3,
    category: "Pantry",
    price: 3.25,
    currency: "GBP",
    stock: "Low stock",
    checkoutId: "40000000000005",
    description: "Cooked, peeled and tinned. For a plate of shrimp, out of the blue.",
    cover: "product-shrimp.webp",
  },
  {
    kind: "Product",
    title: "Instant noodles",
    slug: "instant-noodles",
    published: true,
    order: 4,
    category: "Pantry",
    price: 0.95,
    currency: "GBP",
    stock: "In stock",
    checkoutId: "40000000000006",
    description: "Add boiling water, wait three minutes, eat. Fork not included.",
    cover: "product-instant-noodles.webp",
  },
  {
    kind: "Product",
    title: "Food",
    slug: "food",
    published: true,
    order: 5,
    category: "Pantry",
    price: 1.2,
    currency: "GBP",
    stock: "Sold out",
    checkoutId: "40000000000007",
    description: "A tin of food. Heat and serve.",
    cover: "product-food.webp",
  },
  {
    kind: "Product",
    title: "Coffee",
    slug: "coffee",
    published: true,
    order: 6,
    category: "Drinks",
    price: 4,
    currency: "GBP",
    stock: "Pre-order",
    checkoutId: "40000000000008",
    description: "Ground coffee, medium roast. Hot when made.",
    cover: "product-coffee.webp",
  },

  // ── the team: generic people, drawn as packs rather than photographed ──
  ...Object.values(TEAM).map(
    (person, i): DemoRow => ({
      kind: "Person",
      title: person.name,
      published: true,
      order: i + 1,
      description: person.role,
      text: person.bio,
      cover: person.portrait,
    }),
  ),

  // ── a quotation: public domain, accurately attributed ──
  {
    kind: "Quote",
    title: "William Morris",
    published: true,
    featured: true,
    text: "Have nothing in your houses that you do not know to be useful, or believe to be beautiful.",
    authorBio: "The Beauty of Life, a lecture, 1880",
  },
  // reviews: invented, so tagged Example and shown marked as examples
  {
    kind: "Review",
    title: "Morgan Aisle",
    published: true,
    example: true,
    rating: 5,
    date: "2026-11-21",
    text: "Ordered the corn flakes. They were corn flakes. The label said so, and the label was right.",
  },
  {
    kind: "Review",
    title: "Casey Basket",
    published: true,
    example: true,
    rating: 5,
    date: "2026-11-18",
    text: "Prices on the front, ingredients on the side, and a real person answered my email. More of this, please.",
  },
  {
    kind: "Review",
    title: "Riley Trolley",
    published: true,
    example: true,
    rating: 4,
    date: "2026-11-12",
    text: "The coffee is coffee, and it came when it said it would. One star off because I wanted more of it.",
  },
  {
    kind: "Review",
    title: "Robin Label",
    published: true,
    example: true,
    rating: 5,
    date: "2026-11-05",
    text: "Cancelled my plan in two clicks, then came back, because nobody made it hard to leave.",
  },

  // ── the questions, from the built-in lists; the template's go on /features ──
  ...[...GROUPS, TEMPLATE_GROUP].flatMap((group) =>
    group.questions.map(
      (item, i): DemoRow => ({
        kind: "Question",
        title: item.q,
        published: true,
        // the pricing page shows Category Pricing; /features, Category Template
        category: group.key === "pricing" ? "Pricing" : group.key === "template" ? "Template" : group.head,
        order: i + 1,
        text: answerText(item.a),
      }),
    ),
  ),

  // ── sections: one row for each, where it was designed, so every page's
  // line-up is there to see and change in Notion (lib/sections.ts) ──
  ...(Object.entries(SECTIONS) as [SectionKey, (typeof SECTIONS)[SectionKey]][]).map(
    ([key, section]): DemoRow => ({
      kind: "Section",
      title: key,
      published: true,
      slug: section.page === "/" ? "home" : section.page.slice(1),
      order: section.order,
      description: section.about,
    }),
  ),

  // ── menus: one row for each link, where it was designed, so the header's
  // and the footer's links are there to reorder and turn off in Notion
  // (lib/menus.ts) ──
  ...MENU_NAMES.flatMap((menu) =>
    MENUS[menu].links.map(
      (href, i): DemoRow => ({
        kind: "Menu",
        title: href === "/" ? "home" : href.slice(1),
        published: true,
        slug: menu,
        order: (i + 1) * 10,
        description: MENUS[menu].about,
      }),
    ),
  ),
]

/** The pictures the starter content uses, in public/demo. */
export const DEMO_FILES = [
  "cover-introducing.png",
  "cover-questions.png",
  "cover-release.png",
  "sampler.png",
  "product-drink.webp",
  "product-drink-back.webp",
  "product-corn-flakes.webp",
  "product-corn-flakes-back.webp",
  "product-shrimp.webp",
  "product-instant-noodles.webp",
  "product-food.webp",
  "product-coffee.webp",
  ...Object.values(TEAM).map((person) => person.portrait),
] as const
