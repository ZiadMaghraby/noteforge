"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, GripVertical, Type, Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Lightbulb, Code2, Minus, ChevronUp, ChevronDown, Copy, Trash2, Check } from "lucide-react";
import { newBlock, type Block, type BlockType, type Page } from "@/lib/model";

const choices = [
  { type: "text", label: "Text", help: "Just start writing", icon: Type },
  { type: "heading1", label: "Heading 1", help: "A big idea", icon: Heading1 },
  { type: "heading2", label: "Heading 2", help: "A new section", icon: Heading2 },
  { type: "heading3", label: "Heading 3", help: "A small section", icon: Heading3 },
  { type: "bullet", label: "Bulleted list", help: "Keep things in order", icon: List },
  { type: "numbered", label: "Numbered list", help: "One step at a time", icon: ListOrdered },
  { type: "todo", label: "To-do list", help: "Make a little progress", icon: ListTodo },
  { type: "quote", label: "Quote", help: "Words worth keeping", icon: Quote },
  { type: "callout", label: "Callout", help: "Something to remember", icon: Lightbulb },
  { type: "code", label: "Code", help: "A snippet or two", icon: Code2 },
  { type: "divider", label: "Divider", help: "A little breathing room", icon: Minus },
] satisfies { type: BlockType; label: string; help: string; icon: typeof Type }[];

export default function Editor({ page, onChange }: { page: Page; onChange: (blocks: Block[]) => void }) {
  const [menu, setMenu] = useState<{ id: string; slash: boolean } | null>(null);
  const [menuIndex, setMenuIndex] = useState(0); const [dragId, setDragId] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLTextAreaElement>()); const focusNext = useRef<{ id: string; position?: number } | null>(null);
  const blocks = page.blocks;
  const slashText = menu?.slash ? blocks.find(b => b.id === menu.id)?.text.slice(1).toLowerCase() ?? "" : "";
  const options = choices.filter(c => !menu?.slash || c.label.toLowerCase().includes(slashText));
  useEffect(() => { for (const element of inputs.current.values()) { element.style.height = "0px"; element.style.height = `${element.scrollHeight}px`; } if (focusNext.current) { const next = focusNext.current; const input = inputs.current.get(next.id); input?.focus(); if (input) input.setSelectionRange(next.position ?? input.value.length, next.position ?? input.value.length); focusNext.current = null; } }, [blocks]);
  useEffect(() => { setMenuIndex(0); }, [slashText]);
  function edit(id: string, fields: Partial<Block>) { onChange(blocks.map(b => b.id === id ? { ...b, ...fields } : b)); }
  function insert(index: number, type: BlockType = "text", text = "") { const block = newBlock(type, text); const next = [...blocks]; next.splice(index, 0, block); focusNext.current = { id: block.id, position: 0 }; onChange(next); setMenu(null); }
  function convert(type: BlockType) { if (!menu) return; const block = blocks.find(b => b.id === menu.id)!; focusNext.current = { id: block.id }; edit(block.id, { type, ...(menu.slash ? { text: "" } : {}), ...(type === "todo" ? { checked: false } : {}) }); setMenu(null); }
  function reorder(id: string, delta: number) { const index = blocks.findIndex(b => b.id === id); if (index + delta < 0 || index + delta >= blocks.length) return; const next = [...blocks]; const [block] = next.splice(index, 1); next.splice(index + delta, 0, block); onChange(next); }
  function remove(id: string) { const index = blocks.findIndex(b => b.id === id); const next = blocks.filter(b => b.id !== id); if (!next.length) next.push(newBlock()); focusNext.current = { id: next[Math.max(0, index - 1)]!.id }; onChange(next); setMenu(null); }
  function keyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) {
    if (e.nativeEvent.isComposing) return;
    if (menu?.id === block.id && menu.slash) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setMenuIndex(i => options.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : 0); return; }
      if (e.key === "Enter" && options.length) { e.preventDefault(); convert(options[menuIndex]?.type ?? options[0].type); return; }
    }
    if (e.key === "Escape") { setMenu(null); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && block.type === "todo") { e.preventDefault(); edit(block.id, { checked: !block.checked }); return; }
    if (e.key === "Enter" && !e.shiftKey && block.type !== "code") {
      e.preventDefault(); const position = e.currentTarget.selectionStart; const end = e.currentTarget.selectionEnd;
      const nextType = ["bullet", "numbered", "todo"].includes(block.type) ? block.type : "text";
      if (!block.text && nextType !== "text") { edit(block.id, { type: "text" }); return; }
      const next = [...blocks]; const created = newBlock(nextType, block.text.slice(end)); next[index] = { ...block, text: block.text.slice(0, position) }; next.splice(index + 1, 0, created); focusNext.current = { id: created.id, position: 0 }; onChange(next); setMenu(null);
    }
    if (e.key === "Backspace" && block.text === "" && blocks.length > 1) { e.preventDefault(); remove(block.id); }
    if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); reorder(block.id, -1); }
    if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); reorder(block.id, 1); }
  }
  return <div className="block-editor" aria-label="Page blocks">
    {blocks.map((block, index) => <div key={block.id} className={`block-row block-${block.type} ${dragId === block.id ? "dragging" : ""} ${block.checked ? "completed" : ""}`} onDragOver={e => { e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (!dragId || dragId === block.id) return; const next = blocks.filter(b => b.id !== dragId); const dragged = blocks.find(b => b.id === dragId)!; next.splice(next.findIndex(b => b.id === block.id), 0, dragged); onChange(next); setDragId(null); }}>
      <div className="block-tools"><button className="icon-button" title="Add block" aria-label={`Add block before block ${index + 1}`} onClick={() => insert(index)}><Plus size={15} /></button><button draggable onDragStart={e => { setDragId(block.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", block.id); }} onDragEnd={() => setDragId(null)} className="icon-button" title="Move or change block" aria-label={`Options for block ${index + 1}`} aria-expanded={menu?.id === block.id} onClick={() => { setMenu(menu?.id === block.id ? null : { id: block.id, slash: false }); setMenuIndex(0); }}><GripVertical size={16} /></button></div>
      {block.type === "todo" && <button className={`todo-box ${block.checked ? "checked" : ""}`} role="checkbox" aria-checked={!!block.checked} aria-label={`Complete ${block.text || "task"}`} onClick={() => edit(block.id, { checked: !block.checked })}>{block.checked && <Check size={12} />}</button>}
      {block.type === "bullet" && <span className="list-marker">•</span>}{block.type === "numbered" && <span className="list-marker">{blocks.slice(0, index + 1).reverse().findIndex(b => b.type !== "numbered") === -1 ? index + 1 : blocks.slice(0, index + 1).reverse().findIndex(b => b.type !== "numbered") }.</span>}
      {block.type === "callout" && <Lightbulb size={20} className="callout-icon" />}
      {block.type === "divider" ? <hr /> : <textarea ref={el => { if (el) inputs.current.set(block.id, el); else inputs.current.delete(block.id); }} rows={1} spellCheck={block.type !== "code"} aria-label={`${choices.find(c => c.type === block.type)?.label} block ${index + 1}`} value={block.text} placeholder={block.type.startsWith("heading") ? choices.find(c => c.type === block.type)?.label : block.type === "todo" ? "To-do" : block.type === "code" ? "Write some code…" : "Type something, or / for commands"} onChange={e => { const text = e.target.value; edit(block.id, { text }); if (text.startsWith("/") && !text.includes("\n")) setMenu({ id: block.id, slash: true }); else if (menu?.slash) setMenu(null); }} onFocus={() => { if (menu?.id !== block.id) setMenu(null); }} onKeyDown={e => keyDown(e, block, index)} />}
      {menu?.id === block.id && <div className="block-menu" role="dialog" aria-label="Block type"><div className="menu-heading">{menu.slash ? "Add a block" : "Turn into"}</div><div className="block-menu-options">{options.map((choice, i) => <button key={choice.type} className={menuIndex === i ? "highlighted" : ""} onMouseDown={e => e.preventDefault()} onClick={() => convert(choice.type)}><choice.icon size={20} /><span><strong>{choice.label}</strong><small>{choice.help}</small></span></button>)}{!options.length && <p>No matching block types.</p>}</div>{!menu.slash && <><div className="menu-separator" /><div className="block-menu-bottom"><button aria-label="Move block up" disabled={index === 0} onClick={() => reorder(block.id, -1)}><ChevronUp size={16} /></button><button aria-label="Move block down" disabled={index === blocks.length - 1} onClick={() => reorder(block.id, 1)}><ChevronDown size={16} /></button><button aria-label="Duplicate block" onClick={() => { const next = [...blocks]; next.splice(index + 1, 0, { ...block, id: crypto.randomUUID() }); onChange(next); setMenu(null); }}><Copy size={16} /></button><button aria-label="Delete block" className="danger" onClick={() => remove(block.id)}><Trash2 size={16} /></button></div></>}
      </div>}
    </div>)}
    <button className="append-block" onClick={() => insert(blocks.length)}><Plus size={16} /><span>Click to keep writing</span></button>
  </div>;
}
