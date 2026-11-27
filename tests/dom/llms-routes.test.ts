// /llms.txt and /llms-full.txt as Next serves them: the route reads the
// site's data (faked here) and answers with the text lib/llms.ts builds from
// it. What the text says is tests/llms.test.mjs.
import { describe, expect, test, vi } from "vitest"

import { llmsFullTxt, llmsTxt } from "@/lib/llms"
import type { SiteData } from "@/lib/notion/rows"

const data = vi.hoisted(() => ({ current: { copy: {}, entries: [] } as SiteData }))
vi.mock("@/lib/content/store", () => ({ getSiteData: async () => data.current }))

const routes = [
  ["/llms.txt", () => import("@/app/llms.txt/route"), llmsTxt],
  ["/llms-full.txt", () => import("@/app/llms-full.txt/route"), llmsFullTxt],
] as const

describe.each(routes)("%s", (_path, load, build) => {
  test("is plain UTF-8 text, built ahead and refreshed with the pages", async () => {
    const mod = await load()
    expect(mod.revalidate).toBe(60)
    const res = await mod.GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8")
    expect(await res.text()).toBe(build({ copy: {}, entries: [] }))
  })
})

test("the full file carries the published Question rows", async () => {
  const question = {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "Question" as const,
    title: "Reworded in Notion?",
    slug: "",
    description: "",
    created: "2026-01-01T00:00:00.000Z",
    lastEdited: "2026-01-01T00:00:00.000Z",
    tags: [],
    featured: false,
    featureBlock: undefined,
    font: "default" as const,
    fullWidth: false,
    coverTint: true,
    layout: "article" as const,
    text: "Yes.",
  }
  data.current = { copy: {}, entries: [question] }
  const text = await (await (await import("@/app/llms-full.txt/route")).GET()).text()
  expect(text).toContain("Q: Reworded in Notion?\nA: Yes.")
  data.current = { copy: {}, entries: [] }
})
