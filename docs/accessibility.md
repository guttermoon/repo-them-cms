# Accessibility

The site meets **WCAG 2.2 level AA**, the standard the European
Accessibility Act and EN 301 549 point to, and goes past it to level AAA
wherever a site can hold AAA for every reader: contrast, target size and
focus. Most of it is built in and checked by tests, so a change that breaks
it fails `npm test` rather than reaching a reader. The rest depends on what
you write in Notion, and this page says what that is.

### Which AAA criteria

WCAG doesn't ask any site to meet all of AAA (some of it, such as sign
language for every video, can't be met for all content), so AAA is claimed
criterion by criterion. These hold on every page, in every look:

| Criterion | What the site does |
|---|---|
| 1.4.6 Contrast (Enhanced) | Words at 7:1 on their ground, titles (large text) at 4.5:1 |
| 2.5.5 Target Size (Enhanced) | Everything pressed is 44 by 44 at least, a link in a sentence excepted |
| 2.4.13 Focus Appearance | A 3px ring in the accent, with a gap, at 3:1 on every ground |
| 2.3.3 Animation from Interactions | Nothing moves for a reader who asked for less motion (`tests/motion.test.mjs`) |
| 1.4.8 Visual Presentation, in part | The reader picks the colours (the four looks), lines are 80 characters at most at 1.5 line height, never justified, and reflow at 200%. The space between paragraphs is Notion's, not the 1.5 lines 1.4.8 asks, so 1.4.8 is not claimed in full |

What you write decides the rest of AAA: plain words (3.1.5), link text that
says where it goes on its own (2.4.9), and section headings (2.4.10).

## What is built in

### Seeing it

- **Contrast, at AAA.** Every pairing of text and background the design
  uses, in each of the four looks, is at least 7:1, and the titles, which
  are large text, at least 4.5:1. Focus rings are at least 3:1 on every
  ground a control sits on, and the edges of controls 3:1 too. Notion's
  nine text colours and backgrounds read at 7:1 in every look, and so does
  every colour the code highlighter prints, and every colour of rainbow's
  titles at 4.5:1, including the colours mixed between its stops.
  `tests/contrast.test.mjs` reads the colours from `app/globals.css` and
  does WCAG's arithmetic (`lib/contrast.ts` names the lines), so a colour
  change that drops below the line fails there. Words on a hero's picture
  sit on a veil dark enough for 7:1 over the lightest picture there is.
- **Reflow.** Every page works at 320 pixels wide with no sideways
  scrolling: the header folds into a menu, grids stack, and wide tables
  scroll inside their own labelled region. It also survives 200% zoom and
  custom text spacing.
- **Four looks, or the system's choice**, chosen by the reader and
  remembered: light, dark, mono (black and white with light grey, the
  pictures in grey) and rainbow. The header's switch moves through the four;
  the footer's radio buttons offer all five choices. Rainbow's titles are
  drawn as a gradient, which stands down in forced-colours mode so the
  system's colours show.

### Using it with a keyboard

- **Skip link:** "Skip to content" is the first thing the Tab key reaches.
- **Focus you can see:** a 3px ring in the accent, a gap of the ground
  between it and the control, on everything that takes focus (WCAG 2.4.13).
  One width for every control (`--focus-ring`); a select's options, which
  show focus by a fill, get the ring too, inside them.
- **Focus that isn't hidden:** the sticky header never covers what the
  keyboard moved to (WCAG 2.4.11).
- **The phone menu** is a named dialog that keeps focus inside it, closes
  with Escape, and closes itself on navigation.
- **The cookie question** gets focus on the question itself, never an
  answer, and Escape answers no, in each of its shapes (`cookies.shape`).
  The bag and the box are modal: they keep Tab inside while open and
  ignore a click on the dimmed page behind them. The banner is not: it
  dims nothing, Tab goes on from it to the page, and the page has room
  under it so the bar covers nothing for good.
- **Tabs, questions, selects:** the feature tabs follow the ARIA tabs
  pattern (arrow keys, Home and End). The questions are native
  `<details>`. The site's own select (the shop's sort, a product's
  options, the contact form's subject) works like a native one, typeahead
  included, and is named by its label and then what it shows.

### Targets

Everything pressed is at least 44 by 44 pixels (WCAG 2.5.5, level AAA):
buttons, links in a menu, a list or the footer, fields, tabs, the look's
switch, a question's summary, a toggle's. A link inside a sentence is the
one exception WCAG makes, and the site takes it. A card that is a link is
pressed anywhere on it. The size is one token, `min-h-target` and
`min-w-target` (`tailwind.config.ts`); `tests/targets.test.mjs` fails on a
size typed under it, and `npm run a11y` measures every control as drawn.

### Reading it

Running text sets at most 80 characters a line (`max-w-measure`), even on a
Notion page set full width, at 1.5 line height, and is never justified.

### Hearing it

| Where | What a screen reader gets |
|---|---|
| Every page | One `<h1>`, headings that go down one level at a time, landmarks (`header`, `nav`, `main`, `footer`) with names where there are several, and `lang` on `<html>` |
| Notion's headings | Drawn so the outline has no gaps, whichever heading the page started with |
| Every control | A name. Icon buttons have words. The cart's buttons name their line ("Remove: Corn flakes (Large)"), and the cart in the header says its count ("Cart, 3 items"). |
| Forms | A label on every field. Errors are announced (`role="alert"`) and tied to their field; success is announced (`role="status"`) and given focus. |
| The cart | A change is announced as it happens |
| Pictures | Every one has a description, or is marked as decoration |
| Decoration | Hidden: the stripes, the packaging, the illustrations' own text |

### Motion

- Nothing moves for a reader who asked for less motion
  (`prefers-reduced-motion`): no animation, and no transition of any
  length, so nothing on the page shifts by itself.
- One thing loops, the row of reviews that passes by, and it can be paused
  (WCAG 2.2.2): under the pointer, with its Pause box, and by moving the
  keyboard into it, which also stands it still so every card is reached
  ([design](design.md)). Everything else that moves, moves once.

## What is up to you, in Notion

- **Describe your pictures.** Notion's own alt text setting is not in its
  API, so the site can't read it. Write the description in the caption
  instead, on a line of its own that starts `Alt:`. That line is what a
  screen reader reads, and it isn't shown. A caption with no `Alt:` line is
  the picture's description, read once under it. A bare `Alt:` marks a
  picture as decoration. A picture with neither caption nor `Alt:` is
  skipped by screen readers, and `npm run notion:check` names it
  ([describing pictures](notion.md#describing-pictures)). A product's
  pictures are described in your shop ([commerce](commerce.md#one-catalogue-kept-in-your-shop)).
- **Write link text that says where it goes.** "The pricing page", not
  "here".
- **Use headings for structure, not for size.** The site fixes the levels,
  but it can't know a heading you meant as a big paragraph.
- **Videos:** captions come from YouTube or Vimeo. Turn them on there.
- **Colour alone shouldn't carry meaning.** Notion's coloured text reads
  well enough, but "the red ones are urgent" is invisible to some readers.

## How it is checked

`npm test` runs these checks on every page and every part of one, in jsdom:

- **Pages:** every page, with and without the starter content, has one
  `<h1>`, unique ids, headings in order, every picture described or marked
  as decoration, every control named, every internal link going to a page
  that exists, new tabs opened safely, and no placeholder text.
- **Frame and controls:** the header, menu, footer, cookie question,
  forms, cart and sections are each tested for their keyboard behaviour and
  names.
- **Contrast:** every colour pairing, in every look, at AAA.
- **Targets and rings:** no control sized under 44px, and every focus ring
  the one width.

Two audits need a running site and a browser (Playwright's Chromium, set up
in [development](development.md)):

```bash
npm run build && npm start
```

In another terminal:

```bash
npm run a11y
```

```bash
npm run responsive
```

- **`npm run a11y`** runs axe over every page with WCAG 2.0, 2.1 and 2.2
  A, AA and AAA rules, and measures in the page what axe doesn't
  (`scripts/aaa-checks.mjs`): every word's contrast against the colour
  really behind it (words on a drawing, such as the cookie bag or a picture,
  from the pixels, with the words hidden; while a dialog is open, only its
  own words), every control's size as drawn, the line height and line
  length of running text, and, Tab by Tab, the focus ring's width and
  contrast:
  - at 320, 768 and 1280 pixels;
  - in light, dark, mono and rainbow;
  - with the cookie question open, the phone menu open, a question opened
    and the tabs used.
- **`npm run responsive`** loads every page at 320, 375, 768, 1024 and 1440
  pixels. It fails on anything wider than the screen, cut-off text, or a
  target smaller than 44 pixels, and saves screenshots for a person to look
  at (at the narrowest and widest, in every look).

Both exit non-zero on a failure, so they can gate a deploy.

## Reporting a problem

If something on a site built with REPO THEM is hard to use, tell the site's
owner. If the problem is in the template itself, open an issue on its
repository.
