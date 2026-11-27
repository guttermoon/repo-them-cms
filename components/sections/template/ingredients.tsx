import Link from "next/link"

import { slotHidden, type SiteCopy, type T } from "@/components/system/notion-text"
import { plainText } from "@/components/system/notion-text"
import { Callout, Divider, Todo, Toggle } from "@/components/ui/blocks"
import { Icon } from "@/components/ui/icon"
import { TagLink } from "@/components/ui/page"
import type { IconName } from "@/lib/icons"

/**
 * The template's full list of ingredients: everything it does, in groups,
 * and what it leaves out. It has a page of its own, /resources/ingredients,
 * listed among the resources; /features shows its groups as chips and the
 * way to it. Every word is a slot under `features.*`, as it was when the
 * list stood on /features, so a row an editor already reworded still holds.
 */

/** Where the list lives. */
export const INGREDIENTS_PATH = "/resources/ingredients"

type Props = { T: T; content: SiteCopy }

/**
 * Every feature, set as a Notion page would set it: headings, callouts,
 * toggles and a table, in the same components a page written in Notion is
 * drawn with. Each feature is a section with its own anchor.
 */
export const INGREDIENTS: { key: string; icon: IconName; title: string; intro: string; points: { key: string; title: string; body: string }[] }[] = [
  {
    key: "copy",
    icon: "pen-nib",
    title: "Words, from Notion",
    intro: "Every piece of text on a designed page is a slot. Each slot looks for a row in the Notion database with its name.",
    points: [
      { key: "once", title: "Written once, shown everywhere", body: "A fact lives in one row, and every place that shows it reads that row: a plan's price feeds the pricing page, the homepage, the comparison table, llms.txt and the search data; a person's portrait every byline and the team page; the site's name every title and share card. Change it once." },
      { key: "states", title: "Three states per slot", body: "A ticked row shows Notion's words. An unticked row, a ticked one left empty, or no row at all shows nothing, so no word reaches the site unseen. Only the starter site, before Notion is connected, shows the words in the code, and a control's own name (a field's label, a button) falls back to them rather than go blank." },
      { key: "links", title: "Links survive", body: "A link made in Notion stays a link on the site. Only web, mail, phone and on-site links are drawn; anything else is drawn as its words. A link to another site opens in a new tab." },
      { key: "formatting", title: "Formatting comes through", body: "Bold, italic, underline, strikethrough and code in a slot or in a row's words are drawn as Notion shows them. Notion's colours stay in a page's body, so the web copy keeps the site's look." },
      { key: "fallbacks", title: "Notion down, site up", body: "If Notion cannot be reached, the site keeps its last good answer, then the copy captured at build time. It never fills a gap with words that are not in your Notion." },
      { key: "keys", title: "Every slot listed", body: "npm run copy renders the site and lists every slot with suggested words. npm run notion:check names any slot with no row, and npm run notion:seed-copy adds them, unticked, for you to read and tick (it needs an integration with Insert content)." },
    ],
  },
  {
    key: "pages",
    icon: "file-text",
    title: "Pages and posts, written in Notion",
    intro: "Add a row, set its Kind to Page or Post, write the page body in Notion, tick Published.",
    points: [
      { key: "blocks", title: "The blocks you write with", body: "Paragraphs, four sizes of heading, toggle headings, bulleted, numbered and to-do lists, toggles, quotes, callouts, dividers, code, equations, tables, columns, tables of contents, images, video, audio, PDFs, files, bookmarks, embeds, link previews, synced blocks and links to other pages." },
      { key: "style", title: "Notion's page options", body: "Cover and icon as Notion sets them, the Default, Serif and Mono fonts and full width from the row's Font and Full width (Notion's own page menu is not in its API), and Notion's nine text and background colours, in every look." },
      { key: "looks", title: "Four looks", body: "Light, dark, mono and rainbow, or whatever the reader's system prefers. Every pairing of colours is checked for contrast in each, to WCAG AAA, and the choice stays in the reader's browser." },
      { key: "blog", title: "A proper blog", body: "Dates, categories and tags with pages of their own, featured posts, reading time, newer and older links, a search box and an RSS feed. Authors are Person rows, written once: one portrait and job title on every byline and on the team page, and a guest is a Person row kept off it." },
      { key: "schedule", title: "Scheduled posts", body: "Give a post, or any row, a Published Date in the future, with a time and its time zone if you like (4pm GMT on the 1st), and tick Published: it appears then, without anybody pressing anything. A date with no time starts at midnight UTC." },
      { key: "addresses", title: "Your addresses", body: "A page lives at its Slug, nested if you like (guides/setup). A page that would take a built-in page's address, or one another page holds, is skipped, and npm run notion:check says which." },
      { key: "more", title: "Pages made of rows", body: "/questions from Question rows (Category Pricing puts one on /pricing too), /team and /about from Person rows, /resources from Resource rows, and /changelog from posts filed under Releases, which stay out of the blog." },
      { key: "sections", title: "Pages you can rearrange", body: "On the homepage, /pricing, /about, /team, /security and /questions, a Section row turns a section off, moves it to another of them, puts a page in a new order or shows a section twice. The hero stays first, and a section with no row stays where it was designed." },
      { key: "menus", title: "Menus you arrange", body: "A Menu row turns a link in the header or the footer off, moves it, or adds a page of your own. The header holds at most four links left of the mark and two right of it, so it stays level." },
      { key: "brand", title: "Your logo and icon", body: "Upload a logo in Notion and it stands where the mark does, in the header and the footer, with a version for the dark look if you like. Your icon, or the logo, becomes the browser tab's and the home screen's, made at every size each needs." },
    ],
  },
  {
    key: "shop",
    icon: "shopping-cart-simple",
    title: "A shop window for Shopify or Printify",
    intro: "Your products stay where you sell them. One command copies them in as rows, and the shelves, the product pages and the cart follow.",
    points: [
      { key: "catalogue", title: "One catalogue, kept in your shop", body: "Names, descriptions, prices, stock and pictures, and from Shopify the sizes, are kept in Shopify or Printify and copied in, never typed twice. Change a product there, run npm run shop:import -- --write, and the site follows." },
      { key: "notion", title: "What Notion decides", body: "Which products show, which come first, what address each has, Low stock and Pre-order, and any picture you upload in Notion. Anything else the shop says that was changed in Notion is changed back, so the two cannot drift." },
      { key: "shopify", title: "Checkout with Shopify", body: "The cart checks out at your Shopify shop, which prices the order from its own records. Printify connected to that shop fulfils it." },
      { key: "printify", title: "Or a Printify Pop-Up Store", body: "Each product's button goes to its page in your Printify store, which takes the order and makes it." },
      { key: "cart", title: "A cart that stays put", body: "Kept in the reader's own browser, written only when they add something, and every change announced to screen readers as it happens." },
      { key: "example", title: "An example until it is real", body: "Until a way to sell is set up, the shop says it is an example, switches the checkout off and keeps itself out of search." },
    ],
  },
  {
    key: "pricing",
    icon: "tag",
    title: "Pricing and landing pages",
    intro: "The parts of a SaaS site, as rows and blocks in Notion.",
    points: [
      { key: "plans", title: "Plans", body: "Monthly and yearly prices, a recommended plan, features as lines, and the saving worked out rather than typed." },
      { key: "compare", title: "A comparison table", body: "Built from the plans' own feature lines: a real table, with headers a screen reader can follow." },
      { key: "landing", title: "Landing pages", body: "Set a page's Layout to Landing and its blocks become sections: columns become cards, a run of short figures in callouts a row of numbers, toggles questions, a quote a quotation, and a line of links buttons." },
      { key: "proof", title: "Quotes, logos and reviews", body: "Quote rows fill the quotations, and Proof Logos rows the strip of tools the site goes well with, which names the tools it is built on until you add your own. Reviews tagged Example show as examples, and only until a real one is published." },
    ],
  },
  {
    key: "media",
    icon: "image",
    title: "Pictures and files, from your own domain",
    intro: "Notion's file links expire after an hour and live on somebody else's host. Here every picture and file is served from your site.",
    points: [
      { key: "proxy", title: "Signed addresses", body: "Each picture and file gets a signed /media/ address. The server fetches it from Notion only when no cache holds it yet, and caches it for a year." },
      { key: "sized", title: "The size it is shown", body: "Upload a large photograph and each reader is sent it near the size their screen shows it, as WebP, so a portrait an inch wide is not a download of megabytes. A drawing, a GIF and a file over 40 MB go as they are." },
      { key: "alt", title: "Pictures described in Notion", body: "A caption line that starts Alt: is a picture's description, read to screen readers and never shown, and a product's picture is described by its name. npm run notion:check names any picture nobody described." },
      { key: "video", title: "Videos load when asked", body: "YouTube and Vimeo appear as a card. Nothing loads from them until the reader presses play." },
      { key: "covers", title: "Covers in the site's colours", body: "A post's or a page's cover is printed in the look's own colour, so a photograph from anywhere sits with the site. Set Cover Tint to Off and it shows as uploaded (in mono it stays grey)." },
      { key: "hero", title: "A picture under the hero", body: "Give the home page's hero a photograph from Notion and it fills the width of the window under a veil, with the words light on it, in every look." },
    ],
  },
  {
    key: "publishing",
    icon: "timer",
    title: "Publishing",
    intro: "Edit in Notion. The site follows.",
    points: [
      { key: "minute", title: "Within about a minute", body: "Content is read from Notion once a minute at most, however busy the site is, and pages refresh in the background." },
      { key: "webhooks", title: "Or within seconds", body: "Point a Notion webhook or a database automation at the site, with a secret of its own, and it refreshes the moment something changes." },
      { key: "status", title: "Status for your team", body: "Draft, In Review and Published say where a row is, kept in step with the Published box by two automations. The site reads Published alone, and the Scheduled view lists what waits for its date." },
      { key: "redirects", title: "Short links for print", body: "A Redirect row makes /go/its-title send people wherever its Link says. Print the short link on a poster, or as a QR code (npm run qr), and change the destination later." },
    ],
  },
  {
    key: "search",
    icon: "magnifying-glass",
    title: "Search and sharing",
    intro: "The same words feed every machine that reads the site.",
    points: [
      { key: "meta", title: "Titles, descriptions, share cards", body: "Every page gets a title, a description, a canonical address and a share card: a picture you give it in Notion, its cover, or one drawn in the house style with its own title on it." },
      { key: "data", title: "Structured data", body: "Pages, posts, the blog, the questions, the team, the site with its logo and the maker, and a live shop's products, described in schema.org JSON-LD, with breadcrumbs, real dates and nothing invented. No review is marked up." },
      { key: "maps", title: "Sitemap, RSS, llms.txt, Markdown", body: "A sitemap, an RSS feed, llms.txt and llms-full.txt with the plans and their prices, and every page, post and product written in Notion as Markdown at its address with .md added, for the assistants people ask. Once it is set up, IndexNow tells Bing and the engines that share it after each deploy, and each hour what changed in Notion." },
      { key: "starter", title: "Out of search until it is yours", body: "Until Notion is connected, every page is noindex and robots are shut, so the starter content never competes in search." },
    ],
  },
  {
    key: "mail",
    icon: "envelope-simple",
    title: "Email, on your own platform",
    intro: "A contact form and a mailing list, sent through an email platform of yours. The site needs one to send anything: it keeps no addresses and sends no email itself.",
    points: [
      { key: "platforms", title: "Built in", body: "Brevo (which also makes its own list), Resend and SendGrid run both forms. Mailchimp, Klaviyo, beehiiv, Loops, MailerLite, Kit and Buttondown keep the list, and Postmark sends the messages: pair one of each. Double opt-in is the platform's to ask." },
      { key: "example", title: "Examples until connected", body: "Until a platform is set up, both forms are marked as examples, send nothing anywhere, and say so when pressed." },
      { key: "webhook", title: "Anything else", body: "A webhook, signed when you set a secret, sends each sign-up and message to Zapier, Make, n8n or your own endpoint." },
      { key: "spam", title: "Quietly guarded", body: "Rate limits, a honeypot field, and a server that checks every field again. Nothing personal is written to the logs." },
    ],
  },
  {
    key: "privacy",
    icon: "lock-simple",
    title: "Privacy, by construction",
    intro: "A reader's browser talks to your site and nobody else, until they press play on a video or go to the checkout.",
    points: [
      { key: "fonts", title: "Fonts from your own files", body: "The faces are files in the repository, served from your domain; nothing is fetched from Google, at build time or by a reader. A Content-Security-Policy refuses any font or stylesheet from elsewhere." },
      { key: "analytics", title: "Analytics only after a yes", body: "PostHog and Google Analytics are off until you add a key, and then count nothing until the reader says yes. Both go through your server, which shortens IP addresses." },
      { key: "cookies", title: "The cookie question, your shape", body: "A bag of cookies, a plain box or a banner along the bottom, chosen in Notion. Every shape asks the same question, no is as easy as yes, and Escape answers no." },
      { key: "limits", title: "Rate limits, and a security.txt", body: "Every route a reader can call is rate limited; with Upstash or Vercel KV, one count holds across every server, kept as a hash, never an address. /.well-known/security.txt names your own contact and renews itself daily." },
      { key: "secrets", title: "No secrets in the code", body: "Every key and address is an environment variable, listed in .env.example. A test fails if anything that looks like a secret is committed, or if the list and the code disagree." },
    ],
  },
  {
    key: "quality",
    icon: "flask",
    title: "Tested",
    intro: "Rules a reader would notice breaking are tests.",
    points: [
      { key: "tests", title: "Over a thousand tests", body: "Every page is rendered three ways (with no Notion, from a stand-in Notion over HTTP, and with an empty database) and checked for alt text, named controls, working links and structured data." },
      { key: "access", title: "Accessible, to AAA where a site can be", body: "7:1 contrast in all four looks, 44-pixel targets, a 3-pixel focus ring, nothing moving for readers who ask for stillness, and a select and tabs that keep the whole keyboard." },
      { key: "audits", title: "Audits", body: "An accessibility audit (axe at WCAG 2.2 AAA, with contrast, target sizes and the focus ring measured in every look at three widths), a privacy audit that fails on any request leaving the site, and a sharpness audit for pictures a retina screen would stretch." },
      { key: "feedback", title: "Feedback from readers", body: "A Feedback button sends a reader's words to your PostHog survey through your site, needing no yes and passing on no address. Turn on the agent and it reads them and opens draft pull requests for a person to review." },
    ],
  },
]

/** The four packs on the still life's shelf, in its order, and the way to
 *  each. Every word is a slot; a link's row may carry its own address. */

/** The groups as chips, each a link to its place in the list. `base`: the
 *  list's own page from elsewhere, or nothing on that page itself. */
export function IngredientChips({ T, content, base = "" }: Props & { base?: string }) {
  return (
    <nav aria-label={plainText(content, "features.list.nav", "Every ingredient")} className="n-page mt-5">
      <div className="flex flex-wrap gap-1.5">
        {INGREDIENTS.filter((s) => !slotHidden(content, `features.${s.key}.title`)).map((s) => (
          <TagLink key={s.key} href={`${base}#${s.key}`}>
            <Icon name={s.icon} className="n-c-gray mr-1" />
            <T k={`features.${s.key}.title`}>{s.title}</T>
          </TagLink>
        ))}
      </div>
    </nav>
  )
}

/** The list itself, group by group, then what is not included. `level`:
 *  the heading each group takes, one under the page's own. */
export function IngredientsList({ T, content }: Props) {
  return (
        <div className="n-page mt-4">
          {INGREDIENTS.map((section) => (
            <section key={section.key} aria-labelledby={section.key}>
              <h2 id={section.key} className="n-h2">
                {slotHidden(content, `features.${section.key}.title`) ? null : <Icon name={section.icon} className="n-c-gray mr-2 align-[-0.08em]" />}
                <T k={`features.${section.key}.title`}>{section.title}</T>
              </h2>
              <p className="n-block">
                <T k={`features.${section.key}.intro`}>{section.intro}</T>
              </p>
              {section.points.map((point) => (
                <Toggle key={point.key} summary={<strong className="font-semibold"><T k={`features.${section.key}.${point.key}.title`}>{point.title}</T></strong>} open>
                  <p className="text-sub">
                    <T k={`features.${section.key}.${point.key}.body`}>{point.body}</T>
                  </p>
                </Toggle>
              ))}
            </section>
          ))}

          <Divider className="my-8" />

          <h2 id="not-included" className="n-h2">
            <T k="features.not.title">Not included</T>
          </h2>
          <div className="mt-1">
            <Todo>
              <T k="features.not.accounts">Accounts, logins and comments. It is a website, not an app.</T>
            </Todo>
            <Todo>
              <T k="features.not.uploads">Uploads from readers. Nothing on the site accepts a file.</T>
            </Todo>
            <Todo>
              <T k="features.not.lockin">Lock-in. Your words are in your Notion; the code is yours under MIT.</T>
            </Todo>
          </div>

          <Callout icon={<Icon name="wrench" />} color="blue" className="mt-8">
            <p>
              <T k="features.help">Would rather somebody else set it up, or make it look like yours?</T>{" "}
              <Link href="/features#services" className="n-link font-semibold">
                <T k="features.help.link">See the service counter</T>
              </Link>
            </p>
          </Callout>
        </div>
  )
}
