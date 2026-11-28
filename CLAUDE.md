# REPO THEM: project guide

A website template whose content is written in Notion: copy, pages, posts,
plans, products, questions and quotations, all in one Notion database. It is
public and made to be forked, so everything here holds for any site built
from it.

This file holds the rules and the reason for each. The details are in
`docs/` (start with `docs/development.md`). When a rule turns out to be
wrong, correct it here in the same commit as the code.

## The commands that matter

    npm run check        lint, types, and every test (node, then vitest)
    npm run dev          the site; with no settings it shows the starter content
    npm run notion:fake  a stand-in Notion with the starter content
    npm run copy         every text slot, rendered, into copy-keys.json
    npm run docs         rewrite the generated parts of docs/

A type error or a lint error fails the build; neither check is switched off
in `next.config.mjs`.

## Rules, and why

### A copy starts as a generic site, not a page about the template

- **The rule:** every page is the generic SaaS-and-shop website a copy
  starts as, in the house voice (plain labels, the ingredients on the side).
  Only `/features` describes the template: how it works, deploy on Vercel in
  five steps (`#deploy`), the maker's services in full (`#services`, under
  the service counter there) and the template's questions (Category
  Template); its full list of ingredients is a page under it,
  `/resources/ingredients`, listed among the resources, and `/features`
  shows that list's groups and the way to it. Elsewhere the site calls itself a live demo, in the home page's
  band and the service counter; the home page shows the maker's plain facts
  under that band, `/features` tells two of the services (setup and care)
  above "one database", and `/pricing` shows the maker's promises; and the
  "goes well with" strip names the tools it works with.
  - **Why:** whoever duplicates the repository wants a typical website to
    rename, not one describing the repository they just copied.
- **The rule:** the footer's copyright carries the template's credit, "©
  (the year) REPO THEM a GitHub template by Denot" (GitHub linked to the
  template's repository, Denot to the maker's site); a copy renamed in
  Notion reads "© (the year) Acme. Built on REPO THEM a GitHub template by
  Denot". It is outside any slot, and is every page's `generator` meta tag. README asks a copy to keep
  it; nothing hides it from Notion.
  - **Why:** the credit is how the next person finds the template. MIT lets
    a copy remove it from the code, so it can only be asked for, but it
    should never be one unticked row away.
- **The rule:** `LICENSE` is MIT's text alone, under one copyright line that
  names the template as the footer does ("REPO THEM a GitHub template by
  Denot"). What MIT doesn't cover (the fonts, the icons, the tool marks,
  Notion's badge) is said under the README's "Credits and licence", and each
  font's licence sits beside it in `assets/fonts`.
  `tests/licence.test.mjs` holds this.
  - **Why:** GitHub names a repository's licence only when the file is a
    licence's own text. With a note under it, the repository showed no
    licence at all, and a template that doesn't show it is MIT is one a
    careful person doesn't fork.
- **The rule:** the repository's own page is whole. The README opens on
  the live demo (`DEMO_URL`), with a picture of it (light or dark, as
  GitHub's reader has it) that links there, and shows the four looks.
  CONTRIBUTING, CODE_OF_CONDUCT (the Contributor Covenant 2.1), SUPPORT
  and SECURITY sit beside it. The issue forms send security to the policy
  and paid help to the maker, the pull request form is the checklist, the
  Sponsor button (`.github/FUNDING.yml`) goes to the maker, and
  `package.json` names the repository and is never published. Each names
  `REPO_URL` and the maker's public address and no other. The pictures
  and the social preview are drawn from a running site at twice their size
  (`npm run readme-images`); GitHub takes the preview only as an upload.
  `tests/community.test.mjs` holds this (`docs/development.md`, "The
  repository's own page").
  - **Why:** a stranger decides whether to fork from the repository's page
    before reading a line of code, a report arrives in the shape the page
    asked for, and an issue form GitHub can't read is dropped from the
    chooser without a word.
- **The rule:** the service counter (`components/sections/service-counter.tsx`)
  sits above the footer on every page but `/features`, which places its own
  above the services in full (`ExceptOn` in the layout). Every one of the
  maker's offers goes to the maker: an email, or the maker's own site to see
  the work. Its share links open each platform's own composer with a post
  written for it (`service.share.<platform>.post`), never a share script.
  Publishing `service.title` blank removes it everywhere; `newsletter.title`
  blank removes the mailing list.
  - **Why:** the credit and the offer travel with every copy, and a copy's
    owner turns them off from Notion like any other words. A request meant
    for the maker must never land in a copy's own contact form.
- **The rule:** with no Notion connected, the site shows the starter content
  (`lib/demo/starter.ts`, read by the same `readRows` as Notion) from its own
  pictures in `public/demo`, and every page is noindex with robots shut.
  Once Notion is connected, the database alone decides what shows.
  - **Why:** a first deploy looks like a finished site; the same rows on
    every copy must never compete in search.
- **The rule:** content that is rows (plans, questions, quotations, products,
  posts, people, reviews) is rows only. With none, a section is left out or
  says so in an `<area>.empty` slot; built-in examples worded by slots never
  stand in for rows. The starter's examples are rows (`lib/demo/`).
  `tests/dom/every-word.test.tsx` fails on a slot only an empty database
  reaches that is not an `.empty`.
  - **Why:** examples worded by slots put the same words in the database
    twice, as rows and as text rows, and only the rows show: an editor
    changed "Enterprise" in the text row and nothing happened.
- **The rule:** a post filed under Category Releases is a release, and the
  changelog's alone (`isRelease`, `blogPosts` in `lib/content/select.ts`):
  the blog, its feed, its category and tag pages, the homepage's newest
  posts, the sitemap's categories and `/llms.txt`'s posts leave it out
  (`/llms.txt` names it under the changelog). Its page stays at
  `/blog/<slug>`, leads on to other releases and back to `/changelog`, and
  stands under the changelog in its breadcrumb; its category goes to the
  changelog, and a tag no blog post has is a plain tag, never a link to the
  404. `tests/dom/releases.test.tsx` holds this.
  - **Why:** a release in the blog reads as news to a reader who came for
    posts, and the same words listed in two places are listed twice.
- **The rule:** until an email platform is set (`listReady`, `contactReady`
  in `lib/email`), the mailing list and the contact form are marked as
  examples, send nothing anywhere, and say so in a dialog when pressed.
  - **Why:** a form that fails after somebody has typed into it is worse
    than one that says what it is.
- **The rule:** until analytics is set up (`ANALYTICS_ON`), the cookie
  question is an example: it says nothing is counted, loads nothing, and
  keeps its answer under its own key (`EXAMPLE_CONSENT_KEY` in
  `lib/consent.ts`). A copy leaves it out by publishing `cookies.example`
  blank (`asksCookies` in `lib/analytics-config.ts`).
  - **Why:** the demo shows the box before anybody has a key, and a yes
    to a question about nothing must never become a yes to counting once a
    key is added.
- **The rule:** the cookie question takes the shape its owner writes in the
  `cookies.shape` row: bag (the default, and whatever else is written),
  box or banner (`cookieShape`). Every shape has the same words, the same
  two answers and the same rules; the bag and the box are modal, the
  banner is not and leaves the page room under it.
  - **Why:** the bag is the template's character, but a copy's owner may
    want the question plain; a site that counts nothing before a yes has
    nothing to hold back, so the banner may leave the page usable.

- **The rule:** the Feedback button (`components/layout/feedback.tsx`) sends
  a reader's words to `/api/feedback`, which sends PostHog a `survey sent`
  for the "Site feedback" survey (`lib/feedback.ts`), found by that name.
  With a yes in the cookie notice it carries the visit, so the response
  ties to its recording; without one, nothing that follows the reader.
  Until PostHog is set up it is an example. Every build with
  `POSTHOG_PERSONAL_API_KEY` makes the survey and the flags when missing,
  and never changes or deletes one (`lib/posthog-setup.ts`). The agent's
  playbook is `.claude/skills/feedback-triage/SKILL.md`, run by
  `.github/workflows/feedback-loop.yml`: draft pull requests only
  (`docs/feedback.md`).
  - **Why:** feedback is a message the reader chose to send, so it needs no
    yes, and goes through this site so PostHog never sees their address;
    a copy gets the whole loop by adding keys, with no terminal.
- **The rule:** the feedback loop's agent works as if a stranger were at its
  keyboard. Its job's GitHub token reads, its PostHog key reads, and it
  pushes nothing: its branches and its pull requests' words leave as files.
  A second job with no agent and none of its keys opens them, once each
  branch passes `lib/feedback-pulls.ts` (new, from the run's commit, and
  clear of `.github/`, `.claude/`, `vercel.json` and the packages), and
  Vercel never builds a `feedback/*` branch (`vercel.json`).
  `tests/feedback-loop.test.mjs` holds this.
  - **Why:** anybody can send feedback, and PostHog's project key is
    public: a sentence in a response is all it takes to ask the agent for
    anything, so what a persuaded agent can reach is kept to what it needs.
- **The rule:** every feature flag the code reads is in `FLAGS`
  (`lib/flags.ts`) with a fallback, and is read with `useFlag`. PostHog is
  asked only after a yes; everybody else gets the fallback, so the fallback
  is the site's default. A change from an idea ships behind a flag with
  `fallback: false`; a fix for something broken does not.
  `tests/flags.test.mjs` holds the list to the code.
  - **Why:** asking PostHog names the reader's browser, so a flag must never
    decide anything for somebody who said no, and the server must draw what
    the first paint shows.

- **The rule:** a new site takes three steps and no terminal: duplicate the
  public Notion template (`NOTION_TEMPLATE_URL` in `lib/site.ts`), make an
  integration with Read content, and put the code on Vercel one of two
  ways, offered side by side: press Deploy (`DEPLOY_URL`, which copies the
  repository to the reader's GitHub and imports it, asking for
  `NOTION_TOKEN` and `NOTION_DATABASE_ID` and nothing else), or from GitHub
  by hand (`TEMPLATE_URL`, then Vercel's import, `VERCEL_IMPORT_URL`, with
  the same two settings). PostHog and the rest come after, each its own
  step. The template
  is a published copy of the demo's database, never the database itself.
  `NOTION_DATABASE_ID` takes the database's ID, its link, or the link of a
  page it sits on (`findDataSource`). The README, `/features#deploy` and
  the button share these addresses (`tests/deploy.test.mjs`).
  - **Why:** Vercel makes every setting the button names required, so an
    optional one there would stop a deploy; the demo's own database holds
    its drafts; and somebody who copies the page's link instead of the
    database's should still get a site.
- **The rule:** the guide to writing lives in Notion, never on a page: a
  database template for each kind but Site Copy (**New ▾**: it sets the
  Kind, starts unticked (a Section and a Menu ticked: unticked, they
  would take a section or a link away), and says in a grey box what each
  property does),
  and a description on every property. The setup can't make templates
  (Notion's API can't), so they are made in the template by hand
  (`docs/notion.md`, "Adding a row").
  - **Why:** a copy starts as a generic site, so a how-to can't be a post;
    an unticked template is never fetched, so the site can't show one.

- **The rule:** Published alone decides what shows. Status (Draft, In
  Review, Published) is the editors', never read by the site
  (`EDITOR_STATUS` in `lib/notion/schema.ts`): two automations made by hand
  keep it in step, the template's card views show it in place of the
  Published tickbox, and `notion:check` names a row whose Status disagrees
  (`checkStatusRows`). The setup makes neither (Notion's API can't).
  - **Why:** a tickbox on a card is one stray click from taking a page off
    the site, and a copy whose automations did not come across must still
    show exactly what is ticked.
- **The rule:** a post's author is a Person row, matched by name
  (`withAuthors` in `lib/notion/rows.ts`): the byline's picture (Image, the
  person's one, cut by Cover Position), job title (Description) and line
  (Author Bio, else Text) are that row's alone, shared with the team card.
  A post holds only the name; a guest is a Person row with Team Page Off,
  which keeps a person off `/team` and `/about` and on their bylines, and a
  name with no row is printed alone. Author Image and Author Photo Credit
  are retired (`RETIRED_PROPS` in `lib/notion/schema.ts`): `notion:check`
  names the old columns and whatever is still in them. Notion's row layout
  groups the properties under the kinds that use them, since it can't hide
  one per kind, and `notion:check` names a field written where nothing
  reads it.
  - **Why:** a portrait and a bio typed on every post drift apart, and an
    editor who changes one expects every byline and the team card to follow.

- **The rule:** a title takes no full stop: not at its end, and not between
  two halves of it ("pick a plan, change it any time"). A question keeps its
  question mark, and the sentences under a title keep theirs.
  `checkTitles` (`tests/dom/support/checks.ts`) holds every heading, the
  title face, anything with a `-title` id and every page's browser title to
  it.
  - **Why:** a title is a label, not a sentence, and the house voice is
    plain labels. A full stop there reads as a sentence that got too big.

### Every word is a Notion slot

- **The rule:** reader-facing text is `<T k="area.name">built-in wording</T>`
  (`components/system/notion-text.tsx`). An attribute (an aria-label, a
  placeholder, an `<option>`) is `plainText(content, "area.name", "…")`.
  Never a bare string in JSX that a reader sees or hears.
  - **Why:** the promise of the template is that the site's owner edits
    every word in Notion. A hard-coded string is a word they can't change.
- **The rule:** the site's own name, its descriptor and the noun on its
  label are slots (`site.name`, `site.descriptor`, `site.noun`, read with
  `siteName()` and its kin in `lib/slots.ts`). The template's credit (the
  footer's independence statement, the template's questions) keeps
  `TEMPLATE_NAME`.
  - **Why:** the name is the first word a copy's owner changes, and the
    credit is the one they must not.
- **The rule:** a slot has three states:
  - a ticked (Published) row with text: the text;
  - an unticked row, or a ticked one left blank: hidden;
  - no row at all: hidden too, once Notion is connected. The store marks
    the copy it reads from Notion (`FROM_NOTION`, `notionCopy` in
    `lib/slots.ts`); only the starter site, unmarked, shows the built-in
    wording. `ROWLESS_SLOTS` never get a row.

  So the store reads every text slot's row, ticked or not;
  `notion:seed-copy` adds the missing rows unticked (`--ticked` to show
  them), `notion:setup` writes the starter's ticked, and `notion:check`
  names every slot with no row. `plainText` falls back instead of hiding.
  - **Why:** Published means shown, for a sentence as for a page, so an
    editor takes words away by unticking them, and no word reaches a site
    its owner has not seen in Notion: a slot added by an update of the code
    would otherwise appear on a live site unread. A blank `<option>` or
    `aria-label` is a broken control, not an editorial choice.
- **The rule:** a word a reader sees or hears is never typed into markup,
  a prop's default, a data table or a page's metadata.
  `tests/every-word.test.mjs` reads the code for it, and
  `tests/dom/every-word.test.tsx` renders every page with every slot and
  every word of the content marked, then every slot blank.
  - **Why:** reading finds a typed word; only rendering finds one built by a
    helper or kept in a table.
- **The rule:** a slot that is a control's whole name (a field's label, a
  tab, a submit button) uses `plainText`. An empty link, button or heading
  is hidden by `app/globals.css`. Words a reader sees that are not a
  control's name but must be a string (a picture's words, a figure, a
  label beside a value, what structured data says) use `slotText`, which
  shows nothing without a row on a connected site, as `<T>` does.
  `tests/dom/pages.test.tsx` renders pages from a database with no wording
  and finds none of the code's words.
  - **Why:** a blank row should take a control away, never leave one with
    no name.
- **The rule:** Notion's formatting comes through: bold, italic, underline,
  strikethrough and code, in a slot and in a row's own words (a quotation,
  an answer, a description, a bio), drawn as a page's blocks draw them.
  Notion's colours (text and highlight) come through in a page's or a
  post's body only; a slot and a row's words take the site's colours.
  Formatted words travel as Notion's runs after a private-use mark
  (`lib/inline-text.ts`); `<T>` and `LinkedText` draw them, and anything
  that needs a string reads `inlineWords()` (metadata, structured data, the
  feed, search). Titles are plain.
  - **Why:** an editor who bolds a word in Notion expects it bold on the
    site. A body is laid out by its writer, colours and all, but the web
    copy is set in the site's design, and a colour typed in Notion would be
    the same in every look and fight it. Plain words keep their old form,
    so nothing unformatted changed, and a test renders every page with every
    row formatted and finds the mark nowhere.
- **The rule:** `plainText` keeps a link in a row as its words, and a slot
  that is the words of a link the code draws is `<T k="…" words>`. A
  button's row may carry a link, and the button then goes there
  (`slotHref`).
  - **Why:** Notion links an address it recognises on its own, and an
    attribute can't hold a link, nor can a link sit inside another (React
    reports that as a hydration error).
- **The rule:** a picture's description (its alt text) is written in Notion,
  where the site can read it (`lib/notion/alt-text.ts`).
  - In a page's or a post's body it is a caption line that starts "Alt:".
    That line is read, not shown, and a bare "Alt:" is decoration. A caption
    with no such line is the description, shown once with `alt=""` on the
    picture.
  - A product's picture is described by its name, which the import writes
    from the shop's alt text. Where the shop has none, the import leaves the
    name alone. A picture uploaded by hand is uploaded named with what it
    shows, and is read without its ending (`nameAlt`).
  - `npm run notion:check` names pictures nobody described.
  - **Why:** Notion's own alt text setting is not in its API, so a caption
    and a file's name are the only words about a picture the site sees. A
    caption used as alt text as well is heard twice.
- **The rule:** a link in Notion's text to this site's own address, or to a
  path Notion kept on `app.notion.com`, is drawn as the path
  (`lib/notion/links.ts`), and the setup writes the starter pages' paths
  that way.
  - **Why:** Notion's API refuses a bare path as a link, and a full address
    would send a preview deployment's reader to production in a new tab.
- **The rule:** the list of slots is generated (`npm run copy` renders every
  page in jsdom), never maintained by hand, and a test fails when the
  committed `copy-keys.json` is stale. The few a render cannot reach are in
  `tests/support/hidden-slots.ts`, each held to its component by a test; the
  few only the starter content draws (`STARTER_ONLY_SLOTS`) are left out,
  since no database could show them. `npm run notion:check` names ticked
  text rows no page reads (an unticked one is put away).
  - **Why:** many keys are built from data, so a grep misses them, and a
    row nobody reads is a word an editor changes for nothing.
- **The rule:** client components get `pickCopy(content, "prefix.")`, never
  the whole map.
  - **Why:** the whole map would ship every row to every browser.
- **The rule:** numbers the code works out are printed between slots, never
  inside one; a figure that is a claim (the plain facts' "100%") is a slot.
  - **Why:** a published row replaces its slot wholesale, so a figure typed
    into it would be frozen there while the code moves on.
- **The rule:** a few links go to the 404 on purpose (`NOT_FOUND_LINKS` in
  `lib/nav.ts`: "see the 404", the small print there is none of), with
  `rel="nofollow"`; the link check in the tests knows them.
  - **Why:** the 404 is drawn with care and worth a look, and a search
    engine should not count the joke as a broken link.

- **The rule:** a property is renamed through `FORMER_NAMES`
  (`lib/notion/schema.ts`): the site reads either name (`rowProperty`), a
  picture's reference names the one the database has, the media route
  finds a file by either, the import writes under the database's own name,
  and `notion:check` suggests the new one. A Kind is renamed the same way,
  through `FORMER_KINDS` (Logo became Proof Logos, so that "logo" means the
  site's own, `site.logo`).
  - **Why:** every copy has a database made before the rename, and a
    property read only by its new name would blank its pictures.

### Notion is read once a minute, never per item

- **The rule:** everything except page bodies comes from one cached query
  (`getSiteData()` in `lib/content/store.ts`). Page bodies are fetched per
  page and cached. Nothing on a render path calls Notion once per item or
  per request. The media route is the one place Notion is asked outside
  that: for a page's or a block's file addresses, once per owner, used for
  50 minutes and never within a minute of the `expiry_time` Notion gives
  them, and only when no CDN holds the file. A file host that refuses or
  fails is tried once more, with an address asked for afresh.
  - **Why:** Notion allows about three requests a second for the whole
    integration. Past that it answers 429, and every failure here is
    silent: a slot shows nothing or an old answer, which looks like an
    editor being ignored.
- **The rule:** the fallbacks are Notion → this instance's last good answer
  → the build's snapshot (`lib/snapshot.json`), each marked as Notion's;
  never the built-in wording, on a connected site.
  - **Why:** an empty site because Notion had a bad minute is worse than a
    minute-old one, and the code's words are ones its owner never agreed to.
- **The rule:** a build never reads Notion itself. The prebuild
  (`scripts/snapshot.mjs`) reads it once, waiting as long as Notion asks,
  into `lib/snapshot.json` (the rows) and `lib/snapshot-bodies.json` (every
  live page's, post's and product's body). Inside `next build` the store and
  `getBlocks` read those, and a route prerenders only the entries whose body
  is there (`prerenderable`); the rest render on their first visit. A route
  never prerendered (the Markdown copies) reads a body only on a visit.
  - **Why:** `next build` renders in a worker per core, each with its own
    memory; on a large build machine thirty of them asking Notion at once
    were rate-limited, a body that couldn't be read failed its page, and a
    failed page failed the deploy.
- **The rule:** both snapshots are committed empty.
  - **Why:** a build fills them, and a filled one in git publishes
    somebody's content.
- **The rule:** the site's token needs Read content only. Anything that
  writes (`notion:setup`, `notion:seed-copy`, `shop:import --write`) uses a
  temporary capability or an integration of its own
  (`NOTION_IMPORT_TOKEN`).
  - **Why:** a leaked read-only token discloses the database; a leaked
    writing one rewrites it.

### A reader's browser talks to the site and nobody else

- **The rule:** fonts are local (`next/font/local`, files in
  `assets/fonts`). Never Google Fonts, never a stylesheet, script, font or
  picture from another host.
  - **Why:** each would hand that host every reader's IP address.
    `tests/third-parties.test.mjs` and the CSP in `next.config.mjs` hold
    this; `npm run privacy` checks a running site.
- **The rule:** Notion's files are served through `/media/<signed token>`,
  each with a policy of its own that runs nothing (`sandbox`,
  `default-src 'none'`), and the only one it is sent with: the site's
  policy in `next.config.mjs` leaves `/media/` out.
  - **Why:** Notion's own addresses expire after an hour and are another
    host; and an SVG from anywhere, opened on its own under the site's
    looser policy, would run as the site. Two policies sent together hold
    only where the host keeps both.
- **The rule:** the media route fetches only what `lib/outbound.ts` allows:
  https, a host that is public and resolves to nothing private, every
  redirect followed by hand and held to the same, and each connection made
  to the address that was checked (`checkedLookup`, `pinnedFetch`), never
  through `fetch`, which looks the name up again.
  - **Why:** the address is signed, but an editor pasted it and its host
    decides where the request lands; a redirect to a cloud's metadata
    service would be fetched from inside the network and served to anybody,
    and so would a name whose DNS answers public for the check and private
    for the connection.
- **The rule:** with no signing key (`MEDIA_SIGNING_KEY` or `NOTION_TOKEN`),
  no media address verifies.
  - **Why:** a key anybody could compute would make the route an open
    proxy.
- **The rule:** analytics (PostHog, Google Analytics) loads nothing before a
  reader says yes, and goes through `/ingest` and `/ga`, with the IP address
  shortened and page addresses cleaned. Escape on the cookie question
  answers no.
  - **Why:** a dismissal is never permission.
- **The rule:** a video loads its player only when the reader presses play.
- **The rule:** Next's image optimiser is off (`images: { unoptimized:
  true }` in `next.config.mjs`, and no remote host), so `/_next/image`
  answers 404. Pictures are resized by the media route.
  - **Why:** allowing remote images makes `/_next/image` an open image
    proxy, and even with none it decodes whatever a stranger points it at
    on this site, which is where its denial-of-service and code-execution
    advisories live.

### Search and assistants (`docs/seo.md`)

- **The rule:** every page, post and product written in Notion is also
  served as Markdown at its address with .md added (`app/markdown`,
  `lib/notion/markdown.ts`), named in its page's head and in `/llms.txt`,
  and naming its page as canonical in a `Link` header. A designed page and
  the example shop's goods have none.
  - **Why:** an assistant reads a post's words in a kilobyte or two instead
    of a hundred of frame and React's payload, and the canonical keeps the
    copy from standing in search beside its page.
- **The rule:** a page's search words and its share picture are Notion's:
  `meta.<page>.title`, `.description`, `.label`, and `meta.<page>.image`
  (`meta.site.image` for every page, `site.logo` for the logo), a picture
  being the cover of a ticked Site Copy row and its Text the picture's
  words (`lib/share.ts`). Without one, the card is drawn with the title.
  - **Why:** what a shared link shows is the first thing a stranger sees of
    the site, and the owner changes it as they change any other word.
- **The rule:** what the site tells machines (structured data, `/llms.txt`
  with the plans and their prices, the copies) is read from the rows and
  slots its pages print, and says nothing they don't.
  - **Why:** an assistant quotes what it reads; a price or a fact said only
    to machines is one an editor never sees to correct.

- **The rule:** every section below the hero of the homepage, /pricing,
  /about, /team, /security and /questions is named in `SECTIONS`
  (`lib/sections.ts`) and drawn by `Lineup` (`components/sections/lineup`),
  where Notion's Section rows put it: Title the section, Slug the page,
  Order its place, Published on or off; two rows, twice. A section with no
  row is where it was designed. A copy shows the original's words. The
  hero stays first, and /features keeps its order. Every section takes its
  ids from `id()` and its ground from the line-up, never typed, so a
  duplicate never repeats an id and two panels never touch.
  `tests/dom/lineup.test.tsx` draws every section twice on every page.
  - **Why:** a copy's owner reshapes the site from Notion like any other
    words, and a page put together that way must still keep every rule a
    designed one keeps.

### Pictures, icons and proof (`docs/brand.md`)

- **The rule:** every picture is drawn at twice the size it is shown: the
  packs are SVG (`components/illustrations/packs.tsx`), and the starter's
  pictures are rendered from them at 2× (`npm run demo-images`).
  `npm run sharpness` fails on any picture a retina screen would stretch.
  - **Why:** a picture drawn larger than its pixels blurs, and its words
    blur with it.
- **The rule:** a picture from Notion is asked for at the size it is shown:
  `<img {...picture(mediaUrl(…), shown)}>` (`lib/media-sizes.ts`), never a
  bare media address in `src`. The route resizes to one of eight widths and
  answers WebP (`lib/content/media-resize.ts`); an SVG, a GIF and anything
  that moves go as they were uploaded. `tests/media-resize.test.mjs` and
  `checkPictures` (`tests/dom/support/checks.ts`, on every page) hold this.
  - **Why:** an editor uploads a photograph megabytes large for a box 56
    pixels wide, and sent as it is, that is what every reader downloads. A
    fixed set of widths keeps a caller from making the server resize
    without end.
- **The rule:** the packs are matte, as the cereal box is: shading only
  darkens, and nothing shines. Words on a round pack wrap round it and curve
  as its bands do (`components/illustrations/geometry.ts`), drawn once and
  shown through masked slices. Packs stand evenly spaced on a shelf as deep
  as they are, every shadow falls back and to the right, and no shadow
  leaves its shelf or its picture. `tests/packs.test.mjs` and
  `tests/dom/packs.test.tsx` hold this.
  - **Why:** a sheen washes out the words under it, and words or shadows
    that break the drawing's own geometry (flat words on a curve, a shadow
    cut by the frame) read as mistakes.
- **The rule:** a post's or a page's cover is its Notion cover first, then
  its Image, cut where Cover Position says, and printed in the look's
  one ink (`.cover-tint`, `--c-tone`: blue, deep green, grey, violet): the
  photograph's light and dark, the look's colour. Cover Tint Off on its row
  shows it as uploaded instead (`coverFrame` in `lib/cover.ts`,
  `data-untinted`), in every look but mono, which stays grey. Portraits and
  the goods are not tinted. `tests/covers.test.mjs` and
  `tests/dom/covers.test.tsx` hold this.
  - **Why:** an editor adds a cover in Notion the way Notion offers, sees on
    the site what Notion shows, and a photograph from anywhere sits with
    the site's colours. Notion's Reposition is not in its API, so the cut
    is a property. A photograph whose colours are the point (a product
    shot, a painting) is the editor's to show as it is, with one select;
    mono is the reader's choice of no colour, so it wins.
- **The rule:** the site picks its icons from `lib/icons.ts` (Phosphor,
  MIT), never an emoji. Notion's own icons are drawn with the icon of the
  same name (one the site has no drawing of is an editor's choice, fetched
  as Notion draws it through `/media/`); a writer's emoji stays an emoji.
  An arrow, a tick or a play triangle typed as text is a character, not an
  icon, and is allowed. `tests/icons.test.mjs` holds this.
  - **Why:** an emoji looks different on every device and can't take the
    theme's colours.
- **The rule:** one rhythm for every section. A section is padded 64px
  top and bottom on a phone, 96px from a tablet up (`MarketingSection`,
  and `FinalCta` the same). What follows a section's heading stands the one
  gap below it, `.section-body` (40px, then 56px); a group in a page of
  groups uses the tighter `.group-body` (24px). A heading's own buttons
  sit 24px under it, and a lede 16px. `checkRhythm`
  (`tests/dom/support/checks.ts`) holds every page to it; a block that
  goes on from its heading on purpose says so (`data-follows-head`).
  - **Why:** gaps typed section by section drifted from 24px to 56px, and
    a section with generous padding and a tight inside reads as squashed.
- **The rule:** a section reads one way. Under a centred heading, short
  columns are centred too (`FeatureColumns align="center"`), and figures on
  a section that is a panel already are a centred band with no box
  (`StatCards band`). A card is never the colour of its ground.
  - **Why:** a card the colour of its ground disappears and leaves only its
    padding, an indent that reads as a mistake, and a centred title over
    left-set columns reads as two layouts at once.
- **The rule:** a corner says what a thing is, from five: a pill for
  what is pressed or typed in and hugs its words (buttons, fields, the
  select, chips, tags), then 4, 10, 16 and 24px as a thing that holds
  things grows (`rounded-text`, `-block`, `-card`, `-panel`), and inside
  another, the outer corner less the gap. Every field is `.field`, and
  the select is `SelectLine`, never a native one (`docs/design.md`,
  "Shape"). `tests/shapes.test.mjs` and `checkShapes` hold this.
  - **Why:** fourteen radii typed one by one read as fourteen decisions;
    one shape per kind of thing tells a reader what can be pressed.
- **The rule:** type is set in ten sizes and four that grow with the
  window, each a class from `tailwind.config.ts` (`text-micro` 11px,
  `-fine` 13, `-small` 14, `-ui` 15, `-body` 16, `-lead` 18, `-head-s` 22,
  `-head-m` 28, `-head-l` 36, `-display` 56; `text-fluid-section`,
  `-title`, `-hero`, `-giant`). No size is typed into markup
  (`tests/type-scale.test.mjs`); a size that must follow something other
  than the window (a belt card's words) is in the stylesheet.
  - **Why:** twenty-seven sizes typed one by one, nine of them a pixel
    apart, read as twenty-seven decisions and none.
- **The rule:** the header is laid out as Notion's: the mark alone in the
  middle, four links on its left (`MAIN_NAV`), two on its right
  (`SIDE_NAV`) before the cart, the look's switch and the button. The name
  is not in the header; the home page's hero opens with it, alone and
  centred, and the descriptor is in the footer. A site's own logo
  (`site.logo`, `SiteMark`) stands where the mark does, in the header and
  the footer, and its own icon (`site.icon`, else the logo) is the tab's,
  the home screen's and the manifest's, each size a square PNG the media
  route makes (`ICON_SIZES`); with neither, the mark and its icons in
  `public/`.
  - **Why:** the row weighs the same either side of the mark, and the name
    beside a large mark read as two logos.
- **The rule:** the header's links, the phone menu and the footer's columns
  are menus (`MENUS`, `siteMenus` in `lib/menus.ts`), and Notion's Menu rows
  arrange them: Title the page, Slug the menu (empty: wherever it was
  designed), Order its place, Published on or off. A link with no row stays
  where it was designed. The header holds no more links than it was
  designed for (four, then two); the phone menu is every menu's links, each
  once. A component draws the links it is handed, never a list of its own.
  `tests/menus.test.mjs` and `tests/dom/menus.test.tsx` hold this.
  - **Why:** a copy's owner turns a link off or moves it like any other
    word, and the header must still weigh the same either side of the mark.
- **The rule:** the band runs under the header and over the footer (and
  round the packs, the cookie bag among them), and on nothing else.
  - **Why:** on a card it is one band too many.
- **The rule:** a mark in the "goes well with" strip is a tool the site
  really works with, in one colour, under words that claim no more than
  that. Never "trusted by" over a company that is not a customer.
  - **Why:** the strip is proof, and proof that isn't so is a lie.
- **The rule:** invented reviews never pass for real ones. One is tagged
  Example (the starter's four are, in the starter content and in Notion),
  shows under an "example reviews" mark, and never beside a real review or
  in its average: the first real one published takes their place
  (`liveReviews`). No review is marked up for search engines.
  - **Why:** a fake review deceives the reader, and in places it is
    unlawful.

### Notion's brand rules (`tests/brand.test.mjs`, `docs/brand.md`)

- **The rule:** "Notion" is never in the product's name. It goes in the
  smaller descriptor.
- **The rule:** the "Made for Notion" badge is Notion's file, unaltered,
  once, in the footer, 48px tall, never animated.
- **The rule:** the attribution and the independence statement are printed
  outside any slot.
  - **Why:** so they can't be blanked from the database.
- **The rule:** no claim of certification, partnership or endorsement, and
  no artwork from notion.com.

### Accessibility, WCAG 2.2 AA, and AAA where a site can hold it (`docs/accessibility.md`)

- **The rule:** the page shape: one `<h1>` a page, headings that go down
  one level at a time, unique ids, and a name on every control.
  - Notion's headings are re-levelled to keep the outline whole
    (`collectHeadings` in `components/notion/context.ts`).
  - A component under a section heading takes a lower level (`ProductGrid`'s
    `heading`, `PricingPlans` under an `h2`).
- **The rule:** colours are tokens in `app/globals.css`, one block for each
  of the four looks in `THEMES` (`lib/theme.ts`): light, dark, mono and
  rainbow. The contrast test checks every pairing in every look at AAA
  (`TEXT_MIN`, `LARGE_TEXT_MIN`, `EDGE_MIN` in `lib/contrast.ts`): words at
  7:1, the titles (large text) at 4.5:1, and the focus ring at 3:1 on every
  ground a control sits on; the code highlighter lifts a colour to 7:1 too.
  A colour that falls short moves along its own hue, towards black on a
  light ground and white on a dark one, only as far as it must. In light,
  black is primary (the words, ledes, eyebrows, links, the secondary
  button) and
  the blue is the accent (titles, the main buttons, the band, focus rings),
  as Notion colours its own; the pale blue is used lightly. Dark glows in
  the dark: a green-black page, mint words, and the titles, the band, the
  mark and the main buttons in one phosphor green (`--c-glow`) with a halo,
  the accent (focus rings, ticks, the accent button) in the label's blue,
  and pictures tinted the same green; Notion's badge is never tinted. In
  every look, the goods for sale (`data-goods`: a product's pictures, on
  the shelf, on its page and in the cart) are shown as uploaded.
  Three things are not tokens, and are the same in every look: the dim
  over a page behind a dialog, a video's poster and its play button, and
  the swatches in the services' picture of a brand's colours. A hero on a
  picture (`home.hero.image`) takes one block of tokens in every look,
  `.on-picture`: the picture under a dark veil, the words and buttons light
  on it, checked on the veil over the lightest picture there is.
  - **Why:** a colour typed into a component escapes that check, and shows
    the same in every look.
- **The rule:** the reader chooses the look (the header's switch moves
  through the four, the footer offers those and the system's), and it is
  set before the first paint. A component never asks which look is
  showing; only `dark:` does, for the badge, the logo strip and the site's
  own logo (`site.logo.dark`, else inverted), because only a dark ground
  changes them.
  - **Why:** the server can't know the reader's look, so anything drawn
    differently per look in React would flash or mismatch on hydration.
- **The rule:** mono has no hue: every colour in its block has equal red,
  green and blue, its code is in greys, and every picture is drawn in grey
  except Notion's badge and the goods for sale.
  - **Why:** a reader who picked black and white should get it everywhere,
    the badge must stay as Notion made it, and a buyer must see the colour
    of what they would buy.
- **The rule:** rainbow's titles are a gradient whose every colour, the
  stops and the mix between them (sRGB and OKLCH), reads at 4.5:1 on every
  ground a title sits on. It stands down in forced colours, and nothing in
  it moves.
  - **Why:** a gradient is checked only where it is sampled, and text drawn
    with a transparent fill vanishes when the system takes the colours.
- **The rule:** native controls first (`<details>`, radio buttons, real
  tables). Where the site draws its own (the select, the tabs), it carries
  the whole keyboard behaviour of the native one.
- **The rule:** nothing moves under `prefers-reduced-motion`. One block in
  `app/globals.css` holds this for every component and library at once,
  and there a transition takes no time at all (`0s`, never `0.01ms`); a
  word fitted by measuring it is `.fit-word`, with no transition of its own.
  - **Why:** a change that is still a transition, however short, is read
    back before it lands: the cookie bag's word swung between two sizes
    twenty times a second for exactly the readers who asked for stillness.
  One thing loops, the row of reviews that passes by (`marquee`), and a
  reader can stop it three ways: under the pointer, with its Pause box, and
  by putting the keyboard in it, which also stands it still as a grid so
  every card is reached. A second loop needs the same before it is added
  (`tests/motion.test.mjs` names the one allowed).
  - **Why:** WCAG 2.2.2 asks that anything moving for more than five
    seconds can be paused, and a card sliding away from the keyboard's focus
    cannot be read.
- **The rule:** the site answers the hand with one set of movements, each a
  class in `app/globals.css` at shared timings (quick to answer, `--t-in`;
  slower to let go, `--t-out`; `--ease`, and `--spring` for a thing with
  weight): `press` (every button: a ring of the accent's light, and it
  gives when pressed), `tone` (a control whose colours answer the pointer),
  `turn` (a small mark that turns or slides), `lit` (a card: its hairline takes the accent, a soft
  light follows the pointer, it leans a degree or two, its picture eases in
  inside a fixed frame, its neighbours step back), `arrive-each` (a row of
  cards steps out from its middle to its places), `marquee`, `pack-hit` (a pack on
  a shelf rises, and pressing it jumps to its column) and `jump-target`. A
  new component uses these; it does not write a transition, a duration or
  an easing of its own (`tests/motion.test.mjs`; the sheet, which slides by
  its library's states, is the one exception).
  - **Why:** movement typed into one component is a different speed and a
    different curve from its neighbour's, and only the homepage ends up
    moving.
- **The rule:** nothing is lifted on a blurred shadow. A card is told from
  its ground by a hairline and its own colour, and from its neighbours,
  under the pointer, by light: `--shadow-card` is a 1px ring in light, dark
  and mono (rainbow keeps its hard offset, which is a look, not a blur),
  and no hover adds a shadow or moves a card (`tests/motion.test.mjs`).
  `--shadow-pop` is for what really floats: a menu, a dialog.
  - **Why:** a card that jumps up onto a dark blur reads as ten years old,
    and muddies whatever is under it.
- **The rule:** motion has a job or it is not there: a hero sets itself
  once (`settle`, and the homepage title's `KineticWords`) and steps back
  as the page leaves it; what follows the scroll moves side to side, as
  the belt does, or simply clears, and never comes up, down or on a
  diagonal: a section's head line by line from
  the left (`arrive`); a row of cards stepping out from its middle, a
  fifth of a card's width at most (`arrive-each`); a panel's ground
  growing to the window's width (`open`); the side of a pack turning in
  depth to face the reader (`depth`: the nutrition labels, the picture
  beside a feature's words, and nothing else); and whatever only needs
  noticing going from unseen to seen where it stands (`appear`, which
  every `section-body` has). A movement is no larger than its job;
  and in the homepage's statement the
  giant word slides while three promise cards ride a checkout belt, are
  scanned and ride on off the left as the page goes by. The shop's own moments
  answer something the reader did: the scanner's line over a thing added to
  the cart, a card pulled off the shelf under the pointer, the cart's
  receipt printing. The movements are borrowed from a grocery shop; none of
  it is drawn (no belt, no till). What follows the scroll is CSS alone with
  no backwards fill, and begins out of sight or from how the thing already
  stands; it changes only `translate`, `scale`, `rotate` and `opacity`
  and a turn in depth (never a blur or a clip), over a set length of
  scroll; and
  every `@keyframes` has a name of its own
  (`docs/design.md`, `tests/motion.test.mjs`).
  - **Why:** motion on every paragraph is decoration and tires a reader;
    a thing hidden until it is scrolled to is blank on paper, in a
    full-page capture and to an agent reading without scrolling, and motion
    driven from React would mismatch on hydration. A movement that begins
    in sight from a first keyframe jumps, a blur or a clip is drawn again
    every frame and stutters (and blurs the words), and a
    second `@keyframes` of a name replaces the first without a word: each
    reads as a glitch.
- **The rule:** the homepage answers a stranger's questions in order: the
  hero, the statement (one word the width of the window, three promises
  as cards on a belt under it; type and colour only, no picture, no
  goods), why generic and the tools it goes well with, a quotation, the
  small print, the plans, then the shop's shelf, what people say about it,
  and the blog (`docs/design.md`;
  `tests/dom/shelf.test.tsx` holds the order).
  - **Why:** a reader meets the seller before the goods, the reviews stand
    by the goods they are about, and the newest things come last.
- **The rule:** a thing pressed is 44 by 44 at least (WCAG 2.5.5, AAA):
  `min-h-target` and `min-w-target` (`tailwind.config.ts`), never a size
  typed under it, and a link inside a sentence is the one exception.
  `tests/targets.test.mjs` holds the code, and `npm run a11y` the size each
  control is drawn at, in every look and at every width.
  - **Why:** a small target is missed by a shaking hand, a thumb and a
    pointer driven by voice; 24px was AA's floor, and the sizes typed one
    by one ran from 24px to 42px.
- **The rule:** one focus ring: `--focus-ring` (3px) in the accent, with a
  gap of the ground between it and the control (WCAG 2.4.13, AAA). A
  control that draws its own ring uses `outline-focus`; one whose focus is
  shown by a fill alone (a select's option) gets the ring too, inset.
  `tests/contrast.test.mjs` holds the width and the colour.
  - **Why:** a 2px ring in a colour near its ground is easy to lose, and a
    fill that changes by a shade is no ring at all.
- **The rule:** running text sets at most 80 characters a line
  (`max-w-measure`, and every paragraph of a Notion page) at 1.5 line
  height, never justified (WCAG 1.4.8). Notion's own space between
  paragraphs is kept, so 1.4.8 is not claimed in full.
  - **Why:** a long line loses the reader at its end; spacing paragraphs at
    the 2.25em 1.4.8 asks would undo the page as Notion sets it.

### The shop (`docs/commerce.md`)

- **The rule:** with no `COMMERCE_PROVIDER`, the shop is an example: it says
  so, is `noindex`, stays out of the sitemap and `/llms.txt`, and carries no
  Product offers.
  - **Why:** fictional goods must never reach search as things for sale.
- **The rule:** Shopify prices the cart, through a cart permalink.
  - **Why:** Notion's price is for display, and no key is needed.
- **The rule:** only lines that can still be bought reach the checkout and
  the subtotal.
- **The rule:** the catalogue is kept in the shop (Shopify or Printify),
  never in Notion: a Product row is the importer's copy of it. Every import
  writes again whatever the platform says (title, description and the row's
  page, price, stock, variants, link, pictures and their alt text,
  collection, tags), so a
  word changed in Notion is changed back. Notion alone decides Published,
  Slug, Featured and Order, Low stock or Pre-order, and a field the
  platform leaves blank. The site, the README and the docs offer Shopify
  and Printify and no other way to sell.
  - **Why:** a description kept in two places is two descriptions the day
    one is edited, and a buyer reads one on the site and another at the
    checkout.
- **The rule:** the importer never deletes a row. It makes rows unpublished,
  never replaces pictures uploaded in Notion, and finds rows again by
  Import ID.

### Secrets and private data

- **The rule:** every token, key, ID and address for an account is an
  environment variable, listed in `.env.example` with a placeholder.
  `tests/env-example.test.mjs` fails if the list and the code disagree.
- **The rule:** `tests/no-secrets.test.mjs` reads every file git would
  commit. It fails on an email address other than the maker's public one or
  an example, a token shape, an analytics ID, a real-looking Notion ID, or a
  deployment's address. Two are public on purpose and named once in
  `lib/site.ts`: the Notion template (`NOTION_TEMPLATE_URL`) and the live
  demo (`DEMO_URL`), which only the README links.
  - **Why:** use example domains (`example.com`, `.example`) and
    placeholder IDs in tests. A copy's own address is its `SITE_URL`, never
    the code's, so the site never prints the demo's.
- **The rule:** a link to another site opens in a new tab, with
  `rel="noopener noreferrer"`; a path, an anchor, mail, a phone number and
  the site's own address stay in the tab. Every link drawn from an address
  takes `outsideLink` (`lib/outside.ts`), and `checkOutboundLinks`
  (`tests/dom/support/checks.ts`) holds every page to it.
  - **Why:** a reader keeps their place here, the other page cannot reach
    back into this one, and it is not told which page the reader came from.
- **The rule:** an address a person typed into a row becomes an `href`
  only through `safeHref` (`lib/inline-links.ts`), and a redirect only
  through `safeDestination`. `tests/row-links.test.mjs` and
  `tests/dom/row-links.test.tsx` hold this.
  - **Why:** a row's Link holding `javascript:…` would run in a reader's
    browser on a click, and the content policy allows inline scripts.
- **The rule:** every route handler that takes a request from a reader
  opens with `await rateLimit` (`lib/rate-limit.ts`). Memory counts first;
  with a shared store set (Upstash's REST API: `UPSTASH_REDIS_REST_*`, or
  Vercel's `KV_REST_API_*`) one count holds across every instance, but on
  `/ingest` and `/ga` (`shared: false`). The store holds a hash of a caller
  keyed with the site's own secret (`MEDIA_SIGNING_KEY`, else
  `NOTION_TOKEN`), never the address and never a key the store could know,
  so a site with neither counts in memory. Memory's window ends where the
  store's does, and a store that fails leaves memory's answer.
  `tests/rate-limit.test.mjs` holds this.
  - **Why:** one client in a loop must not enrol addresses, send letters
    or make the site fan out to another service, nor a flood spread over
    instances; the analytics keys are public, so a shared count there buys
    nothing; and a limiter must never be the thing that takes the site
    down.
- **The rule:** `/.well-known/security.txt` (`lib/security-txt.ts`) names
  the site's own contact (`SECURITY_CONTACT`, then
  `NEXT_PUBLIC_CONTACT_EMAIL`, and always the contact form), never the
  maker's, with `/security` as its policy, and expires 180 days after it is
  drawn, which is daily. `tests/security-txt.test.mjs` holds this.
  - **Why:** a copy's owner answers for their copy, and a security.txt past
    its date tells a researcher nobody is reading it.
- **The rule:** routes that need a secret fail closed without it
  (`/api/revalidate`, `/api/notion-webhook`), and compare it in constant
  time.
- **The rule:** route handlers log no personal details, and nothing a
  stranger sent unless it is held to a shape first (the webhook's
  verification token).
  - **Why:** a line break in a logged value writes lines of the sender's
    own into the log.
- **The rule:** a route that passes a request to another host names the
  headers it passes, each way (`pickHeaders` in `lib/proxy.ts`), and reads
  a stand-in upstream through `standIn`, which production ignores. It
  never hands on a page, a drawing or an XML document (`pageLike`), and
  the analytics proxies serve this site's own project's scripts only
  (PostHog's `array/<key>/`, one Google `id`).
  - **Why:** copying every header hands a reader's cookies to the other
    host and its cookies back under this site's name, and whatever a proxy
    hands on runs as this site: a page from elsewhere, or another
    project's scripts, would be a script of a stranger's under its name.

### Tests

- **The rule:** a test is checked by breaking the code it covers and
  watching it fail.
- **The rule:** `tests/dom/pages.test.tsx` renders every route three
  times: with no Notion (the starter content from the site's own files),
  with the starter content through the real store and client from the
  stand-in Notion over HTTP, and with an empty database (every empty state).
  A new page is covered without anybody asking.
- **The rule:** a React warning fails the test it happened in.
  - **Why:** in production that warning is a hydration error.
- **The rule:** React can't render an async component in jsdom (only a
  server renders one). Keep
  async work at the page level. Where a component must be async, split its
  markup into a synchronous part (as `CodeBlock` and `CodeFigure`).

### Comments and docs

- **The rule:** comments say what the rule is and why.
  - **Why:** the story of how it came about is in git history, and a comment
    that narrates it goes stale.
- **The rule:** docs change with the code.
  - The property table in `docs/notion.md` is generated (`npm run docs`),
    and `tests/docs.test.mjs` fails when it's stale or when a doc links to
    something that isn't there.
