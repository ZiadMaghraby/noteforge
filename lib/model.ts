import { z } from "zod";
export const blockTypes = ["text", "heading1", "heading2", "heading3", "bullet", "numbered", "todo", "quote", "callout", "code", "divider"] as const;
export type BlockType = typeof blockTypes[number];
export type Block = { id: string; type: BlockType; text: string; checked?: boolean };
export const statuses = ["Not started", "In progress", "Done"] as const;
export const priorities = ["Low", "Medium", "High"] as const;
export type Row = { id: string; title: string; status: typeof statuses[number]; priority: typeof priorities[number]; assignee: string; due: string; notes: string };
export type Page = { id: string; parentId: string | null; title: string; icon: string; kind: "document" | "database"; cover: "none" | "blue" | "violet" | "slate"; favorite: boolean; archived: boolean; blocks: Block[]; rows: Row[]; version: number; createdAt: string; updatedAt: string };
export type Workspace = { name: string; user: { name: string; email: string }; pages: Page[] };
const blockSchema = z.object({ id: z.string().min(1).max(100), type: z.enum(blockTypes), text: z.string().max(30000), checked: z.boolean().optional() }).strict();
const rowSchema = z.object({ id: z.string().min(1).max(100), title: z.string().max(1000), status: z.enum(statuses), priority: z.enum(priorities), assignee: z.string().max(200), due: z.string().refine(v => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v)), notes: z.string().max(10000) }).strict();
const distinctIds = <T extends { id: string }>(items: T[]) => new Set(items.map(x => x.id)).size === items.length;
export const pageFields = z.object({
  parentId: z.string().min(1).max(200).nullable(), title: z.string().max(500), icon: z.string().min(1).max(20),
  kind: z.enum(["document", "database"]), cover: z.enum(["none", "blue", "violet", "slate"]),
  favorite: z.boolean(), archived: z.boolean(),
  blocks: z.array(blockSchema).max(1000).refine(distinctIds, "Block IDs must be unique"),
  rows: z.array(rowSchema).max(2000).refine(distinctIds, "Row IDs must be unique"),
});
export const createPageSchema = pageFields.partial().strict();
export const updatePageSchema = pageFields.partial().extend({ version: z.number().int().positive() }).strict();
export function newBlock(type: BlockType = "text", text = ""): Block { return { id: crypto.randomUUID(), type, text, ...(type === "todo" ? { checked: false } : {}) }; }
export function newRow(): Row { return { id: crypto.randomUUID(), title: "Untitled task", status: "Not started", priority: "Medium", assignee: "", due: "", notes: "" }; }
export function pageToMarkdown(page: Page): string {
  const content = page.blocks.map(b => {
    switch (b.type) {
      case "heading1": return `# ${b.text}`;
      case "heading2": return `## ${b.text}`;
      case "heading3": return `### ${b.text}`;
      case "bullet": return `- ${b.text}`;
      case "numbered": return `1. ${b.text}`;
      case "todo": return `- [${b.checked ? "x" : " "}] ${b.text}`;
      case "quote": case "callout": return b.text.split("\n").map(x => `> ${x}`).join("\n");
      case "code": return `\`\`\`\n${b.text}\n\`\`\``;
      case "divider": return "---";
      default: return b.text;
    }
  }).join("\n\n");
  const cell = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");
  const table = page.kind === "database" ? "\n\n| Name | Status | Priority | Assignee | Due date |\n| --- | --- | --- | --- | --- |\n" + page.rows.map(r => `| ${[r.title, r.status, r.priority, r.assignee, r.due].map(cell).join(" | ")} |`).join("\n") : "";
  return `# ${page.title || "Untitled"}\n\n${content}${table}\n`;
}
export function descendants(allPages: Page[], id: string): Set<string> {
  const result = new Set([id]); let changed = true;
  while (changed) { changed = false; for (const p of allPages) if (p.parentId && result.has(p.parentId) && !result.has(p.id)) { result.add(p.id); changed = true; } }
  return result;
}
