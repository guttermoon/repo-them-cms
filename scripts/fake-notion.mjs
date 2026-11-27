// A stand-in Notion API serving the starter content (lib/demo/content.ts),
// for running the whole site end to end without a Notion account:
//
//   npm run notion:fake                    # prints the variables to use
//   NOTION_API_BASE_URL=http://127.0.0.1:4010 NOTION_TOKEN=fake \
//   NOTION_DATABASE_ID=<printed id> npm run dev
//
// Never point a live deployment at it.
import { startFakeNotion } from "../lib/demo/fake-notion.ts"

const port = Number(process.env.PORT || 4010)
const fake = await startFakeNotion({ port })
console.log(`[fake-notion] serving the starter content at ${fake.url}`)
console.log(`  NOTION_API_BASE_URL=${fake.url}`)
console.log(`  NOTION_TOKEN=fake`)
console.log(`  NOTION_DATABASE_ID=${fake.databaseId}`)
process.on("SIGINT", () => fake.close().then(() => process.exit(0)))
process.on("SIGTERM", () => fake.close().then(() => process.exit(0)))
