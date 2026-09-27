"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { value: JSONContent | null; onChange: (doc: JSONContent) => void; dir: "rtl" | "ltr"; label: string };

/** Tiptap editor (one per locale). Stores Tiptap JSON, rendered by components/public/rich-text. */
export function RichTextEditor({ value, onChange, dir, label }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, protocols: ["mailto", "tel"] } })],
    content: value && Object.keys(value).length ? value : "",
    editorProps: { attributes: { dir, "aria-label": label, class: "prose-ngo min-h-48 px-4 py-3 outline-none" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  if (!editor) return <div className="min-h-48 rounded-theme border border-foreground/20 bg-white" />;

  const btn = (active: boolean) => cn("grid size-9 place-items-center rounded-theme hover:bg-foreground/5", active && "bg-primary/15 text-primary");
  const tools = [
    { label: "B", Icon: Bold, run: () => editor.chain().focus().toggleBold().run(), on: editor.isActive("bold") },
    { label: "I", Icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), on: editor.isActive("italic") },
    { label: "H2", Icon: Heading2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), on: editor.isActive("heading", { level: 2 }) },
    { label: "H3", Icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), on: editor.isActive("heading", { level: 3 }) },
    { label: "•", Icon: List, run: () => editor.chain().focus().toggleBulletList().run(), on: editor.isActive("bulletList") },
    { label: "1.", Icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), on: editor.isActive("orderedList") },
    { label: "“", Icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), on: editor.isActive("blockquote") },
    {
      label: "link",
      Icon: Link2,
      on: editor.isActive("link"),
      run: () => {
        const href = window.prompt("URL", editor.getAttributes("link").href ?? "https://");
        if (href === null) return;
        if (!href) editor.chain().focus().unsetLink().run();
        else if (/^(https?:\/\/|mailto:|tel:|\/)/.test(href)) editor.chain().focus().setLink({ href }).run();
      },
    },
  ];

  return (
    <div className="overflow-hidden rounded-theme border border-foreground/20 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
      <div role="toolbar" aria-label={label} className="flex flex-wrap gap-0.5 border-b border-foreground/10 bg-foreground/[0.03] p-1" dir="ltr">
        {tools.map(({ label: l, Icon, run, on }) => (
          <button key={l} type="button" onClick={run} aria-pressed={on} aria-label={l} className={btn(on)}>
            <Icon aria-hidden className="size-4" />
          </button>
        ))}
        <span className="mx-1 w-px bg-foreground/10" />
        <button type="button" aria-label="undo" onClick={() => editor.chain().focus().undo().run()} className={btn(false)}><Undo2 aria-hidden className="size-4" /></button>
        <button type="button" aria-label="redo" onClick={() => editor.chain().focus().redo().run()} className={btn(false)}><Redo2 aria-hidden className="size-4" /></button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
