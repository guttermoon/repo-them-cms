// The feedback loop's second job (.github/workflows/feedback-loop.yml): opens
// what the agent handed over as draft pull requests and one issue, once each
// is held to lib/feedback-pulls.ts.
//
//   node scripts/feedback-open.mjs <folder>
//
// The folder is the agent's job's artifact: `branches.bundle` (its
// `feedback/*` branches), `pulls/<name>.md` (one per branch: `# title`, then
// the body) and `issue.md` (ideas and praise). Everything in it is data: no
// file from it is run, git reads the bundle with hooks off, and the branches
// land under refs/feedback-in/ before any is pushed.
//
// It runs in a checkout of the commit the agent started from, with
// GH_TOKEN, GITHUB_SHA and GITHUB_REF_NAME (the branch the run started
// on, which the pull requests go into) set by Actions. Node's own modules
// and lib/feedback-pulls.ts only: nothing is installed for it.
import { spawnSync } from "node:child_process"
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { branchRefusal, MAX_PULLS, PULL_NAME, readHanded } from "../lib/feedback-pulls.ts"

const folder = process.argv[2]
const base = process.env.GITHUB_SHA
const into = process.env.GITHUB_REF_NAME
if (!folder || !base || !into) {
  console.error("[feedback-open] usage: GITHUB_SHA=… GITHUB_REF_NAME=… node scripts/feedback-open.mjs <folder>")
  process.exit(2)
}

/** A command, with its arguments as they are: no shell ever reads them. */
function run(command, args, { input } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 })
  return { ok: result.status === 0, out: (result.stdout ?? "").trim(), err: (result.stderr ?? "").trim() }
}
// git with no hooks and no prompt, whatever the checkout says
const git = (...args) => run("git", ["-c", "core.hooksPath=/dev/null", "-c", "credential.interactive=never", ...args])

const lines = []
let failed = false
const say = (line) => {
  console.log(line)
  lines.push(line)
}
const warn = (line) => {
  console.log(`::warning::${line}`)
  lines.push(`- ${line}`)
}
const fail = (line) => {
  console.log(`::error::${line}`)
  lines.push(`- **${line}**`)
  failed = true
}

/** GitHub's answer when a workflow's token may not open pull requests. */
const NOT_PERMITTED = /not permitted to create or approve pull requests/i
const notPermitted = () =>
  fail(
    "GitHub Actions is not permitted to create or approve pull requests in this repository: allow it (Settings, Actions, General, Workflow permissions) or add a FEEDBACK_GH_TOKEN secret (docs/feedback.md). The branch is pushed, so the next run leaves its responses alone.",
  )

// --------------------------------------------------------------- branches

const bundle = join(folder, "branches.bundle")
if (existsSync(bundle)) {
  const verified = git("bundle", "verify", bundle)
  if (!verified.ok) fail(`the agent's branches could not be read: ${verified.err.split("\n")[0]}`)
  else {
    const fetched = git("fetch", "--no-tags", bundle, "+refs/heads/feedback/*:refs/feedback-in/*")
    if (!fetched.ok) fail(`the agent's branches could not be taken in: ${fetched.err.split("\n")[0]}`)
  }
}

/** What GitHub and git say about one handed-over branch. */
function factsFor(name) {
  const ref = `refs/feedback-in/${name}`
  const remote = git("ls-remote", "--heads", "origin", `refs/heads/feedback/${name}`)
  return {
    exists: !remote.ok || remote.out !== "",
    fromBase: git("merge-base", "--is-ancestor", base, ref).ok,
    files: git("diff", "--name-only", "--no-renames", "-z", `${base}...${ref}`).out.split("\0").filter(Boolean),
  }
}

// ------------------------------------------------------------ pull requests

const pullsDir = join(folder, "pulls")
const pullFiles = existsSync(pullsDir) ? readdirSync(pullsDir).filter((f) => f.endsWith(".md")).sort() : []
if (pullFiles.length > MAX_PULLS) warn(`${pullFiles.length} pull requests were handed over; the first ${MAX_PULLS} are opened`)

say(`## Feedback loop: what was opened\n`)
for (const file of pullFiles.slice(0, MAX_PULLS)) {
  const name = file.slice(0, -".md".length)
  const branch = `feedback/${name}`
  if (!PULL_NAME.test(name)) {
    warn(`\`${file}\` is not opened: a branch is feedback/ and lowercase letters, digits and dashes`)
    continue
  }
  if (!git("rev-parse", "--verify", "--quiet", `refs/feedback-in/${name}^{commit}`).ok) {
    warn(`\`${branch}\` is not opened: the agent handed over its pull request but not the branch`)
    continue
  }
  const handed = readHanded(readFileSync(join(pullsDir, file), "utf8"))
  if ("refused" in handed) {
    warn(`\`${branch}\` is not opened: ${handed.refused}`)
    continue
  }
  const refusal = branchRefusal(factsFor(name))
  if (refusal) {
    warn(`\`${branch}\` is not opened: ${refusal}`)
    continue
  }
  const pushed = git("push", "--no-verify", "origin", `refs/feedback-in/${name}:refs/heads/${branch}`)
  if (!pushed.ok) {
    fail(`\`${branch}\` could not be pushed: ${pushed.err.split("\n").pop()}`)
    continue
  }
  const bodyFile = join(process.env.RUNNER_TEMP || folder, `pull-${name}.md`)
  writeFileSync(bodyFile, handed.body)
  const opened = run("gh", ["pr", "create", "--draft", "--base", into, "--head", branch, "--title", handed.title, "--body-file", bodyFile])
  if (opened.ok) say(`- ${opened.out} (\`${branch}\`)`)
  else if (NOT_PERMITTED.test(opened.err)) notPermitted()
  else fail(`\`${branch}\` is pushed, but its pull request was refused: ${opened.err.split("\n")[0]}`)
}
if (!pullFiles.length) say("- no pull request was handed over")

// ------------------------------------------------------------------- issue

const issueFile = join(folder, "issue.md")
if (existsSync(issueFile)) {
  const handed = readHanded(readFileSync(issueFile, "utf8"))
  if ("refused" in handed) warn(`the ideas and praise are not opened: ${handed.refused}`)
  else {
    const bodyFile = join(process.env.RUNNER_TEMP || folder, "issue-body.md")
    writeFileSync(bodyFile, handed.body)
    const opened = run("gh", ["issue", "create", "--title", handed.title, "--body-file", bodyFile])
    if (opened.ok) say(`- ${opened.out} (ideas and praise)`)
    else fail(`the ideas and praise could not be opened as an issue: ${opened.err.split("\n")[0]}`)
  }
}

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`)
process.exit(failed ? 1 : 0)
