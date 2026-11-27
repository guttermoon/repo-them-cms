# Brand

REPO THEM is dressed as a generic product: a plain label that says what's
in the tin. This page covers the look, Notion's brand rules (which the
template keeps and tests), and how to make the site yours.

## The look

**The label.** Lowercase titles in Roboto Slab Bold, set tight. The name, the
eyebrows and the wordmark share the face. Titles inside a Notion page keep
their own capitals; only the site's marketing titles are lowercase.

**No full stop in a title.** A title is a label, not a sentence: "say hello",
"pick a plan, change it any time", never "say hello." Two halves are joined
with a comma, and a question keeps its question mark. The sentences under a
title keep theirs. Every page's headings, its title face, the cookie notice
and the browser tab are held to it (`checkTitles` in
`tests/dom/support/checks.ts`), so a title row in Notion is written the same
way.

**Black first, blue for the accent,** as Notion colours its own: the words
in near-black, eyebrows, links and the secondary button in black, the titles
and main buttons in the label's dark blue, and the light blue used lightly.

**Two inks for words, far apart.** As Notion's own site sets them: near-black
(#191918) for what is read, and a grey for what sits beside it: a lede, a
date, a caption, a label. The grey is the lightest that still reads at 7:1
(WCAG AAA) on every ground it sits on, the pale panels and the wash
included, so it is darker than Notion's #787774, which reaches 4.5:1 on
white only. With the black at 17.6:1 and the grey at about 7:1, the two
read as two tiers. They used to be Notion's editor ink #37352F (12.3:1) and
a darker grey, and side by side the grey looked heavy and the black looked
grey. The contrast test fails if the grey is darker than it needs to be, or
falls below 7:1. Dark swaps the blues for one phosphor green
(`--c-glow`, below) and keeps a little of the label's blue as its accent.

| Token | Light | Dark | Mono | Rainbow | What for |
|---|---|---|---|---|---|
| `--c-page` | #FFFFFF | #070D09 | #FFFFFF | #FFFAF0 | The page |
| `--c-ink` | #191918 | #CDF0D6 | #0A0A0A | #1A1033 | The words |
| `--c-sub` | #4E4D4B | #87B795 | #4A4A4A | #4B3D6E | What sits beside them: a lede, a date, a caption |
| `--c-strong` | #111111 | #ECFFF0 | #000000 | #8E0056 | Eyebrows, links, the secondary button's words and edge |
| `--c-heading` | #283FA6 | #7CFFA0 | #000000 | a rainbow (`--c-title-*`) | Titles |
| `--c-btn`, `--c-btn-ink` | white on #283FA6 | #06140A on #7CFFA0 | white on #000000 | white on #AF005F | The main button |
| `--c-accent` | #283FA6 | #849BFF | #000000 | #5F0EBE | Focus rings, checkmarks, step numbers |
| `--c-cta`, `--c-cta-ink` | white on #283FA6 | white on #283FA6 | white on #000000 | white on #5B0FD1 | The `accent` button |
| `--c-panel` | #F3F5FC | #0B1811 | #F5F5F5 | #FFF0A3 | Panels, used lightly |
| `--c-brand` | #283FA6 | #7CFFA0 | #000000 | #5F0EBE | The band's edges (ink in rainbow), the mark's rim and "r" |
| `--c-tint` | #E6EAF9 | #12341F | #E6E6E6 | #FFE14D | The band's middle (a rainbow in rainbow), the mark's ground |

The rest is Notion's own palette: the nine text and background colours, used
as Notion uses them.

The greys a thing is washed with (a hover, a code block) are cooled to the
label's blue (`--c-wash` #F4F5F8, `--c-well` #EDEFF4). Notion's are warm,
and beside the blues a warm grey reads as a second colour; the contrast
test fails on any ground in light that leans warm.

**The four looks.** The reader picks one (or follows their system, which
gives light or dark) with the header's switch or the footer's choice, and
the site keeps it in their browser (`lib/theme.ts`). Each is one block of
tokens in `app/globals.css`, so a component never knows which is showing.

- **Light:** the label's blues, as described above.
- **Dark glows in the dark,** like a car in a film that does. A near-black
  page with green in it, words in pale mint, and the titles, the band, the
  mark and the main buttons in one phosphor green (`--c-glow`), each with
  a halo of its own light. A little of the label's blue stays as the
  accent: focus rings, ticks and step numbers in the main blue lifted to
  read, and the accent button in the main blue itself, each glowing blue.
  Pictures turn the same pale green and glow, a writer's photographs
  among them, but never the goods for sale (below). An inverted logo
  keeps its inversion;
  Notion's badge is left as Notion made it. Nothing moves, and with the
  system's colours the glow goes with everything else. The favicon and the
  share cards keep the label's blues.
- **Mono:** black and white with light grey, and nothing with a hue: the
  band black and grey, Notion's nine colours folded into black (the grey
  stays grey), the code in greys, and every picture drawn in grey but
  Notion's badge, which is left as Notion made it, and the goods for sale.
  The contrast test fails
  on any colour in mono's block whose red, green and blue differ.
- **Rainbow:** loud. A cream page, a rainbow band between two ink lines,
  titles cut out of a rainbow (seven stops, each and every mix between them
  at 4.5:1, a title being large text, on every ground a title sits on,
  mixed in OKLCH where the browser can), deep pink buttons, violet accents, magenta eyebrows, yellow
  and pink panels, and cards outlined in ink with a hard pink shadow. The
  rainbow is never animated. A title that must stay one colour adds
  `title-solid` (the logo strip's names do).

**The goods for sale are shown as uploaded, in every look.** A product's
pictures (on the shelf, on its page and in its details, and in the cart)
carry `data-goods`, and no look's tint or grey reaches them: a buyer must
see the colour of what they would buy. Every other picture follows the
look. The contrast test fails on any rule that changes a picture's colours
and does not pass the goods by.

To add a look: name it in `THEMES` (`lib/theme.ts`), give it a block of
tokens, an icon (`components/ui/theme-icons.tsx`), a swatch and a footer
name, and a code theme (`lib/highlight.ts`). `tests/theme.test.mjs` and
`tests/contrast.test.mjs` list whatever is missing.

**The header** is laid out as Notion lays out its own: the mark alone in
the middle (the way home), four links on its left, and on its right two
more (the blog and contact), the cart, the look's switch and "Get started",
so the row weighs the same either side. The name is not in the header: the
home page's hero opens with it, alone and centred, in the slab face; the
descriptor, smaller, is in the footer (Notion's rule, below). On a phone the
mark moves to the left and the links into a drawer opened from the right.

**One rhythm.** Every section is padded the same (64px on a phone, 96px
from a tablet up), and whatever follows a section's heading stands the
same gap below it (`.section-body`: 40px, then 56px). A group in a page of
groups, such as a category of questions, keeps its heading closer
(`.group-body`, 24px). The tests hold every page to it.

**A section reads one way.** Under a centred heading, short columns are
centred too, and figures on a panel are a centred band with no box: a card
the colour of its ground vanishes and leaves its padding as an indent.

**The band.** A dark line, a light band and a dark line, as round a tin. It
runs under the header, above the footer, and round the packs (the cookie
question is one: a bag of cookies, `.cookie-bag`) and the miniature of the
site on `/features`, and nowhere else: on a card
or a section it is one band too many. It's decoration,
hidden from screen readers.

**Covers are printed in the look's ink.** A post's, a page's or a
resource's cover is drawn in the look's one ink (`--c-tone`): the label's
blue in light, the deep green in dark (so a white picture is pale mint, not
a glaring slab), grey in mono, the accent in rainbow. The
photograph keeps its own light and dark (CSS's `luminosity` blend over the
ink, `.cover-tint` in `app/globals.css`); the file is untouched, and with the
system's colours the photograph shows as it is. One cover is shown in its
own colours by setting its row's **Cover Tint** to Off (`data-untinted`:
no look's tint or glow reaches it, though mono still draws it in grey).
To show every cover in its own colours, delete the two `.cover-tint`
rules. Portraits keep their colours, and the goods for sale are never
tinted ([notion](notion.md#covers)).

**The packs.** The pictures are generic packs drawn in three dimensions (a
box, a can, a gable-top carton, a cup, a bag), lit from the top left, with
the lowercase word and the band round them. One set of drawings
(`components/illustrations/packs.tsx`) makes the still life on `/features`,
the pack on `/about`, and the starter content's pictures
(`npm run demo-images`), so they all match. Every picture is drawn at twice
the size it is shown, and `npm run sharpness` holds every page to it.

They follow a few rules of their own, worked out in
`components/illustrations/geometry.ts` and held by `tests/packs.test.mjs`
and `tests/dom/packs.test.tsx`:

- **Matte, like the cereal box.** Card and paper don't shine: the faces
  turned from the light are shaded and nothing is lit up white, since a
  sheen washes out the words under it.
- **Words wrap round a round pack.** On a can or a cup the words curve
  exactly as the bands do, lower in the middle as seen from a little above,
  narrowing towards the edges. The words are still text (drawn once and
  shown slice by slice round the curve), so they stay sharp. A bag's face is
  near flat, so its words and band run straight.
- **One light.** Every shadow falls back and to the right of its pack.
- **A proper shelf.** On `/features` the packs stand evenly spaced on a
  shelf as deep as they are, and every shadow fades out on the shelf.
- **No shadow cut off.** Every picture is large enough for its packs and
  every shadow.

**The icons.** The site's icons are Phosphor's fill set (MIT,
`lib/icons.ts`), in the colour of the words round them, never an emoji, whose look changes with
the reader's device and which can't take the theme's colours. A page or
callout given one of Notion's own icons in Notion is drawn with the icon of
that name here; one the site has no drawing of is shown as Notion draws it,
through `/media/`.

**Tool marks.** The "goes well with" strip shows the marks of tools the site
really works with (Vercel, Next.js, Shopify, Mailchimp, Brevo, PostHog,
Resend, GitHub), in one colour: black on light, white on dark. The paths
are Simple Icons' (CC0, `lib/brand-marks.ts`); the marks are their owners'
trademarks, used only to say the site works with each, unaltered, and never
under words that claim more ("trusted by"). Notion's logo is not among them
(see below), and a tool the site does not work with has no place there.

**Reviews.** The homepage's reviews are Review rows. The starter content's
four are invented, so they are tagged Example, in the starter content and
in Notion, and show under the words "example reviews". An example never
stands beside a real review or counts in its average: publish one real
review and the examples give way. Nothing marks reviews up for
search engines: a site's own reviews of itself earn nothing there, and an
invented one must never pass for a real one.

**The faces.** All four are self-hosted (see
[privacy](privacy-and-security.md)):

| Face | What for |
|---|---|
| Roboto Slab | Titles |
| Inter | Everything else |
| Source Serif 4 | Notion's Serif page style |
| IBM Plex Mono | Notion's Mono page style |

Each face ships in a Latin file and a Latin Extended file, and a browser
fetches the second only for a page that needs it.

**The mark.** A rounded square with a dark rim, a light ground and a slab
"r". `npm run icons` draws it, and every icon from it, from the font's own
outline. It shares nothing with Notion's logo. A copy gives its own logo and
icon in Notion (`site.logo`, `site.logo.dark`, `site.icon`: docs/notion.md,
"The logo and the icon"), and the mark and its icons stand down.

**The template's credit.** The copyright in every copy's footer: "© (the year)
REPO THEM a GitHub template by Denot", GitHub a plain link to the template's
repository (`REPO_URL`) and Denot (`MAKER.studio`) one to the maker's site
(`MAKER.url`), with the maker's name on hover. A copy renamed in Notion
keeps its own name first: "© (the year) Acme. Built on REPO THEM a GitHub template
by Denot". The same words are every page's `generator` meta tag. Like
Notion's attribution, it is printed outside any slot, so a copy's owner
can't blank it from Notion. The code is MIT, so it can be taken out of the
code; README asks a copy to keep it. The maker's offers (the service
counter) are a slot, and turn off from Notion.

## Notion's brand rules

The template follows [Notion's brand usage
guidelines](https://notion.notion.site/Notion-s-brand-usage-guidelines-How-to-use-Notion-s-brand-in-your-marketing-689045e1761348f887a3c5c80295e00f).
`tests/brand.test.mjs` holds the code to them:

- **Notion's name is never the product's.** The product is REPO THEM. "A
  Notion-powered CMS" is the smaller descriptor beside it, never part of
  the name. That goes for the package and the repository name too.
- **The "Made for Notion" badge:**
  - It's Notion's own file, unaltered: the test checks each file's
    fingerprint.
  - It appears once, in the footer, in a secondary position.
  - It's 48 pixels tall, Notion's minimum on screen, never angled and never
    animated.
- **The attribution is printed:** "Notion and the Notion logo are trademarks
  of Notion Labs, Inc." with a statement that the template is independent.
  It sits outside any Notion slot, so it can't be blanked from the database.
- **No claim of a standing the template doesn't have.** Nothing says
  certified, partner, official, approved or endorsed. The independence
  statement's "not endorsed" is the one exception, and the test knows it.
- **No artwork from Notion's own site.** No screenshots, illustrations,
  icons or gallery covers. The pictures here are the template's own (the
  packs, drawn by `npm run demo-images`), and the illustrations are the
  site's own markup.

If you change the name, keep these rules: they apply to your site as much as
to the template.

## Making it yours

| To change | Edit | Then |
|---|---|---|
| The name, the descriptor and the noun on the label | Notion: the `site.name`, `site.descriptor` and `site.noun` slots. `lib/site.ts` holds the built-in ones, which the feed's link, the contact email's subject and the Brevo list's name still use | |
| The one-line description, the language | `lib/site.ts` | |
| The maker's offers (the service counter above the footer) | Publish the `service.title` slot blank to remove it from every page. The template's credit beside the copyright stays: it is not a slot, and README asks a copy to keep it |
| Your repository, for "Get it" and the star card | `REPO_URL` in `lib/site.ts` | |
| The colours | The tokens at the top of `app/globals.css`, one block per look | `npm test` (the contrast test says if a pairing drops below AAA) |
| The title face | `app/fonts.ts` and its files in `assets/fonts` | For the share cards, swap the `.woff` that `lib/og-card.tsx` reads |
| The mark | `scripts/build-icons.mjs` | `npm run icons` |
| The starter pictures | `scripts/build-demo-images.mjs` | `npm run demo-images` |
| Every word | Notion: Site Copy rows ([notion](notion.md)) | |

The words are the one thing never to change in code: a fork that rewrites a
slot's built-in wording in the components loses the ability to edit it in
Notion. Publish a Site Copy row instead.
