/**
 * Any platform at all: each sign-up and each message is POSTed as JSON to
 * EMAIL_WEBHOOK_URL (Zapier, Make, n8n, or your own code), signed with
 * EMAIL_WEBHOOK_SECRET when it is set:
 *
 *   X-Signature: sha256=<hex HMAC-SHA256 of the raw body>
 *
 * Verify it on the other side before trusting the body.
 */
import { createHmac } from "node:crypto"

import { SITE_URL } from "../../site"
import { errorText, failed, TIMEOUT_MS } from "../http"
import type { Env, Provider } from "../types"

export function signature(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
}

async function post(env: Env, payload: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  const body = JSON.stringify({ ...payload, site: SITE_URL, at: new Date().toISOString() })
  const secret = env.EMAIL_WEBHOOK_SECRET?.trim()
  const response = await fetch(env.EMAIL_WEBHOOK_URL!.trim(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "X-Signature": signature(body, secret) } : {}) },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  return response.ok ? { ok: true } : { ok: false, message: errorText("The webhook", response.status, {}) }
}

const missingUrl = (env: Env) => {
  const url = env.EMAIL_WEBHOOK_URL?.trim()
  return !url ? "EMAIL_WEBHOOK_URL is not set" : !/^https:\/\//i.test(url) ? "EMAIL_WEBHOOK_URL must be an https address" : null
}

export const webhook: Provider = {
  id: "webhook",
  name: "a webhook",
  privacyUrl: "",
  missing: (env) => ({ subscribe: missingUrl(env), send: missingUrl(env) }),
  async subscribe({ email, firstName }, env) {
    try {
      const r = await post(env, { type: "subscribe", email, firstName: firstName ?? null })
      return r.ok ? { status: "subscribed" } : { status: "error", message: r.message ?? "the webhook refused it" }
    } catch (error) {
      return failed(error)
    }
  },
  async send(message, env) {
    try {
      const r = await post(env, {
        type: "message",
        to: message.to,
        replyTo: message.replyTo ?? null,
        subject: message.subject,
        text: message.text,
      })
      return r.ok ? { status: "sent" } : { status: "error", message: r.message ?? "the webhook refused it" }
    } catch (error) {
      return failed(error)
    }
  },
}
