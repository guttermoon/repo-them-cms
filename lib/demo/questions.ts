/**
 * The starter content's questions: lib/demo/content.ts makes a Question
 * row of each, under its group's Category, and the setup writes those rows
 * to Notion. The pages read the rows (/questions, the /pricing questions,
 * /features), never this list: the words live in one place, the database.
 * An answer is its paragraphs: words, or words in parts with a link among
 * them (`answerText` writes the row's text, a link as `[label](url)`).
 *
 * Imports nothing but lib/site.ts, so `npm test` loads it.
 */
import { MAKER, MAKER_HOST, TEMPLATE_NAME } from "../site"

/** A paragraph of an answer: words, or parts of words and links. */
export type Paragraph = string | { parts: (string | { link: string; href: string })[] }

export type Group = { key: string; head: string; questions: { q: string; a: Paragraph[] }[] }

/** No space before a part that opens on punctuation (", then"). */
const OPENS_ON_PUNCTUATION = /^[.,;:!?’)]/

/** An answer as a Question row's text: paragraphs a blank line apart, a
 *  link as `[label](url)`, as the site reads a row's link. */
export function answerText(a: Paragraph[]): string {
  return a
    .map((p) =>
      typeof p === "string"
        ? p
        : p.parts
            .map((part) => (typeof part === "string" ? part : `[${part.link}](${part.href})`))
            .reduce((out, piece) => (!out ? piece : OPENS_ON_PUNCTUATION.test(piece) ? out + piece : `${out} ${piece}`), ""),
    )
    .join("\n\n")
}

export const GROUPS: Group[] = [
  {
    key: "orders",
    head: "Orders and delivery",
    questions: [
      {
        q: "How long does delivery take?",
        a: ["Two to four working days as standard. Plus and Business members get theirs free, and Business gets it the next working day."],
      },
      {
        q: "Can I change or cancel an order?",
        a: ["Until it leaves the shelf, yes. Write to us with the order number and say what you would like changed."],
      },
      {
        q: "Do you deliver abroad?",
        a: ["Not yet. When we do, it will say so here, in plain words."],
      },
    ],
  },
  {
    key: "returns",
    head: "Returns",
    questions: [
      {
        q: "What if something is wrong?",
        a: ["Tell us and we will put it right: a replacement or your money back, whichever you prefer. There are no forms to download."],
      },
      {
        q: "How long do I have to send something back?",
        a: ["Thirty days on the Free plan and sixty on Plus and Business, opened or not."],
      },
    ],
  },
  {
    key: "pricing",
    head: "Plans and billing",
    questions: [
      {
        q: "Can I change plans?",
        a: ["Any time. Moving up starts straight away; moving down starts at your next payment."],
      },
      {
        q: "Is there a contract?",
        a: ["No. Plans run month to month, or year to year if you pay yearly, and you can stop whenever you like."],
      },
      {
        q: "What does paying yearly save?",
        a: ["Paying yearly costs less a month, and the plans page works out the saving for you. No arithmetic required."],
      },
      {
        q: "Do prices include VAT?",
        a: ["Yes. The price you see is the price you pay."],
      },
    ],
  },
  {
    key: "accounts",
    head: "Your account and privacy",
    questions: [
      {
        q: "Do I need an account to shop?",
        a: ["No. The cart lives in your own browser."],
      },
      {
        q: "What do you keep about me?",
        a: ["What you send us and what an order needs, and nothing else. The privacy notice has the details."],
      },
      {
        q: "Do you track visitors?",
        a: ["Not unless you say yes in the cookie notice, and then only to see which pages are read, what is pressed and what goes wrong."],
      },
    ],
  },
  {
    key: "help",
    head: "Help",
    questions: [
      {
        q: "How do I reach a person?",
        a: ["Use the contact page. A person reads every message and replies in sentences, usually the same day."],
      },
      {
        q: "Where do I report a problem with the site?",
        a: ["On the contact page, choosing Something is broken. Say what you were doing and what happened."],
      },
    ],
  },
]

/** The questions about the template itself, for /features (the one page
 *  that describes it): Category Template. */
export const TEMPLATE_GROUP: Group = {
  key: "template",
  head: "The template",
  questions: [
    {
      q: "What is this site?",
      a: [
        `${TEMPLATE_NAME} is a Notion-powered CMS: a website template whose words, pages, posts, plans and products you write in one Notion database. The site reads them from there.`,
        "Every other page of this site is the generic website a copy of the template starts as: rename it, reword it in Notion, and it is yours.",
      ],
    },
    {
      q: "Is it made by Notion?",
      a: [`No. ${TEMPLATE_NAME} is an independent template that runs on Notion's public API. It is not made, endorsed or maintained by Notion Labs, Inc.`],
    },
    {
      q: "What do I need?",
      a: ["A Notion account, a GitHub account and a Vercel account, all of which have free plans, put the site live, with nothing to install.", "The contact form and the mailing list send nothing until you connect an email platform, such as Brevo or Resend, and the shop sells nothing until you connect your Shopify or Printify shop."],
    },
    {
      q: "How fast do changes appear?",
      a: ["Within a minute of ticking Published, or within seconds with a Notion webhook. Nothing to build, nothing to press."],
    },
    {
      q: "Can I schedule a post?",
      a: [
        "Yes, to the minute and in any time zone. Tick Published and give the row a Published Date in the future, with a time if you like (turn on Include time and pick the zone). It stays off the site until then and goes live on its own within a minute or two.",
        "Nothing in Notion changes when it does: Published is ticked all along, so a row that waits already looks published there. The template's Scheduled view lists the ticked rows dated today or later.",
      ],
    },
    {
      q: "What happens if Notion is down?",
      a: ["The site keeps showing its last good answer, then the copy captured when it was built. It never fills a gap with words that are not in your Notion."],
    },
    {
      q: "What does it cost to run?",
      a: ["Nothing on the free plans of Notion, Vercel and most email platforms. Vercel's free plan is for personal sites; a business pays for Vercel's Pro plan."],
    },
    {
      q: "Does it take a cut of what my shop sells?",
      a: ["No. Checkout is your own Shopify or Printify shop, and the template is not in the middle."],
    },
    {
      q: "Where do I keep my products?",
      a: ["In Shopify or Printify, where you sell them. One command copies them into Notion, and the site shows that copy. You change a product in your shop and run it again; in Notion you choose which products show and in what order."],
    },
    {
      q: "Can somebody set it up for me?",
      a: [
        {
          parts: [
            `Yes. ${MAKER.name}, who made it, sets it up for people and builds sites to order. Write to`,
            { link: MAKER.email, href: `mailto:${MAKER.email}` },
            "or visit",
            { link: MAKER_HOST, href: MAKER.url },
            ".",
          ],
        },
      ],
    },
    {
      q: "Where do I report a bug?",
      a: ["Open an issue on the repository. Security problems: see the security policy in the repository, and please do not post them publicly."],
    },
  ],
}
