import type React from "react"

import { CopyText } from "@/components/ui/copy"
import { highlight } from "@/lib/highlight"

/**
 * A Notion code block: the language at the top, a copy button, and the code,
 * highlighted on the server (lib/highlight.ts) so the colours arrive as
 * inline styles and no script or stylesheet reaches the reader.
 */

type CodeProps = {
  code: string
  language: string
  caption?: React.ReactNode
  /** the copy button's words: `codeLabels()` (components/notion/context.ts) */
  labels: { copy: string; copied: string; failed: string }
}

/** A Notion code block: highlighted on the server, then drawn by CodeFigure. */
export async function CodeBlock(props: CodeProps) {
  return <CodeFigure {...props} html={await highlight(props.code, props.language)} />
}

/**
 * The code block's markup: the language at the top, a copy button, the
 * code, highlighted when `html` is given and plain when it is not. Kept
 * apart from the highlighting so it renders anywhere a promise cannot.
 */
export function CodeFigure({ code, language, caption, labels, html }: CodeProps & { html: string | null }) {
  const name = language && language !== "plain text" ? language : ""
  return (
    <figure className="n-code group">
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-3 pt-1.5">
        <span className="text-fine capitalize text-sub">{name}</span>
        <CopyText
          text={code}
          label={labels.copy}
          copied={labels.copied}
          failed={labels.failed}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        />
      </div>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre>
          <code>{code}</code>
        </pre>
      )}
      {caption ? <figcaption className="n-caption px-2 pb-2">{caption}</figcaption> : null}
    </figure>
  )
}
