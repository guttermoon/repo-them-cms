// Releases are the changelog's alone (lib/content/select.ts, `blogPosts`):
// a post filed under Category Releases is listed on /changelog and nowhere
// in the blog (its list, its feed, its category pages, the homepage's
// newest), keeps a page of its own, and from it leads on to other releases
// and back to the changelog. tests/content-select.test.mjs holds the reading,
// tests/small-routes.test.mjs the feed and the sitemap.
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"

import { CartProvider } from "@/components/commerce/cart-context"
import { STARTER_DATA } from "@/lib/demo/starter"
import { isRelease, tagSlug } from "@/lib/content/select"
import type { Entry, SiteData } from "@/lib/notion/rows"
import { SITE_URL } from "@/lib/site"

vi.mock("@/components/notion/code", async (original) => (await import("./support/mocks")).plainCode(original))

// a test may add rows to the starter's
let swap: ((data: SiteData) => SiteData) | undefined
vi.mock("@/lib/content/store", async (original) => {
  const real = await original<typeof import("@/lib/content/store")>()
  return { ...real, getSiteData: async () => (swap ? swap(await real.getSiteData()) : real.getSiteData()) }
})

for (const key of ["NOTION_TOKEN", "NOTION_DATABASE_ID", "NOTION_API_BASE_URL"]) delete process.env[key]

const release = STARTER_DATA.entries.find((e) => e.kind === "Post" && isRelease(e))!
const blogPost = STARTER_DATA.entries.find((e) => e.kind === "Post" && !isRelease(e))!

/** A post like the starter's release, on another date and address. */
const another = (from: Entry, slug: string, date: string): Entry => ({ ...from, id: `${from.id}-${slug}`, slug, title: `${from.title} (${slug})`, date })

const hrefs = (root: HTMLElement) => [...root.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))

async function renderPost(slug: string) {
  const { default: Post } = await import("@/app/blog/[slug]/page")
  return render(<CartProvider>{await Post({ params: Promise.resolve({ slug }) })}</CartProvider>)
}

describe("releases are the changelog's, not the blog's", () => {
  test("the starter has a release and a blog post to tell apart", () => {
    expect(release?.category?.name).toBe("Releases")
    expect(blogPost).toBeTruthy()
  })

  test("/blog lists no release; /changelog lists it", async () => {
    const { default: Blog } = await import("@/app/blog/page")
    const blog = render(<CartProvider>{await Blog()}</CartProvider>)
    const listed = hrefs(blog.container.querySelector("main") ?? blog.container)
    expect(listed).toContain(`/blog/${blogPost.slug}`)
    expect(listed, "no release in the blog").not.toContain(`/blog/${release.slug}`)
    expect(listed, "and no Releases category to file it under").not.toContain("/blog/category/releases")
    blog.unmount()

    const { default: Changelog } = await import("@/app/changelog/page")
    const changelog = render(<CartProvider>{await Changelog()}</CartProvider>)
    expect(hrefs(changelog.container)).toContain(`/blog/${release.slug}`)
    expect(hrefs(changelog.container)).not.toContain(`/blog/${blogPost.slug}`)
    // a section of its own: its trail is the home page, then itself
    const ld = [...changelog.container.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "").join("\n")
    expect(ld).toContain(`"item":"${SITE_URL}/changelog"`)
    expect(ld).not.toContain(`"item":"${SITE_URL}/blog"`)
  })

  test("Releases is no category of the blog's: its page is the 404", async () => {
    const { filedPage, filedSlugs } = await import("@/components/notion/post-filter-page")
    expect(await filedSlugs("Category")).not.toContain("releases")
    await expect(filedPage("Category", "releases")).rejects.toThrow("NEXT_NOT_FOUND")
  })

  test("a release's page leads on to releases only, and back to the changelog", async () => {
    // an older release, and a blog post newer than the starter's release
    swap = (data) => ({ ...data, entries: [...data.entries, another(release, "version-0", "2026-01-01"), { ...another(blogPost, "newer-post", "2026-11-26") }] })
    try {
      const { container } = await renderPost(release.slug)
      const more = screen.getByRole("navigation", { name: "More posts" })
      expect(hrefs(more), "the older release, never the newer blog post").toEqual(["/blog/version-0"])
      const back = within(container).getByRole("link", { name: "← Every release" })
      expect(back.getAttribute("href")).toBe("/changelog")
      expect(hrefs(container)).not.toContain("/blog/newer-post")
      // and search engines read it as the changelog's
      const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "").join("\n")
      expect(ld).toContain(`"item":"${SITE_URL}/changelog"`)
      expect(ld).not.toContain(`"item":"${SITE_URL}/blog"`)
    } finally {
      swap = undefined
    }
  })

  test("a blog post's page leads on to blog posts only, and back to the blog", async () => {
    swap = (data) => ({ ...data, entries: [...data.entries, another(release, "version-9", "2026-11-26")] })
    try {
      const { container } = await renderPost(blogPost.slug)
      expect(hrefs(container), "no release as a neighbour").not.toContain(`/blog/${release.slug}`)
      expect(hrefs(container)).not.toContain("/blog/version-9")
      expect(within(container).getByRole("link", { name: "← All posts" }).getAttribute("href")).toBe("/blog")
      const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "").join("\n")
      expect(ld).toContain(`"item":"${SITE_URL}/blog"`)
    } finally {
      swap = undefined
    }
  })

  test("a release's category goes to the changelog, and a tag no blog post has is a plain tag: neither is a link to the 404", async () => {
    const tagged = (data: SiteData): SiteData => ({
      ...data,
      entries: data.entries.map((e) => (e.id === release.id ? { ...e, tags: [{ name: "Only on releases", color: "blue" as const }, ...blogPost.tags.slice(0, 1)] } : e)),
    })
    swap = tagged
    try {
      const { container } = await renderPost(release.slug)
      const links = hrefs(container)
      expect(links).toContain("/changelog")
      expect(links, "no category page for Releases").not.toContain("/blog/category/releases")
      expect(links, "no tag page for a tag only releases have").not.toContain("/blog/tag/only-on-releases")
      expect(within(container).getByText("Only on releases").closest("a"), "the tag is still shown").toBeNull()
      // a tag a blog post shares has its page, and is a link to it
      const shared = blogPost.tags[0]
      if (shared) expect(links).toContain(`/blog/tag/${tagSlug(shared.name)}`)
    } finally {
      swap = undefined
    }
  })

  test("a release's share card is its own, as a blog post's is", async () => {
    const { ogWords } = await import("@/lib/og-words")
    expect((await ogWords(`/blog/${release.slug}`)).title).toBe(release.title)
    expect((await ogWords(`/blog/${blogPost.slug}`)).title).toBe(blogPost.title)
  })
})
