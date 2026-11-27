// A page written in Notion as Markdown (lib/notion/markdown.ts): what the
// page says, block by block, with its links going where the page's go, every
// address whole, and nothing in it that Markdown would misread.
import { test } from "node:test"
import assert from "node:assert/strict"

import { STARTER_DATA, starterChildren } from "../lib/demo/starter.ts"
import { fetchBlockTree } from "../lib/notion/blocks.ts"
import { blocksMarkdown, markdownDocument, runsMarkdown } from "../lib/notion/markdown.ts"

const LABELS = {
  video: "{provider} video",
  downloadVideo: "Download the video",
  downloadAudio: "Download the audio",
  pdf: "PDF",
  file: "File",
}
const LIVE = "11111111222243338444555555555555"
const ctx = {
  absolute: (href) => (href.startsWith("/") ? `https://site.example${href}` : href),
  pageUrl: (id) => (id === LIVE ? "/guides/setup" : undefined),
  media: (ref, name) => `/media/signed-${ref.id}/${name}`,
  labels: LABELS,
}

let n = 0
const run = (text, annotations = {}, link) => ({ type: "text", plain_text: text, text: { content: text, ...(link ? { link: { url: link } } : {}) }, annotations, ...(link ? { href: link } : {}) })
const b = (type, payload = {}, children) => ({ id: `block-${++n}`, type, [type]: payload, ...(children ? { children } : {}) })
const para = (...runs) => b("paragraph", { rich_text: runs })
const md = (...blocks) => blocksMarkdown(blocks, ctx)

test("Notion's formatting as Markdown marks it, the spaces outside the marks, and runs of one style joined", () => {
  assert.equal(
    runsMarkdown([run("Plain, "), run("bold", { bold: true }), run(" and "), run("ital", { italic: true }), run("ic", { italic: true }), run(", "), run("gone", { strikethrough: true }), run(", "), run("x = 1", { code: true }), run(".")], ctx),
    "Plain, **bold** and *italic*, ~~gone~~, `x = 1`.",
  )
  assert.equal(runsMarkdown([run("bold ", { bold: true }), run("then not")], ctx), "**bold** then not", "a space inside a mark would break it")
  assert.equal(runsMarkdown([run("both", { bold: true, italic: true })], ctx), "***both***")
  assert.equal(runsMarkdown([run("under", { underline: true, color: "red" })], ctx), "under", "underline and colour have no Markdown")
  // a backtick at the end: a space each side, which Markdown takes off again
  assert.equal(runsMarkdown([run("a `tick`", { code: true })], ctx), "`` a `tick` ``")
  assert.equal(runsMarkdown([{ type: "equation", plain_text: "E", equation: { expression: "E = mc^2" } }], ctx), "$E = mc^2$")
})

test("inline code with backticks in it is fenced with more of them", () => {
  assert.equal(runsMarkdown([run("a `b` c", { code: true })], ctx), "``a `b` c``")
  assert.equal(runsMarkdown([run("`start", { code: true })], ctx), "`` `start ``")
})

test("words that Markdown would read as markup are escaped, wherever they stand", () => {
  assert.equal(runsMarkdown([run("2 * 3 = 6, snake_case, [not a link], <b>")], ctx), "2 \\* 3 = 6, snake\\_case, \\[not a link\\], \\<b>")
  assert.equal(md(para(run("# not a heading"))), "\\# not a heading")
  assert.equal(md(para(run("1. not a list"))), "1\\. not a list")
  assert.equal(md(para(run("- not a list either"))), "\\- not a list either")
  assert.equal(md(para(run("> not a quote"))), "\\> not a quote")
  assert.equal(md(para(run("first line\n2. second line"))), "first line\\\n2\\. second line", "a line break is a hard break, and each line is escaped")
})

test("links go where the page's links go: a live Notion page to its address here, a private one nowhere, anything unsafe nowhere", () => {
  assert.equal(runsMarkdown([run("the guide", {}, `https://www.notion.so/Setup-${LIVE}`)], ctx), "[the guide](https://site.example/guides/setup)")
  assert.equal(runsMarkdown([run("private", {}, "https://www.notion.so/Draft-99999999999999999999999999999999")], ctx), "private")
  assert.equal(runsMarkdown([run("run me", {}, "javascript:alert(1)")], ctx), "run me")
  assert.equal(runsMarkdown([run("pricing", {}, "https://app.notion.com/pricing")], ctx), "[pricing](https://site.example/pricing)", "a path Notion kept on its app is this site's")
  assert.equal(runsMarkdown([run("bold link", { bold: true }, "https://example.com/a b")], ctx), "[**bold link**](<https://example.com/a b>)")
  const mention = { type: "mention", plain_text: "Setup", mention: { type: "page", page: { id: "11111111-2222-4333-8444-555555555555" } } }
  assert.equal(runsMarkdown([mention], ctx), "[Setup](https://site.example/guides/setup)")
  assert.equal(runsMarkdown([{ ...mention, mention: { type: "page", page: { id: "nope" } } }], ctx), "Setup")
  assert.equal(runsMarkdown([{ type: "mention", plain_text: "4 November 2026", mention: { type: "date", date: { start: "2026-11-04" } } }], ctx), "4 November 2026")
})

test("headings keep the page's outline: Heading 1 under the title's #, and no level skipped", () => {
  const h = (type, text, extra = {}, children) => b(type, { rich_text: [run(text)], ...extra }, children)
  assert.equal(md(h("heading_2", "Starts at two"), h("heading_3", "Then three"), h("heading_1", "One")), "## Starts at two\n\n### Then three\n\n## One")
  assert.equal(md(h("heading_1", "Folds", { is_toggleable: true }, [para(run("Inside."))])), "## Folds\n\nInside.")
})

test("lists: bullets, numbers from where Notion starts them, to-dos, and what is nested in an item lined up under it", () => {
  const item = (type, text, extra = {}, children) => b(type, { rich_text: [run(text)], ...extra }, children)
  assert.equal(md(item("bulleted_list_item", "One", {}, [item("bulleted_list_item", "Under")]), item("bulleted_list_item", "Two")), "- One\n  - Under\n- Two")
  assert.equal(md(item("numbered_list_item", "Three", { list_start_index: 3 }), item("numbered_list_item", "Four", {}, [para(run("More about four."))])), "3. Three\n4. Four\n\n   More about four.")
  assert.equal(md(item("to_do", "Done", { checked: true }), item("to_do", "Not yet", { checked: false })), "- [x] Done\n- [ ] Not yet")
  assert.equal(md(item("bulleted_list_item", "A"), item("numbered_list_item", "B")), "- A\n\n1. B", "two kinds of list are two lists")
})

test("quotes and callouts as quotations, a writer's emoji kept and an icon left out", () => {
  assert.equal(md(b("quote", { rich_text: [run("Said once.\nSaid twice.")] })), "> Said once.\\\n> Said twice.")
  assert.equal(md(b("callout", { rich_text: [run("Mind the step.")], icon: { type: "emoji", emoji: "⚠️" } }, [para(run("Really."))])), "> ⚠️ Mind the step.\n>\n> Really.")
  assert.equal(md(b("callout", { rich_text: [run("Plain.")], icon: { type: "icon", icon: { name: "lightbulb" } } })), "> Plain.")
})

test("code is fenced longer than any fence inside it, with its language", () => {
  assert.equal(md(b("code", { rich_text: [run("npm run dev")], language: "bash" })), "```bash\nnpm run dev\n```")
  assert.equal(md(b("code", { rich_text: [run("```\nnested\n```")], language: "markdown" })), "````markdown\n```\nnested\n```\n````")
  assert.equal(md(b("code", { rich_text: [run("text")], language: "plain text", caption: [run("A caption.")] })), "```\ntext\n```\n\nA caption.")
  assert.equal(md(b("equation", { expression: "a^2 + b^2" })), "$$\na^2 + b^2\n$$")
})

test("pictures and files from this site's /media/, whole addresses, their captions as their words", () => {
  const media = { owner: "block", id: "pic", field: "block", v: "1" }
  assert.equal(md(b("image", { media, caption: [run("A [shelf]")] })), "![A \\[shelf\\]](https://site.example/media/signed-pic/image)")
  assert.equal(md(b("pdf", { media, name: "Price list.pdf" })), "[Price list.pdf](https://site.example/media/signed-pic/document.pdf)")
  assert.equal(md(b("file", { media, name: null, caption: [] })), "[File](https://site.example/media/signed-pic/file)")
  assert.equal(md(b("audio", { media })), "[Download the audio](https://site.example/media/signed-pic/audio)")
  assert.equal(md(b("video", { media, source: "file" })), "[Download the video](https://site.example/media/signed-pic/video)")
  assert.equal(md(b("image", {})), "", "no file, no picture")
})

test("a video from YouTube or Vimeo is a link to watch it there; a bookmark a link with its caption or host", () => {
  assert.equal(md(b("video", { source: "external", external: "https://youtu.be/aqz-KE-bpKQ" })), "[YouTube video](https://www.youtube.com/watch?v=aqz-KE-bpKQ)")
  assert.equal(md(b("embed", { url: "https://vimeo.com/76979871", caption: [run("The film")] })), "[The film](https://vimeo.com/76979871)")
  assert.equal(md(b("bookmark", { url: "https://www.example.com/a" })), "[example.com](https://www.example.com/a)")
  assert.equal(md(b("bookmark", { url: "javascript:alert(1)" })), "", "an unsafe address is no link")
  assert.equal(md(b("link_to_page", { type: "page_id", page_id: LIVE })), "<https://site.example/guides/setup>")
  assert.equal(md(b("link_to_page", { type: "page_id", page_id: "99999999999999999999999999999999" })), "", "a page that is not live here is not linked")
})

test("tables as GitHub's, a header row given when Notion's has none, and a bar in a cell escaped", () => {
  const row = (...cells) => b("table_row", { cells: cells.map((c) => [run(c)]) })
  assert.equal(md(b("table", { has_column_header: true }, [row("Kind", "Where"), row("Page", "/a|b")])), "| Kind | Where |\n| --- | --- |\n| Page | /a\\|b |")
  assert.equal(md(b("table", { has_column_header: false }, [row("a", "b")])), "|   |   |\n| --- | --- |\n| a | b |")
})

test("what holds blocks gives up its blocks; what the page leaves out, this leaves out", () => {
  const column = (...blocks) => b("column", {}, blocks)
  assert.equal(md(b("column_list", {}, [column(para(run("Left."))), column(para(run("Right.")))])), "Left.\n\nRight.")
  assert.equal(md(b("synced_block", {}, [para(run("Synced."))])), "Synced.")
  assert.equal(md(b("toggle", { rich_text: [run("Ask")] }, [para(run("Answer."))])), "Ask\n\nAnswer.")
  assert.equal(md(b("divider")), "---")
  assert.equal(md(b("child_page", { title: "Notes" })), "Notes")
  assert.equal(md(b("table_of_contents"), b("child_database", { title: "Private" }), b("breadcrumb"), para()), "", "nothing half-drawn, and no empty paragraph")
})

test("a document: its facts as front matter YAML can read, one # title, then its body", () => {
  const doc = markdownDocument({ title: 'A "quoted" title', url: "https://site.example/blog/a", price: 4.5, tags: ["News", "Guides"], empty: "", none: [] }, "A *title*", "Body.")
  assert.equal(doc, ['---', 'title: "A \\"quoted\\" title"', 'url: "https://site.example/blog/a"', "price: 4.5", 'tags: ["News","Guides"]', "---", "", "# A \\*title\\*", "", "Body.", ""].join("\n"))
  assert.equal(markdownDocument({}, "Bare", ""), "# Bare\n")
})

test("every block on the starter's every-block page comes through, and the page's words are all there", async () => {
  const page = STARTER_DATA.entries.find((e) => e.slug === "every-block")
  const blocks = await fetchBlockTree(page.id, starterChildren)
  const text = blocksMarkdown(blocks, ctx)
  for (const expected of ["## Text", "**bold**", "*italic*", "~~struck through~~", "`inline code`", "$E = mc^2$", "- Bulleted\n  - Nested once", "1. Numbered", "- [x] A to-do, done", "> A quote.", "```typescript", "$$", "| Kind | Lives at | Written in |", "![", "](https://www.youtube.com/watch?v="]) {
    assert.ok(text.includes(expected), `missing ${JSON.stringify(expected)}`)
  }
  // no heading level skipped, and none above the title's
  const levels = [...text.matchAll(/^(#+) /gm)].map((m) => m[1].length)
  assert.ok(levels.every((level, i) => level >= 2 && (i === 0 || level <= levels[i - 1] + 1)), levels.join(","))
  assert.doesNotMatch(text, /\n{3,}/, "one blank line between blocks")
})
