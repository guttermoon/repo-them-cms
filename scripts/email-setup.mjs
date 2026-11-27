// Run by npm's `prebuild`: gets the email platform ready, so the first
// sign-up does not pay for it. For Brevo that means finding the mailing list
// by name and making it (in a folder of the same name) when it is missing.
// Other platforms need nothing made.
//
// It never fails a build: no platform, no key or a refusal is reported and
// the build goes on. The site makes the list on first use anyway.
import "./load-env.mjs"
import { listProvider } from "../lib/email/index.ts"
import { ensureList, listName } from "../lib/email/providers/brevo.ts"

const provider = listProvider()
if (!provider) {
  console.log("[email-setup] no email platform is set (EMAIL_PROVIDER); nothing to do")
  process.exit(0)
}
if (provider.id !== "brevo") {
  console.log(`[email-setup] ${provider.name}: nothing to set up`)
  process.exit(0)
}
if (provider.missing(process.env).subscribe) {
  console.log(`[email-setup] Brevo: ${provider.missing(process.env).subscribe}; skipped`)
  process.exit(0)
}
try {
  const { id, created } = await ensureList(process.env)
  console.log(`[email-setup] Brevo list "${listName(process.env)}" ${created ? "created" : "found"} (#${id})`)
} catch (error) {
  console.warn(`[email-setup] Brevo could not be set up (${error instanceof Error ? error.message : error}); the site will try on the first sign-up`)
}
