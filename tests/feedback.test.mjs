// Feedback's site end (lib/feedback.ts, app/api/feedback): what a posting is
// held to, the `survey sent` event PostHog's own surveys send, and the route
// against a stand-in PostHog: what it sends, what it refuses, and that it
// never logs a word a reader wrote.
import { after, beforeEach, test } from "node:test"
import assert from "node:assert/strict"

const POSTHOG = "https://posthog.test"
const KEY = "phc_test12345678"
const saved = { ...process.env }
const realFetch = globalThis.fetch

const SURVEY = {
  id: "0190-survey",
  name: "Site feedback",
  type: "api",
  current_iteration: null,
  questions: [
    { id: "q-kind", type: "single_choice", question: "What is it?", choices: ["Something is broken", "An idea", "Something I liked"] },
    { id: "q-words", type: "open", question: "What happened?" },
  ],
}

/** What the stand-in PostHog has been asked, and how it answers next. */
let asked = []
let surveys = [SURVEY]
let refuseCapture = null
globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  if (!url.startsWith(POSTHOG)) throw new Error(`unexpected request to ${url}`)
  asked.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined })
  if (url.startsWith(`${POSTHOG}/api/surveys/`)) return Response.json({ surveys })
  if (refuseCapture) return new Response("no", { status: refuseCapture })
  return Response.json({ status: "Ok" })
}

process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY
process.env.POSTHOG_PROXY_UPSTREAM = POSTHOG
process.env.NODE_ENV = "test"

const { NextRequest } = await import("next/server")
const route = await import("../app/api/feedback/route.ts")
const { readFeedback, surveyEvent, feedbackSurvey, forgetFeedbackSurvey, FEEDBACK_SURVEY, FEEDBACK_KINDS } = await import("../lib/feedback.ts")

const logged = []
const quiet = ["log", "warn", "error", "info"].map((level) => [level, console[level]])
for (const [level] of quiet) console[level] = (...args) => logged.push(args.join(" "))
after(() => {
  globalThis.fetch = realFetch
  process.env = saved
  for (const [level, fn] of quiet) console[level] = fn
})

beforeEach(() => {
  asked = []
  surveys = [SURVEY]
  refuseCapture = null
  logged.length = 0
  process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY
  forgetFeedbackSurvey()
})

let ip = 0
const post = (body, from = `10.9.${Math.floor(++ip / 250)}.${ip % 250}`) =>
  route.POST(
    new NextRequest("https://site.example/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": from, "user-agent": "TestBrowser/1.0" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )

const SECRET_WORDS = "the basket button does nothing for jane@example.com"
const GOOD = { kind: "broken", words: SECRET_WORDS, page: "/shop/drink", look: "dark", viewport: "390x844" }
const captured = () => asked.filter((a) => a.url === `${POSTHOG}/i/v0/e/`).map((a) => a.body)

// ------------------------------------------------------------------- shape

test("a posting is held to its shape: a known kind, a few words, a path; the rest is dropped", () => {
  assert.deepEqual(readFeedback({ kind: "nope", words: "hello there" }), { refused: "malformed" })
  assert.deepEqual(readFeedback({ kind: "idea", words: "  hi " }), { refused: "empty" })
  const read = readFeedback({ ...GOOD, words: "x".repeat(5000), extra: "kept nowhere", visit: { distinctId: "abc", sessionId: "<script>" } })
  assert.equal(read.words.length, 2000, "words are cut to a page")
  assert.equal(read.visit, undefined, "a visit that is not shaped like PostHog's ids is dropped")
  assert.equal("extra" in read, false)
  assert.equal(readFeedback({ ...GOOD, page: "https://elsewhere.example/x" }).page, "/", "a page is a path on this site")
  assert.equal(readFeedback({ ...GOOD, page: "//elsewhere.example/x" }).page, "/", "a path that names a host is another site")
  const named = surveyEvent(SURVEY, readFeedback({ ...GOOD, page: "//elsewhere.example/x" }), { submissionId: "sub-0", siteUrl: "https://site.example" })
  assert.equal(new URL(named.properties.$current_url).host, "site.example", "the event's address is always this site's")
  assert.equal(readFeedback({ ...GOOD, look: "neon" }).look, undefined)
  assert.equal(readFeedback({ ...GOOD, viewport: "huge" }).viewport, undefined)
  assert.deepEqual(readFeedback({ ...GOOD, visit: { distinctId: "0190a-visitor-id", sessionId: "0190b-session-id" } }).visit, { distinctId: "0190a-visitor-id", sessionId: "0190b-session-id" })
})

test("the event is PostHog's survey contract: one complete submission, each answer under its question's id", () => {
  const event = surveyEvent(SURVEY, readFeedback({ ...GOOD, kind: "idea" }), { submissionId: "sub-1", siteUrl: "https://site.example", userAgent: "TestBrowser/1.0" })
  assert.equal(event.event, "survey sent")
  const p = event.properties
  assert.equal(p.$survey_id, SURVEY.id)
  assert.equal(p.$survey_submission_id, "sub-1")
  assert.equal(p.$survey_completed, true)
  assert.deepEqual(p.$survey_questions, [
    { id: "q-kind", question: "What is it?" },
    { id: "q-words", question: "What happened?" },
  ])
  assert.equal(p["$survey_response_q-kind"], "An idea", "a kind is the survey's own choice at its place")
  assert.equal(p["$survey_response_q-words"], SECRET_WORDS)
  assert.equal(p.$current_url, "https://site.example/shop/drink")
  assert.equal(p.look, "dark")
  // a stranger: a fresh identifier and no profile
  assert.equal(event.distinct_id, "sub-1")
  assert.equal(p.$process_person_profile, false)
  assert.equal(p.$session_id, undefined)
})

test("with a yes, the event is the visit's own, tied to its recording", () => {
  const visit = { distinctId: "0190a-visitor-id", sessionId: "0190b-session-id" }
  const event = surveyEvent(SURVEY, readFeedback({ ...GOOD, visit }), { submissionId: "sub-2", siteUrl: "https://site.example" })
  assert.equal(event.distinct_id, visit.distinctId)
  assert.equal(event.properties.$session_id, visit.sessionId)
  assert.equal(event.properties.$process_person_profile, undefined)
})

test("the survey the setup makes has a choice for every kind, in their order", () => {
  assert.equal(FEEDBACK_SURVEY.questions[0].type, "single_choice")
  assert.equal(FEEDBACK_SURVEY.questions[0].choices.length, FEEDBACK_KINDS.length)
  assert.equal(FEEDBACK_SURVEY.questions[1].type, "open")
})

// ------------------------------------------------------------------- route

test("route: a good posting becomes one `survey sent`, sent with the public key from this server", async () => {
  const response = await post(GOOD)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: "sent" })
  const [event] = captured()
  assert.equal(event.api_key, KEY)
  assert.equal(event.event, "survey sent")
  assert.equal(event.properties["$survey_response_q-words"], SECRET_WORDS)
  assert.equal(event.properties.$raw_user_agent, "TestBrowser/1.0")
  assert.ok(!logged.join("\n").includes("basket"), "nothing a reader wrote is logged")
})

test("route: the survey is looked up once and kept, not asked for on every posting", async () => {
  await post(GOOD)
  await post(GOOD)
  assert.equal(asked.filter((a) => a.url.startsWith(`${POSTHOG}/api/surveys/`)).length, 1)
  assert.ok(asked.find((a) => a.url.startsWith(`${POSTHOG}/api/surveys/`)).url.includes(`token=${KEY}`))
})

test("route: refusals carry the form's codes", async () => {
  assert.equal((await (await post("not json")).json()).code, "malformed")
  assert.equal((await (await post({ ...GOOD, words: "" })).json()).code, "empty")
  assert.equal((await (await post({ ...GOOD, kind: "rant" })).json()).code, "malformed")
  assert.equal(captured().length, 0)
})

test("route: a filled honeypot is a quiet success that sends nothing", async () => {
  const response = await post({ ...GOOD, website: "https://spam.example" })
  assert.equal(response.status, 200)
  assert.equal(asked.length, 0)
})

test("route: no key, or no running survey, is a 503 'not set up', never a false success", async () => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY
  const none = await post(GOOD)
  assert.equal(none.status, 503)
  assert.equal((await none.json()).code, "not-set-up")
  process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY
  surveys = [{ ...SURVEY, name: "Something else" }]
  const missing = await post(GOOD)
  assert.equal(missing.status, 503)
  assert.equal(captured().length, 0)
  assert.match(logged.join("\n"), /posthog:setup/)
})

test("route: PostHog refusing is a 502, and the log keeps its status, not the words", async () => {
  refuseCapture = 500
  const response = await post(GOOD)
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, "failed")
  assert.match(logged.join("\n"), /500/)
  assert.ok(!logged.join("\n").includes("basket"))
})

test("route: five a minute from one address, then a 429", async () => {
  const from = "10.250.0.1"
  for (let i = 0; i < 5; i++) assert.equal((await post(GOOD, from)).status, 200)
  const sixth = await post(GOOD, from)
  assert.equal(sixth.status, 429)
  assert.equal((await sixth.json()).code, "busy")
})

test("the survey is found by its name among the project's running ones, and only an `api` one", async () => {
  surveys = [{ ...SURVEY, type: "popover" }]
  assert.equal(await feedbackSurvey(KEY, POSTHOG, 1), null)
  forgetFeedbackSurvey()
  surveys = [SURVEY]
  assert.equal((await feedbackSurvey(KEY, POSTHOG, 2)).id, SURVEY.id)
})
