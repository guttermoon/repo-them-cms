// What `next/cache` is in the tests (tests/resolve-ts.mjs points it here).
//
// The real functions need a Next request around them and throw without one.
// Here `unstable_cache` simply calls through (so a test sees every read),
// and revalidation is recorded rather than done, so a route's test can check
// that the right pages and tags were cleared.
export const revalidated = []

export function revalidatePath(path, type) {
  revalidated.push(type ? `path:${path}:${type}` : `path:${path}`)
}

export function revalidateTag(tag) {
  revalidated.push(`tag:${tag}`)
  // a remembered answer under the tag is let go, as Next's would be
  for (const [key, entry] of kept.answers ?? []) if (entry.tags.includes(tag)) kept.answers.delete(key)
}

/**
 * Set to a Map by a test that needs Next's cache to remember: an answer is
 * then kept under its key for good, as Next hands back an answer past its
 * time while it fetches a new one behind. Null, and nothing is remembered.
 */
export const kept = { answers: null }

export function unstable_cache(fn, keys = [], options = {}) {
  return async (...args) => {
    if (!kept.answers) return fn(...args)
    const key = JSON.stringify(keys)
    if (!kept.answers.has(key)) kept.answers.set(key, { value: await fn(...args), tags: options.tags ?? [] })
    return kept.answers.get(key).value
  }
}

export function unstable_noStore() {}
