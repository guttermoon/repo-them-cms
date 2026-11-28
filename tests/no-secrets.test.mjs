// Nothing private goes into this repository: it is public, and meant to be
// forked. Every file git would commit is read and checked for
//
// - an email address that is not the maker's public one or an example
//   address (example.com, .test, .invalid and the like);
// - a token or key from any service the site talks to, or a private key;
// - a real-looking ID: a Notion page, database or data source, a PostHog
//   project key, a Google Analytics or Tag Manager ID, a deployment's own
//   hostname. Account-specific values come from the environment, never the
//   code (.env.example has the names, with placeholders).
//
// The test names none of what it is looking for: the patterns are shapes,
// not values, so the file cannot leak what it guards against.
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { DEMO_URL, MAKER } from "../lib/site.ts"

const ROOT = fileURLToPath(new URL("../", import.meta.url))
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|pdf|zip|gz|mp4|mp3)$/i

/** Every file git would commit: tracked, and new files not ignored. */
const FILES = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter((f) => f && existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).isFile() && !BINARY.test(f))

const text = (file) => readFileSync(join(ROOT, file), "utf8")

/** Where every finding is reported from. */
function scan(pattern, allowed = () => false) {
  const found = []
  for (const file of FILES) {
    for (const match of text(file).matchAll(pattern)) {
      if (!allowed(match[0], file)) found.push(`${file}: ${match[0]}`)
    }
  }
  return found
}

test("the scan sees the files that matter", () => {
  for (const file of ["package.json", "lib/site.ts", "README.md", ".env.example"]) assert.ok(FILES.includes(file), file)
})

test("no email address but the maker's public one and examples", () => {
  // the domains RFC 2606 keeps for examples, and nothing else
  const EXAMPLE = /@([a-z0-9-]+\.)*(example\.(com|org|net)|example|test|invalid|localhost)$/i
  const found = scan(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, (address, file) => {
    const a = address.toLowerCase()
    // npm's lockfile carries packages' own metadata, never this project's
    if (file === "package-lock.json") return true
    return a === MAKER.email || EXAMPLE.test(a) || a === "git@github.com" || a === "noreply@github.com" || /@\d+\.\d+\.\d+$/.test(a)
  })
  assert.deepEqual(found, [])
})

test("no token, key or private key from any service", () => {
  const SHAPES = [
    /\b(?:secret|ntn)_[A-Za-z0-9]{40,}\b/g, // Notion integration tokens
    /\bxkeysib-[a-f0-9]{64}-[A-Za-z0-9]{16}\b/g, // Brevo API keys
    /\bxsmtpsib-[a-f0-9]{64}-[A-Za-z0-9]{16}\b/g, // Brevo SMTP keys
    /\b[a-f0-9]{32}-us\d{1,2}\b/g, // Mailchimp API keys
    /\bSG\.[\w-]{22}\.[\w-]{43}\b/g, // SendGrid
    /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/g, // Resend
    /\bphc_[A-Za-z0-9]{20,}\b/g, // PostHog project keys
    /\bphx_[A-Za-z0-9]{20,}\b/g, // PostHog personal keys
    /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/g, // Stripe
    /\bAKIA[0-9A-Z]{16}\b/g, // AWS
    /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API keys
    /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, // GitHub tokens
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, // GitHub fine-grained tokens (FEEDBACK_GH_TOKEN)
    /\bsk-ant-(?:api|oat|admin)\d{2}-[A-Za-z0-9_-]{20,}/g, // Anthropic API keys and Claude Code OAuth tokens
    /\bshp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}\b/g, // Shopify access tokens
    /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/g, // signed tokens (JWTs), as Printify's are
    /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, // Slack
    /\bvercel_[A-Za-z0-9]{20,}\b|\bVERCEL_TOKEN=\S+/g, // Vercel
    /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  ]
  for (const shape of SHAPES) assert.deepEqual(scan(shape), [], String(shape))
})

test("no analytics or tag manager ID but the tests' made-up ones and placeholders", () => {
  const found = scan(
    /\b(?:G|GTM|UA|AW)-[A-Z0-9]{5,12}\b/g,
    (id) => /^(G-TEST\d+|G-ABC123DEF4)$/.test(id) || /^(G|GTM|UA|AW)-[0X]+$/.test(id) || /^(G|GTM)-(?:EXAMPLE|PLACEHOLDER)/.test(id),
  )
  assert.deepEqual(found, [])
})

test("no real-looking Notion ID: only made-up ones and public pages", () => {
  const PUBLIC = new Set([
    // Notion's brand guidelines, a public page the starter content links to
    "689045e1761348f887a3c5c80295e00f",
    // the REPO THEM template, published to be duplicated (NOTION_TEMPLATE_URL)
    "4236f6ccb2c18175b890e03e8f6ca2a8",
  ])
  const madeUp = (hex) => new Set(hex).size <= 6 || /^(0123456789abcdef){2}$/.test(hex) || /^0{8}/.test(hex)
  const found = scan(/\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/gi, (id) => {
    const hex = id.replace(/-/g, "").toLowerCase()
    return PUBLIC.has(hex) || madeUp(hex)
  })
  assert.deepEqual(found, [])
})

test("no deployment's own address but the public demo's: hosts come from the environment", () => {
  const demo = new URL(DEMO_URL).host
  const found = scan(/\b[a-z0-9-]+\.vercel\.app\b/gi, (host) => host.toLowerCase() === demo || /^(your|my|example|project|site)[a-z0-9-]*\.vercel\.app$/i.test(host))
  assert.deepEqual(found, [])
})

test("no trace of the site this template was made from", () => {
  // ROT13, so this file does not itself carry the names it guards against
  const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode(((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26) + (c === c.toLowerCase() ? 97 : 65)))
  const NAMES = ["zbovyr serr zbaqnl", "zbovyrserrzbaqnl", "qrnq tbbq pyho", "qrnqtbbqpyho", "jbeyqmbzovrqnl", "zszcyrqtrf", "zszarjfyrggre"].map(rot13)
  for (const file of FILES) {
    const body = text(file).toLowerCase()
    for (const name of NAMES) assert.ok(!body.includes(name), `${file} still mentions an old name (${NAMES.indexOf(name)})`)
  }
})
