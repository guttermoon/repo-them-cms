/**
 * The environment the Notion layer and the revalidation routes read.
 *
 * Nothing here runs at import or throws: the site is meant to work with no
 * credentials at all (every slot falls back to the wording written into the
 * components, and the blog and the Notion pages are simply empty), so a
 * missing token is reported by the code that needs one, once, in production.
 *
 * Read through functions rather than captured in constants, so a test or a
 * script can set a variable after import.
 */

/** The Notion integration's token (Notion → Settings → Connections → Develop
 *  or manage integrations). Read-only access is enough for the site. */
export const notionToken = (): string | undefined => process.env.NOTION_TOKEN?.trim() || undefined

/**
 * The database, as its ID or as the URL copied from Notion's address bar.
 * The 32 hex characters are pulled out of either, so pasting the whole link
 * works.
 */
export function notionDatabaseId(): string | undefined {
  return notionId(process.env.NOTION_DATABASE_ID)
}

/** A Notion ID out of an ID, a dashed UUID or a URL that ends in one. */
export function notionId(raw: string | undefined): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  // A URL's "?v=" (a view) and "#" come after the ID, so they go first.
  const path = value.split(/[?#]/)[0].replace(/\/+$/, "")
  // A dashed UUID anywhere, the last one winning; else the 32 hex characters
  // the path ends in. Anchored to the end because a page's slug comes before
  // its ID in a Notion URL ("My-Database-1f16…"), and a slug can be hex too.
  const dashed = path.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)
  const hex = dashed ? dashed[dashed.length - 1].replace(/-/g, "") : path.match(/[0-9a-f]{32}$/i)?.[0]
  if (!hex) return undefined
  const h = hex.toLowerCase()
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Both halves of the Notion connection are set. Without them an empty site
 *  is the expected answer, not a failure worth logging. */
export const notionConfigured = (): boolean => Boolean(notionToken() && notionDatabaseId())

/**
 * A stand-in for api.notion.com, for the tests and for an end-to-end run
 * against scripts/fake-notion.mjs. Never set it on a live deployment: the
 * site would read its content from wherever it points.
 */
export const notionApiBaseUrl = (): string | undefined =>
  process.env.NOTION_API_BASE_URL?.trim().replace(/\/+$/, "") || undefined

/** The secret /api/revalidate requires. Unset, the route refuses every call. */
export const revalidationSecret = (): string | undefined => process.env.REVALIDATION_SECRET?.trim() || undefined

/** The verification token Notion sends when an integration webhook is
 *  created; every event after it is signed with it. Unset, the webhook route
 *  refuses events (and logs the token it is sent, once, so it can be set). */
export const notionWebhookSecret = (): string | undefined => process.env.NOTION_WEBHOOK_SECRET?.trim() || undefined
