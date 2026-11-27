/**
 * MailerLite (the current API, connect.mailerlite.com): the mailing list
 * only. MAILERLITE_GROUP_ID adds subscribers to a group. Whether a
 * confirmation email goes first follows the account's own double opt-in
 * setting; the answer says which happened.
 */
import { call, errorText, failed } from "../http"
import type { Provider } from "../types"

export const mailerlite: Provider = {
  id: "mailerlite",
  name: "MailerLite",
  privacyUrl: "https://www.mailerlite.com/legal/privacy-policy",
  missing: (env) => ({
    subscribe: env.MAILERLITE_API_KEY?.trim() ? null : "MAILERLITE_API_KEY is not set",
    send: "MailerLite sends no transactional email here: set CONTACT_EMAIL_PROVIDER to another platform",
  }),
  async subscribe({ email, firstName }, env) {
    try {
      const group = env.MAILERLITE_GROUP_ID?.trim()
      const { ok, status, data } = await call("https://connect.mailerlite.com/api/subscribers", {
        headers: { Authorization: `Bearer ${env.MAILERLITE_API_KEY!.trim()}` },
        body: { email, ...(firstName ? { fields: { name: firstName } } : {}), ...(group ? { groups: [group] } : {}) },
      })
      if (!ok) return { status: "error", message: errorText("MailerLite", status, data) }
      const state = (data.data as { status?: string } | undefined)?.status
      return { status: state === "unconfirmed" ? "pending" : "subscribed" }
    } catch (error) {
      return failed(error)
    }
  },
}
