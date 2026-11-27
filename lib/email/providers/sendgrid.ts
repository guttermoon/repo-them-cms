/**
 * SendGrid: the contact form (Mail Send) and the mailing list (Marketing
 * contacts, in SENDGRID_LIST_ID when it is set). SendGrid adds contacts in
 * the background, so the answer is "accepted" rather than "done".
 */
import { call, errorText, failed } from "../http"
import type { Provider } from "../types"

const API = "https://api.sendgrid.com/v3"

export const sendgrid: Provider = {
  id: "sendgrid",
  name: "SendGrid",
  privacyUrl: "https://www.twilio.com/en-us/legal/privacy",
  missing: (env) => {
    const key = env.SENDGRID_API_KEY?.trim() ? null : "SENDGRID_API_KEY is not set"
    return { subscribe: key, send: key }
  },
  async subscribe({ email, firstName }, env) {
    try {
      const list = env.SENDGRID_LIST_ID?.trim()
      const { ok, status, data } = await call(`${API}/marketing/contacts`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY!.trim()}` },
        body: { ...(list ? { list_ids: [list] } : {}), contacts: [{ email, ...(firstName ? { first_name: firstName } : {}) }] },
      })
      return ok ? { status: "subscribed" } : { status: "error", message: errorText("SendGrid", status, data) }
    } catch (error) {
      return failed(error)
    }
  },
  async send(message, env) {
    try {
      const { ok, status, data } = await call(`${API}/mail/send`, {
        headers: { Authorization: `Bearer ${env.SENDGRID_API_KEY!.trim()}` },
        body: {
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: message.from, name: message.fromName },
          ...(message.replyTo ? { reply_to: { email: message.replyTo.email, ...(message.replyTo.name ? { name: message.replyTo.name } : {}) } } : {}),
          subject: message.subject,
          content: [{ type: "text/plain", value: message.text }, ...(message.html ? [{ type: "text/html", value: message.html }] : [])],
        },
      })
      return ok ? { status: "sent" } : { status: "error", message: errorText("SendGrid", status, data) }
    } catch (error) {
      return failed(error)
    }
  },
}
