/**
 * Who this site is and where it lives. Imports nothing, so the tests, the
 * scripts and every page can load it.
 *
 * A fork changes the identity here and the words in Notion. Nothing
 * account-specific belongs in this file: keys, IDs and addresses for your
 * accounts are environment variables (.env.example), so a public fork never
 * publishes them.
 */

/** The template's own name, in its credit: the footer's independence
 *  statement and the questions about the template. A copy keeps it, as it
 *  keeps the maker's credit; its own name is SITE_NAME. Notion's brand rules
 *  forbid "Notion" in a product's name: it goes in the descriptor instead. */
export const TEMPLATE_NAME = "REPO THEM"

/** The site's name, as the code knows it: the built-in wording of the
 *  `site.name` row, which renames the site from Notion. A label, set in
 *  capitals. Notion's brand rules forbid "Notion" in a product's name. */
export const SITE_NAME = "REPO THEM"

/** What it is, said less prominently than the name (Notion's rule). */
export const SITE_DESCRIPTOR = "A Notion-powered CMS"

/** The generic noun on the label: what is in the box. */
export const SITE_NOUN = "WEBSITE"

/** The site's logo, as search engines and assistants are told it (the
 *  Organization in lib/structured-data.ts): the mark, square, larger than
 *  the 112 pixels Google asks for, at an address that does not change.
 *  `npm run icons` draws it; a copy with a mark of its own redraws it. */
export const SITE_LOGO = { src: "/icon-512.png", width: 512, height: 512 } as const

/** The one-line description used by search results, feeds and /llms.txt. */
export const SITE_DESCRIPTION =
  "REPO THEM is a Notion-powered CMS: a website you write in Notion. Copy, pages and posts live in one Notion database, and the site follows within a minute."

/** `lang` on <html>, the structured data's inLanguage and the feed's language. */
export const SITE_LANGUAGE = "en-GB"

/** Open Graph's locale, which spells the same thing differently. */
export const SITE_LOCALE = "en_GB"

/**
 * The person who made the template, credited in the footer, the homepage's
 * service counter, the README, the structured data and /llms.txt. The email
 * address is a public business contact, printed on purpose; it is the only
 * address the secret scan allows (tests/no-secrets.test.mjs).
 */
export const MAKER = {
  name: "Megan Aileen Williams",
  /** the studio the template is credited to, "REPO THEM a GitHub template by Denot", linked
   *  to the maker's site */
  studio: "Denot",
  url: "https://denot.app",
  email: "hello@denot.app",
} as const

/** The maker's site as it is printed on a button: its address without the
 *  scheme. */
export const MAKER_HOST = new URL(MAKER.url).host

/**
 * The template's public repository, for "Get it" and "Star it". Set here
 * rather than read from the environment because it is the upstream every
 * fork points back to. Left empty, "Get it" points at the deploy steps on
 * /features and the star card, the security policy link and the source
 * line in /llms.txt hide themselves.
 */
export const REPO_URL: string = "https://github.com/guttermoon/repo-them-cms"

/** GitHub's "Use this template" page for the repository, or "" without one. */
export const TEMPLATE_URL = REPO_URL ? `${REPO_URL}/generate` : ""

/** Vercel's page for importing a repository as a new project: step 4 of the
 *  directions, for a copy made by hand. */
export const VERCEL_IMPORT_URL = "https://vercel.com/new"

/**
 * The public Notion template: a copy of the demo's database, published with
 * "Allow duplicate as template", so a new site starts from the same rows,
 * pictures and views in a click. A copy, never the demo's own database, so
 * nobody reads its drafts. Notion sends this address to the published page.
 * Its ID is public on purpose (tests/no-secrets.test.mjs allows it).
 */
export const NOTION_TEMPLATE_URL = "https://www.notion.so/4236f6ccb2c18175b890e03e8f6ca2a8"

/**
 * The template's own live demo: this code, connected to the demo's
 * database, for the README to link. The one deployment's address the
 * repository names, public on purpose (tests/no-secrets.test.mjs allows it
 * and no other). The site never prints it: a copy's own address is its
 * SITE_URL.
 */
export const DEMO_URL = "https://repo-them.vercel.app"

/** The two settings the Deploy button asks for: the only ones a site needs.
 *  Vercel makes every setting the button names required, so anything
 *  optional is left to the project's settings afterwards. */
export const DEPLOY_SETTINGS = ["NOTION_TOKEN", "NOTION_DATABASE_ID"] as const

/** What Vercel prints above those two settings. */
export const DEPLOY_SETTINGS_HELP =
  "Your Notion integration's token (ntn_…), and the link to your copy of the REPO THEM template in Notion (the whole link works). The guide shows where each one is."

/** The guide those settings link to: the README's directions. */
export const SETUP_GUIDE_URL = REPO_URL ? `${REPO_URL}#set-it-up` : ""

/** A query value with nothing left that a Markdown link would trip on:
 *  encodeURIComponent, and the brackets and quote it leaves alone. */
const queryValue = (text: string) => encodeURIComponent(text).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** Vercel's clone page for the repository, with a query of its own. */
function vercelClone(extra: string): string {
  const repository = queryValue(REPO_URL)
  return `https://vercel.com/new/clone?repository-url=${repository}&project-name=repo-them&repository-name=repo-them${extra}`
}

/**
 * "Deploy with Vercel": copies the repository to the reader's GitHub, asks
 * for the two Notion settings, and deploys. Values never go in the address
 * (it stays in the browser's history), only the settings' names.
 */
export const DEPLOY_URL = REPO_URL
  ? vercelClone(
      `&env=${DEPLOY_SETTINGS.join(",")}&envDescription=${queryValue(DEPLOY_SETTINGS_HELP)}&envLink=${queryValue(SETUP_GUIDE_URL)}`,
    )
  : ""

/** The same, asking for nothing: a site showing the starter content, to look
 *  round before connecting Notion. */
export const DEMO_DEPLOY_URL = REPO_URL ? vercelClone("") : ""

// Absolute origin for canonical URLs, sitemap, robots, feeds and JSON-LD.
//
// Order matters: whatever this resolves to is what the sitemap advertises and
// what every page canonicalises to. VERCEL_URL is the deployment-specific
// host, so using it in production publishes a sitemap of URLs on a domain
// that is not the one serving it. So: the explicit value first, then
// Vercel's production domain, and only then the per-deployment host, which
// is right for previews and wrong for anything else.
//
// next.config.mjs hands the same answer to the browser's code at build
// (Vercel's own variables are the server's alone), so a client component
// that reads this agrees with the server.
const explicit = process.env.NEXT_PUBLIC_SITE_URL
const production = process.env.VERCEL_PROJECT_PRODUCTION_URL
const deployment = process.env.VERCEL_URL

const withScheme = (host: string) => (host.startsWith("http") ? host : `https://${host}`)

export const SITE_URL = (
  (explicit && withScheme(explicit)) ||
  (production && withScheme(production)) ||
  (deployment && withScheme(deployment)) ||
  "http://localhost:3000"
)
  // a trailing slash here doubles up everywhere this is concatenated
  .replace(/\/+$/, "")

/** The host alone, for printing: no scheme, no leading "www.". */
export const SITE_HOST = new URL(SITE_URL).host.replace(/^www\./, "")
