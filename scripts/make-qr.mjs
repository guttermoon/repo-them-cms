#!/usr/bin/env node
/**
 * Draw the QR code for a short link.
 *
 *   npm run qr -- poster
 *   npm run qr -- poster --white
 *   npm run qr -- poster --url https://your-domain.example
 *   npm run qr -- --direct https://your-domain.example/ --name site
 *
 * Writes `qr/<slug>.svg` and `qr/<slug>.png` (1200px, print-safe). The SVG is
 * the one to hand a printer: it is vector, so it stays crisp at any size.
 *
 * Both versions are drawn on a transparent ground: the light squares are left
 * unpainted rather than filled, so a code drops onto coloured paper or a
 * photograph without a white box around it. `--white` swaps the ink to white
 * and writes `<slug>-white.*`, so the two can sit side by side.
 *
 * Transparent means whatever is behind it shows through, and a QR code is read
 * by contrast — so the ground has to do the work the fill used to. Put the
 * black one on something light and plain and the white one on something dark
 * and plain, and keep both off the busy middle of a picture. If you cannot
 * control what it lands on, set it on a plain panel of your own.
 *
 * The code encodes `<site>/go/<slug>` and nothing else. It never encodes the
 * real destination: that is the whole point. Where `/go/<slug>` sends people
 * is a Notion row (Kind Redirect, Title `<slug>`, the destination in Link,
 * Published ticked), so a code already printed on a poster can be repointed
 * at any time. See lib/content/redirects.ts.
 *
 * `--direct <url>` is the exception: it encodes that address exactly, with no
 * /go/ link in between, and writes `qr/<name>.*`: right for a site's own
 * homepage, the one address that will not move. A direct code cannot be
 * repointed; a /go/ one can.
 *
 * The SVG draws every run of dark modules as a FILLED rectangle. The qrcode
 * package draws them as stroked lines one unit wide, which is the same thing
 * on screen and not the same thing in a PDF: Chrome prints a small code as
 * thin stripes that will not scan. Filled squares leave a renderer nothing to
 * round off.
 *
 * This does not talk to Notion and needs no credentials: the code depends only
 * on the slug, so it can be drawn before the row exists. Make the code, print
 * it, decide where it goes afterwards — or change your mind next year.
 *
 * Error correction is set to Q (~25% recoverable). Printed codes get creased,
 * rained on and photographed at an angle, and the cost is a slightly denser
 * pattern.
 */
import "./load-env.mjs"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import QRCode from "qrcode"

const args = process.argv.slice(2)
const urlFlag = args.indexOf("--url")
// the value after --url is the site, not the slug. Guarded on urlFlag !== -1
// because otherwise `indexOf` returning -1 makes the test read `i !== 0`,
// which quietly skips the slug whenever it is the first argument — i.e. always.
const valueOf = new Set(
  ["--url", "--direct", "--name"].map((f) => args.indexOf(f)).filter((i) => i !== -1).map((i) => i + 1),
)
const slug = args.find((a, i) => !a.startsWith("--") && !valueOf.has(i))
const white = args.includes("--white")
const flag = (name) => (args.indexOf(name) !== -1 ? args[args.indexOf(name) + 1] : undefined)
const direct = flag("--direct")
const directName = flag("--name")
const site =
  (urlFlag !== -1 ? args[urlFlag + 1] : undefined) ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000"

if (direct && !/^https?:\/\/[^/\s]+/.test(direct)) {
  console.error(`--direct needs a full address, e.g. https://your-domain.example/`)
  process.exit(1)
}
if (direct && !/^[a-z0-9][a-z0-9_-]*$/.test(directName || "")) {
  console.error(`--direct needs --name <file-name> too (lowercase, digits, - and _)`)
  process.exit(1)
}
if (!slug && !direct) {
  console.error(
    "Usage: npm run qr -- <slug> [--white] [--url https://example.com]",
  )
  process.exit(1)
}
if (!direct && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
  console.error(
    `Bad slug "${slug}". Use lowercase letters, numbers and hyphens — it has to
survive being read aloud and typed by hand as well as scanned.`,
  )
  process.exit(1)
}

const target = direct || `${site.replace(/\/+$/, "")}/go/${slug}`
const outDir = join(process.cwd(), "qr")
await mkdir(outDir, { recursive: true })

// quiet zone of 4 modules is part of the spec, not decoration: without it
// scanners struggle against a busy background, which a magazine page is. That
// margin matters more in the white version, where the "background" is whatever
// the code is placed on.
const opts = {
  errorCorrectionLevel: "Q",
  margin: 4,
  // The light squares are left unpainted rather than filled, so the code sits
  // on whatever is underneath, black or white, without a box showing round
  // it — the one thing a vector file should never force on a designer.
  color: {
    dark: white ? "#ffffff" : "#000000",
    light: "#00000000",
  },
}

const base = direct ? directName : slug
const name = white ? `${base}-white` : base

/** The code as filled rectangles, one per run of dark modules (see above). */
function filledSvg(text) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: opts.errorCorrectionLevel })
  const n = modules.size
  const m = opts.margin
  const runs = []
  for (let y = 0; y < n; y++) {
    let x = 0
    while (x < n) {
      if (!modules.get(y, x)) {
        x++
        continue
      }
      let w = 0
      while (x + w < n && modules.get(y, x + w)) w++
      runs.push(`M${x + m} ${y + m}h${w}v1h-${w}z`)
      x += w
    }
  }
  const size = n + 2 * m
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="${opts.color.dark}" d="${runs.join("")}"/></svg>\n`
}
const svg = filledSvg(target)
await writeFile(join(outDir, `${name}.svg`), svg)
await QRCode.toFile(join(outDir, `${name}.png`), target, { ...opts, width: 1200 })

console.log(`${name}
  encodes  ${target}
  svg      qr/${name}.svg   (for print)
  png      qr/${name}.png   (1200px)${
    white
      ? "\n  colour   white ink, transparent ground: place on something dark and plain"
      : "\n  colour   black ink, transparent ground: place on something light and plain"
  }

${
  direct
    ? "A direct code: no Notion row needed, and it cannot be repointed."
    : `Now add a row to the Notion database:
  Kind       Redirect
  Title      ${slug}
  Link       where it should send people, e.g. https://example.com/thing
  Published  ticked

Change that Link later and every printed copy of this code follows.`
}`)
