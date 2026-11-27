/**
 * The site's feature flags: every flag the code reads, with the value it
 * takes when PostHog cannot say (docs/feedback.md, "Flags").
 *
 * A flag is read from PostHog only for a reader who said yes in the cookie
 * notice, since asking PostHog is a request that names their browser. Every
 * other reader gets the flag's `fallback`, which is therefore what the site
 * does by default: a flag never decides anything for somebody who said no.
 * So a change that should reach only some readers ships with `fallback:
 * false` and is turned on in PostHog; once it has proved itself, the flag
 * comes out of the code and the change is simply the site.
 *
 * `npm run posthog:setup` makes each flag here in the PostHog project, and
 * tests/flags.test.mjs fails on a flag the code reads that is not listed.
 */
export const FLAGS = {
  "site-feedback": {
    fallback: true,
    about: "The Feedback button in the corner of every page, which sends a reader's words to the Site feedback survey.",
  },
} as const satisfies Record<string, { fallback: boolean; about: string }>

export type FlagKey = keyof typeof FLAGS

/** What a flag is for a reader: PostHog's answer when it gave one (a
 *  boolean, or a variant's name, which counts as on), else its fallback. */
export function flagValue(key: FlagKey, answer: boolean | string | undefined): boolean {
  if (typeof answer === "boolean") return answer
  if (typeof answer === "string") return answer.length > 0
  return FLAGS[key].fallback
}
