import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable("workspaces", {
  ownerId: text("owner_id").primaryKey(),
  name: text("name").notNull().default("My workspace"),
  createdAt: text("created_at").notNull(),
});
export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => workspaces.ownerId),
  parentId: text("parent_id"),
  title: text("title").notNull(),
  icon: text("icon").notNull().default("📄"),
  kind: text("kind").notNull().default("document"),
  cover: text("cover").notNull().default("none"),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  blocks: text("blocks").notNull().default("[]"),
  rows: text("rows").notNull().default("[]"),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [index("idx_pages_owner_parent").on(table.ownerId, table.parentId)]);
