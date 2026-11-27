/**
 * PostHog Logs, from the server: the few lines lib/posthog-logs.ts writes
 * (a contact message delivered, a sign-up accepted), each saying what
 * happened and never who. Sent over OpenTelemetry to POSTHOG_LOGS_ENDPOINT
 * with the project key; with either missing, the logger has nowhere to send
 * and every line is dropped, so the site runs the same with no settings.
 *
 * Nothing here reaches a reader's browser, and no line carries an address,
 * a name or an IP address (route handlers log no personal details).
 */
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs"

import { analyticsKey } from "@/lib/analytics"

const key = analyticsKey(process.env.NEXT_PUBLIC_POSTHOG_KEY)
const endpoint = process.env.POSTHOG_LOGS_ENDPOINT?.trim() || undefined

/** Where the lines go, or nowhere: both the key and the address are set. */
export const logsOn = Boolean(key && endpoint)

export const loggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({ "service.name": "repo-them" }),
  processors:
    key && endpoint
      ? [
          new BatchLogRecordProcessor({
            exporter: new OTLPLogExporter({
              url: endpoint,
              headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
              timeoutMillis: 2_000,
            }),
            exportTimeoutMillis: 2_000,
          }),
        ]
      : [],
})

/** Next's instrumentation hook: the provider above is made on import. */
export function register() {}
