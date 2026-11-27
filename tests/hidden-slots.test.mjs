// The slots `npm run copy` cannot reach by rendering (a form's answer, a page
// set up with analytics on) are listed by hand in tests/support/hidden-slots.ts.
// A list kept by hand goes stale, and a stale one seeds Notion with old words.
// So each entry is held to its component: the key is in the code, as a whole
// string, and the words beside it are the code's built-in wording.
import { test } from "node:test"
import assert from "node:assert/strict"
import { join, relative } from "node:path"

import { HIDDEN_SLOTS, STARTER_ONLY_SLOTS } from "./support/hidden-slots.ts"
import { ROOT, sources } from "./support/sources.mjs"

const FILES = sources(["app", "components", "lib"])

/**
 * Words as JSX or a string holds them, read the way `npm run copy` writes
 * them (lib/copy-dump.ts): a link as `[its words](its address)`, any other
 * tag gone, entities as their characters. Spacing is set aside, since JSX
 * lays words over lines as it likes.
 */
const read = (text) =>
  text
    .replace(/<a\s[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)")
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, "")

test("there are hidden slots to check", () => {
  assert.ok(Object.keys(HIDDEN_SLOTS).length > 10)
})

for (const [key, words] of Object.entries({ ...HIDDEN_SLOTS, ...STARTER_ONLY_SLOTS })) {
  test(`${key} is in the code with these words`, () => {
    const homes = FILES.filter((f) => f.text.includes(`"${key}"`))
    assert.ok(homes.length, `no file has the slot "${key}"`)
    assert.ok(
      // read as markup, or as it stands (words in an attribute, a string)
      homes.some((f) => read(f.text).includes(read(words)) || f.text.replace(/\s+/g, "").includes(words.replace(/\s+/g, ""))),
      `"${key}" is in ${homes.map((f) => relative(ROOT, join(ROOT, f.path))).join(", ")}, but not with the words "${words}"`,
    )
  })
}
