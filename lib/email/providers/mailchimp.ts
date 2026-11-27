/**
 * Mailchimp (the Marketing API): the mailing list only. Mailchimp's
 * transactional email is a separate product, so the contact form needs
 * another platform (CONTACT_EMAIL_PROVIDER) alongside it.
 *
 * MAILCHIMP_API_KEY ends in its data centre ("…-us21"), which is the API's
 * host. A new address is added as "pending" (Mailchimp sends the
 * confirmation) unless MAILCHIMP_DOUBLE_OPT_IN is "false". An address that
 * unsubscribed stays unsubscribed: `status_if_new` only applies to new ones.
 */
import { createHash } from "node:crypto"

import { call, errorText, failed } from "../http"
import type { Provider } from "../types"

const dataCentre = (key: string) => key.split("-").pop() ?? ""

export const mailchimp: Provider = {
  id: "mailchimp",
  name: "Mailchimp",
  privacyUrl: "https://www.intuit.com/privacy/statement/",
  missing: (env) => {
    const key = env.MAILCHIMP_API_KEY?.trim() ?? ""
    return {
      subscribe: !key || !/-[a-z]+\d+$/i.test(key) ? "MAILCHIMP_API_KEY is not set (it ends in its data centre, e.g. -us21)" : !env.MAILCHIMP_AUDIENCE_ID?.trim() ? "MAILCHIMP_AUDIENCE_ID is not set" : null,
      send: "Mailchimp sends no transactional email here: set CONTACT_EMAIL_PROVIDER to another platform",
    }
  },
  async subscribe({ email, firstName }, env) {
    try {
      const key = env.MAILCHIMP_API_KEY!.trim()
      const audience = env.MAILCHIMP_AUDIENCE_ID!.trim()
      const hash = createHash("md5").update(email.toLowerCase()).digest("hex")
      const confirm = env.MAILCHIMP_DOUBLE_OPT_IN?.trim().toLowerCase() !== "false"
      const { ok, status, data } = await call(`https://${dataCentre(key)}.api.mailchimp.com/3.0/lists/${encodeURIComponent(audience)}/members/${hash}`, {
        method: "PUT",
        headers: { Authorization: `Basic ${Buffer.from(`site:${key}`).toString("base64")}` },
        body: { email_address: email, status_if_new: confirm ? "pending" : "subscribed", ...(firstName ? { merge_fields: { FNAME: firstName } } : {}) },
      })
      if (!ok) return { status: "error", message: errorText("Mailchimp", status, data) }
      return { status: data.status === "pending" ? "pending" : "subscribed" }
    } catch (error) {
      return failed(error)
    }
  },
}
