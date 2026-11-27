import { createHighlighterCore, type HighlighterCore, type ThemeRegistrationRaw } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

import { hexToRgb, readable, rgbToHex, type Rgb } from "./contrast"
import type { Theme } from "./theme"

/**
 * Code, highlighted on the server by shiki for the Notion code block
 * (components/notion/code.tsx): the colours arrive as inline styles in the
 * HTML, so no script and no stylesheet reach the reader. The grammars are
 * loaded only when a page uses one, and the regular expressions run on
 * shiki's JavaScript engine, so nothing needs WebAssembly.
 *
 * No JSX, so `npm test` loads it (tests/contrast.test.mjs highlights code in
 * every bundled language and checks every colour against its ground).
 */

/** Notion's language names → shiki's, for the languages bundled. */
const ALIASES: Record<string, string> = {
  "plain text": "text",
  bash: "bash",
  shell: "bash",
  c: "c",
  "c++": "cpp",
  "c#": "csharp",
  css: "css",
  diff: "diff",
  docker: "docker",
  go: "go",
  graphql: "graphql",
  html: "html",
  java: "java",
  javascript: "javascript",
  json: "json",
  kotlin: "kotlin",
  markdown: "markdown",
  markup: "html",
  php: "php",
  powershell: "powershell",
  python: "python",
  ruby: "ruby",
  rust: "rust",
  scss: "scss",
  sql: "sql",
  swift: "swift",
  toml: "toml",
  typescript: "typescript",
  xml: "xml",
  yaml: "yaml",
  makefile: "makefile",
}

const LANGS: Record<string, () => Promise<unknown>> = {
  bash: () => import("shiki/langs/bash.mjs"),
  c: () => import("shiki/langs/c.mjs"),
  cpp: () => import("shiki/langs/cpp.mjs"),
  csharp: () => import("shiki/langs/csharp.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
  docker: () => import("shiki/langs/docker.mjs"),
  go: () => import("shiki/langs/go.mjs"),
  graphql: () => import("shiki/langs/graphql.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  java: () => import("shiki/langs/java.mjs"),
  javascript: () => import("shiki/langs/javascript.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  kotlin: () => import("shiki/langs/kotlin.mjs"),
  makefile: () => import("shiki/langs/makefile.mjs"),
  markdown: () => import("shiki/langs/markdown.mjs"),
  php: () => import("shiki/langs/php.mjs"),
  powershell: () => import("shiki/langs/powershell.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  ruby: () => import("shiki/langs/ruby.mjs"),
  rust: () => import("shiki/langs/rust.mjs"),
  scss: () => import("shiki/langs/scss.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  swift: () => import("shiki/langs/swift.mjs"),
  toml: () => import("shiki/langs/toml.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  typescript: () => import("shiki/langs/typescript.mjs"),
  xml: () => import("shiki/langs/xml.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
}

/** The languages highlighted; any other is shown as plain code. */
export const BUNDLED_LANGUAGES = Object.keys(LANGS)

/**
 * A theme of greys for mono: comments in a mid grey, strings a shade
 * lighter than the words, keywords and tags in black. Nothing with a hue.
 */
const MONO_CODE: ThemeRegistrationRaw = {
  name: "site-mono",
  type: "light",
  colors: { "editor.foreground": "#1f1f1f", "editor.background": "#f2f2f2" },
  settings: [
    { settings: { foreground: "#1f1f1f", background: "#f2f2f2" } },
    { scope: ["comment", "punctuation.definition.comment", "string.comment"], settings: { foreground: "#5c5c5c" } },
    { scope: ["string", "string.quoted", "constant.other.symbol", "markup.inline.raw"], settings: { foreground: "#474747" } },
    { scope: ["keyword", "storage", "storage.type", "storage.modifier", "entity.name.tag", "markup.heading", "keyword.operator.new"], settings: { foreground: "#000000" } },
  ],
}

/**
 * The code's colours in each look. Light's are inline (`color:`); every
 * other look's is a variable (`--shiki-dark:`, `--shiki-mono:`,
 * `--shiki-rainbow:`) that app/globals.css switches to under its
 * data-theme. Rainbow's is snazzy-light, the loudest of shiki's light themes.
 */
const CODE_THEMES = { light: "github-light", dark: "github-dark", mono: "site-mono", rainbow: "snazzy-light" } as const satisfies Record<Theme, string>

let highlighter: Promise<HighlighterCore> | null = null
const loaded = new Set<string>()

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [import("shiki/themes/github-light.mjs"), import("shiki/themes/github-dark.mjs"), import("shiki/themes/snazzy-light.mjs"), MONO_CODE],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  })
  return highlighter
}

/**
 * The code block's ground in each look: `bg-wash`, which is --c-wash in
 * app/globals.css (tests/contrast.test.mjs checks they agree).
 */
export const CODE_GROUNDS: Record<Theme, Rgb> = { light: [244, 245, 248], dark: [12, 20, 15], mono: [242, 242, 242], rainbow: [244, 238, 255] }

/** Which look a colour in shiki's HTML is for: `color` is light's, `--shiki-<look>` the rest. */
export const CODE_COLOUR = /(^|[;"\s])(color|--shiki-(?:dark|mono|rainbow)):\s*(#[0-9a-f]{3,8})\b/gi
export const lookOf = (prop: string): Theme => (prop.toLowerCase() === "color" ? "light" : (prop.slice("--shiki-".length).toLowerCase() as Theme))

/**
 * Every colour shiki set, lifted where it is too faint to read on its
 * look's ground (TEXT_MIN, 7:1). A theme's colours are its own wherever they
 * already read; GitHub's grey comments and red keywords, among others, do
 * not on a tinted ground.
 */
export function readableColours(html: string): string {
  // Inside tags only. The code's own "<" is escaped, so every "<" starts a
  // tag shiki wrote, and a "color:#fff" the code itself says is left as it is.
  return html.replace(/<[^>]*>/g, (tag) =>
    tag.replace(CODE_COLOUR, (match, lead: string, prop: string, hex: string) => {
      const rgb = hexToRgb(hex)
      if (!rgb) return match
      return `${lead}${prop}:${rgbToHex(readable(rgb, CODE_GROUNDS[lookOf(prop)]))}`
    }),
  )
}

/** The code as highlighted HTML, or null to fall back to plain text. */
export async function highlight(code: string, language: string): Promise<string | null> {
  const lang = ALIASES[language.toLowerCase()] ?? language.toLowerCase()
  const load = LANGS[lang]
  if (!load) return null
  try {
    const h = await getHighlighter()
    if (!loaded.has(lang)) {
      await h.loadLanguage((await load()) as Parameters<HighlighterCore["loadLanguage"]>[0])
      loaded.add(lang)
    }
    return readableColours(h.codeToHtml(code, { lang, themes: CODE_THEMES, defaultColor: "light" }))
  } catch (error) {
    console.warn(`[code] could not highlight ${language}:`, error instanceof Error ? error.message : error)
    return null
  }
}

