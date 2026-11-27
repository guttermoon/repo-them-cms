/**
 * What the feedback loop's agent hands over, held to its shape before
 * anything of it reaches GitHub (docs/feedback.md, "What a stranger can do").
 *
 * Anybody can send feedback, and the agent reads it, so the agent's job runs
 * as if a stranger were at its keyboard: it may read the repository and
 * PostHog, and write only files. Its branches arrive as a git bundle and its
 * pull requests and issue as Markdown files (`# title`, then the body), and
 * the workflow's second job, with no agent and none of its keys, opens them
 * through `scripts/feedback-open.mjs` and these rules:
 *
 * - a branch is `feedback/<name>`, lowercase, and new: one already on GitHub
 *   is never pushed over;
 * - it starts from the commit the run started from and changes something;
 * - it changes nothing that runs before a person has read it, or that gives
 *   the repository's keys away: the workflows, the agent's own playbook,
 *   Vercel's settings (which keep `feedback/*` from being built with the
 *   site's secrets) and the packages that install;
 * - titles are one line, start with "Feedback: ", and bodies are cut to a
 *   size GitHub takes, with every @mention broken so a stranger's words never
 *   notify anybody, and a line telling the reviewer whose words they are.
 *
 * Imports nothing, so `npm test` loads it (tests/feedback-loop.test.mjs).
 */

/** A branch's name after `feedback/`, and a pull request file's before `.md`. */
export const PULL_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/

/** The most pull requests one run opens: more is a flood, not a morning. */
export const MAX_PULLS = 10

/** Paths a feedback branch may not change. */
export const PROTECTED = [
  /^\.github\//, // the workflows, and what runs them
  /^\.claude\//, // the agent's playbook and settings
  /^vercel\.json$/, // which branches Vercel builds with the site's secrets
  /^package(?:-lock)?\.json$/, // what installs, and the scripts npm runs
  /^\.npmrc$/, // where packages come from
] as const

/** The changed paths a feedback branch may not change. */
export function protectedPaths(files: string[]): string[] {
  return files.filter((file) => PROTECTED.some((rule) => rule.test(file)))
}

/** GitHub's most for a body is 65,536 characters; this leaves room for the note. */
export const BODY_MAX = 60_000
const TITLE_MAX = 120
const PREFIX = "Feedback: "

/** What every body ends with: whose words these are. */
export const REVIEW_NOTE =
  "---\n_Opened by the feedback loop (docs/feedback.md). An agent wrote this from feedback anybody can send: read every line of the change before you run or build it._"

/** One line, no control characters, "Feedback: " first, cut to fit. */
export function cleanTitle(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const line = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim()
  const titled = `${PREFIX}${line.replace(/^feedback:\s*/i, "")}`.trim()
  return titled.length > TITLE_MAX ? `${titled.slice(0, TITLE_MAX - 1).trimEnd()}…` : titled
}

/** A body that notifies nobody: `@name` is broken with a zero-width space. */
export function quietBody(raw: string): string {
  const body = raw.replace(/(^|[^\w`])@(?=[A-Za-z0-9])/g, "$1@\u200b").trim()
  const cut = body.length > BODY_MAX ? `${body.slice(0, BODY_MAX)}\n\n…` : body
  return `${cut}\n\n${REVIEW_NOTE}`
}

export type Handed = { title: string; body: string }

/** A handed-over Markdown file as a title and a body, or why it is refused. */
export function readHanded(text: string): Handed | { refused: string } {
  const [first = "", ...rest] = text.replace(/^\ufeff/, "").split(/\r?\n/)
  const heading = /^#\s+(.+)$/.exec(first.trim())
  if (!heading) return { refused: "its first line is not a `# title`" }
  const title = cleanTitle(heading[1])
  if (title === PREFIX.trim()) return { refused: "its title is empty" }
  const body = rest.join("\n").trim()
  if (!body) return { refused: "its body is empty" }
  return { title, body: quietBody(body) }
}

export type BranchFacts = {
  /** whether the branch is on GitHub already */
  exists: boolean
  /** whether it starts from the commit the run started from */
  fromBase: boolean
  /** the paths it changes, from that commit */
  files: string[]
}

/** Why a branch is not pushed, or null when it may be. */
export function branchRefusal(facts: BranchFacts): string | null {
  if (facts.exists) return "a branch of that name is already on GitHub, and is never pushed over"
  if (!facts.fromBase) return "it does not start from the commit this run started from"
  if (!facts.files.length) return "it changes nothing"
  const held = protectedPaths(facts.files)
  if (held.length) return `it changes ${held.join(", ")}, which a feedback branch may not`
  return null
}
