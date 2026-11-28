# Security

## Reporting a vulnerability

Please don't open a public issue for a security problem. Use one of these
instead:

- **GitHub's private reporting:** the repository's Security tab → "Report a
  vulnerability".
- **Email:** [hello@denot.app](mailto:hello@denot.app), with "Security" in
  the subject.

Say what you found, how to reproduce it, and what an attacker could do with
it. You'll get an answer within a week. A fix is made in the template
first, then announced, so that forks can take it before the details are
public.

## What is in scope

**In scope:** the template's own code, for example:

- a way to make a reader's browser contact a third party;
- a way to read or change the Notion database through the site;
- a way to use the site as a proxy, or to bypass a route's secret;
- a way to put a script on a page through content, a form or an address;
- a token, key or private detail committed to the repository.

**Out of scope:** the accounts a site is connected to (Notion, the email
platform, Shopify, Printify, the analytics tools, the host), and settings a
site's owner chose. Report those to the service concerned.

## How the template defends itself

[docs/privacy-and-security.md](docs/privacy-and-security.md) describes:

- the Content-Security-Policy and headers;
- the signed media route;
- the fail-closed secrets;
- form handling and rate limits;
- the tests and audits that hold them.

## Keeping a fork safe

- **Keep every secret in your host's environment variables**, never in the
  code. `.env.local` is ignored by git. The secrets test
  (`npm test`) fails on anything shaped like a token.
- **Give the site's Notion integration Read content only.** Give anything
  that writes an integration of its own.
- **Set `REVALIDATION_SECRET`** to a long random string if you use that
  route, and **`NOTION_WEBHOOK_SECRET`** to the verification token Notion
  sends when you make the webhook (the site logs it once): any other value
  and every event is refused.
- **Take updates from the template.** Dependabot (`.github/dependabot.yml`)
  proposes dependency updates once they have been public for two weeks, which
  keeps a freshly compromised release out. It never proposes a new major
  version, so a framework's move to one (Next.js, React) arrives from the
  template, made and tested by hand. Every GitHub Action in the workflows is
  pinned to a commit, not a tag, with its version beside it
  (`actions/checkout@<commit> # v7.0.1`): a tag can be moved to other code,
  a commit cannot, and the feedback loop's action holds your Anthropic key.
  Dependabot proposes new commits for them the same way, monthly.
  `tests/workflows.test.mjs` fails on an action named by tag.
- **Share the rate limits across every server.** In Vercel: Storage →
  Marketplace → Upstash (Redis), then redeploy; it sets the variables
  itself. Without a shared store each server instance counts alone, which
  stops one client in a loop but not a flood spread across instances
  ([docs/privacy-and-security.md](docs/privacy-and-security.md#rate-limits)).
- **Say where to report a problem with your site.** It serves
  `/.well-known/security.txt`; set `SECURITY_CONTACT` to your own address,
  and on a domain of your own turn DNSSEC on where its DNS is kept
  ([docs/privacy-and-security.md](docs/privacy-and-security.md#your-domain)).
- **Protect the default branch.** Settings, Rules, Rulesets: require a pull
  request on it, with no one allowed to bypass. Then no workflow, key or
  agent can put a change on the live site without a person merging it.
- **Read a fork's pull request before Vercel builds it.** Vercel's Git Fork
  Protection (on by default) asks before deploying one; a deployment it
  reports to GitHub runs that commit's own workflows with the repository's
  secrets. Keep the feedback loop's secrets in a GitHub environment that
  only the default branch may use if you ever turn that protection off.
- **Give the feedback loop keys of its own.** Anybody can send feedback, so
  its agent gets a PostHog key that only reads and a model key with a
  spending limit, and never pushes or opens anything itself
  ([docs/feedback.md](docs/feedback.md#what-a-stranger-can-do-with-it)).
