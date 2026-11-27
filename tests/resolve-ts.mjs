// A resolve hook for `npm test`, registered by tests/register-ts.mjs.
//
// Node 22 strips the types from a .ts file it is asked to load, but resolves
// its imports the way Node does, not the way Next and TypeScript do: an
// import written `./rows` (no extension) or `@/lib/site` (the tsconfig
// alias) is not found. With this hook, `./rows` finds `./rows.ts`, `./dir`
// finds `./dir/index.ts`, and `@/` is the project root.
//
// Next's own entry points are resolved as Next resolves them: `next/server`
// to its file (Next has no exports map, so Node will not find it bare),
// and `next/cache` to tests/support/next-cache.mjs, a stand-in that records
// revalidation instead of needing a running server. `react` gains the
// `cache` Next's copy of React has (tests/support/react.mjs). That is what
// lets the route handlers be called as Next calls them
// (tests/routes.test.mjs, tests/small-routes.test.mjs).
//
// `server-only` resolves to an empty module. The real package throws when it
// is imported outside a React Server Component, which is its job inside Next
// and would stop a server module being tested at all.
//
// It changes nothing for a specifier Node can already resolve, and nothing
// outside the tests and the build scripts: Next never sees this file.
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROOT = new URL("../", import.meta.url)
const HAS_EXTENSION = /\.(?:[cm]?[jt]sx?|json)$/
const TRY = [".ts", "/index.ts"]

const EMPTY_MODULE = "data:text/javascript,export%20%7B%7D"
const NEXT_CACHE = new URL("./support/next-cache.mjs", import.meta.url).href
const REACT = new URL("./support/react.mjs", import.meta.url).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: EMPTY_MODULE, shortCircuit: true }
  if (specifier === "next/cache") return { url: NEXT_CACHE, shortCircuit: true }
  if (specifier === "next/server") return nextResolve("next/server.js", context)
  if (specifier === "react" && context.parentURL !== REACT) return { url: REACT, shortCircuit: true }

  let spec = specifier
  if (spec.startsWith("@/")) spec = new URL(spec.slice(2), ROOT).href

  const local = spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("file:")
  if (local && !HAS_EXTENSION.test(spec) && context.parentURL) {
    const base = new URL(spec, context.parentURL).href
    for (const ending of TRY) {
      const candidate = base + ending
      if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate, context)
    }
  }
  return nextResolve(spec, context)
}

// A JSON file imported the way TypeScript and Next import one (no
// `with { type: "json" }`), as lib/content/store.ts imports the build
// snapshot. Node insists on the attribute; Next's bundler never asks for it.
export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith(".json") && context.importAttributes?.type !== "json") {
    return nextLoad(url, { ...context, importAttributes: { ...context.importAttributes, type: "json" } })
  }
  return nextLoad(url, context)
}
