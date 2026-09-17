/**
 * The music and the scene artwork are ~22 MB that never change between deploys, so
 * in production they are served from a CDN bucket rather than from the app.
 *
 * `NEXT_PUBLIC_` is load-bearing: the music player picks tracks in the browser, so
 * the value has to reach the client bundle, where Next inlines it at build time.
 */
const base = (process.env.NEXT_PUBLIC_CDN_URL ?? "").trim().replace(/\/+$/, "");

/** Takes a root-relative path, so call sites read the same with or without a CDN. */
export const assetUrl = (path: string): string => (base === "" ? path : `${base}${path}`);
