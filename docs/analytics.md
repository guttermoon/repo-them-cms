# Analytics

The site counts nothing until you turn analytics on. Even then, it counts a
reader only after they say **yes**. You can use PostHog, Google Analytics 4,
or both.

## Turning it on

| Setting | What it does |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Your PostHog project key (`phc_…`). There is no key in the code, so a fork never counts into somebody else's project. |
| `NEXT_PUBLIC_POSTHOG_REGION` | `eu` (the default) or `us`, matching where your project lives. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Your GA4 measurement ID (`G-…`). Anything else is ignored. |
| `POSTHOG_LOGS_ENDPOINT` | Optional: PostHog Logs' address for your region (`https://eu.i.posthog.com/i/v1/logs`, or `us.`), for the server's own lines (below). |

These are read when the site is built. **Redeploy after changing one.**
Without any of them:

- nothing is counted, and the privacy notice says so;
- the cookie question is still asked, as an example, so you can see it
  before you set anything up (below).

## The question, and the answer

The question takes one of three shapes. Choose one in Notion with the Site
Copy row `cookies.shape`: write **bag**, **box** or **banner** in its
Text. With no row, or a word the site doesn't know, it is the bag.

| Shape | What it looks like | The page behind it |
|---|---|---|
| bag | A bag of cookies in the middle of the screen (below) | Dimmed, and held: Tab stays in the bag until it is answered |
| box | A plain panel in the middle of the screen, the word as its heading | Dimmed, and held, as with the bag |
| banner | A bar along the bottom of the screen, the page's width | Left as it is, and usable: nothing is counted until a yes, so nothing needs holding back. Room is left under the page so the bar never covers its end |

Every shape asks with the same words and the same two answers, and keeps
every rule below. The pack's own label (`cookies.kind`, "generic,
assorted") is printed on the bag alone.

In the bag's shape, a bag of cookies in the middle of the screen asks
first-time readers whether visits may be counted. It is the same bag as the one on the shelf
(`bagOutline` in `components/illustrations/geometry.ts`): a crimped seal
across the top, sides that bulge, a rounded base, and the band across its
face under the word "cookies". It is drawn at whatever size its words make
it, in the look's own colours, and the words and buttons over it are the
page's own. The word is set to fill the face on one line, whatever an
editor renames it to and however narrow the screen, and wraps only when it
would be smaller than 40px. Every word on it is a `cookies.*` slot.

**Until analytics is set up, the question is an example**, as the mailing list
and the contact form are until an email platform is:
- its small print says so (`cookies.example`), and names no tool;
- nothing loads, whatever the answer;
- the answer is kept apart from a real one (`site-consent-example`), so a
  yes given to the example is never taken as a yes to counting: once
  analytics is switched on, every reader is asked again, for real;
- to leave the example out of a copy, publish `cookies.example` blank.

- **Before an answer: nothing.** No script, no cookie, no request.
- **Yes:** the tools named in the question start. The answer is kept in the
  reader's browser (`site-consent` in localStorage).
- **No, or Escape:** nothing loads. A no after a yes switches the tools off
  at once and deletes their cookies and stored identifiers, whether or not
  the tool had loaded on that visit. PostHog's support chat leaves the page
  too, and its conversation, with any email typed into it, is deleted from
  the browser (`ph_conv_<key>`, which PostHog's own opt-out leaves). (Escape pressed to close the menu or
  a list is not an answer.)
- **The two answers look exactly alike**: the same size, the same type,
  both filled as the main button. Yes comes first, as the question asks it
  (GOV.UK's cookie banner does the same), not bottom right where a hand
  used to OK goes by habit. Filling Yes alone would make it the obvious
  answer, which is what the regulators' guidance on cookie banners names
  as a nudge. Focus goes to the question, not to
  either button, so pressing Return never gives an answer nobody chose. In
  the bag and the box, Tab stays inside while it's open, and a click on
  the dimmed page behind it is not an answer; the banner holds nothing, so
  Tab goes on to the page.
- **"Cookie settings" in the footer**, and on `/privacy`, asks again.
  Withdrawing is as easy as agreeing.

This is the strictest reading of the law, chosen because the template is
used everywhere. If you know your own situation allows less, say so in your
privacy notice before you change it.

## Through your own site

A reader's browser never contacts PostHog or Google: everything goes through
your domain.

**PostHog:**
- The browser sends to `/ingest` on your site, and your server passes it on
  to PostHog's EU or US cloud with the IP address shortened (IPv4 to its
  /24, IPv6 to its first three groups).
- It sends no cookies, no referrer, and never the full address. Besides
  what any request carries (its type, language and browser), the support
  chat's requests carry two things PostHog needs, neither naming anybody:
  the chat's public token, which PostHog gives every browser, and this
  site's own origin (`https://your-domain`), which PostHog checks against
  the chat's **Allowed domains**. Without either, PostHog refuses every
  message ("Failed to send message"). `tests/ingest.test.mjs` sends a chat
  message through and checks what arrives.
- Only PostHog's own paths are forwarded, so `/ingest` is no open proxy.

**Google Analytics:**
- Google's script is fetched by your server and served from `/ga/gtag/js`,
  and GA4 sends its hits to `/ga`.
- The server passes them on with the IP address shortened (in `_uip`, as
  Google's own server-side tagging does) and every page address cleaned.
- **Contact details are dropped.** GA4 can pick email addresses and phone
  numbers out of a page's forms and send them hashed (`em`, `emd`, `ec_…`);
  the server drops them, whatever GA4's settings say.
- Only your measurement ID's script is fetched, so `/ga` serves nobody
  else's tag.
- The tag has Google signals and ad personalisation turned off, and Consent
  Mode denies every advertising purpose.
- The cookies last 13 months, not GA4's default two years.

**Three switches live only in GA4's admin.** Turn them off there, because
your privacy notice depends on them:

- Data collection → Google signals;
- Data collection → User-provided data collection;
- Account settings → Data sharing (all of it).

## What PostHog is told

After a yes, PostHog counts page views and whatever its project settings
switch on (session replay, heatmaps, surveys). One thing is set in the code:
error tracking takes unhandled errors and rejected promises, never console
output. On top of those, the site sends a few events of its own, each saying
what happened and never who:

| Event | Sent when | With |
|---|---|---|
| `product_added_to_cart` | A product goes in the cart | `product_slug`, `variant_id`, `quantity` |
| `cart_item_quantity_updated` | A line's quantity changes | `product_slug`, `variant_id`, `previous_quantity`, `quantity` |
| `cart_item_removed` | A line leaves the cart | `product_slug`, `variant_id` |
| `checkout_started` | The checkout button is pressed | `item_count`, `subtotal`, `currency` |
| `newsletter_subscription_completed` | The mailing list takes an address | `status` (`subscribed`, or `pending` a confirmation) |
| `contact_message_sent` | The contact form's message is sent | `enquiry_type` |
| `feedback_sent` | The Feedback panel's words are sent | `kind` (`broken`, `idea` or `liked`) |

An error the page can't recover from goes to PostHog's error tracking, after
a yes. The feedback itself is not one of these: it is a survey response the
server sends, with or without a yes ([feedback](feedback.md)), and feature
flags are asked for only after a yes (feedback, "Flags"). `tests/analytics.test.mjs` fails if an event carries anything but
these properties, or is sent before a yes.

### The server's own lines

With `POSTHOG_LOGS_ENDPOINT` set as well as the key, the server writes a
line to PostHog Logs when a contact message is delivered and when the
mailing list accepts an address, with the enquiry type or the status and
nothing else: no address, name, message or IP address. These come from your
server, not a reader's browser, and are about the site working, not about
the reader. Without the setting, nothing is sent.

## PostHog's pop-ups and chat

Anything you switch on in PostHog that draws on the page, a survey pop-up
(CSAT, NPS) or the support chat, is drawn by PostHog's script, so it shows
only to a reader who said yes to cookies. The site dresses it in its own
look (`app/globals.css`): the card, the words, the buttons, the field, the
focus ring, the corners, the shadow and the font are the site's tokens, so
it follows the reader's look, dark, mono and rainbow included, whatever
colours the survey was given in PostHog. `tests/posthog-widgets.test.mjs`
reads which colours the installed posthog-js uses and fails on one with no
token, so an update can't bring back PostHog's own.

What stays PostHog's to set, on the survey itself (**Customization**):

- **Where it opens:** Position. **Center** opens it in the middle of the
  window. The site can't move it, since PostHog places it from inside its
  own part of the page.
- **Its words:** the question, the scale's labels and the thank-you.

The chat shows on the desktop layout alone, 1024 pixels wide and up, where
the header shows its links (`CHAT_MEDIA` in `lib/analytics.ts`). On a phone
or a tablet its launcher and window would sit over the page's own controls,
so a reader who arrives on a smaller screen never loads it, and a wide
window narrowed below the line hides it. The Feedback button and the contact
page are there on every screen.

For the chat, in **Support → Settings → In-app widget**:

- **Asking for an email:** turn on **Require email** (and **Collect name**,
  if you want it). The chat then opens on a short form, "Before we
  start...", and a reader gives their email before their first message. It
  goes with the conversation to PostHog's Support inbox, so you can reply
  by email after they leave. The site never identifies anybody, so the form
  shows to every reader; an email given once is kept in their browser for
  the next chat, until a no to cookies deletes it.
- **Allowed domains:** your site's own domain (`your-domain.com`), so the
  chat's public token works on your site alone. The site sends its own
  address with every chat request for PostHog to check.
- **Identity verification:** leave it off. It is for sites where people
  log in, and this one has no accounts.
- **"Survey by PostHog"** under it, which only PostHog's paid plans remove.

The Feedback button is different: the site draws it itself, and PostHog
only keeps what it sends ([feedback](feedback.md)). It needs no yes to
cookies, and it is the one to keep if you want every reader to have a way
to reach you.

## What never leaves

- **Query strings.** Every page address sent in an event loses its query
  string, except five campaign tags (`utm_source`, `utm_medium`,
  `utm_campaign`, `utm_content`, `utm_term`) and the contact form's `type`.
  A session replay, if you switch replay on in PostHog, records the page as
  it was drawn, links and all; only its page-address events are cleaned. A
  parameter added to a page later can't leak by default. Another site's
  address (a referrer) keeps only its origin and path.
- **Typing.** PostHog's session replay hides everything typed into a form.
- **Identities.** The site never identifies anybody, and makes no person
  profiles.

## The privacy notice follows the settings

`/privacy` describes the build as it is configured:

- the tools in use;
- where PostHog keeps its data (the EU or the US);
- that Google may handle data in the United States;
- each cookie, with how long it lasts.

With nothing configured it says the site counts nothing. Every paragraph is
a Notion slot, so you can add what is particular to you.

## Checking it

`npm run privacy` checks a running site (see
[privacy and security](privacy-and-security.md)). It opens every page three
ways:

- as a reader who hasn't answered;
- after a no;
- after a yes.

It fails on any request that leaves the site, on anything sent to `/ingest`
after a no, and on anything sent to `/ga` before a yes.
