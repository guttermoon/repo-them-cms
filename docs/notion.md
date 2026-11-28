# Notion

Everything the site says comes from one Notion database. This page covers:

- how the database is shaped;
- what each kind of row makes;
- Published and Status: the switch, and where a row is;
- the three states of a text slot;
- how quickly the site follows Notion;
- what happens when Notion is down.

## The database

One database holds everything. The **Kind** of a row says what it is, and
**Published** says whether the site shows it.

- **The template** is the quickest start: duplicate the
  [REPO THEM template](https://www.notion.so/4236f6ccb2c18175b890e03e8f6ca2a8)
  in Notion. It is a copy of the demo's database, with a row for every word
  already, and nothing to run (the README's
  [Set it up](../README.md#set-it-up)). It also has a Notion template for
  each kind but Site Copy ([adding a row](#adding-a-row)), and a Status
  kept in step with Published ([Published and Status](#published-and-status)).
  It is published to the web with **Allow duplicate as template** on, and it
  is a copy, never the demo's own database, so nobody reads the demo's drafts.
- `npm run notion:setup -- "<page address>"` makes the database inside a page
  you have shared with your integration. It includes every property below and
  the starter content (pages, posts, plans, products, questions, a quotation,
  resources, short links, people, example reviews and their pictures).
- `npm run notion:check` checks a database you have:
  - that the integration can read it;
  - which properties are missing or have the wrong type;
  - what the site will skip or read differently from what you probably meant;
  - which ticked text rows no page reads (so editing them changes nothing;
    untick one to put it away), and
    how many slots have no row yet;
  - which rows' Status disagrees with Published, where there is a Status.
- `NOTION_DATABASE_ID` takes the database's ID or its whole address copied
  from Notion. A page's address works too when the database sits on that
  page: the site reads the first database among the page's blocks.
- Since Notion's 2025-09-03 API, a database holds one or more data sources.
  The site reads the first.

### Integrations and what each may do

| Who | Needs | Why |
|---|---|---|
| The site (`NOTION_TOKEN`) | Read content | It only ever reads. A leaked read-only token discloses the database; a leaked writing one could rewrite it. |
| `notion:setup` and `notion:seed-copy` | Insert content, for the one run | They make rows. Take the capability away afterwards. |
| `shop:import --write` (`NOTION_IMPORT_TOKEN`) | Read, Insert and Update content | Give it an integration of its own, so the site's token stays read-only (see [commerce](commerce.md)). |

Share the database with each integration: the database's ⋯ menu →
Connections.

## What a row can be

| Kind | Where it appears |
|---|---|
| Site Copy | Wherever its slot is: Title is the slot's name (`home.hero.title`), Text the words. A few hold a picture in Image instead: the site's own logo and icon (`site.logo`, `site.logo.dark`, `site.icon`), share pictures and the hero's picture ([below](#text-slots-three-states)) |
| Page | At `/its-slug`, its body written in the row's own page |
| Post | At `/blog/its-slug`; on `/blog`, the homepage (the three newest), its category and tag pages and the feed. One filed under Category Releases is a release: on `/changelog` instead, leading on to other releases |
| Resource | On `/resources`, grouped by Category |
| Redirect | `/go/its-title` sends people to its Link |
| Plan | On `/pricing`, with the comparison table built from its features, and on the homepage. With no Plan rows, `/pricing` says so and the homepage leaves its plans out |
| Product | In the shop, at `/shop/its-slug` and in its collection (Category); featured ones first on the homepage's shelf. A copy of a product in your Shopify or Printify shop, made and kept in step by `npm run shop:import` ([commerce](commerce.md)) |
| Question | On `/questions` under its Category; Category Pricing also puts it on `/pricing`, and Category Template on `/features` instead. With none, `/questions` says so |
| Quote | The homepage shows the first (featured first, then by Order), `/pricing` the next, or the first when there is one |
| Proof Logos | A tool the site works with, in the "goes well with" strip on the homepage and `/features` (the site's own logo is not one: it is the `site.logo` Site Copy row, below); with none, the strip shows the marks of the tools the site works with, each name a slot (`logos.<tool>`, blank to take the mark away) |
| Person | On `/team` (and the first three on `/about`): Title the name, Description the role, Text a line about them, Image the portrait, Link a profile. Also the author of the posts that name them ([authors](#authors)); Team Page Off keeps them to that |
| Review | On the homepage, newest first, with the average and the count: Title the name, Text what they said, Rating the stars (1 to 5), Published Date when, Image a photo, Link where it was left. Tags: **Example** marks an invented one. Examples show under an "example reviews" mark, and only until one real review is published, which takes their place. The starter's four are invented, so the setup tags them Example |
| Section | Not a page of its own: where a section of a designed page goes. Title names the section, Slug the page, Order its place; read ticked or not, since unticked takes it off ([sections](sections.md#sections-from-notion)) |
| Menu | Not a page of its own: a link in the header or the footer. Title names the page, Slug the menu, Order its place; read ticked or not, since unticked takes it off ([menus](#menus)) |

## Adding a row

In the template, press the arrow beside **New** and pick what you are
adding: Post, Page, Product, Question, Plan, Quote, Review, Person,
Resource, Short link, Proof Logos, Section or Menu. Each is a Notion database
template:

- it sets the row's **Kind** (and a sensible default or two, such as a
  product's Stock), and starts with **Published** unticked, but for a
  Section and a Menu, which start ticked: an unticked Section row naming a
  section places it nowhere, and an unticked Menu row takes its link off,
  so a half-filled one would take a section or a link away;
- a grey box at the top says what each property does for that kind;
- a post's and a page's body is shown on the site, so their box says to
  delete it before you tick Published. The other kinds are read from their
  properties alone, and their box can stay.

The site never sees a template. Notion's query does not return them. Even
if it did, an unticked row could not show, and the Section and Menu
templates' Titles name no section and no page, so they would place nothing.

A database made by `npm run notion:setup` has no templates: Notion's API
can read and use them, but not make them. Duplicate the template instead,
or make your own in Notion: **New ▾ → New template**.

## Published and Status

**Published** is the one switch the site reads: ticked, a row shows;
unticked, it does not. The template also has **Status** (Draft, In Review,
Published), which says where a row is for the people writing it. The site
never reads Status.

- **Cards show Status, never the tickbox.** In the board and gallery views
  (By Kind, Posts, Shop, Proof Logos), a tickbox on a card is one stray click from
  taking a page off the site, so the cards show Status instead. Tick and
  untick Published on the row's own page, or in a table view (Everything,
  Copy, Pages and the rest), where it is a column of its own.
- **Two automations keep Status in step** (the ⚡ beside the views, then
  Automations):
  - when Published is checked, set Status to Published;
  - when Published is unchecked, set Status to In Review.

  Notion's API can make neither an automation nor a status property, so a
  database made by `npm run notion:setup` has neither. In a copy of the
  template, check the two are there and switched on, and make them as above
  if they are not.
- **Status alone changes nothing on the site.** Moving a row between Draft
  and In Review is a note to the team; setting it to Published by hand does
  not publish it. Tick Published.
- **To schedule a row, tick it now and date it ahead.** Tick Published and
  give the row a Published Date in the future, with a time and its time
  zone if you like (Include time). The site keeps it hidden until then and
  shows it within a minute or two after, on its own. Nothing in Notion
  changes when it goes live, and nothing ticks a box for you: a row that
  waits is ticked all along, so its Status already reads Published. The
  template's **Scheduled** view lists every ticked row dated today or later,
  soonest first, and `npm run notion:check` says when each goes live. Untick it to
  call it off.
- A new row starts unticked and Draft. The Section and Menu templates start
  ticked, so their Status is Published too.
- `npm run notion:check` names any row, drafts included, whose Status
  disagrees with Published: on the site while its Status says otherwise,
  or off it while its Status says Published. A Status is live when it is in
  the property's **Complete** group, whatever it is called.

## Finding things

Everything the site shows is a row, and a view for each kind keeps rows easy
to find. Make one (the setup makes the database and its rows, not views): a
table filtered to its Kind, showing the properties that kind uses
(the table above says which). For example, Kind is Plan with Price, Yearly
Price, Currency and Price Note, or Kind is Site Copy with Title, Text and
Published.

Notion's search reads titles and text but never a number. So a price, an
Order or a Rating is found by opening its row or its view, not by searching
for it:

| On the site | In Notion |
|---|---|
| A plan's price | The Plan row's Price, and its Yearly Price when the reader picks yearly. Currency gives the sign, and Price Note the words after it |
| A product's price | The Product row's Price, and its Compare-at Price for an old price struck through |
| Which comes first | The row's Order |
| A review's stars | The Review row's Rating |

## Every property

The property names are the names the site looks for, exactly: rename one in
Notion and the site stops reading it (`npm run notion:check` says which). The
descriptions are the ones `notion:setup` writes into Notion, so they show
beside each property there too.

<!-- schema:start -->
| Property | Type | Required | What it is for |
|---|---|---|---|
| Title | Title | yes | Site Copy: the slot's name. Section: the section it places (home.reviews). Menu: the page it links (features, or a Notion page's address). Redirect: the short link's slug. Quote, Person and Review: the name. Anything else: its title. |
| Kind | Select | yes | What the row is. Options: Site Copy, Page, Post, Resource, Redirect, Plan, Product, Quote, Proof Logos, Question, Person, Review, Section, Menu. |
| Published | Checkbox | yes | Ticked: on the site, or from its Published Date when that is still to come. Unticked: off. Nothing ticks it for you: to schedule a row, tick it now and date it ahead. It stays ticked while it waits. |
| Text | Text |  | Site Copy: the slot's words (a picture's row: the picture's words). Plan: its features, one a line ("Label: value" fills the table). Quote: the quotation. Question: the answer. Person: a line about them. Review: what they said. Newlines become line breaks; links are kept. |
| Slug | Text |  | Pages, posts and products: the address, e.g. about or guides/setup. Empty means made from the title. Sections: the page it shows on (home, pricing…); empty, its own. Menus: the menu (header, header-side, footer-product…); empty, its own. |
| Description | Text |  | One or two sentences for search results, cards and share previews. Person: their role. |
| Image | Files & media |  | Pages, posts: the cover if no Notion cover. Products: the first picture. Quotes: their logo. Proof logos: a tool's mark. Person, Review: the portrait. Site Copy: the picture of meta.<page>.image (1200×630), meta.site.image, site.logo, site.logo.dark, site.icon or home.hero.image. |
| Cover Position | Select |  | Where the cover or portrait is cut when it is cropped: Top, Upper, Middle (the default), Lower or Bottom. Notion's own Reposition does not reach the site. Options: Top, Upper, Middle, Lower, Bottom. |
| Cover Tint | Select |  | Pages, posts and resources: On (the default, when empty) prints the cover in the look's ink; Off shows it as uploaded. Mono still shows it in grey. Options: On, Off. |
| Order | Number |  | Position in a list, smallest first. Pages: in the footer (empty means not listed). Sections: on their page. Menus: in their menu. Resources, plans, products, quotes, logos, questions, people: in theirs. |
| Published Date | Date |  | Posts: the date printed. Reviews: when it was left. Any ticked row: a future date keeps it hidden until then, and it goes live on its own; with a time and its zone (Include time), from that minute, e.g. 4pm GMT. |
| Category | Select |  | The group a row belongs to. Posts and resources: a category (Releases puts a post on the changelog instead of the blog). Products: a collection in the shop. Plans: the box they sit in on the pricing page. Questions: where they are asked (Pricing puts them on /pricing). Options: General, News, Guides, Releases, Pricing, Template, Services, Breakfast, Drinks, Household, Pantry, Orders and delivery, Returns, Your account and privacy, Help. |
| Tags | Multi-select |  | Posts: any number of tags. Reviews: Example marks an invented one, shown as an example and only until a real one is published. Options: Technology, Design, Business, Tutorial, News, Review, Example. |
| Featured | Checkbox |  | Posts: shown first on /blog. Products and quotes: shown first. Plans: marked as the recommended one. |
| Feature Block | Number |  | Featured posts and products: their order among the featured (1 first). |
| Author | Text |  | Posts: the byline, a Person row's name: their portrait (Image), job title and line come from that row. A guest gets a Person row too, with Team Page Off. A name with no Person row is printed alone. |
| Author Bio | Text |  | Person: the line under their posts (empty: their Text). Quotes: who the speaker is. |
| Team Page | Select |  | Person: On (the default, when empty) shows them on /team and /about. Off keeps them to the byline of the posts they write. Options: On, Off. |
| Action | Select |  | Resources: the button's verb. Options: Read, Watch, Download, Link. |
| Link | URL |  | Where a row's button goes: a resource's, a plan's or a logo's. Person: their profile. Review: where it was left. Products: an outside buy link (https). Redirects: the destination. Menus: an address the link goes to instead of a page, its Title the words. |
| Font | Select |  | Pages and posts: Notion's three page styles. Options: Default, Serif, Mono. |
| Full width | Checkbox |  | Pages and posts: use the full width, as Notion's page option does. |
| Layout | Select |  | Pages: Article sets the body as a Notion page; Landing sets its top-level blocks as marketing sections (docs/sections.md). Options: Article, Landing. |
| Price | Number |  | Plans and products: the price, as a number. Plans: per month. Empty means custom pricing. Products: your shop's price, written by npm run shop:import; change it there. |
| Yearly Price | Number |  | Plans: the price per month when paid yearly. Shows the monthly/yearly switch. |
| Currency | Select |  | Plans and products: the price's currency, as its three-letter code. Empty means GBP; a code that is not offered can be typed in. Options: GBP, USD, EUR, CAD, AUD, NZD, CHF, SEK, NOK, DKK, JPY, INR. |
| Price Note | Text |  | Plans: the words after the price, e.g. per seat / month. |
| Compare-at Price | Number |  | Products: the old price, shown struck through. Written by npm run shop:import. |
| Gallery | Files & media |  | Products: more pictures, after the Image. Each product picture's name, the Image's too, is its alt text, read to screen readers: npm run shop:import writes the shop's. |
| Stock | Select |  | Products: whether it can be bought. Sold out keeps the page and stops the button. Written by npm run shop:import; Low stock and Pre-order are yours to set. Options: In stock, Low stock, Sold out, Pre-order. |
| Checkout ID | Text |  | Products sold through Shopify: the variant ID, or one "Label: ID" a line for several (Small: 4012345678901). Written by npm run shop:import. |
| Button | Text |  | Plans: the words on the plan's button. Its Link is where it goes. |
| Rating | Number |  | Reviews: the stars given, 1 to 5. |
| Import ID | Text |  | Products: the product in your shop this row is a copy of (shopify:… or printify:…), so npm run shop:import finds it again. Leave it as it is. |
<!-- schema:end -->

## Text slots: three states

Every piece of text on a designed page (the homepage, `/pricing`, the
footer…) is a **slot**. A slot looks for a Site Copy row whose Title is its
name, such as `home.hero.title`:

| The row | What the site shows |
|---|---|
| Published (ticked), with text | The text |
| Not published (unticked), or ticked with the Text left empty | Nothing: the slot is hidden |
| None | Nothing: the slot is hidden |

Published means shown, for a sentence as for a page: untick a row to take
its words off the site, tick it to put them back. With no row at all a
slot shows nothing too, so no word reaches the site that its owner has not
seen in Notion: a slot an update of the code adds, a row moved to the trash
instead of unticked, a Title mistyped. `npm run notion:check` names every
slot with no row. Only the starter site, with no Notion connected, shows the
words written into the code.

A control's whole name is the one exception: a field's label, a tab, a
submit button, a page's title in the tab and in search fall back to the
code's suggestion rather than go blank, since a control with no name is
broken, not edited. `notion:check` names their missing rows all the same.
Words inside a picture (the small pictures on `/features`, a pack's label)
and a figure (a fact's value) are not controls: with no row they show
nothing too.

- Line breaks in Text are kept.
- Formatting is kept, as Notion shows it: **bold**, *italic*, underline,
  strikethrough and `code`, drawn the way a page's own blocks are. The same
  goes for the words a row prints: a quotation, an answer, a description, a
  bio. Notion's colours (red text, a yellow highlight) are not: this is the
  site's web copy, set in its design and its four looks. Colours you give
  words in a page's or a post's own body are kept, as Notion shows them.
  Where a string is needed
  (a page's title in search, an attribute, the feed, structured data), the
  words are kept and the formatting dropped. Titles are always plain.
- Notion links are kept. A link to another site opens in a new tab; one to a
  page here (`/pricing`), or to the site's own full address, does not. A
  link to anything but the web, email, a phone or this site is shown as its
  words alone.
- **A button goes where its row's link goes.** Link the words of a
  button's row (`nav.get`, `home.cta.shop`, `home.cta.plans`,
  `home.final.shop`, `home.final.contact`, `security.report.contact`) and
  the button goes there instead of the address in the code; the words stay
  the button's words. `security.report.contact` goes to the site's own
  contact form until then; a site that takes bug reports elsewhere (the
  template's demo sends them to its GitHub issue forms) links it there.
- Where a slot names a control or is the words of a link the site draws (a
  placeholder, a menu item, the address in a sentence), a link in it is
  shown as its words. Notion links an address it recognises on its own
  (`you@example.com`), and a link can't sit inside another.
- A few of the renderer's own words take `{provider}`, which becomes YouTube
  or Vimeo (`blocks.video`, `blocks.playNote`, `blocks.watchOn`).

**The list of slots is generated, not maintained.** `npm run copy` renders
every page in jsdom (tests/dom/every-word.test.tsx), from the starter content
and from none, with each page's metadata, share card and `/llms.txt`, and
writes `copy-keys.json`: every slot with its built-in wording. Many slot
names are built from data (the services, the tools, the share links), so
searching the code for them finds only part of the list. The few a render
cannot reach (a form's answer, a setting that is off) are listed in
`tests/support/hidden-slots.ts`, and a test holds each to its component. A
test fails when `copy-keys.json` is out of date.

**Words that are rows are never slots as well.** Plans, questions and
quotations are rows (Kind Plan, Question, Quote), and only rows: with none,
the section is left out or says it is empty (`pricing.empty`,
`questions.empty`), and nothing built in stands in for them. So a plan's
name is in its Plan row and nowhere else, and editing it always shows. A
test fails if a slot only an empty database reaches is anything but an
empty state (`<area>.empty`).

**The site's own name is a slot**: `site.name`, with `site.descriptor` (the
smaller words beside it, where Notion's brand rules put "Notion") and
`site.noun` (the word on the homepage's share card). The template's credit
in the footer keeps the template's name.

**Text rows the site never reads.** `npm run notion:check` names every Site
Copy row whose Title is no slot the site reads (left by an older version, or
mistyped), so you never edit words that change nothing, and says how many
slots have no row yet.

**A page's own words are slots too.** A designed page's search title,
description and label are `meta.<page>.title`, `.description` and `.label`
(docs/seo.md).

**So are its pictures.** A ticked Site Copy row with a picture on it (its
Notion cover, or its Image) gives the site a picture where its Title
says: `meta.<page>.image` the share picture of one designed page,
`meta.site.image` that of every page with none of its own, `site.logo` the
site's logo. Its Text is the picture's words for whoever cannot see it;
blank, they are the page's title. A row without a picture changes nothing
(docs/seo.md, "Pictures from Notion").

**The logo and the icon.** `site.logo`'s picture stands where the mark does,
in the header and the footer (as tall as the mark, as wide as it is drawn up
to 160 pixels), and is the logo search engines show. In the dark look it is
shown inverted, dark ink turned light, unless `site.logo.dark` gives one made
for a dark ground. `site.icon`'s picture is the icon in a browser's tab, on a
phone's home screen and in the manifest; without one, the logo is. Upload a
square PNG or JPG at least 512 pixels wide: the site makes each size from it,
fitted whole inside the square. An SVG works in a browser's tab, as it was
uploaded, and a home screen then keeps a picture of the page. Untick the
row, or clear its picture, and the mark and its icons are back. A browser
holds on to a tab's icon a while, so a new one can take a reload or two to
show.

**A picture under the home page's hero** is `home.hero.image`: the row's
picture fills the hero the width of the window, under a veil, and the
hero's words and buttons turn light on it, in every look. It is printed in
the look's ink as a cover is, unless the row's **Cover Tint** is Off (as
uploaded), and cut where its **Cover Position** says. Its Text is the
picture's words only if it shows something a reader should know of; left
blank, the picture is decoration. Untick the row, or clear its picture, and
the hero is as designed. A photograph 2400 pixels wide is plenty: a reader
is sent the width their screen needs.

**One row is a choice, not words.** `cookies.shape` says which shape the
cookie question takes: bag (the default), box or banner, in any case.
Unticked, blank or anything else, it is the bag (docs/analytics.md, "The
question, and the answer").

A form's every message is one, its refusals included: the
routes answer with a code, and the form says it in your words
(`contact.form.<code>`, `newsletter.<code>`).

**A blank row never leaves a broken control.** A slot that is a control's
whole name (a field's label, a tab, a submit button) falls back rather than
going blank. Where a link, a button or a heading held nothing but a slot,
publishing that slot blank leaves it empty, and the stylesheet hides it.

**A slot with no row.** `npm run notion:seed-copy` makes a row for every
slot that has none, holding the words the code suggests, and unticked:
nothing on the site changes until you have read a row and ticked it.
`npm run notion:seed-copy -- --ticked` makes them ticked, for a database you
want to show the suggestions at once (`npm run notion:setup` does this for
the starter content it writes).

## Pages and posts

| Property | What it does |
|---|---|
| Slug | Sets the address. Empty is made from the title. Pages can nest (`guides/setup` is `/guides/setup`). A page may not take an address the site already answers (`/blog`, `/shop`, `/pricing`…); `notion:check` reports one that tries. Two rows with one address: the older keeps it, so a new page cannot quietly replace an old one, and the check reports both. |
| Published Date | Schedules a row. A date in the future keeps a post, or any other row, off the site, the feed and the sitemap until that day (from midnight UTC). For a time too, turn on **Include time** in Notion's date picker and pick the time zone beside it: 1 December, 16:00, GMT goes live at 4pm in London, and a summer date there is read as British Summer Time. The site shows it within a minute or two of then, and `npm run notion:check` says, in UTC, when each ticked row that waits will go live. The date printed on a post is the day written in Notion, whatever the zone. |
| Featured | Featured posts come first on `/blog`, in **Feature Block** order (1 first); the homepage shows the three newest, featured or not. Featured products come first on the homepage's shelf, in the same order. |
| Font and Full width | The row's own Font and Full width properties, drawn as Notion's page options are. Notion's own page menu (Style, Full width) is not in its API, so the site cannot read it. |
| Layout | Landing sets a page's top-level blocks as marketing sections ([sections](sections.md)). |
| The cover and the page icon | Shown as Notion shows them. A page's or a post's own Notion cover (**Add cover**, then Change: upload, a link, Notion's gallery or Unsplash) comes first; the **Image** property is used only when the page has none. The cover is also the page's share picture, and is printed in the look's own ink ([covers](#covers)). |
| Cover Position | Where the cover is cut: Top, Upper, Middle (the default), Lower or Bottom. Notion's own **Reposition** stays in Notion: its API does not say where a cover was moved to. |
| Cover Tint | On (the default, when empty) prints the cover in the look's ink; Off shows it as uploaded ([covers](#covers)). |
| Order | Puts a page in the footer's Company column. |
| Author | Who wrote a post: a Person's name ([authors](#authors)). |

### Menus

The header's links, the phone menu and the footer's three columns are the
site's menus, and a **Menu** row says where one link goes. A link with no
row stays where it was designed, so a database with no Menu rows has the
menus as designed; the setup makes one row for every designed link, ticked,
so each is there to reorder or turn off. In the template, the **Menus** view
shows them a menu to a group, in the order the menu shows them.

| Property | What it does |
|---|---|
| Title | The page the link goes to: a designed page (`features`, `pricing`, `blog`, `home`…) or a published Notion page's address (`guides/setup`). Its words are the page's `nav.<page>` slot, or the Notion page's title. |
| Link | An address to go to instead of the page Title names: another site (opened in a new tab), a Notion page, an email, or a path here. On a designed page's row (`shop`) the link takes that page's place and words; on a new row, Title is the link's words and Slug must name its menu. |
| Slug | The menu: `header` (left of the mark), `header-side` (right of it), `footer-product`, `footer-company` or `footer-help`. Empty: every menu the page was designed for, so one row with no Slug, unticked, takes a page off every menu. |
| Order | Its place, smallest first. The designed links stand at 10, 20, 30… so a row at 15 goes between the first two. No Order keeps a designed link where it was, and puts an added one last. |
| Published | Ticked, the link shows; unticked, it is off that menu. |

<!-- menus:start -->
| Slug | Where it is | Room | Its links as designed |
|---|---|---|---|
| `header` | The header, left of the mark | 4 | `features`, `pricing`, `shop`, `about` |
| `header-side` | The header, right of the mark, before the cart | 2 | `blog`, `resources` |
| `footer-product` | The footer's first column (footer.col.product) | any | `features`, `pricing`, `shop`, `changelog` |
| `footer-company` | The footer's second column (footer.col.company), then the Notion pages with an Order | any | `about`, `team`, `blog`, `contact` |
| `footer-help` | The footer's third column (footer.col.help), then Cookie settings | any | `questions`, `resources`, `security`, `privacy` |
<!-- menus:end -->

The header holds as many links as it was designed for, four on the left and
two on the right, so the row weighs the same either side of the mark; past
that, the first by Order show, and `notion:check` names the rest. The phone
menu is every menu's links in turn, each once, so a page taken off every
menu leaves the phone's too. A footer column with no links left goes,
heading and all (Help stays while Cookie settings is in it). A Notion page
with an Order still joins the company column after its links, as before.

A link out of the site is a row with a Link. Put one on the `shop` row and
the header's Shop goes to a shop on another platform, in Shop's place and
under its words; unticked, Shop is off that menu as before. A new row adds
a link of its own: the template's own demo has one in `footer-help`, Title
"Report a bug", Link its GitHub issue forms. Either way it is the
database's, never the code's, so a copy's menus send nobody to somebody
else's site. `notion:check` names a row with a Link it can't place (no
Title, no menu, or an address a browser must not follow).

### Authors

A post's **Author** names a person, and the person is written once, on their
Person row, which the team page reads too. So a new picture, a new job title
or a new line about them changes every post they wrote and their team card
together.

| On the Person row | On their posts |
|---|---|
| Title | The name, as the row writes it. The Author is matched in any case and spacing. |
| Description | The job title, under the name. |
| Author Bio | The line under their posts. Empty: their **Text**, the team card's line. Two fields, so the byline can say something the team card doesn't. |
| Image | Their one picture, the same on the team card and every byline. |
| Cover Position | Where the picture is cut, on the team card and every byline alike. |
| Team Page | On (the default, when empty) shows them on `/team` and `/about`; Off keeps them to their posts' bylines, for a guest writer or somebody who has left. |

The Person row is the whole byline. A post holds nothing of its author but
the name: a guest who writes once gets a Person row too, with Team Page Off,
and a name with no Person row is printed alone.

**Author Image** and **Author Photo Credit** are retired: a person has one
picture, their Image, and the site prints no credit under it. A database
made before still has both columns, and `notion:check` names them, and
every row still holding something in them, drafts too, so each picture can
be moved to the person's Image before the columns are deleted.

Notion can't hide a property on some kinds of row and show it on others (the
layout is one for the whole database), so the row's properties are grouped
under headings that say which kinds use them, and `notion:check` names what
an editor wrote where nothing reads it: a post's own Author Bio, a post by a
name with no Person row (printed alone), a person with Team Page Off who
writes no post (shown nowhere), and two Person rows of one name (posts take
the first).

Who shows where:

| Somebody who | Is |
|---|---|
| writes and is on the team | a Person row, Team Page empty or On, named in their posts' Author |
| writes, and is not on the team (a guest, somebody who has left) | a Person row with Team Page Off: on their bylines, off `/team` and `/about` |
| is on the team, and writes nothing | a Person row no post names: on `/team`, on no byline |

### Blocks

The blocks below are drawn the way Notion draws them, colours included. A
page is read eight levels deep and 2,000 blocks long at most:

- paragraphs and headings;
- lists and to-dos;
- toggles and toggle headings;
- quotes, callouts and dividers;
- columns and tables;
- code (highlighted on the server) and equations;
- pictures, video, audio, PDFs and files;
- bookmarks, embeds and links to other pages;
- a table of contents.

Some blocks need more care:

- **Headings:** Notion's Heading 1 is an `<h2>` (the page's title is the
  `<h1>`), and no heading is drawn more than one level below the one before
  it. Screen readers get an outline with no gaps, whichever heading you
  started with.
- **Videos:** a YouTube or Vimeo video loads nothing until the reader presses
  play.
- **Links to other pages:** a link to a Notion page that is a live page,
  post or product here becomes a link to its address; a link into a private part of
  Notion is left out.
- **Links to this site's own pages:** link to the page's full address
  (`https://your-site.example/pricing`). It becomes the path (`/pricing`), so
  it stays in the tab and works on a preview deployment too. Notion keeps a
  link written as a path on its own app (`https://app.notion.com/pricing`);
  that is read as the path as well, and it is how `npm run notion:setup`
  writes the starter pages' links, since Notion's API refuses a bare path.
- **Child databases, breadcrumbs and templates** are left out rather than
  half-drawn. In development, the server log names each one it skipped.

## Covers

**Image used to be called Cover Image,** and was renamed so it isn't
mistaken for a page's own Notion cover. A database from before the rename
needs nothing doing: the site reads either name, `npm run shop:import`
writes whichever the database has, and `npm run notion:check` suggests
renaming it (the property's menu, Rename) when you like.

A post's or a page's cover is the picture above its title, and on its card.

- **Add it in Notion the usual way.** Use **Add cover**, then **Change**, to
  upload a picture, paste a link, or pick one from Notion's gallery or
  Unsplash. The site shows what Notion shows. An Image file is used only
  for a page with no cover of its own.
- **Choose where it is cut with Cover Position.** Covers are cropped to a
  wide strip, so pick Top, Upper, Middle, Lower or Bottom to keep the part
  that matters in view. Notion's own Reposition doesn't carry over, because
  Notion's API never says where a cover was moved to. Cover Position also
  sets where a person's portrait is cut.
- **Every cover is printed in the look's one ink:**
  - the label's blue in light;
  - a deep green in dark, so whites are a pale mint;
  - grey in mono;
  - violet in rainbow.

  The photograph keeps its own light and dark and takes its colour from the
  look, so a picture from anywhere sits with the site. The file itself is
  untouched, and the goods for sale are never tinted.
- **Turn the ink off with Cover Tint.** Set a row's **Cover Tint** to Off
  and its cover is shown as uploaded, on its page and on its card, in
  light, dark and rainbow; mono still shows it in grey, since the reader
  chose no colour. Empty is On. To make Off the default for new posts, set
  it in the Post template (**New ▾**, then **⋯** beside Post, then Edit).
  [Brand](brand.md) says how to switch the ink off for every cover at once.
- **Credit the photographer** where the licence asks. Unsplash doesn't
  require it, but appreciates it. A line at the end of the post is enough.

## Pictures and files

- Notion's file addresses expire after an hour and live on another company's
  host. So every picture and file is served from this site instead, at
  `/media/<token>/<name>`.
- The token is signed. The media route serves only what the site printed, so
  it can't be used to fetch anything else.
- The route asks Notion for a file's current address at most every 50
  minutes, once for a whole page (its cover, icon and gallery share the
  answer), and sooner when Notion says the addresses expire sooner (a
  minute before its `expiry_time`). The file is cached for a year.
  Uploading a new file changes the token, and so the address.
- When Notion's file host refuses an address (an expired one answers 403),
  fails, or can't be reached, the route asks Notion for the address afresh
  and tries once more, so a moment's failure is not a broken picture. Two
  failures are a 502, which nothing caches, and a line in the log naming
  the host (never the address, which holds a signature).
- A picture is sent at the size it is shown, as WebP: a 4000-pixel
  photograph in a row costs a reader no more than a small one. An SVG, a
  GIF, anything that moves and a file over 40 MB go as they were uploaded,
  and a file over 100 MB is refused ([how](development.md#pictures-from-notion)).
- **Upload photographs as they are.** Don't shrink them first: each reader is
  sent the width they need, and each width is made once and kept for a
  year. A cover from Notion's Unsplash gallery is lighter still: the site
  asks Unsplash for just the width it needs and never fetches the
  original.

  The limits are Notion's. Its free plan takes files up to 5 MB, so
  download from Unsplash at **Large** (2400 pixels wide), which is plenty
  for the widest screen. Paid plans take larger files, and the site never
  needs more than 1920 pixels across.
- An outside picture (a link, not an upload) is fetched over https from a
  public host only ([why](privacy-and-security.md#pictures-and-files-media)).
- The signing key is `MEDIA_SIGNING_KEY`, or one made from `NOTION_TOKEN`.
  With neither set, no media address works at all.

## Describing pictures

A screen reader reads a picture's description (its alt text) in place of the
picture. Notion lets you set alt text on a picture, but its API never returns
it. So the site reads descriptions from two places it can see:

| A picture in… | Its description |
|---|---|
| A page's or a post's body | A line of its caption that starts `Alt:` (or `Alt text:`). Add it with Shift+Enter after the caption, or write it alone. It is read, never shown |
| A product's Image or Gallery | The picture's name in Notion. The import names each one with your shop's alt text. A picture you add by hand: rename the file with what it shows before you upload it (`The front of the box.webp` is read as "The front of the box"). A name that is only a file name (`IMG_1234.jpg`) is not a description |

For example, this caption shows "Our shop on opening day" under the
picture, and a screen reader reads "A green shopfront with bread in the
window":

```
Our shop on opening day
Alt: A green shopfront with bread in the window
```

- **A caption with no `Alt:` line** is the picture's description, read once,
  under it. The picture itself isn't announced, so it isn't read twice.
- **A bare `Alt:`** marks a picture as decoration: nothing is shown, and a
  screen reader passes it by. That's right for a picture that adds nothing
  the words around it don't say.
- **No caption and no `Alt:`** also means a screen reader passes it by,
  unasked. `npm run notion:check` names every page, post and product with
  such a picture.
- **Say what the picture shows, as you would on the phone**: "A loaf cut
  open, its crumb full of holes", not "image" or the file's name. Leave out
  "picture of"; the screen reader says that already.
- **Covers, portraits and review photos are decoration** on purpose: the
  title or the name next to them says what they are.

## Icons

A page's icon and a callout's are Notion's to choose, as in Notion:

- **An emoji** is shown as the emoji.
- **One of Notion's own icons** (the Icons tab of Notion's picker) reaches
  the site as a name and a colour, and is drawn with the site's icon of that
  name (`lib/icons.ts`), in Notion's colour for it, so it follows the
  site's looks. One the site has no drawing of is shown as Notion draws
  it, fetched through `/media/`.
- **A picture** (uploaded, or a link) comes through `/media/`.

The starter content uses Notion's own icons, by name (receipt, grid, search,
tag, light-bulb, checkmark, warning, chat, calendar, clock, unlock, and the
alien), so a database made by `npm run notion:setup` shows the same icons
in Notion as on the site. Notion refuses a name it does not have.

## Short links for print

A Redirect row makes `/go/<its title>` a 307 redirect to its Link:

- **Not cached:** a printed QR code keeps working when you change where it
  goes.
- **Never a dead end:** an unknown slug goes to the homepage.
- **Link rules:** a Link may be a web address, an email (`mailto:`), a phone
  number (`tel:`) or a page here.

`npm run qr -- <slug>` draws the code, as SVG for a printer and as PNG.

## How quickly the site follows

**Within a minute, on its own.** Notion is read once a minute at most for the
whole site, whatever the traffic, and every page, feed and route reads that
one answer, the sitemap included. Two things take longer: the drawn share
cards are refreshed hourly, and a second edit to a page's body inside the
same minute can take ten. Notion allows about three requests a second, so nothing reads it
once per page view.

**Within seconds, with a webhook.** Either of these works:

| Webhook | Setup |
|---|---|
| Notion integration webhook → `/api/notion-webhook` | 1. In the integration's settings, add a subscription pointing at `https://<your site>/api/notion-webhook`. 2. Notion sends a one-time verification token; the site writes it to its log. Paste it into Notion, and set it as `NOTION_WEBHOOK_SECRET`. 3. From then on every event is signed, and one without a matching signature is refused. |
| Database automation → `/api/revalidate` | 1. In the database, add an automation with the action "Send webhook" to `https://<your site>/api/revalidate`. 2. Add an `x-revalidation-secret` header set to `REVALIDATION_SECRET`. 3. With no secret set, the route refuses everything. |

You can also call `/api/revalidate` yourself (a POST with the secret). Give it
`{ "path": "/pricing" }` to refresh one page; leave the path out to refresh
everything.

## When Notion is down

Each source below is tried only when the one above it fails:

1. **Notion.**
2. **The last answer this server had.**
3. **The snapshot taken at build time.** `npm run build` reads Notion once
   and writes `lib/snapshot.json`; on Vercel, every deploy does. It's
   committed empty, and a build that can't reach Notion keeps the snapshot
   it has rather than failing.

There is no fourth: a connected site never falls back to the wording
written into the code. With nothing to show from any of the three (a first
deploy that has never once read Notion), a slot shows nothing, as a slot
with no row does, until Notion answers.

A failure is logged as `[notion] …` on the server. A site with no Notion
settings at all is not a failure: it shows the starter content
(`lib/demo/starter.ts`, the same rows `npm run notion:setup` writes, read by
the same code) from its own pictures in `public/demo`, keeps every page out
of search, and mentions it once, in production. Once Notion is connected,
the database alone decides what shows.

### During a build

A build reads Notion once, before Next starts: `npm run build` runs
`scripts/snapshot.mjs` first, which writes the rows to `lib/snapshot.json`
and the body of every live page, post and product to
`lib/snapshot-bodies.json`, one page at a time through the site's limiter,
waiting as Notion asks when it answers 429 (up to a minute a try, eight
tries; after that the page is left to render on its first visit). `next build`
then renders every page from those two files and sends Notion nothing.

That matters because `next build` renders in a worker per processor core,
each with its own memory. On a large build machine (Vercel's has thirty),
every worker asking Notion for the rows and the bodies at once is far past
Notion's three requests a second, and a body that can't be read fails the
deploy.

- A body the prebuild couldn't read is left out, and its page is rendered
  on its first visit instead of at the build.
- If the prebuild couldn't read Notion at all, the build reads the rows
  itself (with the fallbacks above) and prerenders no page body.
- Once deployed, the site reads Notion as before: the bodies' snapshot is
  for the build alone.

Both files are committed empty; CI fails if a build leaves them filled.

