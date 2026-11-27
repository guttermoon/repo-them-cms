/**
 * Email, on whichever platform the site owner already uses.
 *
 * EMAIL_PROVIDER picks the platform for both jobs (the mailing list and the
 * contact form); CONTACT_EMAIL_PROVIDER picks a different one for the contact
 * form, for a platform with no transactional email (Mailchimp, MailerLite,
 * Kit, Buttondown, Klaviyo, beehiiv, Loops). Unset, Brevo is used when BREVO_API_KEY is set, and
 * nothing otherwise: the routes then accept in development (and log that
 * nothing was sent) and answer 503 in production, so a form never claims a
 * success it did not have.
 *
 * Every adapter takes the environment as an argument, so the tests drive
 * them with a fake one (tests/email-providers.test.mjs).
 */
import { beehiiv } from "./providers/beehiiv"
import { brevo } from "./providers/brevo"
import { buttondown } from "./providers/buttondown"
import { kit } from "./providers/kit"
import { klaviyo } from "./providers/klaviyo"
import { loops } from "./providers/loops"
import { mailchimp } from "./providers/mailchimp"
import { mailerlite } from "./providers/mailerlite"
import { postmark } from "./providers/postmark"
import { resend } from "./providers/resend"
import { sendgrid } from "./providers/sendgrid"
import { webhook } from "./providers/webhook"
import { SITE_NAME } from "../site"
import type { Env, Message, Provider, SendResult, SubscribeResult, Subscriber } from "./types"

export type { Env, Message, Provider, SendResult, SubscribeResult, Subscriber }

export const PROVIDERS: Record<string, Provider> = {
  brevo,
  mailchimp,
  mailerlite,
  kit,
  buttondown,
  klaviyo,
  beehiiv,
  loops,
  resend,
  postmark,
  sendgrid,
  webhook,
}

const pick = (raw: string | undefined): Provider | null => {
  const id = raw?.trim().toLowerCase()
  if (!id) return null
  const found = PROVIDERS[id]
  if (!found) console.warn(`[email] unknown email platform "${id}"; expected one of ${Object.keys(PROVIDERS).join(", ")}`)
  return found ?? null
}

/** The platform for the mailing list. */
export function listProvider(env: Env = process.env): Provider | null {
  return pick(env.EMAIL_PROVIDER) ?? (env.BREVO_API_KEY?.trim() ? brevo : null)
}

/** The platform for the contact form. */
export function contactProvider(env: Env = process.env): Provider | null {
  return pick(env.CONTACT_EMAIL_PROVIDER) ?? listProvider(env)
}

export async function subscribe(subscriber: Subscriber, env: Env = process.env): Promise<SubscribeResult> {
  const provider = listProvider(env)
  if (!provider) return { status: "unconfigured", reason: "no email platform is set (EMAIL_PROVIDER)" }
  const missing = provider.missing(env).subscribe
  if (missing || !provider.subscribe) return { status: "unconfigured", reason: missing ?? `${provider.name} keeps no mailing list` }
  return provider.subscribe(subscriber, env)
}

/**
 * Whether the mailing list and the contact form can do their job with the
 * settings as they are. Until they can, the forms are placeholders that send
 * nothing (components/layout/newsletter-form.tsx, contact-form.tsx), rather
 * than forms that fail after somebody has typed into them.
 */
export function listReady(env: Env = process.env): boolean {
  const provider = listProvider(env)
  return Boolean(provider?.subscribe && !provider.missing(env).subscribe)
}

export function contactReady(env: Env = process.env): boolean {
  const provider = contactProvider(env)
  if (!provider?.send || provider.missing(env).send) return false
  const { to, from } = mailboxes(env)
  return Boolean(to && (from || provider.id === "webhook"))
}

/** Where contact-form messages go and who they come from. */
export function mailboxes(env: Env = process.env): { to?: string; from?: string } {
  return { to: env.CONTACT_TO_EMAIL?.trim() || undefined, from: env.EMAIL_FROM?.trim() || undefined }
}

export async function sendMessage(
  message: Omit<Message, "to" | "from" | "fromName">,
  env: Env = process.env,
): Promise<SendResult> {
  const provider = contactProvider(env)
  if (!provider) return { status: "unconfigured", reason: "no email platform is set (EMAIL_PROVIDER)" }
  const missing = provider.missing(env).send
  if (missing || !provider.send) return { status: "unconfigured", reason: missing ?? `${provider.name} cannot send email` }
  const { to, from } = mailboxes(env)
  if (!to) return { status: "unconfigured", reason: "CONTACT_TO_EMAIL is not set" }
  if (!from && provider.id !== "webhook") return { status: "unconfigured", reason: "EMAIL_FROM is not set (a sender the platform has verified)" }
  return provider.send({ ...message, to, from: from ?? to, fromName: SITE_NAME }, env)
}

/** The platforms in use, as the privacy notice names them. */
export function processors(env: Env = process.env): { name: string; privacyUrl: string }[] {
  const out = [listProvider(env), contactProvider(env)].filter((p): p is Provider => Boolean(p))
  return out.filter((p, i) => out.findIndex((q) => q.id === p.id) === i).map((p) => ({ name: p.name, privacyUrl: p.privacyUrl }))
}
