import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { Page } from "./model";
import { starterPages } from "./seed";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export function database(): D1Database { if (!env.DB) throw new ApiError(503, "Your workspace storage is unavailable. Please try again."); return env.DB; }
export async function identity() { const user = await getChatGPTUser(); if (!user) throw new ApiError(401, "Sign in to open your workspace."); return user; }
export function decodePage(row: Record<string, unknown>): Page {
  return { id: String(row.id), parentId: row.parent_id ? String(row.parent_id) : null, title: String(row.title), icon: String(row.icon), kind: row.kind as Page["kind"], cover: row.cover as Page["cover"], favorite: Boolean(row.favorite), archived: Boolean(row.archived), blocks: JSON.parse(String(row.blocks)), rows: JSON.parse(String(row.rows)), version: Number(row.version), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
export async function getPage(ownerId: string, id: string) {
  const row = await database().prepare("SELECT * FROM pages WHERE owner_id = ? AND id = ?").bind(ownerId, id).first<Record<string, unknown>>();
  if (!row) throw new ApiError(404, "This page does not exist."); return decodePage(row);
}
export function insertPage(db: D1Database, ownerId: string, p: Page) {
  return db.prepare("INSERT OR IGNORE INTO pages (id,owner_id,parent_id,title,icon,kind,cover,favorite,archived,blocks,rows,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(p.id, ownerId, p.parentId, p.title, p.icon, p.kind, p.cover, +p.favorite, +p.archived, JSON.stringify(p.blocks), JSON.stringify(p.rows), p.version, p.createdAt, p.updatedAt);
}
export async function initialize(ownerId: string) {
  const db = database(); const existing = await db.prepare("SELECT owner_id FROM workspaces WHERE owner_id = ?").bind(ownerId).first();
  if (existing) return;
  await db.batch([db.prepare("INSERT OR IGNORE INTO workspaces (owner_id,name,created_at) VALUES (?,?,?)").bind(ownerId, "My workspace", new Date().toISOString()), ...starterPages(ownerId).map(p => insertPage(db, ownerId, p))]);
}
export async function assertParent(ownerId: string, parentId: string | null, pageId?: string) {
  const visited = new Set<string>(); let cursor = parentId;
  while (cursor) {
    if (cursor === pageId || visited.has(cursor)) throw new ApiError(400, "A page cannot be moved inside itself.");
    visited.add(cursor); const parent = await getPage(ownerId, cursor);
    if (parent.archived) throw new ApiError(400, "Restore the parent page first."); cursor = parent.parentId;
  }
}
export async function requestBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new ApiError(415, "Use JSON for this request.");
  const raw = await request.text(); if (raw.length > 2_000_000) throw new ApiError(413, "This page is too large to save.");
  try { return JSON.parse(raw); } catch { throw new ApiError(400, "The request contains invalid JSON."); }
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin"); if (origin && origin !== new URL(request.url).origin) throw new ApiError(403, "This request came from a different website.");
}
export async function api(action: () => Promise<Response>) {
  try { return await action(); } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Workspace request failed", error); return Response.json({ error: "Your workspace could not be saved or loaded. Your unsaved changes are still here." }, { status: 503 });
  }
}
