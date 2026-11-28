// The repository's own page: what a stranger reads before the code
// (docs/development.md, "The repository's own page"). Every file GitHub
// looks for is there; each names the template's address and the maker's
// public one, and no other repository; the issue forms are in the shape
// GitHub reads, since a form it can't read is dropped from the chooser
// without a word; and the README's pictures are described and drawn at
// twice the size it shows them, as the site's own are.
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

import { DEMO_URL, MAKER, REPO_URL } from "../lib/site.ts"
import { ROOT } from "./support/sources.mjs"

const sharp = createRequire(import.meta.url)("sharp")
const read = (path) => readFileSync(join(ROOT, path), "utf8")
const FORMS_DIR = ".github/ISSUE_TEMPLATE"
const FORMS = readdirSync(join(ROOT, FORMS_DIR))
  .filter((f) => /\.ya?ml$/.test(f) && f !== "config.yml")
  .map((f) => `${FORMS_DIR}/${f}`)

/** The files a person reads on the repository's page, each in the template's own words. */
const PAGE = ["CONTRIBUTING.md", "SUPPORT.md", "SECURITY.md", ".github/pull_request_template.md", ".github/FUNDING.yml", `${FORMS_DIR}/config.yml`, ...FORMS]

test("every file GitHub's community profile looks for is there", () => {
  for (const file of ["README.md", "LICENSE", "CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "SECURITY.md", "SUPPORT.md", ".github/pull_request_template.md", ".github/FUNDING.yml", `${FORMS_DIR}/config.yml`]) {
    assert.ok(existsSync(join(ROOT, file)), `${file} is missing`)
  }
  assert.ok(FORMS.length >= 2, "a bug form and an idea form")
})

test("the README sends contributors, help-seekers and reporters to their files", () => {
  const readme = read("README.md")
  for (const file of ["CONTRIBUTING.md", "SUPPORT.md", "CODE_OF_CONDUCT.md", "SECURITY.md"]) assert.ok(readme.includes(`(${file})`), `README.md does not link ${file}`)
  const badge = `[![CI](${REPO_URL}/actions/workflows/ci.yml/badge.svg)](${REPO_URL}/actions/workflows/ci.yml)`
  assert.ok(readme.includes(badge), "the README shows CI's status, from this repository's own workflow")
  assert.ok(existsSync(join(ROOT, ".github/workflows/ci.yml")))
})

test("the README opens on the live demo, and its first picture goes there", () => {
  assert.match(DEMO_URL, /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/, "the demo is a bare https origin")
  const readme = read("README.md")
  const opening = readme.split(/^## /m)[0]
  assert.ok(opening.includes(`[see it live](${DEMO_URL})`), "the opening lines link the demo")
  assert.match(opening, new RegExp(`<a href="${DEMO_URL.replace(/[.]/g, "\\.")}"><picture>`), "the first picture is a link to the demo")
})

test("the Sponsor button sends people to the maker and nowhere else", () => {
  const funding = read(".github/FUNDING.yml")
  const entries = funding.split("\n").filter((line) => line.trim() && !line.trimStart().startsWith("#"))
  assert.deepEqual(entries, [`custom: ["${MAKER.url}"]`])
})

test("the code of conduct is the Contributor Covenant 2.1, with somewhere to report", () => {
  const conduct = read("CODE_OF_CONDUCT.md")
  assert.match(conduct, /^# Contributor Covenant Code of Conduct$/m)
  assert.match(conduct, /\[Contributor Covenant\]\[homepage\], version 2\.1/)
  assert.ok(conduct.includes(`[${MAKER.email}](mailto:${MAKER.email})`), "reports go to the maker's public address")
  assert.doesNotMatch(conduct, /\[INSERT [A-Z ]+\]/, "the covenant's placeholder is filled in")
  // the covenant's own front matter is the website's, not GitHub's
  assert.doesNotMatch(conduct, /^\+\+\+/m)
})

test("the repository's page names this repository and no other", () => {
  for (const file of PAGE) {
    for (const [address] of read(file).matchAll(/https:\/\/github\.com\/[^\s)"'>\]]+/g)) {
      assert.ok(address === REPO_URL || address.startsWith(`${REPO_URL}/`) || address.startsWith(`${REPO_URL}#`), `${file} links ${address}, not ${REPO_URL}`)
    }
  }
})

test("package.json names the repository, its issues and its maker, and is never published", () => {
  const pkg = JSON.parse(read("package.json"))
  assert.deepEqual(pkg.repository, { type: "git", url: `git+${REPO_URL}.git` })
  assert.deepEqual(pkg.bugs, { url: `${REPO_URL}/issues` })
  assert.equal(pkg.homepage, `${REPO_URL}#readme`)
  assert.deepEqual(pkg.author, { name: MAKER.name, url: MAKER.url })
  assert.equal(pkg.license, "MIT")
  // a site, not a package: npm publish would put a copy's code on a public registry
  assert.equal(pkg.private, true)
})

/** An issue form's items, each as its own lines (GitHub's form schema, the
 *  part these forms use). */
function items(form) {
  const body = form.split(/^body:\n/m)[1]
  assert.ok(body, "a form has a body")
  return body.split(/^ {2}- type: /m).slice(1).map((text) => ({ type: text.split("\n")[0].trim(), text }))
}

test("the issue forms are in the shape GitHub reads", () => {
  const TYPES = new Set(["markdown", "textarea", "input", "dropdown", "checkboxes"])
  for (const file of FORMS) {
    const form = read(file)
    assert.doesNotMatch(form, /\t/, `${file}: YAML takes no tabs`)
    for (const key of ["name", "description"]) assert.match(form, new RegExp(`^${key}: \\S.*$`, "m"), `${file} has no ${key}`)
    assert.match(form, /^labels: \[("[a-z ]+"(, )?)+\]$/m, `${file} labels what it opens`)
    const ids = []
    for (const { type, text } of items(form)) {
      assert.ok(TYPES.has(type), `${file}: ${type} is not a form item`)
      assert.match(text, /^ {4}attributes:$/m, `${file}: a ${type} has attributes`)
      if (type === "markdown") {
        assert.match(text, /^ {6}value: \|$/m, `${file}: a markdown item has a value`)
        continue
      }
      const id = text.match(/^ {4}id: ([a-z][\w-]*)$/m)?.[1]
      assert.ok(id, `${file}: a ${type} has an id`)
      ids.push(id)
      assert.match(text, /^ {6}label: \S/m, `${file}: ${id} has a label`)
      if (type === "dropdown") assert.match(text, /^ {6}options:\n( {8}- \S.*\n)+/m, `${file}: ${id} has options`)
      if (type === "checkboxes") assert.match(text, /^ {6}options:\n( {8}- label: \S.*\n( {10}required: (true|false)\n)?)+/m, `${file}: ${id}'s options are labelled`)
    }
    assert.equal(new Set(ids).size, ids.length, `${file}: every id is its own`)
  }
})

test("the bug form keeps security out and private details out", () => {
  const bug = FORMS.map(read).find((form) => /^labels: \["bug"\]$/m.test(form))
  assert.ok(bug, "a form labelled bug")
  assert.ok(bug.includes(`${REPO_URL}/security/policy`), "it sends a security problem to the policy")
  assert.match(bug, /- label: Nothing private[^\n]*\n {10}required: true/, "it asks, before sending, that nothing private is in it")
})

test("the chooser sends setup questions to the guide and paid help to the maker, and leaves security to GitHub", () => {
  const config = read(`${FORMS_DIR}/config.yml`)
  assert.match(config, /^blank_issues_enabled: (true|false)$/m)
  const urls = [...config.matchAll(/^ {4}url: (\S+)$/gm)].map((m) => m[1])
  assert.deepEqual(urls, [`${REPO_URL}#set-it-up`, MAKER.url])
  assert.equal([...config.matchAll(/^ {2}- name: \S/gm)].length, urls.length, "every link has a name")
  assert.equal([...config.matchAll(/^ {4}about: \S/gm)].length, urls.length, "every link says what it is about")
  // GitHub adds its own "Report a security vulnerability" from SECURITY.md
  assert.ok(!urls.some((url) => /security/.test(url)))
  assert.match(read("SECURITY.md"), /private reporting/)
})

test("the pull request form asks for the check, a failing test, the slots, the docs and nothing private", () => {
  const form = read(".github/pull_request_template.md")
  for (const said of ["`npm run check` passes", "fails without this change", "`npm run copy`", "`npm run docs`", "Nothing private"]) {
    assert.ok(form.includes(said), `the pull request form does not ask: ${said}`)
  }
  assert.equal([...form.matchAll(/^- \[ \] /gm)].length, 6, "every item is a box to tick")
})

/** Every picture the README draws: its file, its words and the width it is shown at. */
function readmePictures() {
  const readme = read("README.md")
  const found = []
  // a <picture> is matched whole, its <img> with it: its sources are shown at the img's width
  for (const [picture] of readme.matchAll(/<picture>[\s\S]*?<\/picture>|<img [^>]*>/g)) {
    const img = picture.match(/<img [^>]*>/)[0]
    const width = Number(img.match(/ width="(\d+)"/)?.[1])
    const alt = img.match(/ alt="([^"]*)"/)?.[1]
    for (const [, src] of picture.matchAll(/ (?:src|srcset)="([^"]+)"/g)) found.push({ src, width, alt })
  }
  for (const [, alt, src] of readme.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    if (!/^https?:/.test(src)) found.push({ src, width: NaN, alt })
  }
  return found
}

test("the README's pictures are there, described, and drawn at twice the size it shows them", async () => {
  const pictures = readmePictures()
  assert.ok(pictures.length >= 3, "the site in light and dark, and the four looks")
  for (const { src, width, alt } of pictures) {
    assert.ok(existsSync(join(ROOT, src)), `README.md shows ${src}, which is not there`)
    assert.ok(alt && alt.trim().length > 20, `${src} is described in words`)
    assert.ok(width > 0, `${src} is given the width it is shown at`)
    const { width: pixels } = await sharp(join(ROOT, src)).metadata()
    assert.ok(pixels >= width * 2, `${src} is ${pixels} pixels wide, shown at ${width}: a retina screen stretches it`)
  }
})

test("the social preview is a card GitHub takes", async () => {
  const file = join(ROOT, ".github/social-preview.png")
  const { format, width, height } = await sharp(file).metadata()
  assert.equal(format, "png")
  // GitHub asks for 640 by 320 at least, under a megabyte; social sites crop to 1.91:1
  assert.ok(width >= 1200 && height >= 630, `${width}×${height}`)
  assert.ok(Math.abs(width / height - 1.91) < 0.1, `${width}×${height} is not a share card's shape`)
  assert.ok(statSync(file).size < 1024 * 1024, "under a megabyte")
})
