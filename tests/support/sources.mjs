// The repository's own code, for the tests that read it (every word a slot,
// the icons, the type scale, the shapes, the motion, the third parties and
// the rest): every file under some folders, in the order the folders are
// named and the disk lists them.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

/** The repository's root, with a trailing slash. Worked out from this
 *  file's own path, not a URL: under jsdom, URL is jsdom's. */
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..") + sep

/** Every file under `dirs` (from the root) whose name matches `pattern`,
 *  as its path from the root ("components/ui/icon.tsx"). */
export function sourceFiles(dirs, pattern = /\.tsx?$/) {
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const path = join(dir, entry)
      if (statSync(join(ROOT, path)).isDirectory()) walk(path)
      else if (pattern.test(entry)) out.push(path)
    }
  }
  for (const dir of [dirs].flat()) walk(dir)
  return out
}

/** The same files, each with its text. */
export const sources = (dirs, pattern) => sourceFiles(dirs, pattern).map((path) => ({ path, text: readFileSync(join(ROOT, path), "utf8") }))
