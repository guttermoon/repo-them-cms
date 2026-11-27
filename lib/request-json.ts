/**
 * A request's JSON body as an object, or null when it is not one.
 *
 * Every route handler here reads fields off what it is posted, and
 * `await request.json()` returns `null`, a number or an array just as happily
 * as an object, for a body that is valid JSON and not a form. Reading `.email`
 * off `null` throws, and a route would answer 500 to what is only a malformed
 * request. Each route answers null with its own 400.
 *
 * No imports; every route's use of it is tested in tests/routes.test.mjs.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json()
    return body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * One field of a posted form as text: trimmed, cut to `max` characters, and
 * "" for anything that is not a string (a number, an array, a missing
 * field), so a route never reads `.trim` off what a caller chose to send.
 */
export function textField(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}
