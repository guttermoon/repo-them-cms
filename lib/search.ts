/**
 * Searching a list on the page (the shop's shelf, the blog): a reader's
 * words against each item's words, both with case, accents and punctuation
 * set aside, so "Cafe" finds "café" and "corn-flakes" finds "corn flakes".
 * Every word must be found; a word may be the start of a longer one.
 *
 * No imports, so the tests load it as it is.
 */

/** Lower case, accents gone, anything not a letter or a digit a space. */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** The words of what a reader typed. */
export function queryWords(query: string): string[] {
  return normalise(query).split(" ").filter(Boolean)
}

/** Whether every word is somewhere in the text; no words matches everything. */
export function matches(text: string, words: string[]): boolean {
  if (!words.length) return true
  const hay = ` ${normalise(text)}`
  return words.every((word) => hay.includes(` ${word}`) || hay.includes(word))
}
