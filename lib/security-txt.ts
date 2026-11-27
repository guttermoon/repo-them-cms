/**
 * /.well-known/security.txt (RFC 9116): where to report a security problem
 * with this site, in the form scanners and researchers look for first.
 *
 * It names the site's own contact, never the template's maker: a copy's
 * owner answers for their copy (the template's own problems go to its
 * SECURITY.md, which /security links). In order of preference:
 *
 * 1. SECURITY_CONTACT: an email address, a `mailto:` or an https address;
 * 2. NEXT_PUBLIC_CONTACT_EMAIL, the address the contact page prints;
 * 3. always, the contact form with "a problem" chosen, which every site has.
 *
 * It points to the site's /security page as its policy, says which
 * language a report may be in, and names its own address as canonical. It
 * expires (the RFC asks for less than a year ahead) 180 days after it is
 * drawn, and the route draws it afresh every day, so it is never stale.
 *
 * Imports nothing, so `npm test` loads it (tests/security-txt.test.mjs).
 */

/** How long a drawn file holds before it says to look again. */
export const EXPIRES_DAYS = 180

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/

/** A contact as security.txt takes it, or undefined for one that is not. */
export function contactUri(raw: string | undefined): string | undefined {
  const value = raw?.trim()
  // one line, or the file would gain lines of a setting's own
  // eslint-disable-next-line no-control-regex
  if (!value || /[\s\u0000-\u001f\u007f]/.test(value)) return undefined
  if (/^mailto:/i.test(value)) return EMAIL.test(value.slice("mailto:".length)) ? `mailto:${value.slice("mailto:".length)}` : undefined
  if (EMAIL.test(value)) return `mailto:${value}`
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export type SecurityTxtInput = {
  /** the site's address, no trailing slash */
  siteUrl: string
  /** SECURITY_CONTACT */
  securityContact?: string
  /** NEXT_PUBLIC_CONTACT_EMAIL */
  publicEmail?: string
  /** SITE_LANGUAGE, as "en-GB" */
  language: string
  now: Date
}

/** The file, one field a line, as RFC 9116 sets it out. */
export function securityTxt({ siteUrl, securityContact, publicEmail, language, now }: SecurityTxtInput): string {
  const site = siteUrl.replace(/\/+$/, "")
  const contacts = [contactUri(securityContact), contactUri(publicEmail), `${site}/contact?type=problem`].filter(
    (c, i, all): c is string => Boolean(c) && all.indexOf(c) === i,
  )
  const expires = new Date(now.getTime() + EXPIRES_DAYS * 24 * 60 * 60 * 1000)
  expires.setUTCHours(0, 0, 0, 0)
  const lang = language.split("-")[0].toLowerCase()
  return [
    ...contacts.map((c) => `Contact: ${c}`),
    `Expires: ${expires.toISOString().replace(/\.\d{3}Z$/, "Z")}`,
    `Policy: ${site}/security`,
    `Preferred-Languages: ${lang === "en" ? "en" : `${lang}, en`}`,
    `Canonical: ${site}/.well-known/security.txt`,
    "",
  ].join("\n")
}
