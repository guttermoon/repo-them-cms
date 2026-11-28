import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * The browser tests (tests/dom/): pages and components rendered in
 * jsdom with Testing Library. The Node tests (tests/*.test.mjs) are run by
 * node:test; `npm test` runs both.
 */
export default defineConfig({
  // JSX through React's automatic runtime: tsconfig.json says "preserve",
  // which is Next's to compile, and Vite's compiler (Oxc) would otherwise
  // leave it as JSX and fail to parse it
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: [
      { find: /^@\//, replacement: here("./") },
      // the stand-ins the Node tests use too: Next's cache records rather
      // than needs a server, and server-only is a no-op outside Next
      { find: /^next\/cache$/, replacement: here("./tests/support/next-cache.mjs") },
      { find: /^server-only$/, replacement: here("./tests/support/empty.mjs") },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["tests/dom/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/support/setup-dom.ts"],
    restoreMocks: true,
    // an address for the site, so links built from SITE_URL read as they
    // do on a deployment
    env: { NEXT_PUBLIC_SITE_URL: "https://site.example" },
  },
})
