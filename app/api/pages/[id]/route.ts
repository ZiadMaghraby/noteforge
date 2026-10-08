import { updatePageSchema } from "@/lib/model";
import { api, identity, database, getPage, assertParent, requestBody, ApiError, assertSameOrigin } from "@/lib/server";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) { return api(async () => {
  assertSameOrigin(request); const user = await identity(); const { id } = await context.params;
  const parsed = updatePageSchema.safeParse(await requestBody(request));
  if (!parsed.success) throw new ApiError(400, "Some page fields are invalid.");
  const current = await getPage(user.userId, id);
  if (parsed.data.parentId !== undefined) await assertParent(user.userId, parsed.data.parentId, id);
  const p = { ...current, ...parsed.data, updatedAt: new Date().toISOString(), version: parsed.data.version + 1 };
  const result = await database().prepare("UPDATE pages SET parent_id=?,title=?,icon=?,kind=?,cover=?,favorite=?,archived=?,blocks=?,rows=?,updated_at=?,version=version+1 WHERE id=? AND owner_id=? AND version=?")
    .bind(p.parentId, p.title, p.icon, p.kind, p.cover, +p.favorite, +p.archived, JSON.stringify(p.blocks), JSON.stringify(p.rows), p.updatedAt, id, user.userId, parsed.data.version).run();
  if (!result.meta.changes) return Response.json({ error: "This page changed in another window. Export your draft, then reload to get the latest version.", current: await getPage(user.userId, id) }, { status: 409 });
  return Response.json(p);
}); }
