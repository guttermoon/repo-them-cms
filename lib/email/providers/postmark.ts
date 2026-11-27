/**
 * Postmark: the contact form only (Postmark is transactional email; pair it
 * with another platform for the mailing list).
 */
import { call, errorText, failed, mailbox } from "../http"
import type { Provider } from "../types"

export const postmark: Provider = {
  id: "postmark",
  name: "Postmark",
  privacyUrl: "https://postmarkapp.com/eu-privacy",
  missing: (env) => ({
    subscribe: "Postmark keeps no mailing list: set EMAIL_PROVIDER to another platform for sign-ups",
    send: env.POSTMARK_SERVER_TOKEN?.trim() ? null : "POSTMARK_SERVER_TOKEN is not set",
  }),
  async send(message, env) {
    try {
      const { ok, status, data } = await call("https://api.postmarkapp.com/email", {
        headers: { "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN!.trim() },
        body: {
          From: mailbox(message.from, message.fromName),
          To: message.to,
          Subject: message.subject,
          TextBody: message.text,
          ...(message.html ? { HtmlBody: message.html } : {}),
          ...(message.replyTo ? { ReplyTo: mailbox(message.replyTo.email, message.replyTo.name) } : {}),
          MessageStream: env.POSTMARK_MESSAGE_STREAM?.trim() || "outbound",
        },
      })
      return ok ? { status: "sent" } : { status: "error", message: errorText("Postmark", status, { ...data, message: data.Message }) }
    } catch (error) {
      return failed(error)
    }
  },
}
