import type { Page, Block, Row } from "./model";
export function starterPages(ownerId: string): Page[] {
  const now = new Date().toISOString();
  const make = (slug: string, title: string, icon: string, fields: Partial<Page> = {}): Page => ({ id: `${ownerId}:${slug}`, parentId: null, title, icon, kind: "document", cover: "none", favorite: false, archived: false, blocks: [], rows: [], version: 1, createdAt: now, updatedAt: now, ...fields });
  const b = (id: string, type: Block["type"], text: string, checked = false): Block => ({ id, type, text, ...(type === "todo" ? { checked } : {}) });
  const r = (id: string, title: string, status: Row["status"], priority: Row["priority"], assignee: string): Row => ({ id, title, status, priority, assignee, due: "", notes: "" });
  return [
    make("home", "Welcome to Noteforge", "✳️", { cover: "blue", favorite: true, blocks: [
      b("h-intro", "callout", "A little space for your biggest ideas. Everything here is editable — make yourself at home."),
      b("h-1", "heading2", "Your work, connected"), b("h-2", "text", "Bring your notes, plans, and projects together. Start with a page, write a thought, and let it grow."),
      b("h-3", "heading2", "Try a few things"), b("h-4", "todo", "Write your first note"), b("h-5", "todo", "Create a page inside another page"), b("h-6", "todo", "Switch the Project tracker from table to board"),
      b("h-7", "divider", ""), b("h-8", "heading2", "A blank page is a good beginning"), b("h-9", "text", "Click any line to edit. Press Enter for a new block, or type / to choose a heading, checklist, quote, and more."), b("h-10", "quote", "Great things are done by a series of small things brought together."),
    ] }),
    make("notes", "Quick notes", "📝", { favorite: true, blocks: [b("n1", "heading2", "On my mind"), b("n2", "text", "A place to capture ideas before they disappear."), b("n3", "bullet", "What should we explore next?"), b("n4", "text", "")] }),
    make("projects", "Projects", "📂", { blocks: [b("p1", "heading2", "Make room for good work"), b("p2", "text", "Keep a page for each project. Add context, collect decisions, and break work into small steps.")] }),
    make("tracker", "Project tracker", "📋", { parentId: `${ownerId}:projects`, kind: "database", favorite: true, rows: [r("r1", "Define the product vision", "Done", "High", "Me"), r("r2", "Build the first workspace", "In progress", "High", "Me"), r("r3", "Gather feedback on the editor", "Not started", "Medium", ""), r("r4", "Design database templates", "Not started", "Medium", ""), r("r5", "Write a getting-started guide", "In progress", "Low", "Me")] }),
    make("brief", "Product brief", "📐", { parentId: `${ownerId}:projects`, blocks: [b("b1", "heading2", "The idea"), b("b2", "text", "A calm, connected workspace for thinking and doing."), b("b3", "heading2", "What matters"), b("b4", "bullet", "Writing should feel effortless."), b("b5", "bullet", "Pages and projects should stay connected."), b("b6", "bullet", "Your work should always be yours to export.")] }),
    make("meeting", "Meeting notes", "💬", { blocks: [b("m1", "heading2", "Agenda"), b("m2", "bullet", "What did we learn?"), b("m3", "bullet", "What is the next small step?"), b("m4", "heading2", "Decisions"), b("m5", "text", ""), b("m6", "heading2", "Action items"), b("m7", "todo", "Add a follow-up")] }),
  ];
}
