/**
 * beehiiv: the mailing list only, as a subscription to the publication
 * (BEEHIIV_PUBLICATION_ID, "pub_…").
 *
 * - Somebody who unsubscribed and signs up again is subscribed again: the
 *   form is them asking.
 * - The publication's welcome email is sent, as its own sign-up form sends
 *   it, unless BEEHIIV_WELCOME_EMAIL is "false".
 * - Whether a confirmation goes first is the publication's own setting,
 *   unless BEEHIIV_DOUBLE_OPT_IN says "true" or "false", which is sent as
 *   beehiiv's override and is then what the form says. Left to the
 *   publication, beehiiv answers "validating" before it has decided, so the
 *   form says "check your inbox" for that as for "pending": telling
 *   somebody they are on the list when a confirmation is waiting loses
 *   them, and the other mistake costs a look at an inbox.
 * - A first name goes in the custom field named "First Name". beehiiv drops
 *   a field the publication does not have and still subscribes.
 */
import { call, errorText, failed } from "../http"
import type { Provider } from "../types"
import { firstError } from "./klaviyo"

export const beehiiv: Provider = {
  id: "beehiiv",
  name: "beehiiv",
  privacyUrl: "https://www.beehiiv.com/privacy",
  missing: (env) => ({
    subscribe: !env.BEEHIIV_API_KEY?.trim()
      ? "BEEHIIV_API_KEY is not set"
      : !/^pub_[\w-]+$/.test(env.BEEHIIV_PUBLICATION_ID?.trim() ?? "")
        ? "BEEHIIV_PUBLICATION_ID is not set (it starts pub_)"
        : null,
    send: "beehiiv sends no transactional email here: set CONTACT_EMAIL_PROVIDER to another platform",
  }),
  async subscribe({ email, firstName }, env) {
    try {
      const publication = env.BEEHIIV_PUBLICATION_ID!.trim()
      const asked = env.BEEHIIV_DOUBLE_OPT_IN?.trim().toLowerCase()
      const confirm = asked === "true" ? true : asked === "false" ? false : undefined
      const { ok, status, data } = await call(`https://api.beehiiv.com/v2/publications/${encodeURIComponent(publication)}/subscriptions`, {
        headers: { Authorization: `Bearer ${env.BEEHIIV_API_KEY!.trim()}` },
        body: {
          email,
          reactivate_existing: true,
          send_welcome_email: env.BEEHIIV_WELCOME_EMAIL?.trim().toLowerCase() !== "false",
          utm_source: "website",
          ...(confirm === undefined ? {} : { double_opt_override: confirm ? "on" : "off" }),
          ...(firstName ? { custom_fields: [{ name: "First Name", value: firstName }] } : {}),
        },
      })
      if (!ok) return { status: "error", message: errorText("beehiiv", status, firstError(data)) }
      const state = (data.data as { status?: string } | undefined)?.status
      if (state === "invalid") return { status: "error", message: "beehiiv found the address invalid" }
      if (confirm !== undefined) return { status: confirm ? "pending" : "subscribed" }
      return { status: state === "pending" || state === "validating" ? "pending" : "subscribed" }
    } catch (error) {
      return failed(error)
    }
  },
}
