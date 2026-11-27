// No client component may be handed the whole Notion copy map.
//
// A "use client" component's props are serialised into every page that
// renders it, so `<CookieNotice content={content} />` in the root layout put
// every copy row into every page on the site — the homepage went
// from 98 KB to 270 KB the day Notion was connected. Narrow the map with
// `pickCopy(content, "prefix.")` before it crosses into a client component.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { sourceFiles } from "./support/sources.mjs"

const ROOT = resolve(import.meta.dirname, "..")

function resolveImport(from, spec) {
  const base = spec.startsWith("@/")
    ? join(ROOT, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null
  if (!base) return null
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    if (existsSync(base + ext)) return base + ext
  }
  return null
}

const isClient = (file) =>
  /^\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(readFileSync(file, "utf8"))

test("no client component receives the unfiltered copy map", () => {
  const offenders = []
  const files = sourceFiles(["app", "components"]).map((file) => join(ROOT, file))
  for (const file of files) {
    const src = readFileSync(file, "utf8")
    const imports = new Map()
    for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
      for (const name of m[1].split(",")) {
        const local = name.trim().split(/\s+as\s+/).pop()
        if (local) imports.set(local, m[2])
      }
    }
    for (const m of src.matchAll(/<([A-Z]\w*)\b[^<]*?\bcontent=\{content\}/g)) {
      const spec = imports.get(m[1])
      const target = spec && resolveImport(file, spec)
      if (target && isClient(target)) {
        offenders.push(`${file.slice(ROOT.length + 1)}: <${m[1]} content={content}>`)
      }
    }
  }
  assert.deepEqual(offenders, [], "pass pickCopy(content, \"prefix.\") instead")
})
