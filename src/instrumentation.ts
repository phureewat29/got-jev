/**
 * Build the Effect runtime at boot so bad configuration is a start-up crash rather
 * than a 500 on somebody's first turn. `register` runs in every Next runtime, and
 * the runtime module pulls in a Redis client that needs `node:net`, so the Node guard
 * is load-bearing.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ Effect }, { runtime }] = await Promise.all([
    import("effect"),
    import("@/server/runtime"),
  ]);
  await runtime.runPromise(Effect.logInfo("story-effect runtime ready"));
}
