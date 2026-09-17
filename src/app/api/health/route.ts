export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness only: it must not touch Jev, the narrator or the store. */
export function GET(): Response {
  return Response.json({ ok: true });
}
