# Design: order, motion, agents, shape and screens

How the homepage is ordered, what is allowed to move and why, what the site
gives a program reading it for somebody, the shape of everything on it, and
how it holds together on any screen. The colours, lettering and pictures are in [brand](brand.md); what
WCAG asks is in [accessibility](accessibility.md); the sections themselves
are in [sections](sections.md).

## The homepage's order

A stranger asks the same questions in the same order, and the page answers
them in it (`app/page.tsx`):

| The question | The section |
|---|---|
| What is this? | The hero: one promise, two ways in, and a picture under it if `home.hero.image` has one (`.on-picture`: a veil as dark in every look, the words and buttons light on it) |
| What is the deal? | The statement: one word the width of the window, and under it three promises as cards on a checkout belt, with the pitch in small print below. Type and colour only |
| Why is it like this? | Why generic, and the tools it goes well with |
| Who says so? | A quotation, straight under the tools |
| Is there a catch? | The small print, in large print: the nutrition label on the side of the pack |
| What does it cost? | The plans |
| What can I get today? | The shelf, what people say about it (the reviews), then the three newest posts |
| What is this site, really? | The live-demo band, the maker's plain facts, the last call to action |

The quotation stands straight under the tools the site goes well with, so a
word from somebody else answers "why" before the price is asked. The shelf
stands near the foot of the page, with the reviews straight after it and the
blog after them: a reader meets the seller before the goods.
`tests/dom/shelf.test.tsx` holds the order.

## Type

Ten sizes, each for a kind of words, and four that grow with the window for
the titles that lead a page. They are classes from `tailwind.config.ts`; no
size is typed into markup (`tests/type-scale.test.mjs`).

| Class | Size | For |
|---|---|---|
| `text-micro` | 11px | Labels in capitals, the small print |
| `text-fine` | 13px | Captions, footnotes, tags |
| `text-small` | 14px | Secondary lines, form labels |
| `text-ui` | 15px | Buttons, the menus, a card's words |
| `text-body` | 16px | A paragraph |
| `text-lead` | 18px | A lede, an eyebrow |
| `text-head-s` | 22px | A card's title |
| `text-head-m` | 28px | A small section's title |
| `text-head-l` | 36px | A section's title |
| `text-display` | 56px | A page's title where it does not grow |
| `text-fluid-section` | 28 to 42px | A section's title that grows |
| `text-fluid-title` | 36 to 64px | A page's or a large section's title |
| `text-fluid-hero` | 44 to 88px | A hero's title |
| `text-fluid-giant` | 56 to 148px | The 404's one word |

A lede, the sentence under a title, is set in the words' colour (`text-ink`),
never the secondary grey: the title leads by its size and its face, and the
sentence that explains it reads as plainly as the rest of the page.
`tests/ledes.test.mjs` holds this.

A size sets no leading; the words' own class does (`title-slab`,
`title-display`, `leading-relaxed`). A breakpoint changes a size only to a
different step. The headings inside a page written in Notion keep Notion's
own sizes (`.n-h1` and its kin in `app/globals.css`), which are relative to
the page's text.

## Motion

Motion is used to say something, never to decorate. The site borrows its
movements from the shop it pretends to be (a checkout belt, a scanner, a
shelf, a till receipt) without drawing any of them. In a page's own content
these move, and each has a job:

| What moves | When | The job it does |
|---|---|---|
| A hero sets itself: eyebrow, title, lede, buttons (`settle`) | Once, as the page opens | Puts the eye on the title first and the buttons last |
| The homepage title's words land one after another (`KineticWords`) | Once, as the page opens | Slows the reader down on the one line that matters most |
| A hero steps back: smaller and fainter (`leave`, on `settle`) | As the page leaves it | What comes next comes over it, instead of beside it |
| A section's head comes in from the left line by line, the title from further than its label and the lede from further still (`arrive`, in `SectionHead`, `SplitFeature`, `FinalCta` and `Quote`) | As it comes up the window, over a set length of scroll | Marks where a section starts |
| A row of cards starts a little toward its middle, turned a few degrees, and steps out to its places: a fifth of a card's width at most, never across its neighbour. A card alone in its row steps in from the left (`arrive-each`) | As the row comes up the window | Deals a row out where the reader can see it happen |
| What only needs noticing goes from unseen to seen where it stands, and does not move: the logos (`appear-each`), the live-demo band, the service counter, the contact form (`appear`), and whatever follows a section's head that is not a grid of cards (every `section-body` and `group-body`, without asking) | As it comes up the window | Says "here", and nothing more |
| A panel's ground grows from a rounded card to the window's full width, behind words that stay put (`open`, on a `MarketingSection` with `tone="panel"`) | As it comes into the window | A change of ground is an arrival, not a line across the page |
| The side of a pack turns in depth to face the reader, square by the middle of the window (`depth`: the nutrition labels, and the picture beside a feature's words). The one thing that turns | For as long as it is in the window | The label is on the side of the pack, and the pack turns to show it |
| The homepage's statement: the giant word slides sideways; the three promise cards ride a belt in from the right, are lit for as long as the scanner's line is on them, and ride on off the left of the window | For as long as it is in the window, at the pace of the scroll | Each promise is looked at once, on its own, as it is scanned |
| The scanner's line crosses the buying form, with a tap where the phone can give one (`scan-line` in `AddToCart`) | Once, when a thing is added to the cart | Says the add was taken, where the reader is looking |
| A product's frame takes the accent and its picture eases in (`shelf-pull`) | Under the pointer or the keyboard's focus | Shows which card will open |
| The cart's total prints like a till receipt, torn along its foot (`receipt`) | Once, when the cart opens | Draws the eye to the total and the way to pay |

### How the site answers the hand

One set of movements for every page, each a class in `app/globals.css`. A
component puts the class on what it draws; it does not write a transition
of its own. The timings are tokens, so the whole site moves at one pace:
quick to answer (`--t-in`, 160ms), slower to let go (`--t-out`, 320ms), on
a curve that starts fast and settles without overshoot (`--ease`).
`--spring` is kept for a thing with weight, a pack picked up.

Nothing is lifted on a blurred shadow. A card is told from its ground by a
hairline, and under the pointer by light.

| Class | What it does | Where it is |
|---|---|---|
| `press` | A ring of the accent's light round a button under the pointer; it gives a hair when pressed, and does not move | Every button and button-shaped link (`buttonClass`) |
| `tone` | A control's colours answer the pointer: quick in, slower out | Menu links, tabs, chips, the look's switch, the logos |
| `turn` | A small mark turns or slides | A question's plus, the select's arrow, the arrow after "see more" |
| `lit` | A card's hairline takes the accent, a soft light on its face follows the pointer, it leans a degree or two toward it, and its picture eases in inside a fixed frame; the cards beside it step back. With the keyboard, the hairline and the light. No shadow, no jump (`PointerLight` tells the card where the pointer is) | Post cards, plan cards, people, the bento, reviews |
| `shelf-pull` | A product's picture frame takes the accent and the picture eases in; its neighbours step back | The shop's grid |
| `arrive-each` | A row of cards steps out from its middle to its places as the grid is scrolled to; a card alone in its row steps in from the left. It reads the grid's own column classes (`grid-cols-2` to `-4`, plain or at `sm:`, `md:`, `lg:`) | Posts, plans, products, people, feature columns, the bento, figures, the deploy steps |
| `marquee` | A row passes by on a loop | The reviews, with three or more |
| `pack-hit` | A pack on a shelf rises under the pointer, dips when pressed, and pressing it jumps to its column, where it stays picked up | The still life on `/features` |
| `jump-target` | The place a link on the page jumped to flashes, and stays marked | The columns under the still life |
| (no class) | An answer unfolds when its question is opened; a jump within a page is a glide | Every `<details>`; every in-page link |

**The loop.** The reviews are the one thing that moves without end. It
stops under the pointer, it stops for the Pause box in its section's head,
and the moment the keyboard is inside it the row stands still as a grid, so
every card can be reached and read. Its second run of cards is scenery:
hidden from a screen reader and out of the Tab order. With fewer than three
reviews, or with reduced motion, it is the grid it always was.

**The packs.** Pressing a pack is a link for the pointer; the picture is
still one image to a screen reader, and the same four ways in are ordinary
links in the columns under it.

The rules, held by `tests/motion.test.mjs`:

- **Purpose over flash.** Paragraphs do not animate. A new movement needs a
  job in one of the tables above.
- **Nothing moves for a reader who asked for less.** Every animation is
  inside `prefers-reduced-motion: no-preference`.
- **Once, except the one loop, which can be stopped** (above).
- **Scroll-driven motion is CSS alone** (`animation-timeline: view()`), so
  the server and the browser draw the same markup and there is no script to
  wait for. A browser that cannot do it shows the page still.
- **Nothing is hidden until it is reached.** A scroll-driven animation has
  no backwards fill: before a thing starts to enter the window it is drawn
  as it will end. A printed page, a full-page capture and an agent that
  reads without scrolling get every word.
- **Nothing jumps as it begins.** Without a backwards fill a thing takes its
  first keyframe the moment its range begins, so a movement with a first
  keyframe begins out of sight (as the thing meets the window's foot), and
  one that begins in sight has no first keyframe: it starts from how the
  thing already stands.
- **A movement has a job, and is no larger than the job.** A head slides
  because a section starts; cards step out because a row is dealt; the
  label turns because it is on the side of the pack. Everything else only
  clears. A thing does not move because it can.
- **Side to side, or simply clearing.** The site's movement echoes its
  checkout belt: a thing comes in from the left or the right, spreads
  across, or goes from unseen to seen where it stands.
  Nothing that follows the scroll comes up, down or on a diagonal.
- **What follows the scroll only moves, grows, turns and clears.** It
  changes `translate`, `scale`, `rotate` and `opacity`, which the browser
  moves without drawing the page again; never a blur or a clip, which
  redraw every frame and set words out of focus. A turn in depth (a `transform`) is kept
  for the side of a pack (`depth`) and a few degrees on a card. A panel's
  ground, a flat colour, may square its corners.
- **It takes a set length of scroll, eased** (`--scrub`), not a share of the
  thing's own height, so a short heading and a tall card move alike.
- **Every movement has a name of its own.** A second `@keyframes` of a name
  replaces the first without a word, and both things move wrongly.
- **Rainbow's title arrives whole.** Its words are cut out of one gradient,
  which a word moving on its own would fall out of.

## Agents and AI

More and more readers arrive as a program acting for a person: an assistant
summarising the page, an agent comparing plans or filling a cart. The site
is built to be read that way:

- **The words are in the HTML.** Every page is rendered on the server, and
  nothing waits for a script or a scroll to appear (see Motion).
- **A plain-text edition.** `/llms.txt` and `/llms-full.txt` give the
  site's pages, plans, products and questions as text ([SEO](seo.md)).
- **Structured data.** Every page says what it is in JSON-LD; the example
  shop carries no offers, so an agent cannot buy fictional goods
  ([commerce](commerce.md)).
- **Real controls with real names.** Links are links, buttons are buttons,
  every field has a label, so an agent operates the page as a screen reader
  does.
- **Nothing is sent without saying so.** A form that is an example says it
  is before anything is typed, and analytics waits for a yes.

### AI states

The template ships no assistant of its own. A copy that adds one (a chat, a
generated summary, an agent that acts) shows each of these states, worded
by slots like any other text:

| State | Required when | What the reader must see |
|---|---|---|
| Disclosure | Anything on the page was written or done by a model | That it was, beside the thing itself, before they rely on it |
| Idle | The assistant is offered | What it can do and what it will be sent |
| Working | A request has gone and nothing has come back | That it is working, announced once (`role="status"`), with a way to stop |
| Streaming | An answer is arriving in pieces | The pieces in place as they come, without the page jumping; no announcement per word |
| Done | The answer is whole | Where it came from: the pages or rows it read, as links |
| Unsure | The model could not ground an answer | That it does not know, and where a person can be asked |
| Failed | The request did not complete | What happened and what to do next, with what was typed kept |
| Confirm | The assistant is about to do something on the reader's behalf (send, buy, delete) | Exactly what will happen, and a yes that is never the default; Escape answers no |

Motion in these states follows the rules above: a working mark does not
loop for a reader who asked for less motion.

## Shape

Every corner on the site says what the thing is. There are five, and
nothing between them: Tailwind's own sizes are switched off
(`tailwind.config.ts`), the sizes are `--r-*` in `app/globals.css`, and
`tests/shapes.test.mjs` fails on any `rounded-[…]` or typed radius.

| Corner | Class | Size | For |
|---|---|---|---|
| Pill | `rounded-full` | the ends are round | a thing you press or type in that hugs its words: buttons, fields, the select, chips, tags, the look's switch, icon buttons (a circle is a pill as tall as it is wide) |
| Text | `rounded-text` | 4px | a mark on words: inline code, a highlight, a checkbox, a link round a logo |
| Block | `rounded-block` | 10px | a row in a column, or a small thing inside a card: a menu's option, a drawer's link, a thumbnail, a swatch, a Notion block in a page (a callout, code, a bookmark, a picture) |
| Card | `rounded-card` | 16px | a thing standing on its own in a grid or a list: a card, a product's picture, a notice, the select's menu, a feature tab |
| Panel | `rounded-panel` | 24px | a ground the width of a section, and what covers the page: a section's panel, the mailing list, a dialog, a product's large picture |

The rules that pick one:

1. **Pressed or typed in, and hugging its words: a pill.** Every button,
   every field, the select, the chips and tags. A row that spans its
   column (a menu's option, a drawer's link, a toggle's line) is a block,
   and a control that holds lines or a picture (a feature tab, a
   thumbnail, a card's link) keeps the corner of its size. `checkShapes`
   (`tests/dom/support/checks.ts`) holds every page to this.
2. **A thing that holds things takes the corner of its size:** block,
   card or panel, growing with it.
3. **Inside another, the outer corner less the gap.** The select's menu is
   a card with 6px of padding, so its options are blocks (16 − 6 = 10):
   the curves stay parallel. The test holds the scale to it.
4. **A box stays a box.** A checkbox is square (round means one of a set),
   and the drawings of real things keep their own: the packs, the cookie
   bag, the receipt's torn edge, the nutrition panel's rule.

A mix of pills and rounded rectangles is the point, not a compromise: the
shape tells a reader at a glance what can be pressed. What makes it
harmonious is that each kind of thing has one shape everywhere, and the
corners nest.

### Size and focus

Anything pressed is 44 by 44 at least (`min-h-target`, `min-w-target`), so a
pill button is 44px tall and an icon button a 44px circle; a link inside a
sentence is the one thing smaller. A list of links (the footer's, a
drawer's) stands one 44px row a link. Whatever takes focus shows the one
ring: 3px in the accent (`--focus-ring`), with a 2px gap of the ground
between it and the thing, so it follows the thing's corner and reads on
any ground. A row inside a menu (a select's option) is ringed inside its
own edge, since there is no gap round it. Running text sets at most 80
characters a line (`max-w-measure`). The reasons, and the WCAG criteria,
are in [accessibility](accessibility.md).

### The field

Every place a reader types or chooses is one field (`.field` in
`app/globals.css`): a pill on the page's own ground, with a hairline edge
that darkens under the pointer, turns the accent when focused or open, and
red when the words are wrong. It brings no colour of its own, so it sits
on the page, a card or a panel alike. What the reader types is set in the
mono face, as a label is filled in; what the site offers to choose stays in
the site's words. A field's name sits over it, in line with the words
inside (16px in). A field too tall for a pill (a message) keeps a pill's
curve: the panel's corner. A row of fields ends in a pill button of the
same height.

The search, the mailing list, the contact form, the select, and the
quantity (one fewer, the number, one more, in one pill: `QuantityStepper`)
are all this field.

### The select

`SelectLine` (`components/system/select-line.tsx`) is the site's select,
and there is no native one (`checkShapes` fails on a `<select>`): the
list a native one opens is drawn by the operating system, which no CSS
reaches, so it never matched. Its button is the field; its menu is a card
that opens below, or above when the screen has no room below, and lines up
with the button's end when the select ends a row (the shop's sort). The
chosen option carries the accent's tick, and the one under the pointer or
the keys is washed. It keeps the whole keyboard of a native select:
arrows, Home, End, Enter, Space, Escape, Tab and typeahead.

## Screens

"Mobile" is several shapes, sometimes on one device: a folding phone is a
compact width on the outside and a regular one inside, and moves between
them with the page open.

- **No fixed widths.** Sizes are fluid (`clamp`, grids, `max-width`), and
  `npm run responsive` fails on any page that overflows from 320px up.
- **A part is laid out by its own width where that is what matters.** The
  belt is a container: a card's size, the space between two and the speed
  of the belt are all in hundredths of the belt's own width, so it is the
  same scene in a narrow window as in a wide one, with larger cards.
- **The system's safe areas are kept.** The page does not ask to draw under
  the notch or the hinge, so the browser keeps the words clear of them.
- **State survives a change of shape.** Nothing a reader has done lives in
  the layout: the cart and the look are stored, a search is in the address
  (`?q=`), and an open question is a `<details>`. Unfolding the phone is a
  resize, not a reload.
