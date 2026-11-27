/**
 * The site's lines in PostHog Logs (instrumentation.ts sends them). Each one
 * is written here, on purpose, and says what happened, never who: no
 * address, name, message or IP address, because route handlers log no
 * personal details. A route awaits the flush, which is instant when logs
 * are off and gives up after two seconds when PostHog is slow.
 */
import { SeverityNumber } from "@opentelemetry/api-logs"

import { loggerProvider } from "@/instrumentation"

const logger = loggerProvider.getLogger("posthog-exporter")

export function logNewsletterSubscriptionAccepted(status: "subscribed" | "pending") {
  logger.emit({
    body: "Newsletter subscription accepted",
    severityNumber: SeverityNumber.INFO,
    attributes: { endpoint: "/api/subscribe", status },
  })
}

export function logContactMessageDelivered(enquiryType: string) {
  logger.emit({
    body: "Contact message delivered",
    severityNumber: SeverityNumber.INFO,
    attributes: { endpoint: "/api/contact", enquiry_type: enquiryType },
  })
}

export async function flushPostHogLogs() {
  await loggerProvider.forceFlush().catch(() => {})
}
