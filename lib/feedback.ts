/**
 * Feedback, the site's end of the loop (docs/feedback.md): a reader's words
 * become a response to the "Site feedback" survey in PostHog, where an agent
 * reads them, watches the recording they came from, and opens a draft pull
 * request with a fix.
 *
 * The survey is PostHog's `api` kind: PostHog keeps its questions and its
 * responses, and the site draws the form (components/layout/feedback.tsx).
 * The form posts to /api/feedback, on this site, which sends PostHog the
 * `survey sent` event its own surveys send. So feedback needs no yes in the
 * cookie notice (it is a message the reader chose to send, like the contact
 * form), and PostHog never sees the reader's address: the request comes from
 * this server. With a yes, the form adds the visit's random identifier and
 * session, which is what ties a response to its recording.
 *
 * Pure but for `feedbackSurvey` and `sendFeedback`, which take their host,
 * so tests/feedback.test.mjs holds every rule against a stand-in PostHog.
 */
import { THEMES } from "./theme"

/** The survey's name in PostHog: the route finds it by this, among the
 *  project's running surveys, and `npm run posthog:setup` makes it. */
export const FEEDBACK_SURVEY_NAME = "Site feedback"

/** What a reader can say it is, in the order of the survey's choices. */
export const FEEDBACK_KINDS = ["broken", "idea", "liked"] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

/** The survey as `npm run posthog:setup` makes it: the choices are in the
 *  order of FEEDBACK_KINDS, which is how a kind finds its choice. The form's
 *  own words are Site Copy; these are what the survey's results show. */
export const FEEDBACK_SURVEY = {
  name: FEEDBACK_SURVEY_NAME,
  description: "What readers send from the Feedback button in the corner of every page (docs/feedback.md).",
  questions: [
    { type: "single_choice", question: "What is it?", choices: ["Something is broken", "An idea", "Something I liked"] },
    { type: "open", question: "What happened?" },
  ],
} as const

/** The most a reader can write: a page of text, not a document. */
export const WORDS_MAX = 2000

export type Visit = { distinctId: string; sessionId: string }

export type Feedback = {
  kind: FeedbackKind
  words: string
  /** the page it was sent from, as a path */
  page: string
  /** the look the reader had on */
  look?: (typeof THEMES)[number]
  /** the window's size, as "1280x800" */
  viewport?: string
  visit?: Visit
}

/** Why a posting is refused, in the form's own codes (`feedback.<code>`). */
export type Refusal = "empty" | "malformed"

/** A path on this site. Never `//host/…`, which an address reads as another
 *  host: the event's `$current_url` would name it, and the agent that reads
 *  the feedback would be sent there. */
const PATH = /^\/(?!\/)[A-Za-z0-9/_\-.~%]*$/
const ID = /^[A-Za-z0-9_-]{8,100}$/
const VIEWPORT = /^\d{2,5}x\d{2,5}$/

/** A posting held to its shape: anything else about it is dropped. */
export function readFeedback(fields: Record<string, unknown>): Feedback | { refused: Refusal } {
  const kind = FEEDBACK_KINDS.find((k) => k === fields.kind)
  if (!kind) return { refused: "malformed" }
  const words = typeof fields.words === "string" ? fields.words.trim().slice(0, WORDS_MAX) : ""
  if (words.length < 3) return { refused: "empty" }
  const page = typeof fields.page === "string" && PATH.test(fields.page) && fields.page.length <= 300 ? fields.page : "/"
  const look = THEMES.find((t) => t === fields.look)
  const viewport = typeof fields.viewport === "string" && VIEWPORT.test(fields.viewport) ? fields.viewport : undefined
  const raw = fields.visit as Record<string, unknown> | null | undefined
  const visit =
    raw && typeof raw === "object" && typeof raw.distinctId === "string" && typeof raw.sessionId === "string" && ID.test(raw.distinctId) && ID.test(raw.sessionId)
      ? { distinctId: raw.distinctId, sessionId: raw.sessionId }
      : undefined
  return { kind, words, page, ...(look ? { look } : {}), ...(viewport ? { viewport } : {}), ...(visit ? { visit } : {}) }
}

/** A survey as PostHog lists the project's running ones. */
export type SurveyDefinition = {
  id: string
  name: string
  type: string
  current_iteration?: number | null
  questions: { id: string; type: string; question: string; choices?: string[] }[]
}

/**
 * The `survey sent` event for one piece of feedback, as PostHog's own
 * surveys send it (the event contract in PostHog's docs): one submission,
 * complete, each answer under its question's id. Each piece of feedback is
 * its own submission, so `submissionId` is new for every one.
 */
export function surveyEvent(survey: SurveyDefinition, feedback: Feedback, { submissionId, siteUrl, userAgent }: { submissionId: string; siteUrl: string; userAgent?: string }) {
  const choice = survey.questions.find((q) => q.type === "single_choice" || q.type === "multiple_choice")
  const open = survey.questions.find((q) => q.type === "open")
  const index = FEEDBACK_KINDS.indexOf(feedback.kind)
  const answers: Record<string, string | string[]> = {}
  if (choice) {
    const picked = choice.choices?.[index] ?? FEEDBACK_SURVEY.questions[0].choices[index]
    answers[`$survey_response_${choice.id}`] = choice.type === "multiple_choice" ? [picked] : picked
  }
  if (open) answers[`$survey_response_${open.id}`] = feedback.words
  return {
    event: "survey sent",
    // a reader who said yes is the visit PostHog already knows; anybody
    // else is a stranger nobody can follow, with no profile kept
    distinct_id: feedback.visit?.distinctId ?? submissionId,
    properties: {
      $survey_id: survey.id,
      $survey_iteration: survey.current_iteration ?? null,
      $survey_submission_id: submissionId,
      $survey_completed: true,
      $survey_questions: survey.questions.map(({ id, question }) => ({ id, question })),
      ...answers,
      // what the agent needs to find it again, and nothing that names anybody
      feedback_kind: feedback.kind,
      $current_url: new URL(feedback.page, siteUrl).toString(),
      $pathname: feedback.page,
      ...(feedback.look ? { look: feedback.look } : {}),
      ...(feedback.viewport ? { viewport: feedback.viewport } : {}),
      ...(userAgent ? { $raw_user_agent: userAgent.slice(0, 400) } : {}),
      ...(feedback.visit ? { $session_id: feedback.visit.sessionId } : { $process_person_profile: false }),
      $lib: "repo-them-feedback",
    },
  }
}

/** How long the survey's definition is used before PostHog is asked again:
 *  a minute when there was none (it is being set up), ten when there was. */
const FOUND_MS = 10 * 60_000
const MISSING_MS = 60_000

let known: { at: number; key: string; survey: SurveyDefinition | null } | null = null

/** For tests: forget the survey, so the next send asks PostHog again. */
export function forgetFeedbackSurvey() {
  known = null
}

/**
 * The project's "Site feedback" survey, or null when it has none running:
 * PostHog's public list of running surveys, read with the project's public
 * key and kept for a while, so feedback never waits on two requests.
 */
export async function feedbackSurvey(key: string, host: string, now: number = Date.now()): Promise<SurveyDefinition | null> {
  if (known && known.key === key && now - known.at < (known.survey ? FOUND_MS : MISSING_MS)) return known.survey
  const response = await fetch(`${host}/api/surveys/?token=${encodeURIComponent(key)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`PostHog listed no surveys (${response.status})`)
  const data = (await response.json()) as { surveys?: SurveyDefinition[] }
  const survey = data.surveys?.find((s) => s.name === FEEDBACK_SURVEY_NAME && s.type === "api") ?? null
  known = { at: now, key, survey }
  return survey
}

/** One event to PostHog's capture endpoint, with the project's public key. */
export async function sendFeedback(key: string, host: string, event: ReturnType<typeof surveyEvent>): Promise<void> {
  const response = await fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, ...event, timestamp: new Date().toISOString() }),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`PostHog refused the feedback (${response.status})`)
}
