// Run by npm's `prebuild`, and by `npm run posthog:setup`: makes what the
// feedback loop needs in the PostHog project when it is missing, the "Site
// feedback" survey and the code's flags (lib/posthog-setup.ts, docs/
// feedback.md). Needs the site's key and a personal API key.
//
// In a build it never fails: no key, or a refusal, is reported and the build
// goes on (the feedback form says "not set up" until the survey exists).
// `--strict` (npm run posthog:setup) exits non-zero on a refusal instead.
import "./load-env.mjs"
import { analyticsKey, posthogRegion } from "../lib/analytics.ts"
import { ensurePostHog } from "../lib/posthog-setup.ts"

const strict = process.argv.includes("--strict")
const projectKey = analyticsKey(process.env.NEXT_PUBLIC_POSTHOG_KEY)
const personalKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim()

if (!projectKey) {
  console.log("[posthog-setup] no PostHog key (NEXT_PUBLIC_POSTHOG_KEY); nothing to do")
  process.exit(0)
}
if (!personalKey) {
  console.log("[posthog-setup] no POSTHOG_PERSONAL_API_KEY, so the Site feedback survey and the flags are not made for you; skipped (docs/feedback.md)")
  process.exit(strict ? 1 : 0)
}
try {
  const lines = await ensurePostHog({ personalKey, projectKey, projectId: process.env.POSTHOG_PROJECT_ID?.trim() || undefined, host: posthogRegion().ui })
  for (const line of lines) console.log(`[posthog-setup] ${line}`)
} catch (error) {
  console.warn(`[posthog-setup] PostHog could not be set up: ${error instanceof Error ? error.message : error}`)
  if (strict) process.exit(1)
}
