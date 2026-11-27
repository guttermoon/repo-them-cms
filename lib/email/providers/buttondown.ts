/**
 * Buttondown: the mailing list only. Buttondown sends its own confirmation
 * when the newsletter asks for one; an address already on the list is not
 * an error to the reader.
 */
import { call, errorText, failed } from "../http"
import type { Provider } from "../types"

export const buttondown: Provider = {
  id: "buttondown",
  name: "Buttondown",
  privacyUrl: "https://buttondown.com/legal/privacy",
  missing: (env) => ({
    subscribe: env.BUTTONDOWN_API_KEY?.trim() ? null : "BUTTONDOWN_API_KEY is not set",
    send: "Buttondown sends no transactional email here: set CONTACT_EMAIL_PROVIDER to another platform",
  }),
  async subscribe({ email, firstName }, env) {
    try {
      const { ok, status, data } = await call("https://api.buttondown.email/v1/subscribers", {
        headers: { Authorization: `Token ${env.BUTTONDOWN_API_KEY!.trim()}` },
        body: { email_address: email, ...(firstName ? { metadata: { first_name: firstName } } : {}) },
      })
      if (!ok) {
        // already subscribed: a second sign-up is the same answer as the first
        if ((status === 400 || status === 409) && /already_exists|already/i.test(String(data.code ?? data.detail ?? ""))) return { status: "subscribed" }
        return { status: "error", message: errorText("Buttondown", status, data) }
      }
      return { status: data.type === "unactivated" ? "pending" : "subscribed" }
    } catch (error) {
      return failed(error)
    }
  },
}
