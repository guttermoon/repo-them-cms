# Development

Next.js 15 (app router), React 19, Tailwind 3 and TypeScript. Node 22.18 or
newer.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

The site runs with no settings at all: it shows the starter content from
its own files (`lib/demo/starter.ts`), every slot in the words written into
the code (once Notion is connected, a slot shows only its row's words),
and keeps itself out of search. To run the real path, the Notion client
reading over HTTP, without a Notion account, run the stand-in Notion:

```bash
npm run notion:fake
```

It serves the starter content on port 4010 and prints the settings to use.
In another terminal:

```bash
NOTION_API_BASE_URL=http://127.0.0.1:4010 NOTION_TOKEN=fake NOTION_DATABASE_ID=<the printed ID> npm run dev
```

The scripts that talk to an account read `.env.local` the way `next build`
does (through Next's own loader, `scripts/load-env.mjs`; `.env.development`
is not read). A value set in the shell wins.

## Where things are

| Folder | What is in it |
|---|---|
| `app/` | The routes: the designed pages, the Notion catch-all (`[...slug]`), the blog, the shop, and the route handlers (`api/`, `media/`, `go/`, `og/`, `ingest/`, `ga/`, `markdown/`, the feeds) |
| `components/layout/` | The frame round every page: header, footer, the mailing-list form, the cookie question, the analytics loaders |
| `components/sections/marketing/` | The section library ([sections](sections.md)) |
| `components/notion/` | Notion's blocks drawn (`blocks.tsx`), a Notion page or post (`entry-page.tsx`), the Landing layout (`landing.tsx`) |
| `components/commerce/` | The cart, the buying controls, the product grid and gallery |
| `components/system/`, `components/ui/` | The copy slot (`notion-text.tsx`), links, paragraphs, JSON-LD, the select, the drawer; buttons, labels, page frames, theme controls |
| `lib/notion/` | Talking to Notion: the client and its limiter, reading rows (`rows.ts`), block trees, the schema, the checker, setup |
| `lib/content/` | What the pages read: the store with its fallbacks, selection (live posts, plans, products…), media addresses and resizing, short links |
| `lib/commerce/` | The cart's rules, the shop's modes, the product importer |
| `lib/email/` | One adapter per email platform |
| `lib/` (the rest) | Site identity (`site.ts`), the map (`nav.ts`), page metadata (`page-meta.ts`, `seo.ts`), structured data, `/llms.txt`, analytics, pricing, plans |
| `lib/demo/` | The starter content, in the shapes Notion's API takes and returns, and the stand-in Notion |
| `scripts/` | The commands in `package.json` |
| `tests/` | Below |

## Pictures from Notion

An editor uploads a 4000-pixel photograph and the site shows it 56 pixels
wide. So no `<img>` carries a bare media address:

```tsx
<img {...picture(mediaUrl(post.cover, "cover"), "(min-width: 1024px) 50vw, 100vw")} alt="" />
<img {...picture(mediaUrl(author.image, "author"), 112)} alt={author.name} />
```

`picture()` (`lib/media-sizes.ts`) takes the width the picture is shown at:
a number for a fixed size in CSS pixels, or a `sizes` value for one that
follows the page. It returns `src`, `srcSet`, `sizes`, `loading` and
`decoding`. The browser then asks `/media/…?w=<width>` for as many pixels as
its screen needs, twice as many on a retina one, and the route answers with
WebP at that width, cached for a year like the original.

- A box that crops (`object-cover` in a square) is filled by the picture's
  shorter side, so ask for more than the box is wide: twice for an avatar,
  half as much again in `sizes`.
- `{ eager: true }` is for the one picture a page opens on. Every other
  loads as it nears the screen.
- An SVG, a GIF and anything that moves are sent as they were uploaded. So
  are the starter's own pictures in `public/demo`, which are already the
  size they're shown.
- Notion is asked for a file's address once per page or block, not once per
  picture: a product's cover and gallery share one request.

`npm run sharpness` still holds every page to twice its pixels.

## Tests

| Command | What it runs |
|---|---|
| `npm test` | Everything below |
| `npm run check` | Lint, types and tests together |
| `npm run typecheck` | TypeScript on its own |
| `npm run lint` | ESLint on its own |

Neither the type checker nor ESLint is switched off for builds: an error in
either fails `npm run build`.

**`tests/*.test.mjs`: Node's own test runner.** `tests/register-ts.mjs` lets
it load TypeScript and stands in for Next's modules (`next/cache` records
what was revalidated; `server-only` is nothing). These tests cover:

- the routes, called as Next calls them (a Request in, a Response out);
- the media route: what it may fetch (`outbound.test.mjs`), how a picture
  is resized (`media-resize.test.mjs`), and which headers a proxy passes
  (`proxy.test.mjs`);
- the email adapters, against stand-in APIs;
- the Notion reader, against real-shaped rows;
- the importer, against stand-in Shopify, Printify and Notion;
- contrast, the brand rules, the secrets scan, `.env.example`, and the
  generated docs;
- what `npm run sharpness` calls blurred, against planted cases in a real
  browser (`sharpness-inspect.test.mjs`), skipped where Playwright is not
  installed.

The tests that read the code itself (every word a slot, the icons, the type
scale, the shapes, the motion, the third parties) list its files with
`tests/support/sources.mjs`.

**`tests/dom/`: Vitest in jsdom, with Testing Library.**
- `pages.test.tsx` renders every page three times: with no Notion (the
  starter content from the site's own files), with the starter content read
  from the stand-in Notion over HTTP, and with a connected database that
  holds nothing yet (every empty state). It holds each to the rules in
  `tests/dom/support/checks.ts`.
- Other files test the frame, the sections, the shop, the forms and the
  block renderer.
- `tests/support/setup-dom.ts` gives jsdom what it lacks. It also fails any
  test during which React warned (a warning in development is a hydration
  error in production).
- `tests/dom/support/mocks.tsx` holds the stand-ins a page test hands to
  `vi.mock`: the code block unhighlighted (React renders an async component
  only on a server), and Notion's SDK allowed to run in jsdom's "browser".

A test is only as good as its failure: check a new one by breaking the code
it covers and watching it fail.

## The audits

These need a running site and a browser, and are deliberately not
dependencies. Install them when you want them:

```bash
npm i --no-save playwright @axe-core/playwright
```

```bash
npx playwright install chromium
```

Then build and serve the site:

```bash
npm run build && npm start
```

In another terminal, run any of the audits:

```bash
npm run a11y
```

```bash
npm run responsive
```

```bash
npm run privacy
```

```bash
npm run sharpness
```

| Audit | What it checks |
|---|---|
| `npm run a11y` | axe's WCAG 2.2 AA rules on every page ([accessibility](accessibility.md)) |
| `npm run responsive` | Overflow, clipped text and target sizes at five widths, with screenshots ([accessibility](accessibility.md)) |
| `npm run privacy` | That no request leaves the site ([privacy and security](privacy-and-security.md)) |
| `npm run sharpness` | On a retina screen, that no picture is drawn larger than its pixels and no text sits under a blur or between pixels |

Each takes extra paths after the address, such as
`npm run a11y -- http://localhost:3000 /about /blog/hello`. Point them at
the stand-in Notion to check the pages written in Notion too.

## Making changes

**A new designed page:**
1. Add it under `app/`.
2. Give it an entry in `lib/page-meta.ts` and a line in `lib/nav.ts`.
3. Read its metadata in `generateMetadata` with
   `pageMetaFor("/its-path", (await getSiteData()).copy)`.
4. Render `pageLd("/its-path", data.copy)`.

`npm test` fails until all of these are done. Its share card, sitemap entry
and `/llms.txt` line follow by themselves. Add its first segment to `RESERVED_SEGMENTS` in `lib/notion/schema.ts`, so
a Notion page cannot take the address; `npm test` fails until it is there.

**A new text slot:** wrap the words in `<T k="area.name">…</T>`, or read an
attribute with `plainText(content, "area.name", "…")`. Then run:

```bash
npm run copy
```

```bash
npm run notion:seed-copy
```

Then tick the new row in Notion: on a connected site a slot with no
ticked row shows nothing. `npm test` fails until `copy-keys.json` is
regenerated, and `npm run notion:check` names the slots with no row and the
rows a renamed or removed slot leaves behind.

**Content that is rows stays rows.** A section that lists rows (plans,
questions, quotations, products, posts) draws the rows alone. With none it
is left out, or says so in an `<area>.empty` slot; it never stands built-in
examples worded by slots in for them, which would put the same words in the
database twice, the copy in the text rows doing nothing. The starter's
examples are rows (`lib/demo/`). The word test fails on a slot only an
empty database reaches that is not an `.empty`.

**Words from a row** are printed with `<LinkedText text={…} />`, which draws
Notion's links, line breaks and formatting; where a string is needed, read
them with `inlineWords()` (`lib/inline-text.ts`). A test renders every page
with every row formatted and fails if the formatting's insides reach a
reader.

**A new Notion property:**
1. Add it to `PROPS` and `SCHEMA` in `lib/notion/schema.ts`.
2. Read it in `lib/notion/rows.ts`.
3. Add it to the stand-in Notion's shapes in `lib/demo/notion-shape.ts`.
4. Run `npm run docs` to rewrite the property table in
   [notion](notion.md).

`notion:setup` and `notion:check` pick it up from the schema.

**A new email platform:** an adapter in `lib/email/providers/`, listed in
`lib/email/index.ts`, with its requests pinned in
`tests/email-providers.test.mjs`.

**A new setting:** read it in code, add it to `.env.example` with a
placeholder, and describe it in the docs. `tests/env-example.test.mjs` fails
if the list and the code disagree.

**Comments say what the rule is and why.** How it came about belongs in git
history.

## Before you commit

- **`lib/snapshot.json` and `lib/snapshot-bodies.json` are committed
  empty.** A build with Notion connected fills them with your content
  ([during a build](notion.md#during-a-build)). Commit them filled only if
  you mean to publish that content in your repository.
- **Run `npm run check`.** CI runs the same checks, then a build with no
  settings, on every push to main and every pull request
  (`.github/workflows/ci.yml`).
- **Never commit a real setting.** `.env.local` is ignored by git, and the
  secrets scan fails on anything shaped like a token.
