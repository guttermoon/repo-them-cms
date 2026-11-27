# Search, sharing and assistants

How the site describes itself to search engines, to the apps that preview a
shared link, and to the assistants people ask. All of it uses open
standards, and all of it says only what the pages say: no hidden text, and no
rating, review or date the site doesn't have.

## The address

**Set `NEXT_PUBLIC_SITE_URL` to the domain the site is served on.** The
canonical addresses, the sitemap, the feed, the structured data and
`/llms.txt` all use it.

Without it, a Vercel deployment uses the project's production domain, then
the deployment's own address. That suits a preview and is wrong for anything
else. Use the address that actually answers: if the bare domain redirects to
`www.`, set the `www.` one.

## Titles and descriptions

| Pages | Where their title and description come from |
|---|---|
| The designed pages | Site Copy rows `meta.<page>.title`, `.description` and `.label` (`meta.home.title`, `meta.pricing.description`…); without a published row, the page's entry in `lib/page-meta.ts`. The page's metadata, its structured data, its share card and `/llms.txt` all read the same words (`pageWords()`) |
| Pages, posts and products written in Notion | Their Title and Description. With no Description, the first words of the page's body; with no body either, `meta.page.description` (`meta.post…`, `meta.product…`), with `{title}` filled in |
| A blog category or tag | `blog.category.meta`, `blog.tag.meta`, with `{name}`, `{count}` and `{titles}` |
| A shop collection | `meta.collection.one` and `meta.collection.many`, with `{name}`, `{count}` and `{titles}` |
| The cart, the thank-you page, the 404 | `meta.cart.*`, `meta.subscribed.*`, `meta.notfound.*` |

A row published blank falls back to the built-in wording: a page with no
title is broken, not an editorial choice.

`{titles}` is the titles of the newest posts or products the page lists,
each in quotation marks, as many as fit 160 characters (`fillTitles` in
`lib/filter-words.ts`). Without it, every category's description would be
one sentence with its name swapped in, which a search engine reads as the
same page over and over. Rows seeded before `{titles}` existed keep their
own wording; add `{titles}` to them to have it.

`npm test` holds every entry in `lib/page-meta.ts` to the rules search
engines print whole, and `npm run notion:check` measures your own wording
against the same numbers (`SEARCH_LIMITS`), for the designed pages' rows and
for every page's, post's and product's own Title and Description (a
product's description is its shop's, so only its title):

- a title of at most 38 characters before " | REPO THEM" (60 in all);
- a description of 140 to 160 characters;
- no two pages alike.

Change a page's subject and its entry changes with it, or reword it in
Notion.

Every page gets:

- a canonical address;
- Open Graph and X card tags;
- a share card;
- `max-image-preview:large` (and no limit on its snippet or a video's
  preview): Google Discover shows a large picture only for a site that
  allows one, and passes over a small one (`INDEXABLE_ROBOTS` in
  `lib/seo.ts`).

`noindex` is set instead on the pages that shouldn't be found: the cart,
the thank-you page, the example shop and the 404. With no Notion connected,
every page is `noindex`: the starter content is the same on every copy, and
must not compete in search.

## Share cards

`/og/<path>` draws a page's card, 1200 by 630, on request:

- in the label style, with the page's own title and a small label
  (`lib/og-words.ts`: a designed page's `meta.<page>.label`, a post's
  category, or `og.label.*` from Site Copy);
- with the "web site" box (`assets/og/box.png`) standing on the band beside
  a short title;
- in the site's own fonts, read from `assets/fonts`;
- cached for an hour.

A page written in Notion has a card the moment it's published. A post with a
cover uses the cover.

### Pictures from Notion

A drawn card can be replaced from Notion, page by page or for the whole
site, by a Site Copy row with a picture on it: the row's Notion cover (Add
cover), else its Image. The row's Text is the picture's words for
whoever cannot see it; left blank, they are the page's title. The row must
be ticked (`lib/share.ts`).

| Row | What its picture is |
|---|---|
| `meta.<page>.image` (`meta.home.image`, `meta.pricing.image`…) | That designed page's share picture |
| `meta.site.image` | The share picture of every page with none of its own: a designed page without its row, a page or post without a cover, a category, tag or collection |
| `site.logo` | The site's logo: in the header and the footer where the mark stands, and in the site's structured data (the Organization's). At least 112 pixels tall; square suits search engines best |
| `site.logo.dark` | The same logo made for a dark ground, shown in the dark look (without it, the logo is shown inverted there) |
| `site.icon` | The icon in a browser's tab, on a home screen and in the manifest, made square at each size by the media route. Without it, `site.logo`; without either, the mark's icons in `public/`. A square PNG or JPG, at least 512 pixels |

A page's own picture comes first, then the site's, then the card drawn with
its title. The picture goes in the page's Open Graph and X tags and in its
structured data, through `/media/`, as uploaded; 1200 by 630 suits every
platform. With no row, or a row without a picture, nothing changes.

**The home page's card is a poster**, since it is the one a shared site
shows: the site's name in lowercase, as large as its room allows (`site.name`, on
two lines when it has two words), its descriptor (`site.descriptor`), and the
box, with the band carried from the card's edge onto the box. No other
words.

The box is drawn by `npm run demo-images`, with no name on it: the card sets
the site's own name beside it, as the copy has it.

## Structured data (JSON-LD)

| Where | What it says |
|---|---|
| Every page | The site (WebSite), published by an Organization of the same name whose logo is `site.logo`'s picture or else the mark (`SITE_LOGO`, `/icon-512.png`), its maker (Person) and, when `REPO_URL` is set, the template's code (SoftwareSourceCode) |
| Each designed page | A WebPage (or an AboutPage, a ContactPage or a CollectionPage), with its title, description, picture (`meta.<page>.image`, the site's, or its card) and language; below the top level (`/resources/ingredients`), a breadcrumb trail through the page above it, named as the link back to it is |
| Pages with questions (`/questions`, `/pricing`) | FAQPage, read from the published answers, so a hidden question is left out |
| `/blog`, `/changelog`, category and tag pages | A CollectionPage whose main entity is the Blog or the list of posts, with a breadcrumb trail: a category or tag page below the blog, the changelog below the home page |
| Each post | A BlogPosting with its real dates, its picture, the site as its publisher, and its author as the page shows them: name, the line about them, portrait; a breadcrumb trail below the blog, or for a release below the changelog |
| Pages written in Notion | A WebPage with their dates; a nested one (`guides/setup`) with a trail through every live page above it |
| `/features` | The maker's services (#services), as Service, with no price (they're quoted per job); the template's questions as FAQPage |
| `/team` | The team, as an ItemList of Person, each with their role and, when their row has them, a portrait and a profile |
| Products, when the shop is live | A Product and one Offer with its real price and availability. Never for the example shop. |

## The sitemap and robots.txt

**`/sitemap.xml` lists:**
- every designed page;
- every published Notion page, post, category and tag;
- in a live shop, every product and collection.

Pages and posts written in Notion carry their real last-edited date. The
designed pages carry none, because no date the build could print would be
true. It is refreshed with the content, every minute, so a date is never
more than a minute behind Notion's.

**`/robots.txt`** lets every crawler read the whole site except its
plumbing (`/api/`, `/ingest/`, `/ga/`). With no Notion connected it shuts
the whole site, and there is no sitemap.

- The assistants' crawlers are named in a group of their own with the same
  access: the ones that fetch a page to answer a question (ChatGPT-User,
  Claude-User, Perplexity-User, MistralAI-User, meta-externalfetcher), the
  ones that build an assistant's search (OAI-SearchBot, Claude-SearchBot,
  PerplexityBot), and the ones that read for training (GPTBot, ClaudeBot,
  Google-Extended, Applebot-Extended, CCBot and the rest).
- Keeping the second kind out is your decision. Edit `app/robots.ts`; it
  keeps the site out of those models, not out of search.

## Markdown copies

Every page, post and product written in Notion is also served as Markdown
at its address with `.md` added: `/blog/hello.md`, `/colophon.md`,
`/guides/setup.md`. It is for whoever reads a page without drawing it, an
assistant above all: a post's words in a kilobyte or two, where its HTML
carries a hundred of frame, styles and React's payload round them.

- **What it says:** front matter with the page's facts (its title,
  description, address, the site's name; a post's dates, author, category
  and tags; a product's price, currency and stock; its pictures), then the
  title as the one `#` heading, then the body. The blocks are the ones the
  page draws, the headings keep its outline, links go where the page's go,
  every address is whole and files come through `/media/`
  (`lib/notion/markdown.ts`).
- **Where it is named:** the page's head
  (`<link rel="alternate" type="text/markdown">`), and a line of
  `/llms.txt` (`llms.fact.markdown`).
- **Search:** each copy names its page as the canonical address in a `Link`
  header, so a search engine files the words under the page and never lists
  the copy beside it. With no Notion connected it carries `noindex`, as
  every page of the starter content does.
- **What has none:** the designed pages (their words are slots, already in
  `/llms.txt`), and the example shop's goods: fictional goods are offered
  nowhere a listing might be read.
- **Notion:** a copy reads the body from the cache its page uses, so it
  costs Notion nothing its page has not already cost.

`next.config.mjs` rewrites `<address>.md` to `app/markdown/`, which keeps the
address the reader asked for.

## /llms.txt

`/llms.txt` and `/llms-full.txt` follow the llmstxt.org proposal: the site
described for a language model. They come from the same sources as the pages,
and use the published wording.

**`/llms.txt` has:**
- the summary;
- the key facts, each a Site Copy row (`llms.fact.what`, `.cost`, `.built`,
  `.maker`, `.source`, `.markdown`), so a site made from the template says
  what it is. A fact published blank is left out. The independence
  statement is printed outside any slot;
- every designed page with its description;
- the plans, from the Plan rows as `/pricing` prints them: each price with
  its note, the price paid yearly, what the plan is for and what it
  includes, then the line under them on the page (`pricing.footnote`). An
  assistant asked what the site costs quotes the page rather than guessing.
  Reword the labels with `llms.plans`, `llms.plan.yearly` and
  `llms.plan.includes`;
- the live pages and the blog's twenty newest posts written in Notion, then the releases under the changelog's name (`nav.changelog`), since a release is the changelog's and not the blog's (`/llms-full.txt` takes two hundred of each).

**`/llms-full.txt` adds:**
- the answers to the questions;
- the resources;
- in a live shop, the products.

## IndexNow

IndexNow tells Bing (and, through it, ChatGPT's search, Copilot and
DuckDuckGo), Yandex, Seznam, Naver and Yep that pages have changed. Google
doesn't take it; it reads the sitemap.

1. Set `INDEXNOW_KEY`: any 8 to 128 letters, digits and dashes. The site
   serves it at `/indexnow.txt`.
2. Run `npm run indexnow` to submit the live sitemap (with `SITE_URL` set to
   the live site), or `-- /pricing` for one page. `-- --dry-run` shows the
   request without sending it.
3. To submit after every production deploy that Vercel reports to GitHub,
   add `SITE_URL` and `INDEXNOW_KEY` as repository secrets. The workflow
   (`.github/workflows/indexnow.yml`) does nothing without them.
4. A post published in Notion is not a deploy. To submit those too, add a
   repository variable (Settings, Secrets and variables, Actions,
   Variables) `INDEXNOW_HOURLY` set to `true`. The workflow then reads the
   sitemap every hour and submits the pages, posts and products whose date
   there (Notion's last edit) is within the hour:
   `npm run indexnow -- --changed-within 70`. A copy without the variable
   spends no minutes on it.

## Search Console and Bing Webmaster Tools

Both can verify the site by an HTML tag:

1. Put the token alone, not the whole `<meta>` tag, in
   `GOOGLE_SITE_VERIFICATION` or `BING_SITE_VERIFICATION`.
2. Redeploy.

Nothing prints while they're unset, and a value that isn't shaped like a
token prints nothing either.

After that, submit `https://<your site>/sitemap.xml` in both.
