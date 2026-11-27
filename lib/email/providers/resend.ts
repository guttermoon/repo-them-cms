/**
 * Resend: the contact form, and the mailing list as Resend contacts
 * (in RESEND_SEGMENT_ID when it is set).
 */
import { call, errorText, failed, mailbox } from "../http"
import type { Provider } from "../types"

const API = "https://api.resend.com"

export const resend: Provider = {
  id: "resend",
  name: "Resend",
  privacyUrl: "https://resend.com/legal/privacy-policy",
  missing: (env) => {
    const key = env.RESEND_API_KEY?.trim() ? null : "RESEND_API_KEY is not set"
    return { subscribe: key, send: key }
  },
  async subscribe({ email, firstName }, env) {
    try {
      const segment = env.RESEND_SEGMENT_ID?.trim()
      const { ok, status, data } = await call(`${API}/contacts`, {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}` },
        body: { email, unsubscribed: false, ...(firstName ? { first_name: firstName } : {}), ...(segment ? { segments: [{ id: segment }] } : {}) },
      })
      return ok ? { status: "subscribed" } : { status: "error", message: errorText("Resend", status, data) }
    } catch (error) {
      return failed(error)
    }
  },
  async send(message, env) {
    try {
      const { ok, status, data } = await call(`${API}/emails`, {
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY!.trim()}` },
        body: {
          from: mailbox(message.from, message.fromName),
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { reply_to: mailbox(message.replyTo.email, message.replyTo.name) } : {}),
        },
      })
      return ok ? { status: "sent" } : { status: "error", message: errorText("Resend", status, data) }
    } catch (error) {
      return failed(error)
    }
  },
}
