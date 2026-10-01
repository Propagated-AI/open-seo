import { timingSafeEqual } from "node:crypto";

export async function handleRenderMaintenance(
  request: Request,
  secret: unknown,
  run: () => Promise<unknown>,
): Promise<Response> {
  const provided = request.headers.get("x-render-maintenance-key") ?? "";
  if (
    request.method !== "POST" ||
    typeof secret !== "string" ||
    secret.length < 32 ||
    Buffer.byteLength(provided) !== Buffer.byteLength(secret) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(secret))
  ) {
    return new Response("Not found", { status: 404 });
  }
  await run();
  return Response.json({ ok: true, completedAt: new Date().toISOString() });
}
