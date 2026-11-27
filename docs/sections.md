# Sections

The designed pages are built from one library of marketing sections, in
`components/sections/marketing/`. It's shaped after a SaaS site's homepage,
enterprise page and pricing page, and dressed as the generic label.

You can use the sections in code, or get them without code by writing a
Notion page with **Layout: Landing**.

## The library

| Section | What it is | Where it's used |
|---|---|---|
| `HeroCentered` | Eyebrow, display title, lede, buttons, an optional picture | `/`, `/features`, `/team`, Landing pages |
| `KineticWords` | A hero title whose words land one after another, once ([design](design.md)) | `/` |
| (hero, with a `name`) | The site's name leads in the slab face; under it the eyebrow is a small label, so two slab lines never stack | `/`, `/features` |
| `HeroSplit` | Title and words on one side, a picture on the other | `/about` |
| `LogoStrip` | Logos from Proof Logos rows; with none, the one-colour marks of the tools the site works with (`logoItems`). Set as the heading it stands under is (`align`) | `/`, `/features` |
| `ReviewCards`, `Stars` | As a review site sets them out: a verdict in a word, the average in star tiles, the count, and a card for each review, passing by on a loop that can be paused when there are three or more; "example reviews" over ones tagged Example | `/` |
| `StatCards` | Big figures with a line each. Only true or worked-out figures. | `/`, `/about`, Landing pages |
| `Quote`, `QuoteCard` | A quotation large, or as a card beside the plans | `/`, `/pricing` |
| `FeatureColumns` | Two to four short columns | `/`, `/features` |
| `Bento` | Cards of different sizes, each with a small illustration | `/features` |
| `SplitFeature` | Words and a picture side by side, alternating; an `h2` where it heads its own section (`heading`) | `/features` |
| `FeatureTabs` | Cards that are tabs, driving one panel | `/features` |
| `TrustFacts` | Facts about privacy and security, in a grid | `/security`, `/pricing` |
| `PricingPlans` | Plans, the monthly/yearly switch, the recommended badge | `/pricing` |
| `ComparisonTable` | Plans compared feature by feature | `/pricing` |
| `Faq` | Questions and answers that open and close | `/pricing`, `/questions`, `/features`, Landing pages |
| `FinalCta` | A last word and its buttons | `/`, `/about`, `/pricing`, `/questions`, `/security`, `/team`, Landing pages |
| `MarketingSection`, `SectionHead`, `Container`, `MoreLink` | The frame: width, rhythm, a section's eyebrow, title and lede, a "see more" link | everywhere |

On `/features`, "every word is a row" is three joined steps, each with a
small working picture of itself, and under them every Kind a row can be,
set as the side of the pack (`TemplateRows`).

The template's full list of ingredients has a page of its own,
`/resources/ingredients` (`IngredientsList`), listed among the resources;
`/features` shows its groups as chips (`IngredientChips`) and a button to it.

The small illustrations (`components/illustrations/`) are the site's own
markup, not pictures of Notion: a table, a page, a form, a calendar, a
browser, a pipeline, and the packs in three dimensions (`packs.tsx`) that
make the still life and the About page's pack. Under the still life on
`/features` stand four columns, one for each pack in the shelf's order,
each with a line and the way to it (`features.shelf.*`).

Search (`components/system/search-box.tsx`) is the pill the shop and the
blog search with: a labelled search field that filters the list already on
the page, says what it found, and keeps the words in the address (`?q=`).

### The rules every section keeps

- **Every word is a Notion slot.** A section takes its words as `<T>`
  slots or strings read with `plainText`, so each can be reworded, or hidden
  with a blank published row.
- **Headings go down one level at a time.** A section's title is an `<h2>`,
  its cards' `<h3>`. Tests fail on a skipped level.
- **Native controls first.**
  - `Faq` is `<details>`/`<summary>`.
  - The pricing switch is two radio buttons.
  - `FeatureTabs` follows the ARIA tabs pattern: arrow keys, Home, End, and
    one tab in the Tab order.
  - `ComparisonTable` is a real `<table>` with a caption and header scopes,
    scrolling sideways inside its own labelled region on a phone.
- **Nothing moves for a reader who asked for less motion.** A hero sets
  itself once and a section's head rises as it enters; nothing else in the
  library moves on its own ([design](design.md)).
- **Figures are never typed.** The yearly saving is worked out from the
  prices, rounded down.

`tests/dom/sections.test.tsx` renders each section and checks these rules.

## Landing pages written in Notion

Set a Page row's **Layout** to **Landing** and its top-level blocks are set
as marketing sections. Anything the mapping doesn't recognise is drawn as
Notion draws it, so nothing you write is lost.

| In Notion | On the page |
|---|---|
| The page's title | The hero's `<h1>` |
| Blocks before the first Heading 1 | The hero: the first paragraph is its lede, a paragraph of nothing but links becomes its buttons, a picture its visual |
| Heading 1 | Starts a section, and is its title |
| Divider | Starts a section with no title |
| The first paragraph after a section's title | The section's lede |
| Columns | A row of cards. Each column's first heading is the card's title, and its first picture the card's picture. |
| Callouts in a row whose first lines are short (`99.9%`, `~1 min`, `£0`) | Figures, as `StatCards` |
| A quote | A big quotation. A paragraph inside it names who said it. |
| A run of toggles | Questions and answers, as `Faq` |
| A table with a header row and a header column | A comparison table, ✓ and — for yes and no |
| A picture | Shown large, framed |
| A section of nothing but words and a line of links | The page's call to action, centred, with buttons |

Write it in Notion first, look at it on the site, and adjust. The starter
content's `/landing` page uses every one of these.

## Sections from Notion

The sections of the designed pages (the homepage, `/pricing`, `/about`,
`/team`, `/security` and `/questions`) can each be turned off, moved to
another of those pages, put in a different order, or shown twice, from
Notion. Each is a row with **Kind: Section**. In the template, the
**Sections** view shows them a page to a group, in the order the page shows
them, each with a line saying what it is: untick one to turn it off, and
change its Order to move it up or down.

| Property | What it does |
|---|---|
| Title | Which section, by name (`home.reviews`): the table below lists them |
| Slug | The page it shows on: `home`, `pricing`, `about`, `team`, `security` or `questions`. Empty: its own page |
| Order | Its place on that page, smallest first. Empty: its own place, or last on a page it was moved to |
| Published | Ticked, it shows; unticked, it is off |

- **To turn a section off,** untick its row.
- **To move it,** write the page in its Slug. It leaves its own page.
- **To reorder a page,** change the Orders. The designed ones go in tens,
  so 25 sits between 20 and 30.
- **To show a section twice,** duplicate its row (⋯ → Duplicate) and give
  the copy its page and place. A copy shows the same words as the
  original, read from the same Site Copy rows: change them once and both
  change.
- **A section with no row stays where it was designed.** A database from
  before Section rows shows its pages as designed, and adding one row
  moves only that section. The template has a row for every section, so
  each page's line-up is there to see.

What stays where it is:
- **Every page's hero.** It holds the page's one `<h1>`, so it comes first,
  always.
- **`/features`.** It is the template's own page, and its jump links, the
  deploy steps and the maker's services hang on its order.

The site looks after the rest:
- **Ids.** A section shown twice names its second heading `…-2`, so links
  and screen readers find each.
- **Panels.** Two panel sections never run into each other: the second
  sits on the page's ground.
- **Spacing.** A section straight under the hero is spaced by the hero,
  and anywhere else by the usual rhythm.
- **Structured data goes with its section.** A page's FAQPage data names
  the questions its own sections show, and the people's data goes with
  the section that shows the team.
- **`npm run notion:check`** warns about a Section row naming no section,
  or a page whose sections can't be placed. Such a row keeps its section
  on its own page, so a typo never takes a section away.

The sections, where each was designed (`lib/sections.ts`; this table is
written by `npm run docs`):

<!-- sections:start -->
| Title | Its page | Order | What it is |
|---|---|---|---|
| `home.statement` | home | 10 | One word the width of the window, and three promises on a checkout belt |
| `home.why` | home | 20 | Why generic, in three columns (on the panel) |
| `home.logos` | home | 30 | The tools the site goes well with |
| `home.quote` | home | 40 | A quotation, large (the first Quote row) |
| `home.facts` | home | 50 | The small print in large print, as a nutrition label |
| `home.plans` | home | 60 | The plans, in brief, and the way to compare them (on the panel) |
| `home.shelf` | home | 70 | The shop's shelf: four products, featured first |
| `home.reviews` | home | 80 | What people say: the reviews, with their average |
| `home.posts` | home | 90 | The three newest posts |
| `home.template` | home | 100 | The band saying this is a live demo of the template |
| `home.service` | home | 110 | The maker's plain facts (on the panel) |
| `home.final` | home | 120 | The last word, and its buttons |
| `pricing.plans` | pricing | 10 | The plans with the monthly and yearly switch, and a quotation |
| `pricing.compare` | pricing | 20 | The plans compared, feature by feature |
| `pricing.promises` | pricing | 30 | The maker's promises (on the panel) |
| `pricing.faq` | pricing | 40 | Questions about money (Question rows, Category Pricing) |
| `pricing.final` | pricing | 50 | The last word, and its buttons |
| `about.story` | about | 10 | The story so far |
| `about.numbers` | about | 20 | By the numbers (on the panel) |
| `about.team` | about | 30 | The first three people, and the way to the team |
| `about.final` | about | 40 | The last word, and its buttons |
| `team.people` | team | 10 | Everybody (Person rows) |
| `team.final` | team | 20 | The last word, and its buttons |
| `security.facts` | security | 10 | What is true of the code |
| `security.report` | security | 20 | How to report a problem |
| `questions.list` | questions | 10 | Every question, under its category |
| `questions.more` | questions | 20 | The last word, and its buttons |
<!-- sections:end -->
