"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, ChevronRight, ChevronDown, PanelLeftClose, PanelLeftOpen, Star, Trash2, MoreHorizontal, Download, Copy, FolderInput, FileText, Table2, LayoutTemplate, Settings2, Check, LoaderCircle, CircleAlert, X, Moon, Sun, BookOpen, RotateCcw, ArrowUpRight, Home } from "lucide-react";
import { newBlock, pageToMarkdown, descendants, type Page, type Workspace as WorkspaceData } from "@/lib/model";
import Editor from "./editor";
import Database from "./database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = data && typeof data === "object" && "error" in data ? data.error : null;
    throw new Error(typeof error === "string" ? error : "Something went wrong.");
  }
  return data as T;
}
function download(name: string, content: string, type = "text/markdown") { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

export default function Workspace() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [activeId, setActiveId] = useState(""); const [loadingError, setLoadingError] = useState("");
  const [sidebar, setSidebar] = useState(true); const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<"search" | "templates" | "trash" | "settings" | "move" | "icon" | null>(null);
  const [query, setQuery] = useState(""); const [pageMenu, setPageMenu] = useState(false);
  const [saveStates, setSaveStates] = useState<Record<string, string>>({}); const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState("light");
  const pending = useRef(new Map<string, Partial<Page>>()); const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inFlight = useRef(new Set<string>()); const versions = useRef(new Map<string, number>()); const pagesRef = useRef<Page[]>([]);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setLoadingError(""); try { const data = await request<WorkspaceData>("/api/workspace");
      if (!alive.current) return; setWorkspace(data); pagesRef.current = data.pages; data.pages.forEach(p => versions.current.set(p.id, p.version));
      const hash = decodeURIComponent(location.hash.slice(1)); const initial = data.pages.find(p => p.id === hash && !p.archived) ?? data.pages.find(p => p.id.endsWith(":home") && !p.archived) ?? data.pages.find(p => !p.archived);
      setActiveId(initial?.id ?? ""); setExpanded(new Set(data.pages.filter(p => !p.parentId).map(p => p.id)));
    } catch (error) { setLoadingError((error as Error).message); }
  }, []);
  useEffect(() => { alive.current = true; void load(); const preferred = localStorage.getItem("noteforge-theme") ?? "light"; setTheme(preferred); document.documentElement.dataset.theme = preferred; if (window.innerWidth < 760) setSidebar(false); return () => { alive.current = false; }; }, [load]);
  useEffect(() => { const onHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (pagesRef.current.some(p => p.id === id)) setActiveId(id); }; window.addEventListener("hashchange", onHash); return () => window.removeEventListener("hashchange", onHash); }, []);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setModal("search"); setQuery(""); } if (event.key === "Escape") { setPageMenu(false); } }; document.addEventListener("keydown", handler); return () => document.removeEventListener("keydown", handler); }, []);
  useEffect(() => { const protect = (e: BeforeUnloadEvent) => { if (pending.current.size || inFlight.current.size) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect); }, []);
  const visible = workspace?.pages.filter(p => !p.archived && !hasArchivedParent(p, workspace.pages)) ?? [];
  const active = workspace?.pages.find(p => p.id === activeId);
  const navigate = useCallback((id: string) => { setActiveId(id); location.hash = encodeURIComponent(id); setPageMenu(false); setModal(null); if (window.innerWidth < 760) setSidebar(false); }, []);

  const flush = useCallback(async (id: string) => {
    if (inFlight.current.has(id) || !pending.current.has(id)) return;
    const changes = pending.current.get(id)!; pending.current.delete(id); inFlight.current.add(id); setSaveStates(s => ({ ...s, [id]: "saving" }));
    let succeeded = false;
    try {
      const saved = await request<Page>(`/api/pages/${encodeURIComponent(id)}`, "PATCH", { ...changes, version: versions.current.get(id) ?? 1 });
      succeeded = true; versions.current.set(id, saved.version);
      setWorkspace(w => { if (!w) return w; const pages = w.pages.map(p => p.id === id ? { ...p, version: saved.version, updatedAt: saved.updatedAt } : p); pagesRef.current = pages; return { ...w, pages }; });
      setSaveErrors(s => ({ ...s, [id]: "" })); setSaveStates(s => ({ ...s, [id]: pending.current.has(id) ? "pending" : "saved" }));
    } catch (error) {
      pending.current.set(id, { ...changes, ...pending.current.get(id) }); setSaveStates(s => ({ ...s, [id]: "error" })); setSaveErrors(s => ({ ...s, [id]: (error as Error).message }));
    } finally { inFlight.current.delete(id); }
    // A queued edit must follow the completed request using its new version.
    if (succeeded && pending.current.has(id)) void flush(id);
  }, []);

  // Keep failed saves pending, but do not retry conflicts automatically.
  const flushSafe = useRef(flush); flushSafe.current = flush;
  const update = useCallback((id: string, changes: Partial<Page>) => {
    setWorkspace(w => { if (!w) return w; const pages = w.pages.map(p => p.id === id ? { ...p, ...changes } : p); pagesRef.current = pages; return { ...w, pages }; });
    pending.current.set(id, { ...pending.current.get(id), ...changes }); setSaveStates(s => ({ ...s, [id]: "pending" }));
    const timer = timers.current.get(id); if (timer) clearTimeout(timer);
    timers.current.set(id, setTimeout(() => void flushSafe.current(id), 650));
  }, []);
  async function create(fields: Partial<Page> = {}) {
    try { const page = await request<Page>("/api/pages", "POST", fields); versions.current.set(page.id, page.version);
      setWorkspace(w => { if (!w) return w; const pages = [...w.pages, page]; pagesRef.current = pages; return { ...w, pages }; });
      if (page.parentId) setExpanded(s => new Set([...s, page.parentId!])); navigate(page.id);
    } catch (error) { setLoadingError((error as Error).message); }
  }
  const createRef = useRef(create); createRef.current = create;
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context) return; const lifecycle = new AbortController();
    Promise.resolve(context.registerTool({ name: "list_pages", description: "List your active workspace pages.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: (input: unknown) => { if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 0) throw new Error("Expected an empty object."); return pagesRef.current.filter(p => !p.archived).map(p => ({ id: p.id, title: p.title, kind: p.kind })); } }, { signal: lifecycle.signal })).catch(console.error);
    return () => lifecycle.abort();
  }, []);

  function archive(page: Page) { update(page.id, { archived: true }); setPageMenu(false); const next = visible.find(p => !descendants(workspace!.pages, page.id).has(p.id)); if (next) navigate(next.id); else setActiveId(""); }
  function toggleTheme() { const next = theme === "light" ? "dark" : "light"; setTheme(next); localStorage.setItem("noteforge-theme", next); document.documentElement.dataset.theme = next; }
  function tree(parentId: string | null, depth = 0): React.ReactNode { if (depth > 50) return null; return visible.filter(p => p.parentId === parentId).map(p => {
    const children = visible.some(c => c.parentId === p.id); const open = expanded.has(p.id);
    return <div key={p.id}><div className={`tree-row ${activeId === p.id ? "selected" : ""}`} style={{ paddingLeft: `${12 + depth * 16}px` }}>
      <button className={`tree-toggle ${children ? "" : "invisible"}`} aria-label={`${open ? "Collapse" : "Expand"} ${p.title}`} onClick={() => setExpanded(s => { const next = new Set(s); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
      <button className="tree-link" onClick={() => navigate(p.id)}><span>{p.icon}</span><span>{p.title || "Untitled"}</span></button>
      <button className="tree-add icon-button" title="Add nested page" aria-label={`Add page inside ${p.title}`} onClick={() => void create({ parentId: p.id })}><Plus size={14} /></button>
    </div>{children && open && tree(p.id, depth + 1)}</div>;
  }); }
  const crumbs: Page[] = []; let ancestor = active?.parentId; const seen = new Set<string>(); while (ancestor && !seen.has(ancestor)) { seen.add(ancestor); const p = workspace?.pages.find(p => p.id === ancestor); if (!p) break; crumbs.unshift(p); ancestor = p.parentId; }

  if (!workspace) return <div className="loading-screen"><div className="brand-mark">N</div><h1>Noteforge</h1>{loadingError ? <><p role="alert">{loadingError}</p><button className="primary" onClick={() => void load()}>Try again</button><a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in with ChatGPT</a></> : <><LoaderCircle className="spin" /><p>Opening your workspace…</p></>}</div>;
  return <div className={`workspace ${sidebar ? "sidebar-open" : ""}`}>
    {sidebar && <button className="mobile-backdrop" aria-label="Close sidebar" onClick={() => setSidebar(false)} />}
    <aside className="sidebar" aria-label="Workspace navigation">
      <div className="workspace-header"><div className="brand-mark">N</div><span>Noteforge</span><button className="icon-button collapse" aria-label="Close sidebar" onClick={() => setSidebar(false)}><PanelLeftClose size={18} /></button></div>
      <div className="workspace-name"><span className="avatar">{workspace.user.name[0].toUpperCase()}</span><span>{workspace.name}</span><ChevronDown size={14} /></div>
      <nav className="primary-nav"><button onClick={() => { setQuery(""); setModal("search"); }}><Search size={17} />Search<span className="shortcut">Ctrl K</span></button><button onClick={() => { const home = visible.find(p => p.id.endsWith(":home")); if (home) navigate(home.id); else void create({ title: "Home" }); }}><Home size={17} />Home</button></nav>
      <div className="sidebar-section"><span>Favorites</span></div>
      <div className="favorites">{visible.filter(p => p.favorite).map(p => <button key={p.id} className={activeId === p.id ? "selected" : ""} onClick={() => navigate(p.id)}><span>{p.icon}</span><span>{p.title || "Untitled"}</span></button>)}{!visible.some(p => p.favorite) && <p className="side-hint">Star a page to keep it here.</p>}</div>
      <div className="sidebar-section"><span>Private pages</span><button className="icon-button" aria-label="Add page" onClick={() => void create()}><Plus size={15} /></button></div>
      <div className="page-tree">{tree(null)}<button className="add-page" onClick={() => void create()}><Plus size={16} />Add a page</button></div>
      <div className="sidebar-bottom"><button onClick={() => setModal("templates")}><LayoutTemplate size={17} />Templates</button><button onClick={() => setModal("trash")}><Trash2 size={17} />Trash</button><button onClick={() => setModal("settings")}><Settings2 size={17} />Settings</button><div className="sidebar-footer"><span>Made for your next idea.</span><span className="version-tag">v0.1</span></div></div>
    </aside>
    <main className="main-pane">
      <header className="topbar"><div className="breadcrumbs">{!sidebar && <button className="icon-button" aria-label="Open sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen size={18} /></button>}{crumbs.map(p => <span key={p.id}><button onClick={() => navigate(p.id)}>{p.icon} {p.title || "Untitled"}</button><span className="crumb-separator">/</span></span>)}{active && <span className="current-crumb">{active.icon} {active.title || "Untitled"}</span>}</div>
      {active && <div className="topbar-actions"><span className={`save-status ${saveStates[active.id] === "error" ? "error" : ""}`} role="status">{saveStates[active.id] === "saving" || saveStates[active.id] === "pending" ? <><LoaderCircle size={13} className="spin" />Saving…</> : saveStates[active.id] === "error" ? <><CircleAlert size={13} />Not saved</> : <><Check size={13} />All changes saved</>}</span><button className={`icon-button ${active.favorite ? "is-starred" : ""}`} aria-label={active.favorite ? "Remove from favorites" : "Add to favorites"} onClick={() => update(active.id, { favorite: !active.favorite })}><Star size={18} fill={active.favorite ? "currentColor" : "none"} /></button><button className="icon-button" aria-label="Page actions" aria-expanded={pageMenu} onClick={() => setPageMenu(!pageMenu)}><MoreHorizontal size={20} /></button></div>}
      {pageMenu && active && <div className="page-menu"><button onClick={() => { download(`${active.title || "Untitled"}.md`, pageToMarkdown(active)); setPageMenu(false); }}><Download size={16} />Export as Markdown</button><button onClick={() => void create({ title: `${active.title || "Untitled"} (copy)`, icon: active.icon, kind: active.kind, parentId: active.parentId, cover: active.cover, blocks: active.blocks.map(b => ({ ...b, id: crypto.randomUUID() })), rows: active.rows.map(r => ({ ...r, id: crypto.randomUUID() })) })}><Copy size={16} />Duplicate page</button><button onClick={() => { setModal("move"); setPageMenu(false); }}><FolderInput size={16} />Move to…</button><button onClick={() => void create({ parentId: active.id })}><Plus size={16} />Add a nested page</button><div className="menu-separator" /><button className="danger" onClick={() => archive(active)}><Trash2 size={16} />Move to trash</button></div>}
      </header>
      {loadingError && <div className="error-banner" role="alert">{loadingError}<button aria-label="Dismiss error" onClick={() => setLoadingError("")}><X size={16} /></button></div>}
      {active && saveErrors[active.id] && <div className="error-banner" role="alert"><span>{saveErrors[active.id]}</span><button onClick={() => void flush(active.id)}>Retry save</button><button onClick={() => download(`${active.title || "Draft"}.md`, pageToMarkdown(active))}>Export draft</button></div>}
      {active && !active.archived ? <div className="document-scroll" key={active.id}>
        {active.cover !== "none" && <div className={`page-cover cover-${active.cover}`}><span className="cover-label">A space to think. A place to build.</span><div className="cover-actions"><button onClick={() => update(active.id, { cover: active.cover === "blue" ? "violet" : active.cover === "violet" ? "slate" : "blue" })}>Change cover</button><button onClick={() => update(active.id, { cover: "none" })}>Remove</button></div></div>}
        <article className={`document ${active.kind === "database" ? "wide" : ""} ${active.cover !== "none" ? "with-cover" : ""}`}>
          <button className="page-icon" title="Change icon" aria-label="Change page icon" onClick={() => setModal("icon")}>{active.icon}</button>
          <div className="document-controls">{active.cover === "none" && <button onClick={() => update(active.id, { cover: "blue" })}>Add cover</button>}<span>{active.kind === "database" ? "Database" : "Page"}</span></div>
          <input className="page-title" aria-label="Page title" value={active.title} placeholder="Untitled" onChange={e => update(active.id, { title: e.target.value })} />
          <div className="page-meta"><span className="avatar small">{workspace.user.name[0].toUpperCase()}</span><span>{workspace.user.name}</span><span className="meta-dot">·</span><span>Private workspace</span></div>
          {active.kind === "database" ? <Database page={active} onChange={rows => update(active.id, { rows })} /> : <Editor page={active} onChange={blocks => update(active.id, { blocks })} />}
          {visible.some(p => p.parentId === active.id) && <div className="child-pages">{visible.filter(p => p.parentId === active.id).map(p => <button key={p.id} onClick={() => navigate(p.id)}><span>{p.icon}</span><span>{p.title || "Untitled"}</span><ArrowUpRight size={16} /></button>)}</div>}
          <div className="document-footer"><BookOpen size={14} /><span>{active.kind === "database" ? `${active.rows.length} items` : `${active.blocks.map(b => b.text).join(" ").trim().split(/\s+/).filter(Boolean).length} words`}</span><span>·</span><span>{active.blocks.length} blocks</span></div>
        </article>
      </div> : <div className="empty-workspace"><FileText size={40} /><h1>A new idea starts here</h1><p>Create a page to get started.</p><button className="primary" onClick={() => void create()}><Plus size={16} />New page</button></div>}
    </main>
    <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null); }}><DialogContent className="nf-dialog"><DialogHeader><DialogTitle>{modal === "search" ? "Search your workspace" : modal === "templates" ? "Start with a template" : modal === "trash" ? "Trash" : modal === "settings" ? "Workspace settings" : modal === "move" ? "Move page" : "Choose an icon"}</DialogTitle><DialogDescription>{modal === "search" ? "Find pages and the ideas inside them." : modal === "templates" ? "A little structure to get you going." : modal === "trash" ? "Restore a page whenever you need it." : modal === "move" ? "Choose where this page belongs." : modal === "icon" ? "Give this page a little personality." : "Make this workspace feel like yours."}</DialogDescription></DialogHeader>
      {modal === "search" && <><input autoFocus className="search-input" placeholder="Search pages and content…" aria-label="Search pages and content" value={query} onChange={e => setQuery(e.target.value)} /><div className="search-results">{visible.filter(p => `${p.title} ${p.blocks.map(b => b.text).join(" ")} ${p.rows.map(r => r.title).join(" ")}`.toLowerCase().includes(query.toLowerCase())).map(p => <button key={p.id} onClick={() => navigate(p.id)}><span>{p.icon}</span><div><strong>{p.title || "Untitled"}</strong><span>{p.kind === "database" ? `${p.rows.length} items` : p.blocks.find(b => b.text)?.text.slice(0, 90)}</span></div><ChevronRight size={16} /></button>)}{visible.every(p => !`${p.title} ${p.blocks.map(b => b.text).join(" ")} ${p.rows.map(r => r.title).join(" ")}`.toLowerCase().includes(query.toLowerCase())) && <p className="dialog-empty">No pages match “{query}”.</p>}</div></>}
      {modal === "templates" && <div className="template-grid">{[{ icon: "📄", title: "Blank page", description: "Room for a new idea", kind: "document" }, { icon: "💬", title: "Meeting notes", description: "Agenda, decisions, and next steps", kind: "document" }, { icon: "📋", title: "Project tracker", description: "Tasks that move your work forward", kind: "database" }, { icon: "📓", title: "Daily journal", description: "A moment to reflect", kind: "document" }].map(t => <button key={t.title} onClick={() => void create({ title: t.title, icon: t.icon, kind: t.kind as Page["kind"], blocks: t.title === "Meeting notes" ? [newBlock("heading2", "Agenda"), newBlock("bullet"), newBlock("heading2", "Decisions"), newBlock("text"), newBlock("heading2", "Action items"), newBlock("todo")] : t.title === "Daily journal" ? [newBlock("heading2", "Today I’m thinking about…"), newBlock(), newBlock("heading2", "One thing I’m grateful for"), newBlock()] : [newBlock()] })}><span>{t.icon}</span><strong>{t.title}</strong><small>{t.description}</small></button>)}</div>}
      {modal === "trash" && <div className="trash-list">{workspace.pages.filter(p => p.archived).map(p => <div key={p.id}><span>{p.icon} {p.title || "Untitled"}</span><button onClick={() => { update(p.id, { archived: false, parentId: p.parentId && hasArchivedParent(p, workspace.pages) ? null : p.parentId }); navigate(p.id); }}><RotateCcw size={15} />Restore</button></div>)}{!workspace.pages.some(p => p.archived) && <p className="dialog-empty">Nothing in the trash. A clean slate.</p>}</div>}
      {modal === "settings" && <div className="settings-panel"><div><span>Appearance</span><button onClick={toggleTheme}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}{theme === "light" ? "Switch to dark" : "Switch to light"}</button></div><div><span>Your account</span><span>{workspace.user.email}</span></div><div><span>Workspace backup</span><button onClick={() => download("noteforge-workspace.json", JSON.stringify(workspace, null, 2), "application/json")}><Download size={16} />Export all pages</button></div><p className="settings-note">Noteforge v0.1 · Your pages are saved in workspace storage.</p></div>}
      {modal === "move" && active && <div className="move-list"><button onClick={() => { update(active.id, { parentId: null }); setModal(null); }}><Home size={17} />Workspace root</button>{visible.filter(p => !descendants(workspace.pages, active.id).has(p.id)).map(p => <button key={p.id} onClick={() => { update(active.id, { parentId: p.id }); setExpanded(s => new Set([...s, p.id])); setModal(null); }}><span>{p.icon}</span>{p.title || "Untitled"}</button>)}</div>}
      {modal === "icon" && active && <div className="icon-picker">{["📄", "📝", "📋", "📂", "📓", "💬", "📐", "✳️", "💡", "🚀", "🎯", "🌱", "🧠", "🎨", "📚", "🔖", "🛠️", "🌍", "⭐", "🏠", "🔬", "🎵", "🗓️", "✅"].map(icon => <button key={icon} aria-label={`Use ${icon} icon`} onClick={() => { update(active.id, { icon }); setModal(null); }}>{icon}</button>)}</div>}
    </DialogContent></Dialog>
  </div>;
}
function hasArchivedParent(page: Page, pages: Page[]): boolean { const seen = new Set<string>(); let parent = page.parentId; while (parent && !seen.has(parent)) { seen.add(parent); const p = pages.find(x => x.id === parent); if (!p) return false; if (p.archived) return true; parent = p.parentId; } return false; }

