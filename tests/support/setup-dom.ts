// What a browser has and jsdom does not, for tests/dom. Each stand-in does
// the least that lets a component run as it would in a browser; none of them
// is a test of the browser feature itself.
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// React's own warnings (markup that cannot nest, a missing key, a hook
// misused) are failures: in a browser the first of those becomes a
// hydration error that re-renders the whole page. React 19 no longer starts
// them "Warning: ", so a warning is anything React itself logs as an error:
// a console.error called from React's own code.
const warnings: string[] = []
const consoleError = console.error.bind(console)
export const fromReact = (stack: string) => /node_modules[\\/]react(-dom)?[\\/]/.test(stack)
console.error = (...args: unknown[]) => {
  if (fromReact(new Error().stack ?? "")) warnings.push(args.map(String).join(" ").slice(0, 400))
  consoleError(...args)
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
  navigation.pathname = "/"
  motion.reduce = false
  const found = warnings.splice(0)
  if (found.length) throw new Error(`React warned while rendering:\n${found.join("\n")}`)
})

// Next's app router: components that navigate get a router that records,
// and the path a test sets.
export const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }
export const navigation = { pathname: "/", search: "" }
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND")
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
}))

// Next hands server components React's request cache; the stock React the
// tests load has none, and outside a request there is nothing to share.
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: (fn: unknown) => fn }))

// Next ships its own React build, whose react-dom has the resource hints;
// the stock react-dom the tests load does not, so they are no-ops here.
vi.mock("react-dom", async (original) => ({
  ...(await original<typeof import("react-dom")>()),
  preload: () => {},
  preinit: () => {},
  prefetchDNS: () => {},
  preconnect: () => {},
}))

// Scrolled into view at once.
class Observer {
  constructor(private callback: (entries: unknown[], observer: unknown) => void) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, intersectionRatio: 1, target }], this)
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
Object.assign(window, { IntersectionObserver: Observer, ResizeObserver: Observer })

// No small screen, and full motion unless a test asks for less
// (`motion.reduce = true`).
export const motion = { reduce: false }
window.matchMedia = (query: string) =>
  ({
    matches: /prefers-reduced-motion:\s*reduce/.test(query) ? motion.reduce : false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }) as MediaQueryList

Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

// <dialog>: open and close set and clear `open`, as a browser does.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "")
}
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open")
  this.dispatchEvent(new Event("close"))
}

// The site's faces are "loaded" at once.
Object.defineProperty(document, "fonts", {
  configurable: true,
  value: { ready: Promise.resolve(), load: async () => [], check: () => true },
})
