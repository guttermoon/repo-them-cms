# Getting help

## Setting it up

[Set it up](README.md#set-it-up) takes a new site from nothing to live in
about ten minutes, with no terminal. Every part of the site has a document
of its own ([the list](README.md#documentation)).

## Something isn't working

- **The site shows nothing, or old words.** Check the row is ticked
  Published: an unticked row, or a ticked one left blank, shows nothing.
  From a checkout of your copy, with its two settings in `.env.local`,
  `npm run notion:check` checks the connection and the database's shape,
  and names every slot with no row.
- **A page, a form or the shop misbehaves.** Open an issue with the
  [bug form](https://github.com/guttermoon/repo-them-cms/issues/new/choose).
- **The deploy fails.** Open an issue with Vercel's build log, its tokens
  and addresses taken out.

## A security problem

Never in an issue: [SECURITY.md](SECURITY.md) says where.

## Notion, Vercel, your email platform or your shop

A problem with one of the accounts themselves goes to that service.

## Have it done for you

Megan Aileen Williams, who made REPO THEM, sets it up for you, builds whole
sites on Notion and keeps them up to date: write to
[hello@denot.app](mailto:hello@denot.app), or see
[denot.app](https://denot.app).
