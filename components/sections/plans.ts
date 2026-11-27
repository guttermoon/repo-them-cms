import { livePlans } from "@/lib/content/select"
import type { SiteData } from "@/lib/notion/rows"
import { planFromEntry } from "@/lib/plans"

import type { PlanView } from "./marketing"

/**
 * The plans as the pages show them (/pricing, the homepage): the Plan rows,
 * in the editor's order. No Plan rows, no plans: the database alone decides
 * (the starter content's four are rows too, lib/demo/plans.ts), so a plan's
 * words are only ever in its row.
 */
export function sitePlans(data: SiteData): PlanView[] {
  return livePlans(data).map(planFromEntry)
}
