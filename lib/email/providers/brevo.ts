/**
 * Brevo: the mailing list (with optional double opt-in) and the contact form.
 *
 * The list is found by name, and made (in a folder of the same name) the
 * first time it is missing, so a new account needs nothing set up by hand:
 * BREVO_LIST_NAME, or "<site name> newsletter". BREVO_LIST_ID pins one
 * instead. `scripts/email-setup.mjs` runs the same find-or-make at build
 * time, so the first sign-up does not pay for it.
 *
 * Double opt-in needs both a Brevo "double opt-in confirmation" template
 * (BREVO_DOI_TEMPLATE_ID) and the page readers land on after confirming
 * (BREVO_DOI_REDIRECT_URL, normally /subscribed). Either alone is ignored.
 *
 * BREVO_API_URL points at a stand-in Brevo for testing; never set it live.
 */
import { SITE_NAME } from "../../site"
import { call, errorText, failed } from "../http"
import type { Env, Provider } from "../types"

const base = (env: Env) => env.BREVO_API_URL?.trim().replace(/\/+$/, "") || "https://api.brevo.com/v3"
const headers = (env: Env) => ({ "api-key": env.BREVO_API_KEY?.trim() ?? "" })

export const listName = (env: Env) => env.BREVO_LIST_NAME?.trim() || `${SITE_NAME} newsletter`

function doi(env: Env): { templateId: number; redirectionUrl: string } | undefined {
  const templateId = Number.parseInt(env.BREVO_DOI_TEMPLATE_ID ?? "", 10)
  const redirectionUrl = env.BREVO_DOI_REDIRECT_URL?.trim()
  if (!env.BREVO_DOI_TEMPLATE_ID && !redirectionUrl) return undefined
  if (!Number.isInteger(templateId) || templateId <= 0 || !redirectionUrl) {
    console.warn("[email] Brevo double opt-in needs both BREVO_DOI_TEMPLATE_ID and BREVO_DOI_REDIRECT_URL; using single opt-in")
    return undefined
  }
  return { templateId, redirectionUrl }
}

/** Every item of a paged Brevo collection, up to 1,000. */
async function all(env: Env, path: string, key: string): Promise<{ id: number; name: string }[]> {
  const out: { id: number; name: string }[] = []
  for (let offset = 0; offset < 1000; offset += 50) {
    const { ok, status, data } = await call(`${base(env)}${path}?limit=50&offset=${offset}`, { method: "GET", headers: headers(env) })
    if (!ok) throw new Error(errorText("Brevo", status, data))
    const rows = Array.isArray(data[key]) ? (data[key] as { id: number; name: string }[]) : []
    out.push(...rows)
    if (rows.length < 50) break
  }
  return out
}

const lowest = (rows: { id: number; name: string }[], name: string) =>
  rows.filter((r) => r.name === name && Number.isInteger(r.id)).map((r) => r.id).sort((a, b) => a - b)[0]

let listCache: { key: string; id: number } | null = null

/** The list's ID: pinned, cached, found by name, or made. */
export async function ensureList(env: Env): Promise<{ id: number; created: boolean }> {
  const pinned = Number.parseInt(env.BREVO_LIST_ID ?? "", 10)
  if (Number.isInteger(pinned) && pinned > 0) return { id: pinned, created: false }
  const name = listName(env)
  const key = `${base(env)}|${name}`
  if (listCache?.key === key) return { id: listCache.id, created: false }

  const found = lowest(await all(env, "/contacts/lists", "lists"), name)
  if (found !== undefined) {
    listCache = { key, id: found }
    return { id: found, created: false }
  }
  let folderId = lowest(await all(env, "/contacts/folders", "folders"), SITE_NAME)
  if (folderId === undefined) {
    const folder = await call(`${base(env)}/contacts/folders`, { headers: headers(env), body: { name: SITE_NAME } })
    if (!folder.ok || typeof folder.data.id !== "number") throw new Error(errorText("Brevo", folder.status, folder.data))
    folderId = folder.data.id
  }
  const list = await call(`${base(env)}/contacts/lists`, { headers: headers(env), body: { name, folderId } })
  if (!list.ok || typeof list.data.id !== "number") throw new Error(errorText("Brevo", list.status, list.data))
  listCache = { key, id: list.data.id }
  return { id: list.data.id, created: true }
}

export const brevo: Provider = {
  id: "brevo",
  name: "Brevo",
  privacyUrl: "https://www.brevo.com/legal/privacypolicy/",
  missing: (env) => ({
    subscribe: env.BREVO_API_KEY?.trim() ? null : "BREVO_API_KEY is not set",
    send: !env.BREVO_API_KEY?.trim() ? "BREVO_API_KEY is not set" : null,
  }),

  async subscribe({ email, firstName }, env) {
    try {
      const { id } = await ensureList(env)
      const attributes = firstName ? { FIRSTNAME: firstName } : {}
      const confirm = doi(env)
      const { ok, status, data } = confirm
        ? await call(`${base(env)}/contacts/doubleOptinConfirmation`, {
            headers: headers(env),
            body: { email, attributes, includeListIds: [id], templateId: confirm.templateId, redirectionUrl: confirm.redirectionUrl },
          })
        : await call(`${base(env)}/contacts`, {
            headers: headers(env),
            // updateEnabled: a second sign-up updates the contact rather than
            // failing as a duplicate. emailBlacklisted is never sent, so
            // somebody who unsubscribed stays unsubscribed.
            body: { email, attributes, listIds: [id], updateEnabled: true },
          })
      if (!ok) return { status: "error", message: errorText("Brevo", status, data) }
      return { status: confirm ? "pending" : "subscribed" }
    } catch (error) {
      return failed(error)
    }
  },

  async send(message, env) {
    try {
      const { ok, status, data } = await call(`${base(env)}/smtp/email`, {
        headers: headers(env),
        body: {
          sender: { email: message.from, name: message.fromName },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          ...(message.html ? { htmlContent: message.html } : {}),
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        },
      })
      return ok ? { status: "sent" } : { status: "error", message: errorText("Brevo", status, data) }
    } catch (error) {
      return failed(error)
    }
  },
}
