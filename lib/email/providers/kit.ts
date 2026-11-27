/**
 * Kit (formerly ConvertKit, API v4): the mailing list only. The subscriber
 * is created (or updated) first, then added to the form in KIT_FORM_ID, which
 * is what Kit's own sign-up forms do; a form set to confirm sends its
 * confirmation email from there.
 */
import { call, errorText, failed } from "../http"
import type { Provider } from "../types"

const API = "https://api.kit.com/v4"

export const kit: Provider = {
  id: "kit",
  name: "Kit",
  privacyUrl: "https://kit.com/privacy",
  missing: (env) => ({
    subscribe: !env.KIT_API_KEY?.trim() ? "KIT_API_KEY is not set" : !env.KIT_FORM_ID?.trim() ? "KIT_FORM_ID is not set" : null,
    send: "Kit sends no transactional email here: set CONTACT_EMAIL_PROVIDER to another platform",
  }),
  async subscribe({ email, firstName }, env) {
    try {
      const headers = { "X-Kit-Api-Key": env.KIT_API_KEY!.trim() }
      const created = await call(`${API}/subscribers`, { headers, body: { email_address: email, ...(firstName ? { first_name: firstName } : {}) } })
      if (!created.ok) return { status: "error", message: errorText("Kit", created.status, created.data) }
      const added = await call(`${API}/forms/${encodeURIComponent(env.KIT_FORM_ID!.trim())}/subscribers`, { headers, body: { email_address: email } })
      if (!added.ok) return { status: "error", message: errorText("Kit", added.status, added.data) }
      const state = (added.data.subscriber as { state?: string } | undefined)?.state
      return { status: state === "inactive" ? "pending" : "subscribed" }
    } catch (error) {
      return failed(error)
    }
  },
}
