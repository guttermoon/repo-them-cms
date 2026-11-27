# REPO THEM

**A Notion-powered CMS.** A website you write in Notion.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fguttermoon%2Frepo-them-cms&project-name=repo-them&repository-name=repo-them&env=NOTION_TOKEN,NOTION_DATABASE_ID&envDescription=Your%20Notion%20integration%27s%20token%20%28ntn_%E2%80%A6%29%2C%20and%20the%20link%20to%20your%20copy%20of%20the%20REPO%20THEM%20template%20in%20Notion%20%28the%20whole%20link%20works%29.%20The%20guide%20shows%20where%20each%20one%20is.&envLink=https%3A%2F%2Fgithub.com%2Fguttermoon%2Frepo-them-cms%23set-it-up)
&nbsp; after [duplicating the Notion template](https://www.notion.so/4236f6ccb2c18175b890e03e8f6ca2a8): three steps, no code
([set it up](#set-it-up)).

Copy, pages, blog posts, pricing plans, products and questions live in one
Notion database. Tick **Published** and the site follows within a minute,
or within seconds with a webhook ([how](docs/notion.md#how-quickly-the-site-follows)). Notion is the CMS: there's no admin to log
in to and no build to run, and the editor is the one you already use.

REPO THEM is a Next.js site made to be forked. It's plain on purpose, like a
tin with a label that says what's in it.

**A copy starts as a typical generic website, not a page about the
template.** The homepage, the shop, pricing, About, Team, the blog and the
rest are a generic SaaS-and-shop site in the house voice, ready to be
renamed and reworded in Notion. Only `/features` describes the template
itself, with the directions (deploy on Vercel in five steps) and the
maker's services. The service counter on every page credits the maker;
publish its `service.title` slot blank to take it away.

## What's in the tin

- **Write it once.** A price, a portrait or a name is one row, and every
  place that shows it reads that row: change a plan's price and the pricing
  page, the homepage, the comparison table, `/llms.txt` and the search
  engines' data all follow. Nothing is typed twice, so nothing drifts.
- **Every word on the site is a row in Notion.** A slot shows its row's
  words once the row is ticked. An unticked row, a ticked one left blank, or
  no row at all shows nothing, so no word reaches your site that you have not
  seen in Notion. Only the starter site, before Notion is connected, shows
  the words written into the code.
- **Pages and posts written in Notion** are drawn as Notion draws them:
  - the blocks you write with: colours, toggles, callouts, tables, code
    (highlighted on the server) and maths ([the list](docs/notion.md#pages-and-posts));
  - Notion's three page styles;
  - a table of contents.
- **Landing pages written in Notion.** Set a page's Layout to Landing and its
  blocks become marketing sections: a hero, cards, figures, quotes,
  questions and a comparison table.
- **Pages you rearrange from Notion.** A Section row turns a section of the
  homepage, `/pricing`, `/about`, `/team`, `/security` or `/questions` off,
  moves it to another of them, reorders a page or shows a section twice
  ([sections](docs/sections.md#sections-from-notion)).
- **Menus you arrange from Notion.** A Menu row turns a link in the header
  or a footer column off, puts it in a new place, or adds a page there
  ([menus](docs/notion.md#menus)).
- **A blog:** categories, tags, scheduled posts (tick Published and give a
  future Published Date, to the minute in any time zone: it goes live on its
  own, and nothing in Notion changes), an RSS feed and a changelog.
  Authors are Person rows, written once: their one picture, job title and
  bio show on every post they write and on the team page, and a guest is a
  Person row kept off it ([authors](docs/notion.md#authors)).
- **A SaaS pricing page:** plans, a monthly/yearly switch whose saving is
  worked out (never typed), a comparison table and the pricing questions.
- **A shop window for your Shopify or Printify shop.**
  - The catalogue stays in your shop: names, descriptions, prices, stock,
    sizes and pictures. `npm run shop:import` copies it into the database,
    and puts back anything changed in Notion, so the two never drift.
  - In Notion you choose which products show, in what order, at what
    address.
  - Checkout goes through your Shopify shop with a cart permalink: no API
    key, and Shopify prices the cart.
  - Or each product's button goes to its page in your Printify Pop-Up Store.
  - Until checkout is set up, the shop is an example that sells nothing and
    search engines skip.
- **A mailing list and a contact form** on whichever platform you already
  use: Brevo, Resend, SendGrid, Mailchimp, Klaviyo, beehiiv, Loops,
  MailerLite, Kit, Buttondown, Postmark, or a webhook. (Some do only the list or only the form:
  [email](docs/email.md) says which.)
- **Private by default.**
  - A reader's browser talks to your site and nobody else: fonts, pictures
    and analytics all go through your own domain. The two exceptions are
    the reader's own doing: pressing play on a video, and going to checkout.
  - Analytics (PostHog, Google Analytics, or both) counts nothing until a
    reader says yes. The question is a bag of cookies, a plain box or a
    banner, as you choose in Notion (`cookies.shape`).
- **Safe by default.**
  - Pictures are fetched by your server from public hosts only, through
    signed addresses, and can't run as a page.
  - A strict content policy, no image proxy, and links from Notion that
    can't run a script.
  - Every form and route is rate limited, and across every server once
    you add Upstash ([keep it safe](#keep-it-safe)).
  - The feedback agent can't push or open anything itself: a second job
    checks its work first.
- **Feedback that turns into pull requests.** A Feedback button on every
  page sends a reader's words to a PostHog survey. Each weekday Claude Code
  reads them, watches the recording behind each, and opens a draft pull
  request per fix. Add PostHog's keys in Vercel and GitHub and the survey,
  the flags and the loop set themselves up: [feedback](docs/feedback.md).
- **Pictures at the size they're shown.** Upload a photograph to Notion as
  large as you like: your server resizes it for each screen and sends WebP,
  cached for a year.
- **Found by search engines and assistants:**
  - metadata and share cards for every page, with large pictures allowed
    in Google Discover;
  - structured data: the site and its logo, breadcrumbs, posts with their
    authors, questions, products;
  - a sitemap, `robots.txt` that names the assistants' crawlers, and
    `/llms.txt` with your plans and prices;
  - every page written in Notion as Markdown too, at its address with `.md`
    added, for the assistants that read without drawing a page;
  - IndexNow, after each deploy and, if you like, every hour for what
    changed in Notion.
- **Accessible:** WCAG 2.2 AA, and AAA for contrast (7:1), target size
  (44 by 44) and focus rings. Contrast, target sizes, keyboard behaviour
  and heading order are checked by tests, and `npm run a11y` runs axe and
  the AAA checks over every page of a running site, in every look.
- **Four looks:** light, dark, mono (black and white with light grey) and
  rainbow (loud and colourful), following the reader's system or their
  choice, each checked for contrast.

## Set it up

A Notion account, a GitHub account and a Vercel account (all free) put the
site live. Nothing to install: about ten minutes, most of it waiting for the
first deploy.

Two things need an account more, and are examples until they have one:

- **The contact form and the mailing list** need an email platform, such as
  Brevo or Resend ([which does what](docs/email.md)). Until one is
  connected they send nothing, and say so.
- **The shop** needs your Shopify or Printify shop
  ([docs/commerce.md](docs/commerce.md)). Until then nothing is for sale.

**1. Duplicate the Notion template.** Open the
[REPO THEM template](https://www.notion.so/4236f6ccb2c18175b890e03e8f6ca2a8) and press **Duplicate**. Your copy is the
whole site: every page, post, plan, product, picture and word, ready to
rename. (It is a copy of the demo's database, so it starts as the demo
looks.) The three example posts show what a post can be; rewrite them or
untick them.

**2. Make a Notion integration, and connect it to your copy.**
- Open [Notion's integrations](https://www.notion.so/profile/integrations)
  and make a new **internal** integration.
- Give it **Read content** and nothing else: the site never writes to
  Notion.
- Copy its token (`ntn_…`).
- On your copy of the template, open **⋯ → Connections** and add the
  integration. Without this, Notion tells the site there is no database.

**3. Put the code on Vercel, one of two ways.** Either way ends the same:
your own copy of the code in your GitHub, a project on Vercel that builds
from it, and two settings in that project.

- **In one press.** Press [**Deploy with Vercel**](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fguttermoon%2Frepo-them-cms&project-name=repo-them&repository-name=repo-them&env=NOTION_TOKEN,NOTION_DATABASE_ID&envDescription=Your%20Notion%20integration%27s%20token%20%28ntn_%E2%80%A6%29%2C%20and%20the%20link%20to%20your%20copy%20of%20the%20REPO%20THEM%20template%20in%20Notion%20%28the%20whole%20link%20works%29.%20The%20guide%20shows%20where%20each%20one%20is.&envLink=https%3A%2F%2Fgithub.com%2Fguttermoon%2Frepo-them-cms%23set-it-up) and sign in with GitHub.
  Vercel makes the copy in your GitHub and the project in one go, then asks
  for the two settings.
- **From GitHub.** At the top of this page, press **Use this template**,
  then **Create a new repository** (or fork it). In Vercel, press
  **Add New → Project**, pick your copy and press **Import**, then add the
  two settings under **Environment Variables** before you press **Deploy**.

| Setting | What to paste |
|---|---|
| `NOTION_TOKEN` | The integration's token, from step 2 |
| `NOTION_DATABASE_ID` | The link to your copy of the template: **Share → Copy link**. The whole link works, and so does the link to a page the database sits on |

Then it deploys. The two settings are the only ones a site needs; every
other one is optional and goes in the project's settings on Vercel
(**Settings → Environment Variables**), followed by a redeploy.

**Afterwards:**
- Add your domain in Vercel, and set `NEXT_PUBLIC_SITE_URL` to it.
- Set `REVALIDATION_SECRET` for instant updates from Notion's webhooks
  ([docs/notion.md](docs/notion.md)).
- Connect an email platform, or the contact form and the mailing list stay
  examples: `EMAIL_PROVIDER` and its key, and for the contact form
  `CONTACT_TO_EMAIL` and `EMAIL_FROM` ([docs/email.md](docs/email.md)).
  Brevo, Resend and SendGrid run both forms; Mailchimp, Klaviyo, beehiiv,
  Loops, MailerLite, Kit and
  Buttondown keep a list only, so the contact form needs a second platform
  beside them.
- Switch on PostHog, for analytics and the Feedback button: set
  `NEXT_PUBLIC_POSTHOG_KEY` to the project token (PostHog: Settings →
  Project), and `NEXT_PUBLIC_POSTHOG_REGION=us` if the project is in the US
  cloud. Then make a personal API key (Settings → User → Personal API keys:
  read on Project and Organization, write on Survey and Feature flag), set
  it as `POSTHOG_PERSONAL_API_KEY`, and redeploy: the build makes the Site
  feedback survey and the flags. Nothing is counted until a reader says
  yes ([analytics](docs/analytics.md), and the
  [feedback agent](docs/feedback.md#set-it-up)).
- A Shopify or Printify shop is a setting or two (`.env.example` lists
  every one, and the docs below say what each does).
- Then the few minutes in [keep it safe](#keep-it-safe): rate limits
  shared across every server, a protected branch, and keys of their own.

**Write.** Everything from here happens in Notion. To add a post, a page, a
product or anything else, press the arrow beside **New** and pick what it
is. Each template sets the row's Kind, starts unticked (a Section or a Menu
starts ticked), and says in a grey box what every property does (on a post
or a page, delete the box before you publish). Tick **Published** and the
site follows within a minute.

- **Status** (Draft, In Review, Published) is for you and your team: the
  site reads Published alone. Two automations keep Status in step with it;
  check they came across with your copy (the ⚡ beside the views), or make
  them ([Published and Status](docs/notion.md#published-and-status)).
- **To turn a section of a page off, or move it,** open the **Sections**
  view: a page to a group, in the order the page shows them. Untick a row
  to turn its section off, or change its Order
  ([sections](docs/sections.md#sections-from-notion)).
- **To rearrange the header's and footer's links,** open the **Menus** view
  ([menus](docs/notion.md#menus)).

Until an email platform is set, the mailing list and the contact form are
marked as examples and send nothing: pressing their button says so, and
where to write instead.

### Keep it safe

A few minutes once the site is live. [SECURITY.md](SECURITY.md) says why
each one matters.

- **Share the rate limits across every server.** In Vercel: **Storage →
  Marketplace → Upstash (Redis)**, connect it to this project, then
  redeploy. It sets the variables itself (`KV_REST_API_URL` and
  `KV_REST_API_TOKEN`); on another host, set `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN`. Without it, each server counts alone and a
  flood spread across them gets through. Upstash only ever sees a scrambled
  stand-in for a visitor's address, keyed with your `NOTION_TOKEN` (or
  `MEDIA_SIGNING_KEY`), and your privacy notice says so once it is set ([rate limits](docs/privacy-and-security.md#rate-limits)).
- **Protect your default branch.** In GitHub: **Settings → Rules →
  Rulesets**, a ruleset on the default branch that requires a pull request,
  with nobody allowed to bypass it. Then nothing reaches the live site
  until you merge it.
- **Leave Vercel's Git Fork Protection on** (**Settings → Git**), so a
  stranger's pull request is never built with your settings until you
  allow it.
- **Say where to report a problem.** The site serves
  `/.well-known/security.txt`, pointing at your contact form. Set
  `SECURITY_CONTACT` to an address of yours (`security@your-domain`) to put
  it first.
- **Put it on a domain of your own, with DNSSEC.** A `vercel.app` address
  can't have DNSSEC, and Vercel's nameservers don't offer it: keep the
  domain's DNS with a provider that does (Cloudflare, or your registrar),
  turn DNSSEC on there, and point the domain at Vercel. While you're there,
  add a CAA record for `letsencrypt.org`, and, if the domain sends no
  email, `v=spf1 -all` and `v=DMARC1; p=reject`
  ([your domain](docs/privacy-and-security.md#your-domain)).
- **Keep the Notion integration to Read content.** Give anything that
  writes an integration of its own, and make `REVALIDATION_SECRET` a long
  random string if you use instant updates.
- **Give the feedback loop keys of its own:** a PostHog key that only
  reads, and an Anthropic API key in a workspace with a spending limit.
  Anybody can send feedback, so the agent is treated as if a stranger were
  at its keyboard ([feedback](docs/feedback.md#what-a-stranger-can-do-with-it)).
- **Take the updates.** Dependabot proposes dependency updates two weeks
  after their release. A new major version of Next.js or React comes from
  the template, made and tested by hand.

### Just looking?

[Deploy the starter site](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fguttermoon%2Frepo-them-cms&project-name=repo-them&repository-name=repo-them) asks for nothing: with no Notion
connected it shows the starter content (a generic shop, posts, plans and
team) from its own files, and keeps itself out of search. Add the two Notion
settings later, and redeploy.

### From the command line

For working on the code, or making the database from scratch instead of
duplicating the template. You need Node 22.18 or newer.

**1. Get the code.** [Use this template](https://github.com/guttermoon/repo-them-cms/generate)
on GitHub (or fork it), then install it:

```bash
git clone https://github.com/<you>/<your-site>.git
```

```bash
cd <your-site> && npm install
```

**2. Make the database** (or duplicate the template, as above).
- Make an integration as in step 2 above. For the setup command, and for
  `notion:seed-copy` in step 4 if you run it, also give it **Insert
  content**, then take that away afterwards.
- Make an empty Notion page and connect the integration to it (the page's
  ⋯ menu → Connections).
- Run the command below with the page's address. It makes the database
  inside the page, with every property, the starter content and its
  pictures, and prints the database's ID.

```bash
NOTION_TOKEN=ntn_your_integration_token npm run notion:setup -- "<the address of a Notion page>"
```

**3. Connect.** Copy `.env.example` to `.env.local` and fill in
`NOTION_TOKEN` and `NOTION_DATABASE_ID`. Once they are set, the database
alone decides what shows: an empty one is an empty site. Check the
connection:

```bash
npm run notion:check
```

Then run the site:

```bash
npm run dev
```

**4. A row for every word.** The template already has one, and
`notion:setup` writes one for every slot. A slot with no row shows nothing,
so when an update of the code adds a slot, `npm run notion:check` names it.
To make its row, first record every text slot,

```bash
npm run copy
```

then make a Notion row for each one that has none. Each holds the words the
code suggests and is unticked, so nothing on the site changes until you have
read the row and ticked it. (This writes to Notion, so the integration needs
**Insert content** again for the one run.)

```bash
npm run notion:seed-copy
```

**5. Deploy.** Import the repository into Vercel, or any host that runs
Next.js, with the same environment variables.

## What a row can be

The **Kind** of a row says what it is. Nothing appears on the site until
**Published** is ticked. In the template, **New ▾** offers one of each.

| Kind | What it makes |
|---|---|
| Site Copy | One piece of the site's wording, such as a heading or a button: Title says which (`home.hero.title`), Text is what it says, with its bold, italic and links (in the site's own colours). A few hold a picture in Image instead: the site's own logo (`site.logo`, `site.logo.dark`), its icon (`site.icon`), share pictures and the hero's picture |
| Page | A page at `/its-slug`, written in the row's own page |
| Post | A blog post at `/blog/its-slug`, with its date, category and tags. Author names a Person row, whose portrait, role and bio go with it |
| Resource | A line on `/resources`: a title, a description and a link |
| Redirect | A short link: `/go/its-title` sends people to its Link (print it as a QR code) |
| Plan | A plan on `/pricing`: its price (empty is custom pricing), features and button |
| Product | A product at `/shop/its-slug`: a copy of the product in your Shopify or Printify shop, which you publish and order here |
| Question | A question on `/questions`; Category Pricing puts it on `/pricing` too, and Category Template on `/features` instead |
| Quote | A quotation: Text is what was said, Title is who said it. The homepage shows the first, `/pricing` the next |
| Proof Logos | A tool the site works with, in the "goes well with" strip. The site's own logo is not one: it is the `site.logo` Site Copy row ([the logo and the icon](docs/notion.md#text-slots-three-states)) |
| Person | Somebody on `/team`, and the author of the posts that name them: Title the name, Description the role, Text a line about them, Image the portrait. Team Page Off keeps them to their posts |
| Review | A review on the homepage: Title the name, Text what they said, Rating the stars (1 to 5), Published Date when, Image their photo |
| Section | Where a section of a designed page goes: Title names it (`home.reviews`), Slug the page (`about`), Order its place. Unticked, it is off; two rows, it shows twice ([sections](docs/sections.md#sections-from-notion)) |
| Menu | A link in the header or the footer: Title names the page (`pricing`, or a Notion page's address), Slug the menu (`header`, `header-side`, `footer-product`, `footer-company`, `footer-help`; empty, wherever it was designed), Order its place. Unticked, it is off that menu ([menus](docs/notion.md#menus)) |

**Pictures.**
- **A post's or a page's cover** is its Notion cover: **Add cover**, then
  Change to upload a picture, paste a link, or pick one from Notion's
  gallery or Unsplash. The Image property is used only when the page
  has no cover of its own.
- **Where it is cut:** covers are cropped to a wide strip, so pick
  **Cover Position** (Top, Upper, Middle, Lower or Bottom). Notion's own
  Reposition doesn't reach the site.
- **Upload photographs as they are.** Every reader is sent the width they
  need as WebP, and every cover is printed in the look's own colour
  ([covers](docs/notion.md#covers)). Set **Cover Tint** to Off to show a
  cover in its own colours.
- **A picture under the home page's hero:** put it on the `home.hero.image`
  Site Copy row (its Image, or its Notion cover). It fills the hero under a
  veil, with the words light on it.

Plans, questions and quotations are rows and nothing else: with none, the
page leaves them out or says so. Formatting in Notion (bold, italic,
underline, strikethrough, code, links, line breaks) shows on the site as it
does in Notion. Colours you give words show in a post's or a page's own
body; the web copy (Site Copy and a row's words) takes the site's colours.

Every property is listed in [docs/notion.md](docs/notion.md).

## Commands

Everyday:

| Command | What it does |
|---|---|
| `npm run dev` | The site on your computer |
| `npm run build` | Snapshots the content, makes the mailing list if Brevo is set, and builds the site (`npm start` serves the build) |
| `npm run check` | Lint, types and every test |

Notion:

| Command | What it does |
|---|---|
| `npm run notion:setup` | Makes the database, with the starter content |
| `npm run posthog:setup` | Makes the Site feedback survey and the code's flags in PostHog (every build does it too, with `POSTHOG_PERSONAL_API_KEY`: [feedback](docs/feedback.md)) |
| `npm run notion:check` | Checks the connection and the database's shape |
| `npm run copy` | Renders every page and lists every text slot in `copy-keys.json` |
| `npm run notion:seed-copy` | Makes an unticked Notion row, holding suggested words, for every slot that has none (`-- --ticked` to show them at once) |
| `npm run notion:fake` | A stand-in Notion with the starter content, for trying the site with no account |

The shop:

| Command | What it does |
|---|---|
| `npm run shop:import` | Copies your Shopify or Printify catalogue into Product rows, and keeps them in step (a dry run until `--write`) |

Publishing and checks:

| Command | What it does |
|---|---|
| `npm run qr -- <slug>` | Draws a print-ready QR code for a short link |
| `npm run indexnow` | Tells search engines the pages have changed (needs `INDEXNOW_KEY` and `SITE_URL`: [SEO](docs/seo.md)) |
| `npm run a11y` / `npm run privacy` | Accessibility and privacy audits of a running site (install Playwright first: [development](docs/development.md#the-audits)) |
| `npm run responsive` / `npm run sharpness` | Every page at five widths, and every picture checked for a retina screen, on a running site |

## Documentation

| Topic | What it covers |
|---|---|
| [Notion](docs/notion.md) | The database, every property, the three states of a slot, instant updates |
| [Email](docs/email.md) | The eleven email platforms and the webhook, double opt-in, the contact form |
| [The shop](docs/commerce.md) | Shopify, Printify, who keeps the catalogue, the example shop, the importer |
| [Analytics](docs/analytics.md) | PostHog and Google Analytics, consent, what is collected |
| [Feedback](docs/feedback.md) | The Feedback button, the PostHog survey and flags it makes, and the agent that turns feedback into draft pull requests |
| [Search](docs/seo.md) | Metadata, share cards, structured data, sitemap, `/llms.txt`, Markdown copies, IndexNow |
| [Sections](docs/sections.md) | The section library and the Landing layout |
| [Design](docs/design.md) | The homepage's order, what may move and why, agents and AI states, shapes |
| [Accessibility](docs/accessibility.md) | What WCAG 2.2 AA asks, which AAA criteria the site meets, and how it is checked |
| [Privacy and security](docs/privacy-and-security.md) | What reaches whom, the site's defences, and the rate limits |
| [Brand](docs/brand.md) | The look, the Notion brand rules, and how to make it yours |
| [Development](docs/development.md) | How the code is laid out, the tests, working without Notion |

## Need a hand?

Rather not set it up yourself? Megan Aileen Williams, who made REPO THEM, can
help with any of these:

- connecting it for you;
- building your whole website on Notion;
- a design in your own brand;
- moving an old site into Notion;
- keeping it up to date month by month.

Write to **[hello@denot.app](mailto:hello@denot.app)**, or see
**[denot.app](https://denot.app)**.

## Star it

If REPO THEM is useful to you, **star the repository**. It costs nothing,
helps the next person find it, and makes the maker unreasonably happy. Issues
and pull requests are welcome. Security reports go to
[SECURITY.md](SECURITY.md).

## Credits and licence

Made by **[Megan Aileen Williams](https://denot.app)**, who builds websites on
Notion: Notion website setup, custom Notion-powered sites, and help
connecting Notion to Next.js.

**Keeping the credit.** Every copy's footer says "© (the year) REPO THEM a
GitHub template by Denot", with GitHub linking to this repository and Denot to
[denot.app](https://denot.app); a copy renamed in Notion reads "© (the year) Your
Name. Built on REPO THEM a GitHub template by Denot". Every page's head
names it as the generator too. It isn't a Notion slot, so it can't be
blanked from the database. The MIT licence does let you take it out of the
code; please keep the credit, or link back to [denot.app](https://denot.app)
somewhere else on your site. It's how the next person finds the template.

- **The code:** MIT, in [LICENSE](LICENSE).
- **The fonts:** Roboto Slab (Apache 2.0), and Inter, Source Serif 4 and IBM
  Plex Mono (SIL Open Font Licence). Their licences are in `assets/fonts`.
- **The icons:** [Phosphor](https://phosphoricons.com) (MIT), its notice in
  `lib/icons.ts`.
- **The tool marks:** [Simple Icons](https://simpleicons.org) (CC0). Each
  mark is its owner's trademark, used only to say the site works with it.

REPO THEM is an independent template, not made, endorsed or maintained by
Notion Labs, Inc. Notion and the Notion logo are trademarks of Notion Labs,
Inc. The "Made for Notion" badge is used as Notion's brand guidelines
describe ([docs/brand.md](docs/brand.md)).
