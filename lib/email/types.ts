/**
 * The two things the site asks of an email platform: put somebody on the
 * mailing list, and deliver a message from the contact form. Every platform
 * in lib/email/providers implements what it can of this.
 */
export type Env = Record<string, string | undefined>

export type Subscriber = { email: string; firstName?: string }

export type Message = {
  /** where contact-form messages go: CONTACT_TO_EMAIL */
  to: string
  /** a sender the platform has verified: EMAIL_FROM */
  from: string
  fromName: string
  /** the person who wrote in, so pressing reply answers them */
  replyTo?: { email: string; name?: string }
  subject: string
  text: string
  html?: string
}

export type SubscribeResult =
  /** on the list now */
  | { status: "subscribed" }
  /** the platform sent a confirmation email first (double opt-in) */
  | { status: "pending" }
  | { status: "unconfigured"; reason: string }
  | { status: "error"; message: string }

export type SendResult = { status: "sent" } | { status: "unconfigured"; reason: string } | { status: "error"; message: string }

export type Provider = {
  /** EMAIL_PROVIDER's value */
  id: string
  /** as the privacy notice names it */
  name: string
  privacyUrl: string
  /** what is missing for each job, or null when it is ready */
  missing: (env: Env) => { subscribe: string | null; send: string | null }
  subscribe?: (subscriber: Subscriber, env: Env) => Promise<SubscribeResult>
  send?: (message: Message, env: Env) => Promise<SendResult>
}
