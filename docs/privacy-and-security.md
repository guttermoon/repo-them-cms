# Privacy and security

The rule the whole site is built on: **a reader's browser talks to your site
and nobody else.** This page covers:

- what reaches whom;
- what is kept, and where;
- the defences, and how each is checked.

## What reaches whom

| From | To | When |
|---|---|---|
| The reader's browser | Your site | Always, and only: pages, fonts, pictures, files and analytics all come from your domain |
| The reader's browser | YouTube or Vimeo | Only when the reader presses play on a video |
| The reader's browser | Your Shopify shop | Only when the reader presses Checkout (a navigation, like following a link) |
| Your server | Notion | The rows once a minute at most; a page's body when it has been edited (and every ten minutes at most otherwise); a page's file addresses once every 50 minutes at most (sooner if Notion says they expire sooner, or its file host refuses one). The files themselves come from Notion's file host whenever the CDN holds no copy |
| Your server | A picture's own host | When a Notion page shows a picture by address, the server fetches it and serves it from your domain |
| Your server | Your email platform | When a reader joins the list or sends a message |
| Your server | PostHog or Google | Only after the reader says yes, with the IP address shortened and page addresses cleaned ([analytics](analytics.md)) |
| Your server | PostHog Logs | With `POSTHOG_LOGS_ENDPOINT` set: that a message was delivered or a sign-up accepted, never who ([analytics](analytics.md)) |

**Fonts.** They're files in the repository (`assets/fonts`), served from
`/_next/static/media`. A `<link>` to Google Fonts would hand Google every
reader's IP address on the first page they open. There is no such link, and
a test fails if one appears.

## What is kept, and where

| What | Where | For how long |
|---|---|---|
| The look (light, dark, mono or rainbow), if the reader chose one | Their browser (`site-theme`) | Until they clear it |
| Their answer to the cookie question (only when analytics is on) | Their browser (`site-consent`) | Until they clear it |
| Their cart (only once they add something) | Their browser (`site-cart`) | Until they empty it or clear their browser |
| Analytics cookies and identifiers (only after a yes) | Their browser | PostHog: a cookie for up to a year and a copy in the browser's storage, both deleted by a later no; Google 13 months |
| A sign-up's address and first name | Your email platform | Until they unsubscribe |
| A message from the contact form | Your mailbox, as an email | As long as you keep it |

The site has no database of its own and keeps no records of readers. The
privacy notice at `/privacy` says all of this, and changes with your
settings.

## The defences

### Headers

Every response carries:

- a **Content-Security-Policy**, which allows:
  - scripts, styles, fonts, pictures, media and requests from your site
    only. Inline scripts and styles are allowed too, because Next's
    hydration and the theme script use them, and pictures may be `data:`
    or `blob:`;
  - frames from the two video players only;
  - forms to post to your site only, and no `<base>` pointing elsewhere;
  - no plugins, and no other site framing yours;
- `X-Frame-Options: DENY`;
- `Cross-Origin-Opener-Policy: same-origin`;
- `X-Content-Type-Options: nosniff`;
- a referrer policy that sends other sites your origin only;
- a permissions policy that turns off the camera, microphone, location and
  ad topics;
- HSTS.

They're in `next.config.mjs`, and `tests/third-parties.test.mjs` fails if
the policy goes missing.

### Pictures and files: `/media/`

- **Signed addresses.** Every Notion file is served at
  `/media/<token>/<name>`. The token is HMAC-signed with
  `MEDIA_SIGNING_KEY`, or a key made from `NOTION_TOKEN`. With neither set,
  no media address works at all: a key anybody could work out would turn the
  route into an open proxy.
- **Limits.** Outside files are fetched over https only. A file that says
  it is over 100 MB is refused, and one that doesn't say is cut off there.
- **Never inside your network.** An address that is, or resolves to, a
  private, loopback or link-local one (a cloud's metadata service, a
  database, localhost) isn't fetched. Redirects are followed by the site,
  three at most, each held to the same rule (`lib/outbound.ts`). The
  connection is made to the address that was checked: the name is looked
  up as the socket opens and refused there if any address it has is
  private, so a DNS server that answers one way for the check and another
  for the connection reaches nothing.
- **Pictures at the size they're shown.** A picture is asked for by width
  (`?w=`), resized on the server and sent as WebP
  ([how](development.md#pictures-from-notion)). Only eight widths are ever
  made, so a caller can't make the server resize without end. A picture
  over 40 MB, or claiming more than 50 megapixels, isn't decoded: it is sent
  as it was uploaded.
- **Nothing runs as a page.** A file that could run as a page (HTML,
  JavaScript, XML) is sent as a download. Every file carries a sandboxing
  Content-Security-Policy and `Cross-Origin-Resource-Policy: same-origin`.
- **No image optimiser.** `next.config.mjs` turns Next's image optimiser
  off (`images: { unoptimized: true }`, no remote host), so `/_next/image`
  answers 404: it can't be used to fetch anything from anywhere, or to
  decode anything a stranger chooses. The media route does the resizing.

### Secrets

- **Settings, not code.** Every token and key is an environment variable,
  never in the code. `tests/no-secrets.test.mjs` reads every file git would
  commit and fails on:
  - an email address other than the maker's public one or an example;
  - a token or key shaped like any service's;
  - an analytics or tag manager ID;
  - a real-looking Notion ID;
  - a deployment's own address.
- **Read-only by default.** The site's Notion token only needs Read content.
  The setup and import commands that write use separate, temporary or
  dedicated integrations ([notion](notion.md)).
- **Fail closed.** `/api/revalidate` refuses everything without
  `REVALIDATION_SECRET`. `/api/notion-webhook` refuses events without
  `NOTION_WEBHOOK_SECRET` and checks each one's signature. Secrets and
  signatures are compared in constant time.
- **A stranger can't write the log.** The webhook's one-time verification
  token is printed only when it is shaped like a token, so a line break in
  a forged one can't add lines to the server's log.

### Forms

- **Checked on the server.** Every field is checked there, whatever the
  browser sent. A body that isn't a JSON object is a 400.
- **Bots caught quietly.** A hidden field catches bots without telling them
  they were caught.
- **A message can't carry a script or a disguised link.**
  - The whole message is escaped before any markup is added.
  - In the email you receive, a link's visible text is always its address,
    so a sender can't dress one link up as another.
  - Subject and name are held to one line, so they can't add email headers.
- **No personal details in the server's logs.**

### Rate limits

Each route takes a set number of requests a minute from one address:

| Route | A minute |
|---|---|
| `/api/subscribe`, `/api/contact`, `/api/feedback` | 5 |
| `/api/revalidate` | 20 |
| `/go/` | 60 |
| `/api/notion-webhook` | 120 |
| `/ga/` | 300 |
| `/media/`, `/ingest/` | 600 |

Each instance counts in its own memory first, and a caller already over a
limit there is refused at once. Alone, that stops one client in a loop, not
a flood spread across instances, and a cold start forgets it.

**For one count across every instance, add a shared store:** a Redis that
speaks Upstash's REST API. On Vercel: Storage, the Marketplace, Upstash
(Redis); it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` itself, and
redeploying picks them up. Anywhere else, set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` (`.env.example`). Then (`lib/rate-limit.ts`):

- every route above counts in the store too, but `/ga/` and `/ingest/`:
  the analytics keys are public, so a flood can go to PostHog or Google
  directly anyway, and those routes carry every reader's events;
- the store never holds an address: a caller is a hash of it, keyed with a
  secret of the site's own (`MEDIA_SIGNING_KEY`, else `NOTION_TOKEN`) that
  the store never sees, and each count expires with its minute. A site with
  neither counts in memory, store or no store: a hash keyed with anything
  the store knows could be undone by hashing every address there is;
- each instance's own minute ends where the store's does, so memory never
  refuses a caller the store has started afresh;
- a store that is slow (past 400 ms) or down is never a site that is down:
  each instance counts alone until it answers again, and the log says so
  once.

A firewall in front (Vercel's, or your host's) still does what no counter
can: it drops a flood before it reaches the site at all.

### security.txt

`/.well-known/security.txt` ([RFC 9116](https://www.rfc-editor.org/rfc/rfc9116))
says where to report a security problem with the site, in the form scanners
and researchers look for first (`lib/security-txt.ts`). `/security.txt`
redirects there.

- **Contact:** `SECURITY_CONTACT` (an email address or an https address)
  when it is set, then `NEXT_PUBLIC_CONTACT_EMAIL`, and always the contact
  form with "a problem" chosen. It is your site's contact, never the
  template's maker's: problems with the template itself go to its
  [SECURITY.md](../SECURITY.md).
- **Policy:** your site's `/security` page.
- **Expires:** 180 days after it is drawn, and it is drawn again every day,
  so it never goes past its date.

### Your domain

Some of what a security grade counts is the domain's, not the site's, and
is set where the domain's DNS is kept. A site on a `vercel.app` address has
none of it to set: the address is Vercel's. On a domain of your own:

- **DNSSEC.** Vercel's nameservers do not offer it. Keep the domain's DNS
  with a provider that does (Cloudflare, your registrar, Route 53), turn
  DNSSEC on there, add the DS record it gives you at your registrar, and
  point the domain at Vercel with the records Vercel's domain settings show
  (an A record for the apex, a CNAME for `www`).
- **CAA:** say who may issue the domain's certificates, `0 issue
  "letsencrypt.org"` for Vercel's, so no other authority can.
- **HSTS preload:** the site already sends `preload`; submit the domain at
  [hstspreload.org](https://hstspreload.org) once every subdomain serves
  https.
- **Email:** if the domain sends no email, say so (`v=spf1 -all` as its SPF
  record, and a DMARC record of `v=DMARC1; p=reject`), so nobody can send
  mail that passes as it. If it does, the email platform gives the records.

## Checking a running site

```bash
npm run build && npm start
```

In another terminal:

```bash
npm run privacy
```

It opens every page in Chromium three times: before an answer, after a no,
and after a yes. It records every request, and fails if:

- any request leaves the site;
- a font comes from anywhere but `/_next/static/media`;
- a page loads no font;
- the Content-Security-Policy refuses anything of the site's own;
- anything reaches `/ingest` after a no, or `/ga` before a yes.

Reporting a vulnerability: see [SECURITY.md](../SECURITY.md).
