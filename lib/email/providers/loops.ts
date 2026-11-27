/**
 * Loops: the mailing list only, as a contact in the audience, made if it is
 * not there and subscribed again if it had left (the form is them asking).
 * LOOPS_MAILING_LIST_ID adds the contact to a mailing list.
 *
 * Loops sends transactional email only from a template made in Loops, with
 * its sender and reply-to fixed there, so it cannot carry a contact-form
 * message that replies to whoever wrote it.
 */
import { call, errorText, failed } from "../http"
import type { Provider } from "../types"

export const loops: Provider = {
  id: "loops",
  name: "Loops",
  privacyUrl: "https://loops.so/privacy",
  missing: (env) => ({
    subscribe: env.LOOPS_API_KEY?.trim() ? null : "LOOPS_API_KEY is not set",
    send: "Loops sends no contact-form email here: set CONTACT_EMAIL_PROVIDER to another platform",
  }),
  async subscribe({ email, firstName }, env) {
    try {
      const list = env.LOOPS_MAILING_LIST_ID?.trim()
      const { ok, status, data } = await call("https://app.loops.so/api/v1/contacts/update", {
        method: "PUT",
        headers: { Authorization: `Bearer ${env.LOOPS_API_KEY!.trim()}` },
        body: { email, subscribed: true, ...(firstName ? { firstName } : {}), ...(list ? { mailingLists: { [list]: true } } : {}) },
      })
      // Loops can answer 200 with success: false
      if (!ok || data.success === false) return { status: "error", message: errorText("Loops", status, data) }
      return { status: "subscribed" }
    } catch (error) {
      return failed(error)
    }
  },
}
