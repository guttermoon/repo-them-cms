# Contributing

Thank you for looking. REPO THEM is a template that sites are copied from,
so a fix made here reaches every copy that takes the update. Reports, fixes
and corrections to the docs are all welcome.

## Before you start

- **Something broken?** Open an issue with the
  [bug form](https://github.com/guttermoon/repo-them-cms/issues/new/choose):
  what you did, what you saw and what you expected. The smallest steps that
  show it, or a failing test, is the most useful thing you can send.
- **A security problem?** Never in an issue: [SECURITY.md](SECURITY.md) says
  where.
- **An idea?** Open an issue with the idea form before writing code for it,
  so its shape is agreed first. An idea that changes what a reader's browser
  sends, how often the site asks Notion, or how a page looks may run into a
  rule, and an issue is where that comes out cheaply.
- **A typo or a broken link in the docs?** Send the pull request straight
  away.

## The rules, and why

[CLAUDE.md](CLAUDE.md) is the project's rulebook: every rule, with its
reason. It is written for people and coding agents alike. Read the part
your change touches before you start. The ones a change meets most often:

- every word a reader sees or hears is a Notion slot (`<T k="area.name">`),
  never a bare string;
- a reader's browser talks to the site and nobody else: no font, script,
  stylesheet or picture from another host;
- Notion is read once a minute, never once per item;
- colours are tokens, checked for contrast in all four looks;
- a thing pressed is 44 by 44 at least, and nothing moves for a reader who
  asked for less motion.

Most rules are tests, so `npm run check` says when a change breaks one.

## Set up

Node 22.18 or newer.

```bash
npm install
```

```bash
npm run dev
```

With no settings the site shows the starter content from its own files. To
run the real path (the Notion client reading over HTTP) without a Notion
account, start the stand-in Notion
([getting started](docs/development.md#getting-started)).

## Making a change

1. Branch from `main`.
2. Make the change with a test. A test is checked by breaking the code it
   covers and watching it fail.
3. Added or renamed a slot? Run `npm run copy` and commit `copy-keys.json`.
   Changed the schema, the menus or the sections? Run `npm run docs`.
4. Change the docs with the code. If a rule in CLAUDE.md turns out to be
   wrong, correct it in the same commit.
5. Run the whole check:

```bash
npm run check
```

CI runs the same, then builds the site with no settings at all, as a new
copy deploys.

The audits (`npm run a11y`, `npm run responsive`, `npm run privacy` and
`npm run sharpness`) need a running site and Playwright. Run the ones your
change touches ([the audits](docs/development.md#the-audits)).

## Commits and pull requests

- **One thing a pull request.** A fix and a tidy-up are two.
- **A commit's first line says what is true once it lands,** in plain
  words: "LICENSE is MIT's text alone, so GitHub names it". The body says
  why. `git log` has plenty more.
- **British spelling,** as the docs and the starter content use: colour,
  licence, organise.
- **Nothing private.** No token, key, real ID, deployment address or email
  address but an example (`example.com`); `tests/no-secrets.test.mjs` fails
  on anything else.
- **Pictures are drawn at twice the size they're shown,** in the site and
  in the docs.

The pull request form has the checklist.

## Licence

A contribution is licensed under the [MIT licence](LICENSE), like the rest
of the code.

## Conduct

Everybody taking part follows the [code of conduct](CODE_OF_CONDUCT.md).
