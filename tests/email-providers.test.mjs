// Every email platform (lib/email): which one is chosen, what each is
// missing, and the exact request each sends, against a fake fetch. A platform
// that changes its API is a one-file fix in lib/email/providers; this file is
// what says which request the site was making.
import { afterEach, beforeEach, test } from "node:test"
import assert from "node:assert/strict"
import { createHash, createHmac } from "node:crypto"

import { contactProvider, contactReady, listProvider, listReady, mailboxes, PROVIDERS, processors, sendMessage, subscribe } from "../lib/email/index.ts"
import { errorText, mailbox } from "../lib/email/http.ts"
import { KLAVIYO_REVISION } from "../lib/email/providers/klaviyo.ts"
import { signature } from "../lib/email/providers/webhook.ts"
import { SITE_NAME } from "../lib/site.ts"

/** Every request made, and the answers to give, in order, by URL. */
let requests = []
let answers = []
const realFetch = globalThis.fetch
const quiet = console.warn

beforeEach(() => {
  requests = []
  answers = []
  console.warn = () => {}
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input)
    const body = init.body ? JSON.parse(init.body) : undefined
    requests.push({ url, method: init.method ?? "GET", headers: init.headers ?? {}, body, raw: init.body })
    const found = answers.findIndex(([pattern]) => pattern.test(url))
    if (found < 0) return Response.json({}, { status: 200 })
    const [, answer] = answers.splice(found, 1)[0]
    return typeof answer === "function" ? answer() : Response.json(answer.body ?? {}, { status: answer.status ?? 200 })
  }
})
afterEach(() => {
  globalThis.fetch = realFetch
  console.warn = quiet
})

const answer = (pattern, body, status = 200) => answers.push([pattern, { body, status }])
const READER = { email: "reader@example.com", firstName: "Ada" }
const MESSAGE = { subject: "Hello", text: "Plain words.", html: "<p>Plain words.</p>", replyTo: { email: "writer@example.org", name: "Writer" } }
const MAIL = { CONTACT_TO_EMAIL: "owner@example.net", EMAIL_FROM: "site@example.net" }

// ------------------------------------------------------------ choosing

test("the platform: EMAIL_PROVIDER, else Brevo when its key is set, else none", () => {
  assert.equal(listProvider({}), null)
  assert.equal(listProvider({ BREVO_API_KEY: "k" }).id, "brevo")
  assert.equal(listProvider({ EMAIL_PROVIDER: " Kit ", BREVO_API_KEY: "k" }).id, "kit")
  assert.equal(listProvider({ EMAIL_PROVIDER: "nonsense" }), null, "an unknown name is no platform, not a guess")
  assert.equal(contactProvider({ EMAIL_PROVIDER: "mailchimp", CONTACT_EMAIL_PROVIDER: "postmark" }).id, "postmark")
  assert.equal(contactProvider({ EMAIL_PROVIDER: "resend" }).id, "resend", "one platform for both jobs by default")
  assert.deepEqual(Object.keys(PROVIDERS).sort(), ["beehiiv", "brevo", "buttondown", "kit", "klaviyo", "loops", "mailchimp", "mailerlite", "postmark", "resend", "sendgrid", "webhook"])
})

test("nothing set up is 'unconfigured' with the reason, never an error and never a request", async () => {
  assert.equal((await subscribe(READER, {})).status, "unconfigured")
  assert.match((await subscribe(READER, { EMAIL_PROVIDER: "mailchimp" })).reason, /MAILCHIMP_API_KEY/)
  assert.match((await subscribe(READER, { EMAIL_PROVIDER: "mailchimp", MAILCHIMP_API_KEY: "abc-us21" })).reason, /MAILCHIMP_AUDIENCE_ID/)
  assert.match((await subscribe(READER, { EMAIL_PROVIDER: "postmark", POSTMARK_SERVER_TOKEN: "t" })).reason, /keeps no mailing list/)
  assert.match((await sendMessage(MESSAGE, { EMAIL_PROVIDER: "kit", KIT_API_KEY: "k", KIT_FORM_ID: "1", ...MAIL })).reason, /CONTACT_EMAIL_PROVIDER/)
  assert.match((await sendMessage(MESSAGE, { BREVO_API_KEY: "k" })).reason, /CONTACT_TO_EMAIL/)
  assert.match((await sendMessage(MESSAGE, { BREVO_API_KEY: "k", CONTACT_TO_EMAIL: "o@example.net" })).reason, /EMAIL_FROM/)
  assert.match((await sendMessage(MESSAGE, { EMAIL_PROVIDER: "webhook", EMAIL_WEBHOOK_URL: "http://plain.example/" })).reason, /https/)
  assert.equal(requests.length, 0)
})

test("mailboxes, and every platform in use named once for the privacy notice", () => {
  assert.deepEqual(mailboxes({ CONTACT_TO_EMAIL: " a@example.net ", EMAIL_FROM: "" }), { to: "a@example.net", from: undefined })
  assert.deepEqual(processors({}), [])
  assert.deepEqual(processors({ BREVO_API_KEY: "k" }).map((p) => p.name), ["Brevo"])
  assert.deepEqual(processors({ EMAIL_PROVIDER: "mailchimp", CONTACT_EMAIL_PROVIDER: "postmark" }).map((p) => p.name), ["Mailchimp", "Postmark"])
  for (const p of Object.values(PROVIDERS)) if (p.id !== "webhook") assert.match(p.privacyUrl, /^https:\/\//, p.id)
})

// ------------------------------------------------------------ Brevo

const BREVO = { BREVO_API_KEY: "brevo-key", BREVO_API_URL: "https://brevo.test/v3", BREVO_LIST_NAME: `List ${Math.random()}` }

test("Brevo: finds the list by name and adds the contact to it, updating rather than duplicating", async () => {
  answer(/\/contacts\/lists\?limit=50&offset=0$/, { lists: [{ id: 9, name: "Other" }, { id: 7, name: BREVO.BREVO_LIST_NAME }, { id: 3, name: BREVO.BREVO_LIST_NAME }] })
  assert.deepEqual(await subscribe(READER, BREVO), { status: "subscribed" })
  const add = requests.at(-1)
  assert.equal(add.url, "https://brevo.test/v3/contacts")
  assert.equal(add.method, "POST")
  assert.equal(add.headers["api-key"], "brevo-key")
  assert.deepEqual(add.body, { email: READER.email, attributes: { FIRSTNAME: "Ada" }, listIds: [3], updateEnabled: true })
  assert.ok(!("emailBlacklisted" in add.body), "an unsubscribed address stays unsubscribed")
  // the list is remembered: the next sign-up asks for it no more
  requests = []
  await subscribe(READER, BREVO)
  assert.deepEqual(requests.map((r) => r.url), ["https://brevo.test/v3/contacts"])
})

test("Brevo: a missing list is made, in a folder named after the site", async () => {
  const env = { ...BREVO, BREVO_LIST_NAME: `New ${Math.random()}` }
  answer(/\/contacts\/lists\?/, { lists: [] })
  answer(/\/contacts\/folders\?/, { folders: [] })
  answer(/\/contacts\/folders$/, { id: 41 })
  answer(/\/contacts\/lists$/, { id: 42 })
  assert.equal((await subscribe(READER, env)).status, "subscribed")
  const [, , folder, list, add] = requests
  assert.deepEqual(folder.body, { name: SITE_NAME })
  assert.deepEqual(list.body, { name: env.BREVO_LIST_NAME, folderId: 41 })
  assert.deepEqual(add.body.listIds, [42])
})

test("Brevo: double opt-in needs both settings, and then sends the confirmation instead", async () => {
  const env = { ...BREVO, BREVO_LIST_ID: "5", BREVO_DOI_TEMPLATE_ID: "12", BREVO_DOI_REDIRECT_URL: "https://site.example/subscribed" }
  assert.deepEqual(await subscribe({ email: READER.email }, env), { status: "pending" })
  assert.equal(requests.length, 1, "a pinned list is not looked up")
  assert.equal(requests[0].url, "https://brevo.test/v3/contacts/doubleOptinConfirmation")
  assert.deepEqual(requests[0].body, { email: READER.email, attributes: {}, includeListIds: [5], templateId: 12, redirectionUrl: "https://site.example/subscribed" })
  requests = []
  assert.deepEqual(await subscribe(READER, { ...env, BREVO_DOI_REDIRECT_URL: "" }), { status: "subscribed" }, "half a setting is single opt-in")
})

test("Brevo: the contact form is a transactional email from the verified sender, replying to the writer", async () => {
  assert.deepEqual(await sendMessage(MESSAGE, { ...BREVO, ...MAIL }), { status: "sent" })
  assert.equal(requests[0].url, "https://brevo.test/v3/smtp/email")
  assert.deepEqual(requests[0].body, {
    sender: { email: MAIL.EMAIL_FROM, name: SITE_NAME },
    to: [{ email: MAIL.CONTACT_TO_EMAIL }],
    subject: "Hello",
    textContent: "Plain words.",
    htmlContent: "<p>Plain words.</p>",
    replyTo: MESSAGE.replyTo,
  })
})

test("a refusal is an error the log can hold: what the platform said, without the reader's address", async () => {
  answer(/smtp\/email/, { code: "invalid_parameter", message: "reader@example.com is not valid" }, 400)
  const result = await sendMessage(MESSAGE, { ...BREVO, ...MAIL })
  assert.equal(result.status, "error")
  assert.match(result.message, /^Brevo responded 400: invalid_parameter/)
  assert.ok(!result.message.includes("reader@example.com"), result.message)
  assert.equal(errorText("X", 500, { message: "a".repeat(500) }).length, "X responded 500: ".length + 200)
  globalThis.fetch = async () => {
    throw new Error("network down")
  }
  assert.deepEqual(await sendMessage(MESSAGE, { ...BREVO, ...MAIL }), { status: "error", message: "network down" })
})

// ------------------------------------------------------------ the others

test("Mailchimp: one PUT to the member's hash, pending unless double opt-in is switched off", async () => {
  const env = { EMAIL_PROVIDER: "mailchimp", MAILCHIMP_API_KEY: "secretkey-us21", MAILCHIMP_AUDIENCE_ID: "aud1" }
  answer(/mailchimp/, { status: "pending" })
  assert.deepEqual(await subscribe({ email: "Reader@Example.com", firstName: "Ada" }, env), { status: "pending" })
  const hash = createHash("md5").update("reader@example.com").digest("hex")
  assert.equal(requests[0].url, `https://us21.api.mailchimp.com/3.0/lists/aud1/members/${hash}`)
  assert.equal(requests[0].method, "PUT")
  assert.equal(requests[0].headers.Authorization, `Basic ${Buffer.from("site:secretkey-us21").toString("base64")}`)
  assert.deepEqual(requests[0].body, { email_address: "Reader@Example.com", status_if_new: "pending", merge_fields: { FNAME: "Ada" } })
  answer(/mailchimp/, { status: "subscribed" })
  assert.deepEqual(await subscribe(READER, { ...env, MAILCHIMP_DOUBLE_OPT_IN: "false" }), { status: "subscribed" })
  assert.equal(requests[1].body.status_if_new, "subscribed")
})

test("MailerLite: the subscriber, in the group, pending when the account confirms first", async () => {
  const env = { EMAIL_PROVIDER: "mailerlite", MAILERLITE_API_KEY: "ml", MAILERLITE_GROUP_ID: "g1" }
  answer(/mailerlite/, { data: { status: "unconfirmed" } })
  assert.deepEqual(await subscribe(READER, env), { status: "pending" })
  assert.equal(requests[0].url, "https://connect.mailerlite.com/api/subscribers")
  assert.equal(requests[0].headers.Authorization, "Bearer ml")
  assert.deepEqual(requests[0].body, { email: READER.email, fields: { name: "Ada" }, groups: ["g1"] })
})

test("Kit: the subscriber, then the form, as Kit's own sign-up forms do", async () => {
  const env = { EMAIL_PROVIDER: "kit", KIT_API_KEY: "kk", KIT_FORM_ID: "77" }
  answer(/\/forms\/77\/subscribers$/, { subscriber: { state: "inactive" } })
  assert.deepEqual(await subscribe(READER, env), { status: "pending" })
  assert.deepEqual(
    requests.map((r) => [r.url, r.headers["X-Kit-Api-Key"], r.body]),
    [
      ["https://api.kit.com/v4/subscribers", "kk", { email_address: READER.email, first_name: "Ada" }],
      ["https://api.kit.com/v4/forms/77/subscribers", "kk", { email_address: READER.email }],
    ],
  )
})

test("Buttondown: the subscriber; already on the list is the same answer as joining", async () => {
  const env = { EMAIL_PROVIDER: "buttondown", BUTTONDOWN_API_KEY: "bd" }
  answer(/buttondown/, { type: "unactivated" })
  assert.deepEqual(await subscribe(READER, env), { status: "pending" })
  assert.equal(requests[0].url, "https://api.buttondown.email/v1/subscribers")
  assert.equal(requests[0].headers.Authorization, "Token bd")
  assert.deepEqual(requests[0].body, { email_address: READER.email, metadata: { first_name: "Ada" } })
  answer(/buttondown/, { code: "email_already_exists", detail: "That address is already subscribed." }, 400)
  assert.deepEqual(await subscribe(READER, env), { status: "subscribed" })
  answer(/buttondown/, { code: "subscriber_blocked" }, 400)
  assert.equal((await subscribe(READER, env)).status, "error")
})

test("Klaviyo: consent to email marketing, in the list; pending unless the list is known to be single opt-in", async () => {
  const env = { EMAIL_PROVIDER: "klaviyo", KLAVIYO_API_KEY: " pk_k ", KLAVIYO_LIST_ID: "Y6nRLr" }
  // Klaviyo answers 202 with no body
  answers.push([/klaviyo/, () => new Response(null, { status: 202 })])
  assert.deepEqual(await subscribe(READER, env), { status: "pending" }, "double opt-in is Klaviyo's default, and its answer does not say")
  const [request] = requests
  assert.equal(request.url, "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs")
  assert.equal(request.method, "POST")
  assert.equal(request.headers.Authorization, "Klaviyo-API-Key pk_k")
  assert.equal(request.headers.revision, KLAVIYO_REVISION)
  assert.match(KLAVIYO_REVISION, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(request.headers["Content-Type"], "application/vnd.api+json")
  assert.equal(request.headers.Accept, "application/vnd.api+json")
  assert.deepEqual(request.body, {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        custom_source: "Website sign-up form",
        profiles: { data: [{ type: "profile", attributes: { email: READER.email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } } }] },
      },
      relationships: { list: { data: { type: "list", id: "Y6nRLr" } } },
    },
  })
  assert.deepEqual(await subscribe(READER, { EMAIL_PROVIDER: "klaviyo", KLAVIYO_API_KEY: "pk_k", KLAVIYO_DOUBLE_OPT_IN: "False" }), { status: "subscribed" })
  assert.ok(!("relationships" in requests[1].body.data), "no list: the account's own opt-in setting applies")
  answer(/klaviyo/, { errors: [{ id: "1", code: "invalid", title: "Invalid input.", detail: "reader@example.com is not a valid email." }] }, 400)
  const refused = await subscribe(READER, env)
  assert.equal(refused.message, "Klaviyo responded 400: invalid Invalid input. [address] is not a valid email.", "the reason is inside errors[0], and the address is not logged")
  assert.match((await subscribe(READER, { EMAIL_PROVIDER: "klaviyo" })).reason, /KLAVIYO_API_KEY/)
  assert.match((await sendMessage(MESSAGE, { EMAIL_PROVIDER: "klaviyo", KLAVIYO_API_KEY: "k", ...MAIL })).reason, /CONTACT_EMAIL_PROVIDER/)
})

test("beehiiv: a subscription to the publication, resubscribing and welcoming; pending when it confirms first", async () => {
  const env = { EMAIL_PROVIDER: "beehiiv", BEEHIIV_API_KEY: "bh", BEEHIIV_PUBLICATION_ID: "pub_00000000-0000-0000-0000-000000000000" }
  answer(/beehiiv/, { data: { id: "sub_1", status: "pending" } })
  assert.deepEqual(await subscribe(READER, env), { status: "pending" })
  assert.equal(requests[0].url, "https://api.beehiiv.com/v2/publications/pub_00000000-0000-0000-0000-000000000000/subscriptions")
  assert.equal(requests[0].method, "POST")
  assert.equal(requests[0].headers.Authorization, "Bearer bh")
  assert.deepEqual(requests[0].body, { email: READER.email, reactivate_existing: true, send_welcome_email: true, utm_source: "website", custom_fields: [{ name: "First Name", value: "Ada" }] })
  answer(/beehiiv/, { data: { status: "validating" } })
  assert.deepEqual(await subscribe({ email: READER.email }, { ...env, BEEHIIV_WELCOME_EMAIL: "false" }), { status: "pending" }, "not yet decided: a confirmation may be waiting")
  assert.deepEqual(requests[1].body, { email: READER.email, reactivate_existing: true, send_welcome_email: false, utm_source: "website" })
  answer(/beehiiv/, { data: { status: "active" } })
  assert.deepEqual(await subscribe(READER, env), { status: "subscribed" })
  // said outright, it is sent as beehiiv's override and is what the form says
  answer(/beehiiv/, { data: { status: "validating" } })
  assert.deepEqual(await subscribe(READER, { ...env, BEEHIIV_DOUBLE_OPT_IN: "false" }), { status: "subscribed" })
  assert.equal(requests[3].body.double_opt_override, "off")
  answer(/beehiiv/, { data: { status: "validating" } })
  assert.deepEqual(await subscribe(READER, { ...env, BEEHIIV_DOUBLE_OPT_IN: " True " }), { status: "pending" })
  assert.equal(requests[4].body.double_opt_override, "on")
  requests.length = 2
  answer(/beehiiv/, { data: { status: "invalid" } })
  assert.equal((await subscribe(READER, env)).status, "error", "an address beehiiv calls invalid is not a success")
  answer(/beehiiv/, { status: 404, statusText: "Not Found", errors: [{ message: "Publication not found", code: "not_found" }] }, 404)
  assert.equal((await subscribe(READER, env)).message, "beehiiv responded 404: not_found Publication not found")
  assert.match((await subscribe(READER, { EMAIL_PROVIDER: "beehiiv", BEEHIIV_API_KEY: "bh" })).reason, /BEEHIIV_PUBLICATION_ID/)
  assert.match((await subscribe(READER, { EMAIL_PROVIDER: "beehiiv", BEEHIIV_API_KEY: "bh", BEEHIIV_PUBLICATION_ID: "../x" })).reason, /starts pub_/, "the ID goes in the address, so it is held to its shape")
  assert.equal(requests.length, 4)
})

test("Loops: the contact, made or updated, subscribed and in the mailing list", async () => {
  const env = { EMAIL_PROVIDER: "loops", LOOPS_API_KEY: "lp", LOOPS_MAILING_LIST_ID: "clm2k8j4h6g0f8d6s4a2b0z8" }
  answer(/loops/, { success: true, id: "c1" })
  assert.deepEqual(await subscribe(READER, env), { status: "subscribed" })
  assert.equal(requests[0].url, "https://app.loops.so/api/v1/contacts/update")
  assert.equal(requests[0].method, "PUT", "update makes the contact when it is not there")
  assert.equal(requests[0].headers.Authorization, "Bearer lp")
  assert.deepEqual(requests[0].body, { email: READER.email, subscribed: true, firstName: "Ada", mailingLists: { clm2k8j4h6g0f8d6s4a2b0z8: true } })
  await subscribe({ email: READER.email }, { EMAIL_PROVIDER: "loops", LOOPS_API_KEY: "lp" })
  assert.deepEqual(requests[1].body, { email: READER.email, subscribed: true })
  answer(/loops/, { success: false, message: "Invalid email address." }, 400)
  assert.equal((await subscribe(READER, env)).message, "Loops responded 400: Invalid email address.")
  answer(/loops/, { success: false, message: "Nope." })
  assert.equal((await subscribe(READER, env)).status, "error", "a 200 that says it failed is a failure")
  assert.match((await sendMessage(MESSAGE, { EMAIL_PROVIDER: "loops", LOOPS_API_KEY: "lp", ...MAIL })).reason, /CONTACT_EMAIL_PROVIDER/)
})

test("Resend: a contact in the segment, and the contact form as an email", async () => {
  const env = { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re", RESEND_SEGMENT_ID: "seg", ...MAIL }
  assert.deepEqual(await subscribe(READER, env), { status: "subscribed" })
  assert.equal(requests[0].url, "https://api.resend.com/contacts")
  assert.equal(requests[0].headers.Authorization, "Bearer re")
  assert.deepEqual(requests[0].body, { email: READER.email, unsubscribed: false, first_name: "Ada", segments: [{ id: "seg" }] })
  assert.deepEqual(await sendMessage(MESSAGE, env), { status: "sent" })
  assert.equal(requests[1].url, "https://api.resend.com/emails")
  assert.deepEqual(requests[1].body, {
    from: `${SITE_NAME} <${MAIL.EMAIL_FROM}>`,
    to: [MAIL.CONTACT_TO_EMAIL],
    subject: "Hello",
    text: "Plain words.",
    html: "<p>Plain words.</p>",
    reply_to: "Writer <writer@example.org>",
  })
})

test("Postmark: the contact form, on the outbound stream unless told otherwise", async () => {
  const env = { EMAIL_PROVIDER: "postmark", POSTMARK_SERVER_TOKEN: "pm", ...MAIL }
  assert.deepEqual(await sendMessage(MESSAGE, env), { status: "sent" })
  assert.equal(requests[0].url, "https://api.postmarkapp.com/email")
  assert.equal(requests[0].headers["X-Postmark-Server-Token"], "pm")
  assert.deepEqual(requests[0].body, {
    From: `${SITE_NAME} <${MAIL.EMAIL_FROM}>`,
    To: MAIL.CONTACT_TO_EMAIL,
    Subject: "Hello",
    TextBody: "Plain words.",
    HtmlBody: "<p>Plain words.</p>",
    ReplyTo: "Writer <writer@example.org>",
    MessageStream: "outbound",
  })
  answer(/postmark/, { ErrorCode: 300, Message: "Invalid 'From' address" }, 422)
  const refused = await sendMessage(MESSAGE, { ...env, POSTMARK_MESSAGE_STREAM: "site" })
  assert.equal(requests[1].body.MessageStream, "site")
  assert.match(refused.message, /Postmark responded 422: Invalid 'From' address/)
})

test("SendGrid: marketing contacts in the list, and Mail Send with both parts", async () => {
  const env = { EMAIL_PROVIDER: "sendgrid", SENDGRID_API_KEY: "sg", SENDGRID_LIST_ID: "l1", ...MAIL }
  assert.deepEqual(await subscribe(READER, env), { status: "subscribed" })
  assert.equal(requests[0].method, "PUT")
  assert.equal(requests[0].url, "https://api.sendgrid.com/v3/marketing/contacts")
  assert.deepEqual(requests[0].body, { list_ids: ["l1"], contacts: [{ email: READER.email, first_name: "Ada" }] })
  assert.deepEqual(await sendMessage(MESSAGE, env), { status: "sent" })
  assert.deepEqual(requests[1].body, {
    personalizations: [{ to: [{ email: MAIL.CONTACT_TO_EMAIL }] }],
    from: { email: MAIL.EMAIL_FROM, name: SITE_NAME },
    reply_to: { email: "writer@example.org", name: "Writer" },
    subject: "Hello",
    content: [
      { type: "text/plain", value: "Plain words." },
      { type: "text/html", value: "<p>Plain words.</p>" },
    ],
  })
})

test("webhook: the JSON, signed over the exact bytes sent; unsigned without a secret", async () => {
  const env = { EMAIL_PROVIDER: "webhook", EMAIL_WEBHOOK_URL: "https://hooks.example/in", EMAIL_WEBHOOK_SECRET: "shh", CONTACT_TO_EMAIL: "o@example.net" }
  assert.deepEqual(await subscribe(READER, env), { status: "subscribed" })
  const [sub] = requests
  assert.equal(sub.url, "https://hooks.example/in")
  assert.equal(sub.headers["X-Signature"], `sha256=${createHmac("sha256", "shh").update(sub.raw).digest("hex")}`)
  assert.equal(sub.headers["X-Signature"], signature(sub.raw, "shh"))
  assert.equal(sub.body.type, "subscribe")
  assert.equal(sub.body.email, READER.email)
  assert.equal(sub.body.firstName, "Ada")
  assert.match(sub.body.at, /^\d{4}-\d\d-\d\dT/)
  assert.deepEqual(await sendMessage(MESSAGE, env), { status: "sent" }, "a webhook needs no verified sender")
  assert.equal(requests[1].body.type, "message")
  assert.equal(requests[1].body.text, "Plain words.")
  await subscribe(READER, { ...env, EMAIL_WEBHOOK_SECRET: "" })
  assert.equal(requests[2].headers["X-Signature"], undefined)
})

test("a sender's name cannot break out of its angle brackets", () => {
  assert.equal(mailbox("a@example.net", 'Evil" <x@y.z>'), '"Evil x@y.z" <a@example.net>')
  assert.equal(mailbox("a@example.net", "Jane Doe"), "Jane Doe <a@example.net>")
  // a comma outside quotes ends an address: unquoted, this is "Doe" and then Jane
  assert.equal(mailbox("a@example.net", "Doe, Jane"), '"Doe, Jane" <a@example.net>')
  assert.equal(mailbox("a@example.net", "Acme: Sales (EU)"), '"Acme: Sales (EU)" <a@example.net>')
  assert.equal(mailbox("a@example.net", 'A\r\nBcc: x@y.z'), '"ABcc: x@y.z" <a@example.net>', "no line of its own")
  assert.equal(mailbox("a@example.net", ' "" '), "a@example.net")
  assert.equal(mailbox("a@example.net"), "a@example.net")
})

test("the forms are ready only when they can do their job: otherwise they are placeholders", () => {
  assert.equal(listReady({}), false, "no platform")
  assert.equal(listReady({ EMAIL_PROVIDER: "brevo" }), false, "a platform with no key")
  assert.equal(listReady({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "key" }), true)
  assert.equal(listReady({ EMAIL_PROVIDER: "postmark", POSTMARK_SERVER_TOKEN: "t" }), false, "a platform that keeps no list")
  assert.equal(contactReady({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "key" }), false, "nowhere to send it")
  assert.equal(contactReady({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "key", CONTACT_TO_EMAIL: "owner@example.com" }), false, "no verified sender")
  assert.equal(contactReady({ EMAIL_PROVIDER: "brevo", BREVO_API_KEY: "key", CONTACT_TO_EMAIL: "owner@example.com", EMAIL_FROM: "site@example.com" }), true)
})
