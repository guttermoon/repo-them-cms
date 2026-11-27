import katex from "katex"

/**
 * An equation, rendered on the server to MathML, which every current
 * browser draws itself: no script, no stylesheet and no font to download.
 * A malformed expression is shown as its source rather than breaking the
 * page.
 */
function mathml(expression: string, displayMode: boolean): string {
  return katex.renderToString(expression, { output: "mathml", throwOnError: false, displayMode, strict: "ignore" })
}

export function InlineEquation({ expression }: { expression: string }) {
  return <span className="n-equation-inline" dangerouslySetInnerHTML={{ __html: mathml(expression, false) }} />
}

export function BlockEquation({ expression }: { expression: string }) {
  return (
    <div
      className="n-block relative my-1 overflow-x-auto text-center text-lead"
      dangerouslySetInnerHTML={{ __html: mathml(expression, true) }}
    />
  )
}
