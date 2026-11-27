// Imports products from Shopify or Printify into the Notion database as
// Product rows. A dry run unless --write is given; new rows are unpublished
// and nothing is ever deleted (lib/commerce/import.ts says what changes).
//
//   npm run shop:import
//   npm run shop:import -- --write
//   npm run shop:import -- --from printify --write
//   npm run shop:import -- --help
import "./load-env.mjs"
import { runImport } from "../lib/commerce/import-run.ts"
import { notionWith } from "../lib/notion/client.ts"

process.exitCode = await runImport({ args: process.argv.slice(2), env: process.env, notion: notionWith })
