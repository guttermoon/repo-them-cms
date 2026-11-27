/**
 * What a message to the site can be about: the contact form's choices and
 * the list the route checks against, in one place so they cannot disagree.
 * The value is what the email says ("Type: order"). A link can choose one
 * with `/contact?type=plan`.
 *
 * Imports nothing, so `npm test` loads it.
 */
export const ENQUIRY_TYPES = [
  { value: "question", label: "A question" },
  { value: "order", label: "An order" },
  { value: "plan", label: "A plan or a bill" },
  { value: "problem", label: "Something is broken" },
  { value: "idea", label: "An idea" },
  { value: "other", label: "Something else" },
] as const

export type EnquiryType = (typeof ENQUIRY_TYPES)[number]["value"]

export const isEnquiryType = (value: unknown): value is EnquiryType =>
  typeof value === "string" && ENQUIRY_TYPES.some((t) => t.value === value)

/** What the form and the route say when no type was chosen. */
export const NO_ENQUIRY_TYPE = "Choose what your message is about."
