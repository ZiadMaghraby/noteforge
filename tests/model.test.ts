import { test } from "node:test";
import assert from "node:assert/strict";
import { createPageSchema, updatePageSchema, descendants, pageToMarkdown, newBlock } from "../lib/model.ts";
import { starterPages } from "../lib/seed.ts";

test("validation rejects unknown fields, duplicate block IDs, and invalid version numbers", () => {
  assert.equal(createPageSchema.safeParse({ ownerId: "another-user" }).success, false);
  const block = newBlock(); assert.equal(createPageSchema.safeParse({ blocks: [block, block] }).success, false);
  assert.equal(updatePageSchema.safeParse({ version: 0 }).success, false);
  assert.equal(updatePageSchema.safeParse({ version: 1, title: "A real edit" }).success, true);
});
test("subtree traversal includes nested pages and terminates on malformed cycles", () => {
  const pages = starterPages("test-owner");
  assert.deepEqual([...descendants(pages, "test-owner:projects")].sort(), ["test-owner:brief", "test-owner:projects", "test-owner:tracker"]);
  pages[0].parentId = pages[1].id; pages[1].parentId = pages[0].id;
  assert.equal(descendants(pages, pages[0].id).size, 2);
});
test("Markdown preserves checked tasks, quote lines, and table delimiters", () => {
  const page = starterPages("test-owner")[0]; page.kind = "database";
  page.blocks = [{ id: "todo", type: "todo", checked: true, text: "Ship it" }, { id: "quote", type: "quote", text: "First line\nSecond line" }];
  page.rows = [{ id: "row", title: "A | B", status: "Done", priority: "High", assignee: "Me", due: "", notes: "" }];
  const markdown = pageToMarkdown(page);
  assert.match(markdown, /- \[x\] Ship it/); assert.match(markdown, /> First line\n> Second line/); assert.match(markdown, /A \\\| B/);
});
