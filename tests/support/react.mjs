// React as Next hands it to a server component: with `cache`, which React
// 19 exports and an older copy may not. Outside a request there is nothing
// to share, so where there is none it simply returns the function.
// tests/resolve-ts.mjs points `react` here for the Node tests.
import React from "react"

export * from "react"
export default React
export const cache = React.cache ?? ((fn) => fn)
