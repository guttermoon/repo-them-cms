import type React from "react"

/**
 * The hook every slot is read through, for the list of slots.
 *
 * `<T>` and `plainText()` call it with the slot's key and its built-in
 * wording. On the site it does nothing. `npm run copy` renders every page in
 * jsdom (tests/dom/every-word.test.tsx) with this hook replaced, and so
 * learns every slot there is: many keys are built from data while a page
 * renders (the questions, the features, the service counter), so a grep for
 * `<T k="…">` would report a shorter list than the truth.
 */
export function recordCopyKey(key: string, children: React.ReactNode): void {
  void key
  void children
}

/**
 * The fallback copy as somebody would type it into Notion: plain text, with
 * <br/> and a bare "\n" both becoming a line break, a link (an <a>, a
 * <Link>) as `[its words](its address)`, the site's one piece of markup
 * (lib/inline-links.ts), and any other markup round a run of words (a
 * <strong>) contributing only the words.
 */
export function toText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(toText).join("")
  const element = node as { type?: unknown; props?: { children?: React.ReactNode; href?: unknown } }
  if (element.type === "br") return "\n"
  const words = toText(element.props?.children)
  return typeof element.props?.href === "string" && words ? `[${words}](${element.props.href})` : words
}
