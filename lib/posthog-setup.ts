/**
 * What the feedback loop needs in a PostHog project, made if it is missing
 * (docs/feedback.md): the "Site feedback" survey, launched, and a flag for
 * every flag the code reads (lib/flags.ts). `npm run posthog:setup` runs it,
 * and so does every build that has POSTHOG_PERSONAL_API_KEY set, so a copy
 * gets its survey by adding one key in Vercel and deploying.
 *
 * It only ever adds. A survey or flag that exists is left exactly as it is,
 * whatever the owner has done to it (reworded, stopped, rolled back), and
 * nothing is deleted. Settings that change what is recorded about readers,
 * session replay above all, are reported, never switched: that is the
 * owner's choice, and the privacy notice's.
 *
 * Pure but for the requests, which go through `fetcher`, so
 * tests/posthog-setup.test.mjs holds it against a stand-in PostHog.
 */
import { FEEDBACK_SURVEY, FEEDBACK_SURVEY_NAME } from "./feedback"
import { FLAGS } from "./flags"

export type SetupSettings = {
  /** the personal API key (phx_…), with project, survey and feature flag access */
  personalKey: string
  /** the site's public project key (phc_…), which says which project */
  projectKey: string
  /** the project's id, when the key can reach more than one organisation */
  projectId?: string
  /** PostHog's app for the project's region, e.g. https://eu.posthog.com */
  host: string
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>
type Project = { id: number; name: string; api_token: string; session_recording_opt_in?: boolean }

/** A refusal from PostHog, with what to do about it. */
export class SetupError extends Error {}

function client(settings: SetupSettings, fetcher: Fetcher) {
  return async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await fetcher(`${settings.host}${path}`, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${settings.personalKey}`, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    if (response.status === 401 || response.status === 403) {
      throw new SetupError(`PostHog refused the personal API key (${response.status}): it needs read on projects and organizations, and write on surveys and feature flags`)
    }
    if (!response.ok) throw new SetupError(`PostHog answered ${response.status} to ${init.method ?? "GET"} ${path.split("?")[0]}`)
    return (await response.json()) as T
  }
}

/** The project the site's key belongs to, found among those the personal
 *  key reaches, or the one named by its id (and checked against the key). */
async function findProject(settings: SetupSettings, call: ReturnType<typeof client>): Promise<Project> {
  if (settings.projectId) {
    const project = await call<Project>(`/api/projects/${encodeURIComponent(settings.projectId)}/`)
    if (project.api_token !== settings.projectKey) throw new SetupError(`project ${settings.projectId} is not the one NEXT_PUBLIC_POSTHOG_KEY counts into`)
    return project
  }
  const organizations = await call<{ results: { id: string }[] }>("/api/organizations/")
  for (const organization of organizations.results) {
    const projects = await call<{ results: Project[] }>(`/api/organizations/${organization.id}/projects/`)
    const found = projects.results.find((p) => p.api_token === settings.projectKey)
    if (found) return call<Project>(`/api/projects/${found.id}/`)
  }
  throw new SetupError("none of the projects this personal key reaches has NEXT_PUBLIC_POSTHOG_KEY; set POSTHOG_PROJECT_ID, or give the key access to that project")
}

/** A flag as PostHog is asked to make it: on for everyone when its fallback
 *  is on (so a yes changes nothing until somebody changes the flag), off
 *  when it is off. */
export function flagDefinition(key: string, flag: { fallback: boolean; about: string }) {
  return { key, name: flag.about, active: true, filters: { groups: [{ properties: [], rollout_percentage: flag.fallback ? 100 : 0 }] } }
}

type Survey = { id: string; name: string; type: string; archived?: boolean; start_date?: string | null; end_date?: string | null }
type Flag = { id: number; key: string; deleted?: boolean }

/** Makes what is missing, and says what it found and did, a line each. */
export async function ensurePostHog(settings: SetupSettings, fetcher: Fetcher = fetch): Promise<string[]> {
  const call = client(settings, fetcher)
  const said: string[] = []
  const project = await findProject(settings, call)
  said.push(`project "${project.name}" (#${project.id})`)
  const base = `/api/projects/${project.id}`

  // the survey: made and launched when missing, otherwise left alone
  const surveys = await call<{ results: Survey[] }>(`${base}/surveys/?limit=500`)
  const survey = surveys.results.find((s) => s.name === FEEDBACK_SURVEY_NAME && !s.archived)
  if (!survey) {
    const made = await call<Survey>(`${base}/surveys/`, {
      method: "POST",
      body: { ...FEEDBACK_SURVEY, type: "api", questions: FEEDBACK_SURVEY.questions, start_date: new Date().toISOString() },
    })
    said.push(`survey "${FEEDBACK_SURVEY_NAME}" made and launched (${made.id})`)
  } else if (survey.type !== "api") {
    said.push(`survey "${FEEDBACK_SURVEY_NAME}" is a ${survey.type} survey; the site sends to an api one, so rename it and run this again`)
  } else if (!survey.start_date) {
    said.push(`survey "${FEEDBACK_SURVEY_NAME}" is a draft: launch it in PostHog and feedback starts arriving`)
  } else if (survey.end_date) {
    said.push(`survey "${FEEDBACK_SURVEY_NAME}" is stopped, so the site answers "not set up"; resume it in PostHog to take feedback again`)
  } else {
    said.push(`survey "${FEEDBACK_SURVEY_NAME}" found, running (${survey.id})`)
  }

  // a flag for each the code reads (flagDefinition)
  for (const [key, flag] of Object.entries(FLAGS)) {
    const found = await call<{ results: Flag[] }>(`${base}/feature_flags/?search=${encodeURIComponent(key)}`)
    if (found.results.some((f) => f.key === key && !f.deleted)) {
      said.push(`flag ${key} found, left as it is`)
      continue
    }
    await call(`${base}/feature_flags/`, {
      method: "POST",
      body: flagDefinition(key, flag),
    })
    said.push(`flag ${key} made, ${flag.fallback ? "on for everyone" : "off"}`)
  }

  if (!project.session_recording_opt_in) {
    said.push("session replay is off, so feedback cannot link to what the reader saw: switch it on in PostHog (Settings, Session replay) if your privacy notice allows it")
  }
  return said
}
