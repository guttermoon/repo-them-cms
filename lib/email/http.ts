/**
 * One request to an email platform: JSON both ways, a ten-second timeout,
 * never cached, and an error that says what the platform said without
 * repeating anything the reader typed.
 */
export const TIMEOUT_MS = 10_000

export async function call(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: unknown },
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const response = await fetch(url, {
    method: init.method ?? "POST",
    headers: {
      Accept: "application/json",
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
  let data: Record<string, unknown> = {}
  try {
    const text = await response.text()
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    data = {}
  }
  return { ok: response.ok, status: response.status, data }
}

/** Anything shaped like an email address, which a platform's error message
 *  may repeat back ("someone@example.com is already a list member"). */
const ADDRESS = /[^\s@<>()[\]"',;:]+@[^\s@<>()[\]"',;:]+/g

/** A platform's error, in a form safe for the server log: what it said,
 *  with any address it repeated back taken out. */
export function errorText(platform: string, status: number, data: Record<string, unknown>): string {
  const detail = [data.code, data.message, data.title, data.detail, data.error]
    .filter((v) => typeof v === "string" && v)
    .join(" ")
    .replace(ADDRESS, "[address]")
    .slice(0, 200)
  return `${platform} responded ${status}${detail ? `: ${detail}` : ""}`
}

/** "Name <address>", the form most platforms take a sender in. */
export function mailbox(email: string, name?: string): string {
  const words = name?.replace(/[<>"\\\r\n]/g, "").trim()
  if (!words) return email
  // a comma or a colon outside quotes ends an address: "Doe, Jane" is two
  return /[,;:@()[\]]/.test(words) ? `"${words}" <${email}>` : `${words} <${email}>`
}

export const failed = (error: unknown) => ({
  status: "error" as const,
  message: error instanceof Error ? error.message : "the platform could not be reached",
})
