/**
 * Klaviyo: the mailing list only, through Subscribe Profiles, which records
 * the reader's consent to email marketing (adding a profile to a list alone
 * would not). KLAVIYO_LIST_ID puts the subscriber in a list.
 *
 * Klaviyo answers 202 with no body and does the work afterwards, so it never
 * says whether a confirmation was sent. That is the list's own setting (or
 * the account's, with no list), and double opt-in is Klaviyo's default: the
 * form says "check your inbox" unless KLAVIYO_DOUBLE_OPT_IN is "false".
 *
 * The request takes an address and nothing else about the person, so a
 * first name is not sent.
 */
import { call, errorText, failed } from "../http"
import type { Provider } from "../types"

/** The API revision this request is written against. */
export const KLAVIYO_REVISION = "2026-10-15"

export const klaviyo: Provider = {
  id: "klaviyo",
  name: "Klaviyo",
  privacyUrl: "https://www.klaviyo.com/legal/privacy-notice",
  missing: (env) => ({
    subscribe: env.KLAVIYO_API_KEY?.trim() ? null : "KLAVIYO_API_KEY is not set (a private key that may write lists, profiles and subscriptions)",
    send: "Klaviyo sends no transactional email here: set CONTACT_EMAIL_PROVIDER to another platform",
  }),
  async subscribe({ email }, env) {
    try {
      const list = env.KLAVIYO_LIST_ID?.trim()
      const { ok, status, data } = await call("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs", {
        headers: {
          Authorization: `Klaviyo-API-Key ${env.KLAVIYO_API_KEY!.trim()}`,
          revision: KLAVIYO_REVISION,
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
        },
        body: {
          data: {
            type: "profile-subscription-bulk-create-job",
            attributes: {
              custom_source: "Website sign-up form",
              profiles: { data: [{ type: "profile", attributes: { email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } } }] },
            },
            ...(list ? { relationships: { list: { data: { type: "list", id: list } } } } : {}),
          },
        },
      })
      if (!ok) return { status: "error", message: errorText("Klaviyo", status, firstError(data)) }
      return { status: env.KLAVIYO_DOUBLE_OPT_IN?.trim().toLowerCase() === "false" ? "subscribed" : "pending" }
    } catch (error) {
      return failed(error)
    }
  },
}

/** The first of a JSON:API answer's `errors`, which is where the reason is. */
export const firstError = (data: Record<string, unknown>): Record<string, unknown> => {
  const first = Array.isArray(data.errors) ? data.errors[0] : undefined
  return first && typeof first === "object" ? (first as Record<string, unknown>) : data
}
