import { createPageSchema, newBlock, type Page } from "@/lib/model";
import { api, identity, initialize, database, insertPage, assertParent, requestBody, ApiError, assertSameOrigin } from "@/lib/server";
export async function POST(request: Request) { return api(async () => {
  assertSameOrigin(request); const user = await identity(); const parsed = createPageSchema.safeParse(await requestBody(request));
  if (!parsed.success) throw new ApiError(400, "Some page fields are invalid.");
  await initialize(user.userId); const input = parsed.data; await assertParent(user.userId, input.parentId ?? null);
  const now = new Date().toISOString(); const page: Page = { id: crypto.randomUUID(), parentId: null, title: "Untitled", icon: "📄", kind: "document", cover: "none", favorite: false, archived: false, blocks: [newBlock()], rows: [], ...input, version: 1, createdAt: now, updatedAt: now };
  await database().batch([insertPage(database(), user.userId, page)]); return Response.json(page, { status: 201 });
}); }
