/**
 * Slots a render of every page does not reach, because they appear only
 * after somebody does something (a form's answer), or only when the site is
 * set up a certain way (analytics on, a repository address). `npm run copy`
 * adds them to what it rendered (tests/dom/every-word.test.tsx), and
 * tests/hidden-slots.test.mjs holds each one to its component: the key is
 * there, with these words as its built-in wording.
 */
export const HIDDEN_SLOTS: Record<string, string> = {
  "newsletter.pending": "Check your inbox. One click confirms it.",
  // only on a review with a Link
  "home.reviews.source": "Read where it was left",
  // the average in a word: one shows, by the average's nearest whole star
  "home.reviews.verdict.4": "Great",
  "home.reviews.verdict.3": "Average",
  "home.reviews.verdict.2": "Poor",
  "home.reviews.verdict.1": "Bad",
  "newsletter.done": "You are on the list.",
  "newsletter.sending": "Sending",
  "contact.form.sent": "Sent. A person will read it.",
  "contact.form.sending": "Sending",
  "contact.or": "Or write to",
  "cookies.kind": "generic, assorted",
  "cookies.title": "cookies",
  "cookies.weight": "Net wt: 0 trackers until you say yes.",
  "cookies.body": "May we count visits? It tells us which pages get read, what gets pressed and what breaks. Nothing is counted until you say yes, and no is just as easy.",
  "cookies.tools": "Counted with",
  "cookies.through": "through this site.",
  "cookies.yes": "Yes",
  "cookies.no": "No",
  "cookies.more": "What we count",
  // only while no analytics is set up
  "cookies.example": "An example: this site counts nothing yet, whatever you answer.",
  // the question's shape, read in the layout: bag, box or banner
  "cookies.shape": "bag",
  "features.demo.blank.note": "(nothing, on purpose)",
  "home.posts.empty": "No posts yet. Write one in Notion: a row with Kind set to Post and Published ticked. It appears here within a minute.",
  "blog.empty": "No posts yet. In the Notion database, add a row, set Kind to Post, write it, and tick Published. It appears here within a minute.",
  "resources.empty": "Nothing here yet. In Notion, add a row with Kind set to Resource, give it a Link, and tick Published.",
  "resources.other": "Other",
  "privacy.analytics.body":
    "Only after you say yes in the cookie notice, we record which pages are opened and what is done on them: what is pressed, what goes in a cart, when a form is sent, and errors a page runs into. It all goes through this site, which shortens your IP address before passing anything on, and takes names and addresses out of page addresses.",
  "privacy.analytics.none": "This site counts nothing. There are no analytics and no tracking cookies.",
  "privacy.table.consent": "Remembers your answer to the cookie notice. Stays in your browser.",
  "privacy.table.posthog": "PostHog: a random identifier, kept as this cookie and in the storage of your browser, so a visit is counted once. Only after a yes, and a later no deletes both.",
  "privacy.table.google": "Google Analytics: a random identifier, so a visit is counted once. Only after a yes.",
  "privacy.table.year": "Up to a year",
  "privacy.table.months": "months",
  "privacy.forms.processors": "Both are handled for us by",
  // only with a repository address (REPO_URL in lib/site.ts)
  "features.deploy.docs": "The full directions",
  "features.star.title": "like it? star it",
  "features.star.lede": "Stars cost nothing and help the next person find it.",
  "features.star.cta": "Star it on GitHub",
  // only when there is nobody on the team yet
  "team.empty":
    "Nobody here yet. In Notion, add a row with Kind set to Person: the name in Title, the role in Description, a line in Text and a portrait in Image. Tick Published.",
  // only once somebody opens the Feedback panel (components/layout/feedback.tsx)
  "feedback.title": "tell us what you think",
  "feedback.close": "Close",
  "feedback.lede": "Something broken, an idea, or something you liked. It goes straight to the people who make the site.",
  "feedback.kind": "What is it?",
  "feedback.words": "What happened?",
  "feedback.words.placeholder": "What you did, what you expected, what you saw.",
  "feedback.note": "Sent with the page you are on, your browser, the look and the size of your window. If you said yes to cookies, also this visit, so we can see what you saw.",
  "feedback.example": "An example: this site is not collecting feedback yet, so nothing is sent.",
  "feedback.send": "Send",
  "feedback.sending": "Sending",
  "feedback.done": "Thank you. It is on its way to the people who make the site.",
  "feedback.again": "Done",
  "feedback.placeholder.title": "Just a placeholder",
  "feedback.placeholder.close": "Close",
  "feedback.placeholder.body": "This feedback form is an example: nothing was sent, and nothing was kept. To tell us something, write to",
  // only with PostHog set up
  "privacy.forms.feedback":
    "The Feedback button sends what you write, with the page you were on, the browser you use (its name and version), the look you had and the size of your window, to PostHog, which we use to read it. If you said yes to cookies, it also sends which visit it came from, so we can see what went wrong. It never sends your address or your name.",
  "privacy.forms.chat":
    "If this site has a support chat, it is PostHog's, and it appears only after you say yes to cookies. It sends what you write, and the email and name you give it, to PostHog, which we use to answer you, with the visit it came from. Your browser keeps the conversation so you can pick it up again, and a no to cookies deletes it.",
  "privacy.table.chat": "PostHog's support chat, if this site has one: the conversation you started, and the email and name you gave it, so you can carry on. Only after a yes, and a later no deletes it.",
  // only with a shared rate-limit store set (lib/rate-limit.ts)
  "privacy.third.limits":
    "To stop any one visitor flooding the site, Upstash counts the requests each one makes, a minute at a time. It never learns who: it is given a stand-in for your IP address, scrambled with a key it does not have, and each count is gone within the minute.",
  // only once somebody presses a placeholder form's button
  "newsletter.placeholder.body": "This mailing list is an example: nothing was sent, and nothing was kept. To get in touch, write to",
  "contact.form.placeholder.body": "This form is an example: nothing was sent, and nothing was kept. To get in touch, write to",
  "service.star.label": "star the repo",
  "service.star.body": "Stars cost nothing. They help the next person find it, and they make the maker unreasonably happy.",
  "service.star.cta": "Star it on GitHub",
  // only when a question has no category
  "questions.other": "Other questions",
  // only when the shop sells (COMMERCE_PROVIDER)
  "llms.shop": "Shop",
  // only with analytics on (NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_GA_MEASUREMENT_ID)
  "privacy.analytics.change": "Change your answer",
  "privacy.analytics.posthog.eu": "PostHog counts the visits for us, on its servers in the European Union ([its privacy policy](https://posthog.com/privacy)).",
  "privacy.analytics.posthog.us": "PostHog counts the visits for us, on its servers in the United States ([its privacy policy](https://posthog.com/privacy)).",
  "privacy.analytics.google":
    "Google Analytics counts them as well, and Google may handle what it receives in the United States ([Google's privacy policy](https://policies.google.com/privacy)).",
  // only once the repository is public (REPO_URL in lib/site.ts)
  "security.report.policy": "The security policy",
}

/**
 * Slots drawn only while the starter content shows (no Notion connected), so
 * no database could ever show them: `npm run copy` leaves them out, and
 * `npm run notion:seed-copy` never makes a row nobody could see.
 * tests/hidden-slots.test.mjs holds each to its component, as above.
 */
export const STARTER_ONLY_SLOTS: Record<string, string> = {}
