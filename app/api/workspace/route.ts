import { api, identity, initialize, database, decodePage } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() { return api(async () => {
  const user = await identity(); await initialize(user.userId); const db = database();
  const [workspace, pages] = await Promise.all([
    db.prepare("SELECT name FROM workspaces WHERE owner_id = ?").bind(user.userId).first<{ name: string }>(),
    db.prepare("SELECT * FROM pages WHERE owner_id = ? ORDER BY created_at, id").bind(user.userId).all<Record<string, unknown>>(),
  ]);
  return Response.json({ name: workspace?.name ?? "My workspace", user: { name: user.fullName ?? "You", email: user.email }, pages: pages.results.map(decodePage) }, { headers: { "Cache-Control": "no-store" } });
}); }
