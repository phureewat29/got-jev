/**
 * Where the heavy assets live.
 *
 * The music and the scene artwork are ~22 MB that never change between deploys, so
 * in production they are served from a CDN bucket rather than from the app. Unset
 * the variable and every path falls back to `public/`, which is what local
 * development and the tests use.
 *
 * `NEXT_PUBLIC_` matters: the music player picks tracks in the browser, so the value
 * has to survive into the client bundle, where Next inlines it at build time.
 */
const base = (process.env.NEXT_PUBLIC_CDN_URL ?? "").trim().replace(/\/+$/, "");

/**
 * Resolve an asset path. Takes a root-relative path so call sites read the same
 * whether or not a CDN is configured.
 */
export const assetUrl = (path: string): string => (base === "" ? path : `${base}${path}`);
