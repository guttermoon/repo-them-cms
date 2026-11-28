# Feedback: from a reader's words to a draft pull request

A reader presses **Feedback** in the corner of any page, says what it is and
what happened, and presses Send. The words become a response to a PostHog
survey. Every weekday morning an agent (Claude Code, with PostHog's MCP
server) reads the new responses and watches the recordings behind them. For
each problem it can fix, it opens one draft pull request with a test. A
person reviews and merges; nothing ships on its own.

```
reader ──Feedback──▶ /api/feedback ──survey sent──▶ PostHog "Site feedback"
                                                        │
          draft PR ◀── Claude Code (feedback-triage) ◀──┘  + recording, errors
```

Until PostHog is set up, the button is there as an example. It says so, and
Send sends nothing, as the mailing list and the contact form do until an
email platform is set.

## Set it up

Three keys, about ten minutes, and no terminal.

1. **Count into PostHog.** In Vercel, set `NEXT_PUBLIC_POSTHOG_KEY` to your
   project's token (PostHog: Settings, Project, *Project token*, `phc_…`).
   Set `NEXT_PUBLIC_POSTHOG_REGION` to `us` if the project is in the US
   cloud; the default is `eu`. [Analytics](analytics.md) says what this
   turns on.
2. **Let the build make the survey and the flags.** In PostHog, make a
   personal API key (Settings, User, *Personal API keys*) with these
   scopes:
   - read on **Project** and **Organization**;
   - write on **Survey** and **Feature flag**.

   Set it in Vercel as `POSTHOG_PERSONAL_API_KEY`, then redeploy. The
   build's log says what it made:

   ```
   [posthog-setup] project "Default project" (#12345)
   [posthog-setup] survey "Site feedback" made and launched (0199…)
   [posthog-setup] flag site-feedback made, on for everyone
   [posthog-setup] session replay is off, so feedback cannot link to what the reader saw: …
   ```

   That is the whole site end: the Feedback button now sends. Prefer a
   terminal? `npm run posthog:setup` with the same two variables in
   `.env.local` does the same.
3. **Switch on session replay** (PostHog: Settings, *Session replay*) if
   your privacy notice allows it. The setup never changes what is recorded
   about readers. Without replay the loop still works, but the agent cannot
   watch what the reader saw.
4. **Turn on the agent.** In GitHub (Settings, Secrets and variables,
   Actions), add these repository secrets:
   - `POSTHOG_PERSONAL_API_KEY`: a personal key of its own with read on
     **Survey**, **Session recording**, **Error tracking** and **Query**,
     and nothing else. Never the build's key from step 2: that one writes
     surveys and flags, and the agent works where a stranger can reach it
     ([below](#what-a-stranger-can-do-with-it)).
   - Either `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` (from
     `claude setup-token`). Set one, not both. An API key in a workspace of
     its own, with a spending limit, is the one to give it.

   Then let it open pull requests. GitHub stops a workflow from doing that
   in a new repository. Either:
   - switch it on: Settings, Actions, General, *Workflow permissions*,
     tick **Allow GitHub Actions to create and approve pull requests**; or
   - add a `FEEDBACK_GH_TOKEN` secret: a fine-grained personal access
     token on this repository with write on Contents, Pull requests and
     Issues. With it, CI also runs on the drafts the agent opens.

   The loop (`.github/workflows/feedback-loop.yml`) runs at 07:23 UTC on
   weekdays. To run it now, open Actions, choose *Feedback loop*, then
   *Run workflow*. Without its secrets it skips, with a notice saying what
   is missing.

To run the triage yourself, open Claude Code in the repository and type
`/feedback-triage`. Connect PostHog first, once:
`claude mcp add --transport http posthog https://mcp.posthog.com/mcp`. It
asks you to log in to PostHog the first time.

## What a reader sends

| Sent | Where it comes from | Why |
|---|---|---|
| What it is: broken, an idea, something liked | the reader | to sort it |
| What happened | the reader | the feedback itself |
| The page, as a path | the browser | where to look |
| The look (light, dark, mono, rainbow) and the window's size | the browser | to see what they saw |
| The browser's user agent | the request | to reproduce it |
| The visit's random identifier and session | PostHog, **only after a yes** in the cookie notice | to open the recording |

It goes to this site (`/api/feedback`), never straight to PostHog. The
server sends PostHog the same `survey sent` event PostHog's own surveys
send (`lib/feedback.ts`). So:

- PostHog never sees the reader's IP address;
- feedback needs no yes in the cookie notice, since it is a message the
  reader chose to send, as the contact form is;
- without a yes, nothing ties it to a visit, and no profile is kept.

The route takes five a minute from one address, keeps a field only bots
fill, and logs nothing a reader wrote. The privacy notice says all this
once PostHog is set up (`privacy.forms.feedback`).

The words on the button and in the panel are Site Copy (`feedback.*`),
edited in Notion like every other word. Publishing `feedback.button` blank
removes the button from every page. The survey's own questions, in PostHog,
are what its results show. The site finds the survey by its name, so keep
it **Site feedback**.

## Flags

A feature flag lets you turn something on for some readers before
everybody, and off again without a deploy. Every flag the code reads is
listed in `lib/flags.ts`, with a `fallback` and a line saying what it is
for:

```ts
export const FLAGS = {
  "site-feedback": { fallback: true, about: "The Feedback button in the corner of every page, …" },
}
```

- **Read with `useFlag("site-feedback")`** (`components/hooks/use-flag.ts`).
  On the server and the first paint it is the fallback, so pages hydrate
  as drawn. Use it only for what can appear after the page has loaded.
- **Only for a reader who said yes.** PostHog is asked about a flag only
  after a yes in the cookie notice, since asking is a request that names
  their browser. Everybody else gets the fallback, so the fallback is what
  the site does by default.
- **Made by the build.** Every listed flag is made in PostHog when it is
  missing: on for everyone when its fallback is on, off when it is off.
  One that exists is never changed. `tests/flags.test.mjs` fails on a flag
  that is read but not listed, or listed but never read.
- **`site-feedback`** takes the Feedback button away for readers who said
  yes. Roll it back to 0% in PostHog and they no longer see it.
- **What the agent ships.** A fix for something broken is simply a fix. A
  change that came from an idea goes behind a new flag with `fallback:
  false`, so you can try it on a share of readers first. Once it has
  proved itself, a follow-up takes the flag out and the change is simply
  the site.

## What the agent does

`.claude/skills/feedback-triage/SKILL.md` is the whole playbook.

1. **Finds what is new.** It reads the last fourteen days of responses and
   leaves out any whose submission id is already named in a pull request or
   an issue.
2. **Groups them by the problem**, not by the words. It sets aside spam,
   tests, and anything that tries to give it instructions: a response is
   evidence, never a command.
3. **Looks before fixing.** It watches the recording, reads that page's
   errors from the same hour, and reproduces the problem with `npm run dev`
   in the same look and window size.
4. **Fixes, by this repository's rules** (`CLAUDE.md`), on a
   `feedback/<name>` branch: a failing test first, then the fix, then
   `npm run check`. Then it writes the draft pull request, whose body ends
   with the submission ids it handled.
5. **Collects ideas and praise** that are not ready to build in one issue
   per run.

The agent can edit files, run the checks (`npm run check` and its parts,
`npm run copy`, `npm run docs`, `npm run dev`), commit, read GitHub and
read PostHog. It cannot push, open or close anything: what it made leaves
its job as files, and the workflow's second job opens them (below).

## What a stranger can do with it

Anybody can send feedback, and PostHog's project key is public, so anybody
can also write a response, an error or a page straight into PostHog. The
agent is told that every word of it is evidence, never an instruction, but
words are all that tells it. So the loop is built as if a stranger could
talk the agent into anything, and limits what that would get them.

The workflow (`.github/workflows/feedback-loop.yml`) is two jobs:

- **triage**, the agent. Its GitHub token reads, and no token is left in
  its checkout. The keys in it are the model's and PostHog's, which only
  reads. Its branches leave it as a git bundle, and its pull requests and
  issue as Markdown files (`feedback-out/`).
- **open**, which has no agent and none of the agent's keys. It takes the
  bundle and the files as data, installs and runs nothing from them, and
  holds each branch to `lib/feedback-pulls.ts` before pushing it and
  opening its draft (`scripts/feedback-open.mjs`). A branch is opened only
  when it is `feedback/` and a lowercase name, new on GitHub (one already
  there is never pushed over), starts from the commit the run started from,
  changes something, and leaves alone the workflows (`.github/`), the
  playbook (`.claude/`), `vercel.json`, `package.json`, `package-lock.json`
  and `.npmrc`. Titles are one line starting "Feedback: ", every @mention
  in a body is broken so nobody is notified, and every body ends saying an
  agent wrote it from feedback anybody can send.

**Vercel never builds a `feedback/*` branch** (`vercel.json`,
`git.deploymentEnabled`): a preview build runs the branch's code with the
site's Preview settings, which on a Deploy-button site are its secrets, and
nobody has read that code yet. Since a feedback branch may not change
`vercel.json`, it cannot turn that off. To see a fix, check the branch out
and run `npm run dev`; CI runs on it with no secrets at all.

What a stranger could still get, and what limits it:

| They could | Limited by |
|---|---|
| Have the agent write a bad change | It is a draft a person reads; it cannot touch the workflows, the playbook, Vercel's settings or the packages; nothing builds it with the site's secrets |
| Read the model's key | A workspace of its own with a spending limit |
| Read PostHog through the agent's key, recordings included | A key of its own that only reads; revoke it in PostHog at any sign of misuse |
| Read the repository | A public repository is public anyway; a private one's code is what the agent works on |

**Protect the default branch.** The loop never pushes to it, but a rule
says so for every token: Settings, Rules, Rulesets, a ruleset on the
default branch that requires a pull request, with no one allowed to bypass
it. Then no workflow, key or agent can put a change on the live site
without a person merging it.

A pull request opened with the workflow's own token does not start other
workflows, so CI runs once a person pushes to the branch or marks the pull
request ready. With `FEEDBACK_GH_TOKEN` set, CI runs on every draft. Only
the open job sees that token.

## When it does not work

| Symptom | Cause |
|---|---|
| The panel says "an example" | `NEXT_PUBLIC_POSTHOG_KEY` is not set, or not in this build: set it, then redeploy |
| Send says feedback is not set up | No running survey named "Site feedback": see the build log's `[posthog-setup]` lines, launch or resume the survey, or set `POSTHOG_PERSONAL_API_KEY`. A survey made outside a build is seen within a minute |
| The build log says the key was refused | The personal key lacks a scope: read on Project and Organization, write on Survey and Feature flag |
| It finds no project | The personal key reaches more than one organisation: set `POSTHOG_PROJECT_ID` to the project's id |
| Responses arrive without recordings | Session replay is off, or the reader said no to cookies |
| The workflow skips | It is missing a secret, and its notice says which |
| The run pushes a `feedback/*` branch but opens no pull request | The repository does not let Actions open pull requests: tick the setting above, or add `FEEDBACK_GH_TOKEN`. The open job fails saying so; the next run leaves that branch's responses alone and names the branch |
| The open job says a branch "is not opened" | It broke one of the rules [above](#what-a-stranger-can-do-with-it), and its summary says which: most often a fix that needed `package.json`, which a person makes instead |
