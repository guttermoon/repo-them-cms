// Loaded with `node --import` by `npm test`: lets a .ts module under test
// import its neighbours without extensions, and through the `@/` alias.
// See tests/resolve-ts.mjs.
import { register } from "node:module"

register("./resolve-ts.mjs", import.meta.url)
