# Email

Two forms send email:

- **the mailing list** in the footer (`/api/subscribe`);
- **the contact form** on `/contact` (`/api/contact`).

Both use whichever platform you already have. The site keeps no email
addresses of its own. Each one goes to your platform and nowhere else.

## Choosing a platform

`EMAIL_PROVIDER` picks the platform for both forms. Leave it unset and Brevo
is used when `BREVO_API_KEY` is set.

Some platforms keep a list but send no email of their own. With one of
those, set `CONTACT_EMAIL_PROVIDER` to another platform for the contact form,
for example Mailchimp for the list and Postmark for the messages.

**One key for both forms:** Brevo, Resend or SendGrid. If you have no
platform yet, start with one of those. **Selling through Shopify:** Klaviyo
is the usual list there; pair it with one of the three for the contact form.

| `EMAIL_PROVIDER` | The list | The contact form | Settings |
|---|---|---|---|
| `brevo` | yes | yes | `BREVO_API_KEY`; optionally `BREVO_LIST_NAME` or `BREVO_LIST_ID`, and double opt-in (below) |
| `mailchimp` | yes | no | `MAILCHIMP_API_KEY` (it ends in its data centre, such as `-us21`), `MAILCHIMP_AUDIENCE_ID`, and `MAILCHIMP_DOUBLE_OPT_IN=false` to turn confirmation off |
| `mailerlite` | yes | no | `MAILERLITE_API_KEY`, optionally `MAILERLITE_GROUP_ID` |
| `kit` | yes | no | `KIT_API_KEY`, `KIT_FORM_ID` |
| `buttondown` | yes | no | `BUTTONDOWN_API_KEY` |
| `klaviyo` | yes | no | `KLAVIYO_API_KEY` (a private key that may write lists, profiles and subscriptions), optionally `KLAVIYO_LIST_ID`, and `KLAVIYO_DOUBLE_OPT_IN=false` when the list is single opt-in |
| `beehiiv` | yes | no | `BEEHIIV_API_KEY`, `BEEHIIV_PUBLICATION_ID` (it starts `pub_`), `BEEHIIV_WELCOME_EMAIL=false` to send no welcome email, and optionally `BEEHIIV_DOUBLE_OPT_IN` |
| `loops` | yes | no | `LOOPS_API_KEY`, optionally `LOOPS_MAILING_LIST_ID` |
| `resend` | yes | yes | `RESEND_API_KEY`, optionally `RESEND_SEGMENT_ID` |
| `postmark` | no | yes | `POSTMARK_SERVER_TOKEN`, optionally `POSTMARK_MESSAGE_STREAM` (`outbound` unless set) |
| `sendgrid` | yes | yes | `SENDGRID_API_KEY`, optionally `SENDGRID_LIST_ID` |
| `webhook` | yes | yes | `EMAIL_WEBHOOK_URL`, optionally `EMAIL_WEBHOOK_SECRET` |

The contact form also needs two addresses:

- `CONTACT_TO_EMAIL`: where messages go.
- `EMAIL_FROM`: the sender. It must be an address your platform has
  verified. The webhook needs no `EMAIL_FROM`.

Each message is sent from your address with the visitor's as its Reply-To,
so answering it replies to them.

`.env.example` lists every setting with a placeholder.

### The webhook

For Zapier, Make, n8n or your own code:

- **What is sent:** each sign-up and each message is POSTed to
  `EMAIL_WEBHOOK_URL` as JSON.
- **Signing:** with `EMAIL_WEBHOOK_SECRET` set, each request carries
  `X-Signature: sha256=<hex HMAC-SHA256 of the body, keyed with the secret>`.
  Check it at the other end before trusting a request.

## Double opt-in

Some platforms send a confirmation email first, and add the address only
once it's clicked. The form then says "Check your inbox" rather than "You are
on the list".

| Platform | How double opt-in is set |
|---|---|
| Brevo | Set both `BREVO_DOI_TEMPLATE_ID` (a template of the double opt-in kind) and `BREVO_DOI_REDIRECT_URL` (where readers land after confirming, normally `https://<your site>/subscribed`). With only one set, the site uses single opt-in and logs a warning. |
| Mailchimp | On unless `MAILCHIMP_DOUBLE_OPT_IN=false`. Mailchimp sends the confirmation. |
| Klaviyo | In the list's own settings in Klaviyo (on by default). Klaviyo's answer does not say which, so the form says "Check your inbox" unless `KLAVIYO_DOUBLE_OPT_IN=false`: set that when the list is single opt-in. |
| beehiiv | In the publication's own settings, or `BEEHIIV_DOUBLE_OPT_IN=true` or `false` to say which for sign-ups from the site. Left to the publication, beehiiv does not always say at once, and the form then says "Check your inbox". |
| MailerLite, Kit, Buttondown | In the platform's own settings. The site reads the answer and says "Check your inbox" when the address is waiting to be confirmed. |

## Getting the platform ready

`npm run build` runs `npm run email:setup` first.

- **For Brevo:** it finds the list by name (`BREVO_LIST_NAME`, or
  "<site name> newsletter") and makes it, inside a folder named after the site,
  when it's missing.
- **Other platforms:** nothing needs making in advance.
- **It never fails a build:** without a key, or when the platform refuses,
  it says so and the build goes on. The site makes the list on first use
  anyway.

## What the forms promise

- **The address is checked before anything is sent**, by the same rule in
  the browser and on the server.
- **A form says it worked only when the platform said so.** With no platform
  set, the routes accept in development (and log that nothing was sent) and
  answer 503 in production. A form never claims a success it didn't have.
- **Bots are caught quietly.** Both forms have a hidden field that people
  never see or reach with the keyboard. A request that fills it gets a polite
  answer and sends nothing.
- **Each address is rate limited:** a few sign-ups and messages a minute.
- **The server logs no personal details.**
- **The privacy notice names your platform.** On `/privacy` it says which
  platform handles each form, and links its privacy policy, from the
  settings you have.
