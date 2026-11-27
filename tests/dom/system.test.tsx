// The pieces every page is made of (components/system, components/ui):
// a copy slot <T> and its plain-text twin, the links and formatting a
// Notion row carries, the structured data, the site's own select and the
// copy button.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { JsonLd } from "@/components/system/json-ld"
import { makeContext } from "@/components/notion/context"
import { RichText } from "@/components/notion/rich-text"
import { LinkedText } from "@/components/system/linked-text"
import { makeT, pickCopy, plainText, slotHidden } from "@/components/system/notion-text"
import { FROM_NOTION, notionCopy, slotText } from "@/lib/slots"
import { SelectLine } from "@/components/system/select-line"
import { CopyText } from "@/components/ui/copy"

describe("<T>, a copy slot: three states", () => {
  const show = (copy: Record<string, string>, props: { colon?: boolean } = {}) => {
    const T = makeT(copy)
    return render(
      <p>
        <T k="hero.title" {...props}>
          Built-in wording
        </T>
      </p>,
    ).container.firstElementChild as HTMLElement
  }

  test("no row, on the starter site (no Notion): the wording written into the component", () => {
    expect(show({}).textContent).toBe("Built-in wording")
  })

  test("no row, once Notion is connected: nothing, so no word reaches the site unseen in Notion", () => {
    expect(show(notionCopy({})).innerHTML).toBe("")
    expect(show(notionCopy({ "hero.titles": "a different slot" })).innerHTML, "a mistyped Title is no row").toBe("")
    // a ticked row still shows its words, and the mark is never drawn
    expect(show(notionCopy({ "hero.title": "The owner's words" })).textContent).toBe("The owner's words")
  })

  test("a Published row with text replaces it, read by its Title exactly", () => {
    expect(show({ "hero.title": "The site's own words" }).textContent).toBe("The site's own words")
    expect(show({ "hero.titles": "a different slot" }).textContent).toBe("Built-in wording")
  })

  test("a Published row left blank hides the slot", () => {
    expect(show({ "hero.title": "   " }).innerHTML).toBe("")
  })

  test("a newline is a line break", () => {
    const slot = show({ "hero.title": "One\nTwo" })
    expect(slot.querySelectorAll("br")).toHaveLength(1)
    expect(slot.textContent).toBe("OneTwo")
  })

  test("a Notion link to another site is a real link in a new tab; one to a page here stays in the tab", () => {
    const slot = show({ "hero.title": "Read [the docs](https://developers.notion.com/) or [the setup](/setup)." })
    const [outside, inside] = slot.querySelectorAll("a")
    expect(outside.getAttribute("href")).toBe("https://developers.notion.com/")
    expect(outside.getAttribute("target")).toBe("_blank")
    expect(outside.getAttribute("rel")).toMatch(/noopener/)
    expect(inside.getAttribute("href")).toBe("/setup")
    expect(inside.getAttribute("target")).toBeNull()
  })

  test("a link to anywhere but the web, mail, a phone or this site is drawn as its words", () => {
    const slot = show({ "hero.title": "Click [here](javascript:alert(1)) now" })
    expect(slot.querySelector("a")).toBeNull()
    expect(slot.textContent).toBe("Click here now")
  })

  test("`colon` sets the words up to the first colon in bold", () => {
    expect(show({ "hero.title": "Notion: the copy." }, { colon: true }).querySelector("strong")?.textContent).toBe("Notion:")
  })

  test("plainText reads a slot for an attribute, and a blank row falls back rather than leave a control unnamed", () => {
    expect(plainText({ "nav.menu": "Navigation" }, "nav.menu", "Menu")).toBe("Navigation")
    expect(plainText({ "nav.menu": "" }, "nav.menu", "Menu")).toBe("Menu")
    expect(plainText({}, "nav.menu", "Menu")).toBe("Menu")
  })

  test("plainText keeps a link in the row as its words, since an attribute cannot hold one", () => {
    // Notion makes a link of an address it recognises, unasked
    expect(plainText({ "newsletter.email.placeholder": "[you@example.com](mailto:you@example.com)" }, "newsletter.email.placeholder", "you@example.com")).toBe("you@example.com")
    expect(plainText({ "nav.menu": "Read [the docs](https://developers.notion.com/) first" }, "nav.menu", "Menu")).toBe("Read the docs first")
  })

  test("`words`: a slot that is a link's own words keeps a link in its row as words, never a link inside a link", () => {
    const T = makeT({ "faq.b": "[hello@denot.app](mailto:hello@denot.app)" })
    const { container } = render(
      <p>
        Write to{" "}
        <a href="mailto:hello@denot.app">
          <T k="faq.b" words>
            hello@denot.app
          </T>
        </a>
        .
      </p>,
    )
    const links = container.querySelectorAll("a")
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute("href")).toBe("mailto:hello@denot.app")
    expect(links[0].textContent).toBe("hello@denot.app")
    expect(container.textContent).toBe("Write to hello@denot.app.")
  })

  test("pickCopy hands a client component only the rows it reads", () => {
    const copy = { "nav.a": "1", "nav.b": "2", "footer.c": "3" }
    expect(pickCopy(copy, "nav.")).toEqual({ "nav.a": "1", "nav.b": "2" })
  })

  test("pickCopy carries the Notion mark, so a client component hides a slot with no row too", () => {
    const picked = pickCopy(notionCopy({ "nav.a": "1", "footer.c": "3" }), "nav.")
    expect(picked).toEqual({ [FROM_NOTION]: "1", "nav.a": "1" })
    const T = makeT(picked)
    expect(render(<p><T k="nav.b">Built-in</T></p>).container.textContent).toBe("")
  })

  test("the string forms follow <T>: with no row, the default on the starter site and nothing once connected; a control's name always falls back", () => {
    expect(slotText({}, "llms.fact.x", "Suggested")).toBe("Suggested")
    expect(slotText(notionCopy({}), "llms.fact.x", "Suggested")).toBe("")
    expect(slotText(notionCopy({ "llms.fact.x": "Theirs" }), "llms.fact.x", "Suggested")).toBe("Theirs")
    expect(slotHidden({}, "service.title")).toBe(false)
    expect(slotHidden(notionCopy({}), "service.title")).toBe(true)
    expect(slotHidden(notionCopy({ "service.title": "Ours" }), "service.title")).toBe(false)
    expect(slotHidden(notionCopy({ "service.title": " " }), "service.title")).toBe(true)
    // a field, a tab or a button with no name is broken, not edited
    expect(plainText(notionCopy({}), "nav.menu", "Menu")).toBe("Menu")
  })
})

describe("LinkedText: a row's own words, with its links and line breaks", () => {
  test("draws links as <T> does, and line breaks", () => {
    const { container } = render(<LinkedText text={"A quote.\nSee [the shop](/shop) and [Notion](https://www.notion.com/)."} />)
    expect(container.querySelectorAll("br")).toHaveLength(1)
    expect(screen.getByRole("link", { name: "the shop" }).getAttribute("target")).toBeNull()
    expect(screen.getByRole("link", { name: "Notion" }).getAttribute("target")).toBe("_blank")
  })

  test("an unsafe address is words, not a link", () => {
    const { container } = render(<LinkedText text="[x](data:text/html,hi) and [y](vbscript:z)" />)
    expect(container.querySelector("a")).toBeNull()
    expect(container.textContent).toBe("x and y")
  })
})

describe("Notion's formatting comes through, as Notion shows it", () => {
  // a row as lib/inline-text.ts keeps it: Notion's runs, after the mark
  const styled = (...runs: Record<string, unknown>[]) => "\uE000" + JSON.stringify(runs)
  const T = (copy: Record<string, string>) => makeT(copy)

  test("bold, italic, underline, strikethrough and code in a slot; a colour or a highlight given in Notion is left to the site", () => {
    const Slot = T({
      k: styled({ t: "Bold", b: 1 }, { t: " " }, { t: "italic", i: 1 }, { t: " " }, { t: "under", u: 1 }, { t: " " }, { t: "struck", s: 1 }, { t: " " }, { t: "code", c: 1 }, { t: " " }, { t: "red", col: "red" }, { t: " " }, { t: "marked", col: "yellow_background" }),
    })
    const { container } = render(
      <p>
        <Slot k="k">default</Slot>
      </p>,
    )
    expect(container.querySelector("strong")?.textContent).toBe("Bold")
    expect(container.querySelector("em")?.textContent).toBe("italic")
    expect(container.querySelector(".underline")?.textContent).toBe("under")
    expect(container.querySelector("s")?.textContent).toBe("struck")
    expect(container.querySelector("code")?.textContent).toBe("code")
    // web copy follows the site's design: no Notion colour, in any look
    expect(container.querySelector('[class*="n-c-"], [class*="n-bg-"]')).toBeNull()
    expect(container.textContent).toBe("Bold italic under struck code red marked")
  })

  test("formatting and a link together, and a line break inside a run", () => {
    const Slot = T({ k: styled({ t: "Shop ", b: 1 }, { t: "here", b: 1, i: 1, href: "https://shop.example/" }, { t: "\nnext line" }) })
    const { container } = render(
      <p>
        <Slot k="k">default</Slot>
      </p>,
    )
    const a = container.querySelector("a")!
    expect(a.getAttribute("href")).toBe("https://shop.example/")
    expect(a.getAttribute("target")).toBe("_blank")
    expect(a.querySelector("strong em, em strong, strong")?.textContent).toBe("here")
    expect(container.querySelectorAll("br")).toHaveLength(1)
    expect(container.textContent).toBe("Shop herenext line")
  })

  test("a link to one of this site's pages, as a path Notion kept on its app, becomes the path and stays in the tab", () => {
    const { container } = render(<LinkedText text={styled({ t: "The plans", b: 1, href: "https://app.notion.com/pricing" })} />)
    const a = container.querySelector("a")!
    expect(a.getAttribute("href")).toBe("/pricing")
    expect(a.getAttribute("target")).toBeNull()
    expect(render(<LinkedText text="[The plans](https://app.notion.com/pricing)" />).container.querySelector("a")?.getAttribute("href")).toBe("/pricing")
  })

  test("a formatted link to anywhere unsafe is drawn as its words, still formatted", () => {
    const { container } = render(<LinkedText text={styled({ t: "click", b: 1, href: "javascript:alert(1)" })} />)
    expect(container.querySelector("a")).toBeNull()
    expect(container.querySelector("strong")?.textContent).toBe("click")
  })

  test("a post's or a page's body keeps Notion's colours, as the writer gave them", () => {
    const ctx = makeContext([], () => undefined)
    const { container } = render(
      <p>
        <RichText
          runs={[
            { type: "text", plain_text: "red", text: { content: "red" }, annotations: { color: "red" } },
            { type: "text", plain_text: " marked", text: { content: " marked" }, annotations: { color: "yellow_background" } },
          ]}
          ctx={ctx}
        />
      </p>,
    )
    expect(container.querySelector(".n-c-red")?.textContent).toBe("red")
    expect(container.querySelector(".n-bg-yellow")?.textContent).toBe(" marked")
  })

  test("`words` keeps bold and italic but drops a link and a colour, inside a link the code draws", () => {
    const Slot = T({ k: styled({ t: "Get ", col: "red" }, { t: "started", b: 1, href: "https://x.example/" }) })
    const { container } = render(
      <a href="/start">
        <Slot k="k" words>
          default
        </Slot>
      </a>,
    )
    expect(container.querySelectorAll("a")).toHaveLength(1)
    expect(container.querySelector(".n-c-red")).toBeNull()
    expect(container.querySelector("strong")?.textContent).toBe("started")
  })

  test("`colon` bolds a formatted line's lead-in too", () => {
    const Slot = T({ k: styled({ t: "Brevo", i: 1 }, { t: ": sends the mail." }) })
    const { container } = render(
      <p>
        <Slot k="k" colon>
          default
        </Slot>
      </p>,
    )
    expect(container.querySelector("strong")?.textContent).toBe("Brevo:")
    expect(container.querySelector("strong em")?.textContent).toBe("Brevo")
    expect(container.textContent).toBe("Brevo: sends the mail.")
  })

  test("a damaged row prints nothing rather than its insides", () => {
    const Slot = T({ k: "\uE000[{not json" })
    const { container } = render(
      <p>
        <Slot k="k">default</Slot>
      </p>,
    )
    expect(container.textContent).toBe("")
  })

  test("plainText and the structured data read a formatted row as its words", () => {
    const copy = { k: styled({ t: "Bold", b: 1 }, { t: " [and](https://x.example/) plain" }) }
    expect(plainText(copy, "k", "default")).toBe("Bold and plain")
    const { container } = render(<JsonLd data={{ description: copy.k, url: "https://x.example/" }} />)
    expect(JSON.parse(container.querySelector("script")!.innerHTML)).toEqual({ description: "Bold and plain", url: "https://x.example/" })
  })
})

describe("JsonLd", () => {
  test("cannot be closed early by a </script> in the data, and reads back as the same data", () => {
    const { container } = render(<JsonLd data={{ name: "</script><script>alert(1)</script>" }} />)
    const script = container.querySelector('script[type="application/ld+json"]')!
    expect(script.innerHTML).not.toContain("</script>")
    expect(JSON.parse(script.innerHTML)).toEqual({ name: "</script><script>alert(1)</script>" })
  })
})

describe("SelectLine, the site's own select", () => {
  const OPTIONS = [
    { value: "setup", label: "Setting it up" },
    { value: "build", label: "A site built for me" },
    { value: "care", label: "Looking after a site" },
    { value: "question", label: "Something else" },
  ]

  function Harness({ placeholder }: { placeholder?: string }) {
    const [value, setValue] = useState("")
    return (
      <>
        <SelectLine value={value} onChange={setValue} options={OPTIONS} label="What is it about?" placeholder={placeholder} />
        <output data-testid="value">{value}</output>
        <p>elsewhere</p>
      </>
    )
  }

  test("starts on its placeholder, or on the first option without one", () => {
    render(<Harness placeholder="Choose one" />)
    expect(screen.getByRole("button", { name: /^What is it about\?/ }).textContent).toBe("Choose one")
    render(<Harness />)
    expect(screen.getAllByRole("button", { name: /^What is it about\?/ })[1].textContent).toBe("Setting it up")
  })

  test("its name is its label, then what it shows, as a native select's is (WCAG 2.5.3, label in name)", async () => {
    const user = userEvent.setup()
    render(<Harness placeholder="Choose one" />)
    expect(screen.getByRole("button", { name: "What is it about? Choose one" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: /^What is it about\?/ }))
    await user.click(screen.getByRole("option", { name: "Looking after a site" }))
    expect(screen.getByRole("button", { name: "What is it about? Looking after a site" })).toBeTruthy()
  })

  test("opens a named listbox; a click chooses and gives focus back", async () => {
    const user = userEvent.setup()
    render(<Harness placeholder="Choose one" />)
    const button = screen.getByRole("button", { name: /^What is it about\?/ })
    expect(button.getAttribute("aria-expanded")).toBe("false")
    await user.click(button)
    expect(button.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByRole("listbox", { name: "What is it about?" })).toBeTruthy()
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(OPTIONS.map((o) => o.label))
    await user.click(screen.getByRole("option", { name: "Looking after a site" }))
    expect(screen.getByTestId("value").textContent).toBe("care")
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  test("works from the keyboard: arrows, Home, End, Enter, Escape", async () => {
    const user = userEvent.setup()
    render(<Harness placeholder="Choose one" />)
    screen.getByRole("button", { name: /^What is it about\?/ }).focus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("listbox")).toBeTruthy()
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    expect(screen.getByTestId("value").textContent).toBe("care")
    await user.keyboard("{ArrowDown}{End}{Enter}")
    expect(screen.getByTestId("value").textContent).toBe("question")
    await user.keyboard("{ArrowDown}{Home}{Escape}")
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(screen.getByTestId("value").textContent).toBe("question")
  })

  test("typing a letter jumps to the next option starting with it, as a native select does", async () => {
    const user = userEvent.setup()
    render(<Harness placeholder="Choose one" />)
    screen.getByRole("button", { name: /^What is it about\?/ }).focus()
    await user.keyboard("{ArrowDown}")
    await user.keyboard("l")
    expect(document.activeElement?.textContent).toBe("Looking after a site")
    await user.keyboard("{Enter}")
    expect(screen.getByTestId("value").textContent).toBe("care")
  })

  test("the chosen option carries the tick, and only it", async () => {
    const user = userEvent.setup()
    render(<Harness placeholder="Choose one" />)
    await user.click(screen.getByRole("button", { name: /^What is it about\?/ }))
    await user.click(screen.getByRole("option", { name: "A site built for me" }))
    await user.click(screen.getByRole("button", { name: /^What is it about\?/ }))
    const ticked = screen.getAllByRole("option").filter((o) => !o.querySelector("svg")?.classList.contains("invisible"))
    expect(ticked.map((o) => o.textContent)).toEqual(["A site built for me"])
    expect(ticked[0].getAttribute("aria-selected")).toBe("true")
  })

  test("its shape is the site's: the button a field, the menu a card, each option a block", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const button = screen.getByRole("button", { name: /^What is it about\?/ })
    expect(button.classList.contains("field")).toBe(true)
    await user.click(button)
    expect(button.hasAttribute("data-open"), "an open select keeps its accent edge").toBe(true)
    expect(screen.getByRole("listbox").className).toContain("rounded-card")
    for (const option of screen.getAllByRole("option")) expect(option.className).toContain("rounded-block")
  })

  test("ArrowUp opens it too, and the pointer moves the active option as the keys do", async () => {
    const user = userEvent.setup()
    render(<Harness placeholder="Choose one" />)
    screen.getByRole("button", { name: /^What is it about\?/ }).focus()
    await user.keyboard("{ArrowUp}")
    expect(screen.getByRole("listbox")).toBeTruthy()
    await user.hover(screen.getByRole("option", { name: "Something else" }))
    expect(document.activeElement?.textContent).toBe("Something else")
    await user.keyboard("{ArrowUp}{Enter}")
    expect(screen.getByTestId("value").textContent).toBe("care")
  })

  test("it opens above when the screen has no room below, and below otherwise", async () => {
    const user = userEvent.setup()
    const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(200)
    const near = (top: number) =>
      vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockReturnValue({ top, bottom: top + 44, left: 0, right: 200, width: 200, height: 44, x: 0, y: top, toJSON: () => ({}) })
    try {
      const low = near(window.innerHeight - 60)
      render(<Harness />)
      const button = screen.getByRole("button", { name: /^What is it about\?/ })
      await user.click(button)
      expect(screen.getByRole("listbox").getAttribute("data-menu")).toBe("up")
      expect(screen.getByRole("listbox").className).toContain("bottom-full")
      await user.keyboard("{Escape}")
      low.mockRestore()
      near(40)
      await user.click(button)
      expect(screen.getByRole("listbox").getAttribute("data-menu")).toBe("down")
      expect(screen.getByRole("listbox").className).toContain("top-full")
    } finally {
      height.mockRestore()
      vi.restoreAllMocks()
    }
  })

  test("a click anywhere else closes it without choosing", async () => {
    const user = userEvent.setup()
    render(<Harness placeholder="Choose one" />)
    await user.click(screen.getByRole("button", { name: /^What is it about\?/ }))
    await user.click(screen.getByText("elsewhere"))
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(screen.getByTestId("value").textContent).toBe("")
  })
})

describe("CopyText, the copy button", () => {
  let writeText: ReturnType<typeof vi.fn>
  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // fireEvent rather than user-event: user-event puts a clipboard of its own
  // on navigator when it is set up, over the one these tests watch
  test("copies the text exactly, says so politely, then goes back to its label", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<CopyText text={"npm run dev\n"} label="Copy the command" copied="Copied" failed="Select and copy" />)
    const button = screen.getByRole("button", { name: "Copy the command" })
    expect(button.getAttribute("aria-live")).toBe("polite")
    fireEvent.click(button)
    await waitFor(() => expect(button.textContent).toBe("Copied"))
    expect(writeText).toHaveBeenCalledWith("npm run dev\n")
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(button.textContent).toBe("Copy the command")
  })

  test("a clipboard that refuses says so; the text is still on the page to select", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    render(<CopyText text="hello" label="Copy" copied="Copied" failed="Select and copy" />)
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("Select and copy"))
  })
})

describe("ExceptOn: what the layout puts on every page but one", () => {
  test("hides its children at the paths it names, and shows them everywhere else", async () => {
    vi.resetModules()
    const path = { current: "/features" }
    vi.doMock("next/navigation", () => ({ usePathname: () => path.current }))
    const { ExceptOn } = await import("@/components/system/except-on")
    const { container, rerender } = render(<ExceptOn paths={["/features"]}>counter</ExceptOn>)
    expect(container.textContent).toBe("")
    path.current = "/pricing"
    rerender(<ExceptOn paths={["/features"]}>counter</ExceptOn>)
    expect(container.textContent).toBe("counter")
    vi.doUnmock("next/navigation")
  })
})

describe("stockLabel: a product's stock, in the copy's words", () => {
  test("each of the four options reads its own slot, and an option an editor added reads as its name", async () => {
    const { stockLabel } = await import("@/components/commerce/labels")
    expect(stockLabel({}, "In stock")).toBe("In stock")
    expect(stockLabel({}, "Low stock")).toBe("Only a few left")
    expect(stockLabel({ "shop.lowstock": "Going fast" }, "low stock")).toBe("Going fast")
    expect(stockLabel({ "shop.preorder": "Coming soon" }, "Pre-order")).toBe("Coming soon")
    expect(stockLabel({}, "Back in spring")).toBe("Back in spring")
  })
})

describe("the 404 on purpose", () => {
  test("its links are named in one place, and the link check knows them", async () => {
    const { NOT_FOUND_LINKS } = await import("@/lib/nav")
    const { checkInternalLinks } = await import("./support/checks")
    const div = document.createElement("div")
    div.innerHTML = Object.values(NOT_FOUND_LINKS)
      .map((href) => `<a href="${href}" rel="nofollow">x</a>`)
      .join("")
    expect(() => checkInternalLinks(div, "sample")).not.toThrow()
    div.innerHTML = `<a href="/not-on-purpose">x</a>`
    expect(() => checkInternalLinks(div, "sample")).toThrow()
  })
})
