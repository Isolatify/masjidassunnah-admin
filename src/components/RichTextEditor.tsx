"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  TextB,
  TextItalic,
  TextUnderline,
  ListBullets,
  ListNumbers,
  Quotes,
  Link as LinkIcon,
  SpinnerGap,
  MagicWand,
} from "@phosphor-icons/react";
import { toast } from "@/components/Toast";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [rewriting, setRewriting] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write the event description...",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "rte-content",
        "aria-label": "Event description",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Keep external value in sync (event load, AI rewrite) without clobbering typing
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  const toggleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const url = window.prompt("Enter URL:");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const handleRewrite = useCallback(async () => {
    if (!editor) return;
    const text = editor.getText().trim();
    if (!text) return;

    setRewriting(true);
    try {
      const res = await fetch("/api/events/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      editor.commands.setContent(data.text, { emitUpdate: false });
      onChange(editor.getHTML());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI rewrite failed");
    }
    setRewriting(false);
  }, [editor, onChange]);

  if (!editor) {
    return <div className="rte rte--loading" style={{ minHeight: 300 }} />;
  }

  const cmd = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="rte">
      <div className="rte-toolbar">
        <ToolBtn
          icon={<TextB size={15} weight="bold" />}
          tip="Bold"
          active={editor.isActive("bold")}
          onMouseDown={cmd(() => editor.chain().focus().toggleBold().run())}
        />
        <ToolBtn
          icon={<TextItalic size={15} />}
          tip="Italic"
          active={editor.isActive("italic")}
          onMouseDown={cmd(() => editor.chain().focus().toggleItalic().run())}
        />
        <ToolBtn
          icon={<TextUnderline size={15} />}
          tip="Underline"
          active={editor.isActive("underline")}
          onMouseDown={cmd(() => editor.chain().focus().toggleUnderline().run())}
        />

        <span className="rte-div" />

        <ToolBtn
          icon={<span className="rte-h">H2</span>}
          tip="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onMouseDown={cmd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        />
        <ToolBtn
          icon={<span className="rte-h">H3</span>}
          tip="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onMouseDown={cmd(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        />
        <ToolBtn
          icon={<ListBullets size={15} />}
          tip="Bullet list"
          active={editor.isActive("bulletList")}
          onMouseDown={cmd(() => editor.chain().focus().toggleBulletList().run())}
        />
        <ToolBtn
          icon={<ListNumbers size={15} />}
          tip="Numbered list"
          active={editor.isActive("orderedList")}
          onMouseDown={cmd(() => editor.chain().focus().toggleOrderedList().run())}
        />
        <ToolBtn
          icon={<Quotes size={15} />}
          tip="Quote"
          active={editor.isActive("blockquote")}
          onMouseDown={cmd(() => editor.chain().focus().toggleBlockquote().run())}
        />

        <span className="rte-div" />

        <ToolBtn
          icon={<LinkIcon size={15} />}
          tip={editor.isActive("link") ? "Remove link" : "Insert link"}
          active={editor.isActive("link")}
          onMouseDown={cmd(toggleLink)}
        />

        <span className="rte-spacer" />

        <button
          type="button"
          className="rte-ai"
          onClick={handleRewrite}
          disabled={rewriting}
          title="Rewrite with AI — formats text into headers & bullet points"
        >
          {rewriting ? (
            <SpinnerGap size={14} weight="bold" className="spin" />
          ) : (
            <MagicWand size={14} weight="duotone" />
          )}
          {rewriting ? "Rewriting…" : "Rewrite with AI"}
        </button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolBtn({
  icon,
  tip,
  active,
  onMouseDown,
}: {
  icon: React.ReactNode;
  tip: string;
  active: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      className={`rte-btn${active ? " on" : ""}`}
      title={tip}
      aria-label={tip}
      aria-pressed={active}
      onMouseDown={onMouseDown}
    >
      {icon}
    </button>
  );
}
