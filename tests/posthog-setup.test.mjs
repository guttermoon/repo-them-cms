// The PostHog setup (lib/posthog-setup.ts) against a stand-in PostHog: it
// finds the site's project by its key, makes the survey and the flags when
// they are missing, and changes nothing that is already there.
import { beforeEach, test } from "node:test"
import assert from "node:assert/strict"

import { ensurePostHog, flagDefinition, SetupError } from "../lib/posthog-setup.ts"
import { FEEDBACK_SURVEY_NAME } from "../lib/feedback.ts"
import { FLAGS } from "../lib/flags.ts"

const HOST = "https://app.posthog.test"
const SETTINGS = { personalKey: "phx_test1234", projectKey: "phc_site1234", host: HOST }

/** A PostHog with two organisations, the site's project in the second. */
let state
let asked
beforeEach(() => {
  asked = []
  state = {
    projects: { 1: { id: 1, name: "Other", api_token: "phc_other123" }, 7: { id: 7, name: "Site", api_token: "phc_site1234", session_recording_opt_in: false } },
    surveys: [],
    flags: [],
    refuse: null,
  }
})

async function posthog(url, init = {}) {
  const { pathname, searchParams } = new URL(url)
  const method = init.method ?? "GET"
  const body = init.body ? JSON.parse(init.body) : undefined
  asked.push({ method, pathname, body, auth: init.headers?.authorization })
  if (state.refuse) return new Response("", { status: state.refuse })
  const json = (value) => Response.json(value)
  if (pathname === "/api/organizations/") return json({ results: [{ id: "org-a" }, { id: "org-b" }] })
  if (pathname === "/api/organizations/org-a/projects/") return json({ results: [state.projects[1]] })
  if (pathname === "/api/organizations/org-b/projects/") return json({ results: [state.projects[7]] })
  const project = /^\/api\/projects\/(\d+)\/$/.exec(pathname)
  if (project) return state.projects[project[1]] ? json(state.projects[project[1]]) : new Response("", { status: 404 })
  if (pathname === "/api/projects/7/surveys/" && method === "GET") return json({ results: state.surveys })
  if (pathname === "/api/projects/7/surveys/" && method === "POST") {
    const made = { id: `s-${state.surveys.length + 1}`, ...body }
    state.surveys.push(made)
    return json(made)
  }
  if (pathname === "/api/projects/7/feature_flags/" && method === "GET") return json({ results: state.flags.filter((f) => f.key.includes(searchParams.get("search") ?? "")) })
  if (pathname === "/api/projects/7/feature_flags/" && method === "POST") {
    state.flags.push({ id: state.flags.length + 1, ...body })
    return json(state.flags.at(-1))
  }
  throw new Error(`unexpected ${method} ${pathname}`)
}

const writes = () => asked.filter((a) => a.method !== "GET")

test("finds the site's project by its key, across organisations, with the personal key", async () => {
  const said = await ensurePostHog(SETTINGS, posthog)
  assert.match(said[0], /"Site" \(#7\)/)
  assert.ok(asked.every((a) => a.auth === "Bearer phx_test1234"))
})

test("makes the survey, launched, with the questions the site sends to", async () => {
  await ensurePostHog(SETTINGS, posthog)
  const [survey] = state.surveys
  assert.equal(survey.name, FEEDBACK_SURVEY_NAME)
  assert.equal(survey.type, "api")
  assert.ok(survey.start_date, "launched, so the site's lookup of running surveys finds it")
  assert.deepEqual(
    survey.questions.map((q) => q.type),
    ["single_choice", "open"],
  )
})

test("makes a flag for every flag the code reads, on for everyone when its fallback is on", async () => {
  await ensurePostHog(SETTINGS, posthog)
  assert.deepEqual(state.flags.map((f) => f.key).sort(), Object.keys(FLAGS).sort())
  for (const flag of state.flags) {
    assert.equal(flag.active, true)
    assert.equal(flag.filters.groups[0].rollout_percentage, FLAGS[flag.key].fallback ? 100 : 0)
  }
})

test("a flag whose fallback is off is made off, so a change behind it reaches nobody until it is turned on", () => {
  assert.equal(flagDefinition("new-look", { fallback: false, about: "A trial of something new" }).filters.groups[0].rollout_percentage, 0)
  assert.equal(flagDefinition("old-thing", { fallback: true, about: "Something already shipped" }).filters.groups[0].rollout_percentage, 100)
})

test("a second run changes nothing: what exists is left as the owner has it", async () => {
  await ensurePostHog(SETTINGS, posthog)
  state.flags[0].filters.groups[0].rollout_percentage = 10
  asked = []
  const said = await ensurePostHog(SETTINGS, posthog)
  assert.deepEqual(writes(), [])
  assert.equal(state.flags[0].filters.groups[0].rollout_percentage, 10)
  assert.ok(said.some((line) => /found, running/.test(line)))
})

test("a stopped or draft survey is reported, never restarted", async () => {
  state.surveys = [{ id: "s-old", name: FEEDBACK_SURVEY_NAME, type: "api", start_date: "2026-01-01", end_date: "2026-02-01" }]
  const stopped = await ensurePostHog(SETTINGS, posthog)
  assert.ok(stopped.some((line) => /stopped/.test(line)))
  state.surveys = [{ id: "s-draft", name: FEEDBACK_SURVEY_NAME, type: "api", start_date: null }]
  const draft = await ensurePostHog(SETTINGS, posthog)
  assert.ok(draft.some((line) => /draft/.test(line)))
  assert.equal(writes().filter((w) => w.pathname.includes("surveys")).length, 0)
})

test("session replay off is reported, and left off", async () => {
  const said = await ensurePostHog(SETTINGS, posthog)
  assert.ok(said.some((line) => /session replay is off/.test(line)))
  assert.ok(!writes().some((w) => /\/api\/projects\/7\/$/.test(w.pathname)), "the project's settings are never changed")
})

test("a project id that is another project, a key that reaches none, and a refused key each say so", async () => {
  await assert.rejects(ensurePostHog({ ...SETTINGS, projectId: "1" }, posthog), SetupError)
  await assert.rejects(ensurePostHog({ ...SETTINGS, projectKey: "phc_nowhere1" }, posthog), /POSTHOG_PROJECT_ID/)
  state.refuse = 403
  await assert.rejects(ensurePostHog(SETTINGS, posthog), /personal API key/)
})
