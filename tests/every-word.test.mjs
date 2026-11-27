// Every word a reader sees or hears is a Notion slot (CLAUDE.md, "Every word
// is a Notion slot"): the site's owner edits all of it in the database, so a
// word typed straight into the markup is a word they cannot change.
//
// This reads every component and page as TypeScript, the way the compiler
// does, and fails on:
//   - JSX text outside <T> (a <T>'s children are its slot's built-in wording);
//   - a string in an attribute a reader sees or hears (aria-label, alt, title,
//     placeholder, label…), and the words on an <input type="submit">;
//   - a string printed as a child expression: {"…"}, {open ? "…" : "…"},
//     {`${n} left`};
//   - a page's title or description written into pageMeta() or `metadata`;
//   - a component's default words for a prop a reader sees or hears
//     (`label = "Copy"`), which would print whenever a page forgot to pass
//     the slot.
// A string handed to plainText(), or to any other call, passes: the call is
// the slot. What may not be a slot is listed below, each with its reason.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"
import { ROOT, sourceFiles } from "./support/sources.mjs"


/** Words that must not come from Notion, and why. Each must still be found. */
const ALLOWED = [
  {
    file: "app/global-error.tsx",
    text: "Try again",
    why: "drawn when the root layout itself has failed, in the browser, with no content to read a slot from",
  },
  {
    file: "components/layout/site-footer.tsx",
    text: "is an independent template, not made, endorsed or maintained by Notion Labs, Inc. Notion and the Notion logo are trademarks of Notion Labs, Inc., and are used here with permission.",
    why: "Notion's brand rules: the attribution and the independence statement are printed outside any slot, so they cannot be blanked (docs/brand.md)",
  },
  ...[". Built on", "a", "GitHub", "template by"].map((text) => ({
    file: "components/layout/site-footer.tsx",
    text,
    why: "the template's credit beside the copyright: printed outside any slot, so a copy's owner cannot blank it from Notion (README asks a copy to keep it)",
  })),
  {
    file: "components/layout/site-footer.tsx",
    text: "Made for Notion",
    why: "the badge is Notion's own file, unaltered, and this is what it says",
  },
  { file: "components/sections/template/services.tsx", text: "Aa", why: "a type specimen: letters shown as letters, not as words" },
]

/** Attributes whose words a reader sees or hears. */
const READER_FACING = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "label",
  "placeholder",
  "title",
])

/** Props whose words a component prints, besides the attributes above. */
const WORDS_PROPS = new Set(["copied", "failed", "names", "labels", "words", "text", "caption", "note"])

/** A letter in any script, once HTML entities (&rsquo;, &#8217;) are set aside. */
const hasWords = (text) => /\p{L}/u.test(text.replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, " "))
const tidy = (text) => text.replace(/\s+/g, " ").trim()

/**
 * The strings an expression can evaluate to, as it would be printed: a
 * literal, either side of a ?: or a || or a ??, the right of an &&, the parts
 * of a template (and what is printed inside them) or a +. Not a call's arguments (a call is a slot, a format or
 * a lookup), and not JSX, which is read on its own.
 */
function printed(expr) {
  if (!expr) return []
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text]
  if (ts.isTemplateExpression(expr)) return [expr.head.text, ...expr.templateSpans.flatMap((s) => [...printed(s.expression), s.literal.text])]
  if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr) || ts.isSatisfiesExpression(expr)) {
    return printed(expr.expression)
  }
  if (ts.isConditionalExpression(expr)) return [...printed(expr.whenTrue), ...printed(expr.whenFalse)]
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return printed(expr.right)
    if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(op)) {
      return [...printed(expr.left), ...printed(expr.right)]
    }
  }
  return []
}

/** Every bare word in one parsed file. */
function scanSource(source) {
  const file = source.fileName
  const found = []
  const name = (node) => node.getText(source)
  const add = (node, where, texts) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
    for (const text of texts.map(tidy)) if (hasWords(text)) found.push({ file, line, where, text })
  }
  // inside a <T>: its children are the slot's built-in wording
  const inSlot = (node) => {
    for (let n = node.parent; n; n = n.parent) if (ts.isJsxElement(n) && name(n.openingElement.tagName) === "T") return true
    return false
  }
  const typeOf = (opening) => {
    const type = opening.attributes.properties.find((a) => ts.isJsxAttribute(a) && name(a.name) === "type")
    return type?.initializer && ts.isStringLiteral(type.initializer) ? type.initializer.text : ""
  }
  // a title or a description anywhere in it: openGraph's, a feed link's
  const pageWords = (node, where) => {
    if (!node) return
    if (ts.isArrayLiteralExpression(node)) return node.elements.forEach((e) => pageWords(e, where))
    if (!ts.isObjectLiteralExpression(node)) return
    for (const p of node.properties) {
      if (!ts.isPropertyAssignment(p)) continue
      if (["title", "description"].includes(name(p.name))) add(p, `${where} ${name(p.name)}`, printed(p.initializer))
      else pageWords(p.initializer, where)
    }
  }

  const visit = (node) => {
    if (ts.isJsxText(node) && !inSlot(node)) add(node, "text", [name(node)])

    // {"…"} as a child of an element
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && !inSlot(node)) {
      add(node, "child", printed(node.expression))
    }

    if (ts.isJsxAttribute(node)) {
      const attr = name(node.name)
      const opening = node.parent.parent
      const button = attr === "value" && name(opening.tagName) === "input" && /^(submit|button|reset)$/.test(typeOf(opening))
      if ((READER_FACING.has(attr) || button) && node.initializer) {
        const init = node.initializer
        add(node, attr, ts.isStringLiteral(init) ? [init.text] : ts.isJsxExpression(init) ? printed(init.expression) : [])
      }
    }

    // pageMeta({ title: "…" }), pageMetaFor(path, { title: "…" })
    if (ts.isCallExpression(node) && ["pageMeta", "pageMetaFor"].includes(name(node.expression))) {
      for (const arg of node.arguments) pageWords(arg, name(node.expression))
    }
    // export const metadata = { title: "…" }
    if (ts.isVariableDeclaration(node) && name(node.name) === "metadata") pageWords(node.initializer, "metadata")

    // function Button({ label = "Copy", names = { light: "Light" } })
    if (ts.isBindingElement(node) && node.initializer && ts.isObjectBindingPattern(node.parent)) {
      const prop = name(node.propertyName ?? node.name)
      if (READER_FACING.has(prop) || WORDS_PROPS.has(prop)) {
        const init = node.initializer
        const values = ts.isObjectLiteralExpression(init) ? init.properties.flatMap((p) => (ts.isPropertyAssignment(p) ? printed(p.initializer) : [])) : printed(init)
        add(node, `default ${prop}`, values)
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const parse = (file, text) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const FILES = sourceFiles(["app", "components", "lib"], /\.tsx$/)
const FOUND = FILES.flatMap((file) => scanSource(parse(file, readFileSync(join(ROOT, file), "utf8"))))
const isAllowed = (f) => ALLOWED.some((a) => a.file === f.file && a.text === f.text)

test("the scan reads the site's markup", () => {
  assert.ok(FILES.length > 60, `only ${FILES.length} files`)
  // the attribution is found, so the scan is reading JSX text at all
  assert.ok(FOUND.some((f) => f.file === "components/layout/site-footer.tsx" && f.text.startsWith("is an independent template")))
})

test("every word a reader sees or hears is a Notion slot", () => {
  const bare = FOUND.filter((f) => !isAllowed(f)).map((f) => `${f.file}:${f.line} (${f.where}) "${f.text.slice(0, 80)}"`)
  assert.deepEqual(bare, [], `words outside a slot: wrap them in <T k="…">, or plainText() for an attribute\n${bare.join("\n")}`)
})

test("every allowed exception is still in the code (a stale one would let the next word in unread)", () => {
  const stale = ALLOWED.filter((a) => !FOUND.some((f) => f.file === a.file && f.text === a.text)).map((a) => `${a.file}: "${a.text}"`)
  assert.deepEqual(stale, [])
})

test("each kind of bare word is caught, and each kind of slot passes", () => {
  const sample = parse(
    "sample.tsx",
    `
    export const metadata = { title: "Bare title", alternates: { types: { rss: [{ url: "/feed", title: "Bare feed" }] } } }
    export function A({ open, n }) {
      return (
        <div aria-label="Bare label" title={open ? "Close it" : "Open it"}>
          Bare text
          {"bare child"}
          {\`\${n} left\`}
          {\`\${n} \${n === 1 ? "item" : "items"}\`}
          {open && "shown when open"}
          <T k="a.b">Slot text <a href="/x">with a link</a></T>
          <img alt={plainText(content, "a.c", "Slot alt")} />
          <input type="submit" value="Send it" />
          <input type="hidden" value="not words anybody reads" />
          {pageMeta({ path: "/", title: "Meta title", description: plainText(content, "a.d", "Slot description") })}
          <Copy />
          <span>{"·"} 42 &rarr;</span>
        </div>
      )
    }
    function Copy({ label = "Default label", names = { light: "Default name" }, className = "not words" }) {
      return <button className={className}>{label}</button>
    }`,
  )
  assert.deepEqual(
    scanSource(sample)
      .map((f) => f.text)
      .sort(),
    ["Bare feed", "Bare label", "Bare text", "Bare title", "Close it", "Default label", "Default name", "Meta title", "Open it", "Send it", "bare child", "item", "items", "left", "shown when open"].sort(),
  )
})
