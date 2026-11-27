// The stand-ins the page tests share. vi.mock is hoisted above a test's
// imports, so each test still calls it, handing these the original module:
//
//   vi.mock("@/components/notion/code", async (original) => (await import("./support/mocks")).plainCode(original))
//   vi.mock("@notionhq/client", async (original) => (await import("./support/mocks")).browserNotion(original))

type CodeModule = typeof import("@/components/notion/code")

/**
 * The code block as its own markup, unhighlighted. React cannot render an
 * async component outside a server, and the code block is the only one below
 * a page (tests/dom/notion-render.test.tsx renders it highlighted).
 */
export async function plainCode(original: () => Promise<unknown>) {
  const real = (await original()) as CodeModule
  return { ...real, CodeBlock: (props: Parameters<typeof real.CodeFigure>[0]) => <real.CodeFigure {...props} html={null} /> }
}

/**
 * Notion's SDK, told the "browser" here is a test runner talking to a
 * stand-in. The SDK refuses a token wherever `window` exists, and jsdom makes
 * one; the site itself only ever calls Notion from the server.
 */
export async function browserNotion(original: () => Promise<unknown>) {
  const real = (await original()) as Record<string, unknown> & { default?: Record<string, unknown> }
  const sdk = (real.default ?? real) as { Client: new (options: Record<string, unknown>) => object }
  class Client extends sdk.Client {
    constructor(options: Record<string, unknown>) {
      super({ ...options, dangerouslyAllowBrowser: true })
    }
  }
  return { ...real, Client, default: { ...sdk, Client } }
}
