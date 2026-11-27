// The scripts read the same settings as `next dev` and `next build`: the
// shell's environment first, then .env.production.local, .env.local,
// .env.production and .env, loaded by Next's own loader so the order and
// the syntax are Next's. Nothing in a file replaces what the shell set.
//
// Import it first in a script, before anything that reads a setting.
//
// On a bare checkout with no dependencies installed (the IndexNow workflow,
// which runs one script and installs nothing) the loader is not there, and
// the environment is the shell's alone, which is all such a run has anyway.
try {
  const { default: nextEnv } = await import("@next/env")
  nextEnv.loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error })
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error
}
