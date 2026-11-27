import { SITE_LANGUAGE, SITE_URL } from "@/lib/site"
import { securityTxt } from "@/lib/security-txt"

/**
 * /.well-known/security.txt (lib/security-txt.ts): the site's own contact
 * for a security problem. Drawn at build and again each day, so its Expires
 * is always half a year ahead.
 */
export const dynamic = "force-static"
export const revalidate = 86400

export function GET() {
  const body = securityTxt({
    siteUrl: SITE_URL,
    securityContact: process.env.SECURITY_CONTACT,
    publicEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
    language: SITE_LANGUAGE,
    now: new Date(),
  })
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400" } })
}
