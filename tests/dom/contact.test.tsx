// The contact form (components/sections/contact-form.tsx): what it asks
// for, what it refuses before sending, what a link can choose for the
// reader, and that it says a message was sent only when the route says so.
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { ContactForm } from "@/components/sections/contact-form"
import { NOT_AN_EMAIL } from "@/lib/email/address"
import { NO_ENQUIRY_TYPE } from "@/lib/enquiry-types"
import { checkEverything } from "./support/checks"

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState({}, "", "/")
})

const answer = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }))

async function fill(user: ReturnType<typeof userEvent.setup>, { type = "A question", email = "ada@example.com" } = {}) {
  await user.type(screen.getByLabelText("Your name"), "Ada")
  await user.type(screen.getByLabelText("Email address"), email)
  if (type) {
    await user.click(screen.getByRole("button", { name: /^What is it about\? \(required\)/ }))
    await user.click(screen.getByRole("option", { name: type }))
  }
  await user.type(screen.getByLabelText("Message"), "Hello there.")
}

describe("the contact form", () => {
  test("holds to the site-wide rules, every field named", () => {
    const { container } = render(<ContactForm />)
    checkEverything(container, "contact form")
  })

  test("an address that is not one is caught before anything is sent", async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await fill(user, { email: "ada@example" })
    await user.click(screen.getByRole("button", { name: "Send it" }))
    expect(screen.getByRole("alert").textContent).toBe(NOT_AN_EMAIL)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("so is a message with nothing chosen for what it is about", async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await fill(user, { type: "" })
    await user.click(screen.getByRole("button", { name: "Send it" }))
    expect(screen.getByRole("alert").textContent).toBe(NO_ENQUIRY_TYPE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("sends every field and the empty trap, and says it was sent only when the route agrees", async () => {
    fetchMock.mockReturnValue(answer(200, { success: true }))
    const user = userEvent.setup()
    render(<ContactForm />)
    await fill(user)
    await user.click(screen.getByRole("button", { name: "Send it" }))
    expect((await screen.findByRole("status")).textContent).toBe("Sent. A person will read it.")
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/contact")
    expect(JSON.parse(init.body)).toEqual({ name: "Ada", email: "ada@example.com", company: "", subject: "", message: "Hello there.", type: "question", website: "" })
  })

  test("a refusal is said in the page's own words for its reason, never the route's English", async () => {
    fetchMock
      .mockReturnValueOnce(answer(503, { error: "Messages cannot be sent from this site yet.", code: "not-set-up" }))
      .mockReturnValueOnce(answer(429, { error: "Too many requests.", code: "busy" }))
      .mockReturnValueOnce(answer(500, { error: "Something odd." }))
      .mockRejectedValueOnce(new TypeError("offline"))
    const user = userEvent.setup()
    render(<ContactForm content={{ "contact.form.failed": "Could not send. Try again.", "contact.form.notsetup": "Not yet, sorry." }} />)
    await fill(user)
    const send = () => user.click(screen.getByRole("button", { name: "Send it" }))
    await send()
    expect((await screen.findByRole("alert")).textContent).toBe("Not yet, sorry.")
    await send()
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Too many messages from here at once. Try again in a minute."))
    // a reason the form has no words for, and a dropped connection: its own words
    await send()
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not send. Try again."))
    await send()
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Could not send. Try again."))
  })

  test("a link chooses what it is about, and a product's link fills in the subject", async () => {
    window.history.replaceState({}, "", "/contact?type=order&about=corn-flakes")
    render(<ContactForm />)
    await waitFor(() => expect(screen.getByRole("button", { name: /^What is it about\? \(required\)/ }).textContent).toBe("An order"))
    expect((screen.getByLabelText("Subject (optional)") as HTMLInputElement).value).toBe("About /shop/corn-flakes")
  })

  test("a link that is not one of the choices, or not a product's address, changes nothing", async () => {
    window.history.replaceState({}, "", "/contact?type=everything&about=%3Cscript%3E")
    render(<ContactForm />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByRole("button", { name: /^What is it about\? \(required\)/ }).textContent).toBe("Choose one")
    expect((screen.getByLabelText("Subject (optional)") as HTMLInputElement).value).toBe("")
  })

  test("the trap field is out of reach of people", () => {
    const { container } = render(<ContactForm />)
    const trap = container.querySelector('input[autocomplete="off"]')!
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(trap.getAttribute("tabindex")).toBe("-1")
  })
})

describe("the contact form before the site can send email", () => {
  test("says it is an example, sends nothing, and the dialog says so and where to write", async () => {
    const user = userEvent.setup()
    render(<ContactForm ready={false} />)
    expect(screen.getByText(/An example form: it sends nothing/)).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Send it" }))
    const dialog = await screen.findByRole("dialog", { name: "Just a placeholder" })
    expect(dialog.textContent).toContain("nothing was sent, and nothing was kept")
    expect(dialog.querySelector('a[href="mailto:hello@denot.app"]')).not.toBeNull()
    expect(fetchMock, "the message went nowhere").not.toHaveBeenCalled()
  })
})
