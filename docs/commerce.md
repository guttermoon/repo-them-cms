# The shop

The shop is a window onto a shop you already have, in **Shopify** or
**Printify**. That shop keeps the catalogue and takes the money; this site
shows the goods and sends the buyer there.

It lives at:

- `/shop`, the shelves, sortable;
- `/shop/collection/<category>`, one shelf per Category;
- `/shop/<slug>`, each product's own page;
- `/cart`.

## One catalogue, kept in your shop

A product is described once, in Shopify or Printify. `npm run shop:import`
copies it into Notion as a **Product** row, and the site reads the row. The
row is a copy, never a second place to edit: the next import puts back
whatever the shop says.

| Kept in your shop (the import writes it, every time) | Kept in Notion (the import never touches it) |
|---|---|
| Title | Published: whether it shows |
| Description: the line on the card and the long one on the page | Slug: its address under `/shop` |
| Price, compare-at price, currency | Featured and Order: where it stands on the shelf |
| Whether it can be bought (Stock) | Low stock or Pre-order, while it can be bought |
| Variants: sizes, colours and their checkout IDs | |
| Buy link | |
| Pictures | |
| Collection (Shopify's product type) and tags | |

So to change a t-shirt's description, change it in the shop and run the
import. A description reworded in Notion is not a second version to keep in
mind: the dry run shows it as a change, and `--write` replaces it.

Three things to know:

- **A field your shop leaves blank is yours.** A product with no
  description, no product type or no tags keeps whatever Notion has there.
- **Pictures you uploaded in Notion are kept**, and the plan says so. Take
  them off the row to have the shop's.
- **A product typed straight into Notion** has no shop behind it, so
  nothing keeps it in step. The import names every such row.

Run the import whenever the catalogue changes. Without `--write` it changes
nothing and prints every difference, so it is also the check that the two
agree.

## How it sells: `COMMERCE_PROVIDER`

| Setting | What the product button does | Checkout |
|---|---|---|
| unset | Adds to a cart that works but sells nothing | Switched off, and the cart says so |
| `shopify` (with `SHOPIFY_STORE_DOMAIN`) | Adds the chosen variant to the cart | At your Shopify shop, through a cart permalink |
| `printify` | Opens the product's page in your Printify Pop-Up Store, in a new tab | There |

### The example shop (no setting)

A fresh site is an example shop: the starter content's generic goods, with
prices, pictures and a working cart. Nothing can be bought from the site.
(The one way out is your own doing: a product row with no Checkout ID and
an https Link still shows its Buy link.)

- A note says so on every shop page.
- The shop is marked `noindex`, and is left out of the sitemap and
  `/llms.txt`.
- No product is marked up as an offer in the structured data.

Fictional goods never reach a search result as things for sale. Set
`COMMERCE_PROVIDER` and the shop is indexed and marked up like any other.
Unpublish the example products then: they are rows nobody's shop holds.

### Shopify

```
COMMERCE_PROVIDER=shopify
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
```

The cart checks out through Shopify's **cart permalink**,
`https://<shop>/cart/<variant>:<quantity>,…`:

- **No API key, no app, no script on your site.**
- **Nothing is sent to Shopify** until the reader presses Checkout, which
  navigates to the shop.
- **Shopify prices the cart from its own records.** A reader cannot change a
  price, and Shopify runs the checkout, taxes, shipping and payment.
  - The price on the shop page is the import's copy of Shopify's. Run the
    import after a price changes, so the page and the checkout agree.

Each product's **Checkout ID** holds its Shopify variant IDs, written by the
import:

- one ID for a product with no options (`40000000000001`);
- otherwise one `Label: ID` a line (`Small: 40000000000002`). The labels are
  what the reader chooses between.

A product with no Checkout ID but an https **Link** gets a Buy button
instead. One with neither gets "Ask about it", which opens the contact form
with the product named.

### Printify

Printify sells through a shop it is connected to. Either way works here:

- **Printify connected to a Shopify shop.**
  - Use `COMMERCE_PROVIDER=shopify` as above. Printify fulfils the orders as
    usual.
  - `npm run shop:import -- --from shopify` brings the products in with
    their variant IDs. Shopify is the catalogue; import from it, not from
    both.
- **A Printify Pop-Up Store.**
  - Use `COMMERCE_PROVIDER=printify`. Each product's **Link** is its page in
    the store, and its button goes there. The header offers no cart (the
    store has its own), and /cart says each product is bought from its page.
  - `npm run shop:import -- --from printify` brings the products in, each
    with its store address as its Link.

(`COMMERCE_PROVIDER=links` is the older name for `printify`, and still
works.)

## Product rows

Every property the import writes is marked. Change those in your shop.

| Property | What it does | Kept in |
|---|---|---|
| Title | The product's name | Your shop |
| Slug | Its address under `/shop` (one segment) | Notion |
| Published | Whether it shows. A new row arrives unticked | Notion |
| Description | The line on its card, in search results and in share previews: the opening of the shop's description | Your shop |
| Image, Gallery | Its pictures, in order. They are served from this site, as every picture is. Each picture's name is its description for screen readers: Shopify's alt text, written by the import ([describing pictures](notion.md#describing-pictures)) | Your shop. Where the shop has no alt text (Printify has none), a name you give a picture in Notion stands |
| Price, Currency | The price shown (Currency is any three-letter code; empty is GBP) | Your shop |
| Compare-at Price | An old price, shown struck through | Your shop (Shopify) |
| Stock | In stock, Low stock, Sold out (keeps the page, stops the button) or Pre-order | Your shop says whether it can be bought; Low stock and Pre-order are yours |
| Checkout ID | Shopify variant IDs (above) | Your shop (Shopify) |
| Link | The product's page in the shop, https only | Your shop |
| Category | Its collection: `/shop/collection/<category>` | Your shop (Shopify's product type) |
| Tags | Its tags | Your shop |
| Featured, Order | Featured products come first, then by Order | Notion |
| The row's page | The long description, under "details" | Your shop |
| Import ID | Which product in the shop the row is a copy of | The import |

`npm run notion:check` warns about a product with no Price, and says when one
can only be asked about.

## The cart

- **It lives in the reader's browser**, under `site-cart` in localStorage.
  Nothing is written until they add something, and the privacy notice lists
  it.
- **It holds up to 50 lines of up to 99 each.** A change is announced to
  screen readers.
- **A line that can no longer be bought stays in the cart, marked**, so the
  reader can take it out. That covers a product that has left the shop, one
  that's sold out, and a size or colour no longer offered. It's left out of
  the checkout and the subtotal, where Shopify would refuse it.

## `npm run shop:import`

Copies your catalogue into Product rows, from Shopify (its Storefront API)
or from Printify (its REST API), and keeps the rows in step with it. One
way only: nothing is ever written to your shop.

```bash
npm run shop:import                        # a dry run: what would change
npm run shop:import -- --write             # make the changes
npm run shop:import -- --from printify     # when both platforms are set up
```

### What it will and will not do

- **A dry run by default.** It reads both sides and prints the plan:
  - new rows;
  - changes, field by field, old → new;
  - rows already up to date;
  - products the platform no longer has;
  - rows typed into Notion that no product in the shop matches;
  - products it skipped, and why.
- **It never deletes a row.** A product that has gone from the platform is
  reported, and unpublishing it is up to you.
- **New rows are unpublished.** They arrive with the platform's title,
  description (as paragraphs and lists), pictures, price, stock, tags and,
  from Shopify, collection. Check each one, then tick Published.
- **An update writes everything the platform says** (the table under
  [one catalogue](#one-catalogue-kept-in-your-shop)): a title, a description
  or a price changed in Notion is changed back.
  - The row's page is rewritten when it is not the shop's description: its
    blocks are taken out and the shop's paragraphs and lists put in (the
    new ones first, so a request that fails leaves nothing lost). A
    picture or a heading added there in Notion goes with them; the dry run
    says "details" for every page it would rewrite. Notion's page history
    keeps the old one.
- **It never writes Published, Slug, Featured or Order.** Those are how you
  arrange the shop, and only Notion knows them.
- **Pictures you uploaded in Notion are never replaced.** It only swaps
  pictures that are addresses, which is what it writes.
- **Each picture is named with the shop's alt text**, which the site reads as
  its description. Change the alt text in Shopify and the next import
  renames the picture; the dry run says "picture descriptions". Where the
  shop gives a picture no alt text, the name it has in Notion stands.
- **Low stock and Pre-order are yours.** The platform says only "can be
  bought" or "cannot":
  - when it can, your Low stock or Pre-order stands;
  - when it cannot, the row becomes Sold out.
- **It finds a row again by its Import ID** (`shopify:123`, `printify:abc`),
  so renaming a product's Slug in Notion doesn't make a second one.
  - A row you wrote by hand with the same address is adopted, not
    duplicated, and takes the shop's words.
  - A new product whose address another row holds gets a free one
    (`corn-flakes-2`), and the plan says so.
- **Missing properties are added.** If the database lacks a property the
  import writes (Import ID, say), `--write` adds it first. A property of the
  wrong type stops the import with a message.

### What it needs

| Setting | From |
|---|---|
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_TOKEN` | Shopify admin → Sales channels → Headless (add the channel), then a storefront's **public access token**. It reads only what the shop publishes: no orders, no customers. `SHOPIFY_API_VERSION` picks a Storefront API version other than the one the code is written against (`2026-10`). |
| `PRINTIFY_API_TOKEN`, `PRINTIFY_SHOP_ID` | Printify → My Profile → Connections → a personal access token that can read shops and products. Leave `PRINTIFY_SHOP_ID` unset once, and the import lists the shops the token can see. `PRINTIFY_CURRENCY` is the shop's currency (Printify's API doesn't say; USD unless set). |
| `NOTION_DATABASE_ID`, and `NOTION_IMPORT_TOKEN` to write | An integration of its own with Read, Insert and Update content, shared with the database. The site's `NOTION_TOKEN` stays read-only; a dry run reads with whichever of the two is set. |

Prices come in as the platform has them: Shopify's in the shop's currency,
Printify's from whole cents. Shopify gives the cheapest priced variant, sold
out or not, and that variant's compare-at price when it is higher.

Exit codes:

| Code | Meaning |
|---|---|
| 0 | Done |
| 1 | A setting to fix |
| 2 | The platform could not be read |
| 3 | Notion could not be read or written |

Every message names the setting to fix, and none prints a token.

### Being a good API client

- **Shopify:** the import asks for 50 products a page. When Shopify says a
  query costs too much, it asks again for fewer. A product with more than a
  hundred variants has the rest fetched separately.
- **Printify:** it asks for 50 a page, and falls back to Printify's own page
  size if that is refused.
- **Busy answers:** 429, Shopify's 430 and 5xx are retried with backoff,
  honouring `Retry-After`.
- **Notion:** it reads and writes one request at a time, well inside Notion's
  limit. It reads the page of each row it compares, so a large catalogue
  takes a request a product.

## Structured data and search

With the shop live, each product page carries Product structured data:

- its name and pictures;
- one Offer with its real price, currency and availability, when the row
  has a Price;
- a breadcrumb trail.

It never carries a rating or a review the shop doesn't have. Products and
collections are in the sitemap, and products in `/llms-full.txt`.

## How the shop moves

Three movements, each an answer to something the reader did, and none of
them under `prefers-reduced-motion` ([design](design.md)):

- **Added to the cart.** The scanner's line crosses the buying form once,
  with a short tap where the phone can give one. The words "added to the
  cart" are still announced; the line is for the eye.
- **Off the shelf.** Under the pointer or the keyboard's focus, a product's
  picture frame takes the accent and the picture eases in; the cards beside
  it step back. Nothing is lifted on a shadow.
- **The receipt.** The cart's total is drawn as a till receipt, torn along
  its foot, and prints once when the cart opens.
