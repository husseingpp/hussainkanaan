import type { ReactNode } from "react";

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type: string; text?: string; marks?: Mark[]; attrs?: Record<string, unknown>; content?: Node[] };

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

function applyMarks(text: ReactNode, marks: Mark[] = []): ReactNode {
  return marks.reduce<ReactNode>((acc, mark, i) => {
    switch (mark.type) {
      case "bold":
        return <strong key={i}>{acc}</strong>;
      case "italic":
        return <em key={i}>{acc}</em>;
      case "underline":
        return <u key={i}>{acc}</u>;
      case "strike":
        return <s key={i}>{acc}</s>;
      case "code":
        return <code key={i} className="rounded bg-foreground/5 px-1">{acc}</code>;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        if (!SAFE_HREF.test(href)) return acc;
        const external = /^https?:/i.test(href);
        return (
          <a key={i} href={href} className="text-primary underline" {...(external && { target: "_blank", rel: "noreferrer" })}>
            {acc}
          </a>
        );
      }
      default:
        return acc;
    }
  }, text);
}

function render(nodes: Node[] | undefined): ReactNode {
  return nodes?.map((node, i) => {
    const children = render(node.content);
    switch (node.type) {
      case "text":
        return <span key={i}>{applyMarks(node.text ?? "", node.marks)}</span>;
      case "paragraph":
        return <p key={i}>{children}</p>;
      case "heading": {
        const level = Math.min(Math.max(Number(node.attrs?.level ?? 2), 2), 4);
        const Tag = `h${level}` as "h2" | "h3" | "h4";
        return <Tag key={i}>{children}</Tag>;
      }
      case "bulletList":
        return <ul key={i}>{children}</ul>;
      case "orderedList":
        return <ol key={i}>{children}</ol>;
      case "listItem":
        return <li key={i}>{children}</li>;
      case "blockquote":
        return <blockquote key={i}>{children}</blockquote>;
      case "hardBreak":
        return <br key={i} />;
      case "horizontalRule":
        return <hr key={i} />;
      case "image": {
        const src = String(node.attrs?.src ?? "");
        if (!/^https?:\/\//.test(src)) return null;
        // eslint-disable-next-line @next/next/no-img-element -- inline editor images have unknown dimensions
        return <img key={i} src={src} alt={String(node.attrs?.alt ?? "")} loading="lazy" className="rounded-theme" />;
      }
      default:
        return children ? <div key={i}>{children}</div> : null;
    }
  });
}

/** Renders a Tiptap JSON document (one locale). Unknown nodes degrade to their children. */
export function RichText({ doc, className }: { doc: unknown; className?: string }) {
  if (!doc || typeof doc !== "object") return null;
  const content = (doc as Node).content;
  if (!content?.length) return null;
  return <div className={`prose-ngo ${className ?? ""}`}>{render(content)}</div>;
}
