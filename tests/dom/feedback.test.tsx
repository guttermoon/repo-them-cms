// The Feedback button and its panel (components/layout/feedback.tsx): where
// it sits, what it asks, what it sends to /api/feedback, what it says when
// it is only an example, and that its flag can take it away.
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { Feedback } from "@/components/layout/feedback"
import { CONSENT_KEY } from "@/lib/consent"
import { checkEverything } from "./support/checks"

/** What the flag says for this test (PostHog's answer to a reader who said yes). */
const flag = vi.hoisted(() => ({ answer: undefined as boolean | undefined }))
vi.mock("@/components/layout/posthog-analytics", async (original) => {
  const real = await original<typeof import("@/components/layout/posthog-analytics")>()
  return {
    ...real,
    onPostHogFlag: (_key: string, listen: (on: boolean) => void) => {
      if (flag.answer !== undefined) listen(flag.answer)
      return () => {}
    },
  }
})

const fetchMock = vi.fn()
beforeEach(() => {
  flag.answer = undefined
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  document.documentElement.dataset.theme = "dark"
  window.history.replaceState({}, "", "/pricing")
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  window.history.replaceState({}, "", "/")
})

const answer = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Feedback" }))
  return screen.getByRole("dialog", { name: "tell us what you think" })
}

describe("the Feedback button", () => {
  test("a pill in the corner, above the page, that opens a named dialog with the site's field and shapes", async () => {
    const user = userEvent.setup()
    render(<Feedback ready />)
    const button = screen.getByRole("button", { name: "Feedback" })
    expect(button.className).toContain("fixed")
    expect(button.className).toContain("rounded-full")
    const dialog = await open(user)
    // what it is: three choices, the first chosen
    const kinds = screen.getAllByRole("radio")
    expect(kinds.map((k) => k.closest("label")?.textContent)).toEqual(["Something is broken", "An idea", "Something I liked"])
    expect((kinds[0] as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole("group", { name: "What is it?" })).toBeTruthy()
    checkEverything(dialog, "feedback panel")
  })

  test("sends the kind, the words, the page, the look and the window's size, and says thank you only when the route says sent", async () => {
    const user = userEvent.setup()
    fetchMock.mockReturnValueOnce(answer(200, { status: "sent" }))
    render(<Feedback ready />)
    await open(user)
    await user.click(screen.getByRole("radio", { name: "An idea" }))
    await user.type(screen.getByLabelText("What happened?"), "A darker dark look")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Thank you/))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/feedback")
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({ kind: "idea", words: "A darker dark look", page: "/pricing", look: "dark", website: "" })
    expect(body.viewport).toMatch(/^\d+x\d+$/)
    // no yes in the cookie notice: no visit to point at
    expect(body.visit).toBeNull()
  })

  test("too few words are refused before sending; a refusal from the route is said in the site's words", async () => {
    const user = userEvent.setup()
    render(<Feedback ready content={{ "feedback.busy": "Slow down a little." }} />)
    await open(user)
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(screen.getByRole("alert").textContent).toBe("Write a few words first.")
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockReturnValueOnce(answer(429, { code: "busy" }))
    await user.type(screen.getByLabelText("What happened?"), "The cart is empty")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Slow down a little."))
    expect(screen.getByLabelText("What happened?").getAttribute("aria-invalid")).toBe("true")
  })

  test("as an example (no PostHog yet) it says so, and Send sends nothing but a dialog that says what it is", async () => {
    const user = userEvent.setup()
    render(<Feedback ready={false} />)
    await open(user)
    expect(screen.getByText(/An example: this site is not collecting feedback yet/)).toBeTruthy()
    await user.type(screen.getByLabelText("What happened?"), "Hello there")
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "Just a placeholder" })).toBeTruthy()
  })

  test("Escape closes it and gives focus back to the button", async () => {
    const user = userEvent.setup()
    render(<Feedback ready />)
    await open(user)
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Feedback" }))
  })

  test("its flag can take it away; without an answer from PostHog it stays", async () => {
    window.localStorage.setItem(CONSENT_KEY, "accepted")
    flag.answer = false
    const { unmount } = render(<Feedback ready />)
    expect(screen.queryByRole("button", { name: "Feedback" })).toBeNull()
    unmount()
    flag.answer = undefined
    render(<Feedback ready />)
    expect(screen.getByRole("button", { name: "Feedback" })).toBeTruthy()
  })

  test("its words are Site Copy", async () => {
    const user = userEvent.setup()
    render(<Feedback ready content={{ "feedback.button": "Tell us", "feedback.title": "say it", "feedback.kind.idea": "A thought" }} />)
    await user.click(screen.getByRole("button", { name: "Tell us" }))
    expect(screen.getByRole("dialog", { name: "say it" })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "A thought" })).toBeTruthy()
    await act(async () => {})
  })
})
