/**
 * A concurrency limiter: at most `max` calls in flight, the rest queued in
 * order. Notion allows roughly three requests a second across a whole
 * integration and answers 429 past that, so every call the site makes goes
 * through one of these (lib/notion/client.ts); the client then retries a
 * 429 after the delay Notion asks for.
 *
 * Imports nothing, so `npm test` loads it (tests/notion-blocks.test.mjs).
 */
export function limiter(max: number) {
  let active = 0
  const queue: (() => void)[] = []

  const next = () => {
    if (active >= max) return
    const start = queue.shift()
    if (start) {
      active++
      start()
    }
  }

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        // through a promise, so a call that throws before it returns one
        // still gives its place back
        Promise.resolve()
          .then(fn)
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      })
      next()
    })
  }
}
