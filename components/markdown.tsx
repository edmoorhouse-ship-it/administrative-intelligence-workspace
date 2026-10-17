"use client";

import { memo, useState, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { copyText } from "./clipboard";

interface HastNode {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/**
 * Wraps each word of prose in a span that fades in on mount. React keeps the
 * existing spans as the text grows, so only newly revealed words animate.
 */
function rehypeWordFade() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && (node.tagName === "pre" || node.tagName === "code")) return;
      if (!node.children) return;
      const out: HastNode[] = [];
      for (const child of node.children) {
        if (child.type === "text" && child.value && /\S/.test(child.value)) {
          for (const part of child.value.match(/\s+|\S+\s*/g) ?? []) {
            if (/^\s+$/.test(part)) out.push({ type: "text", value: part });
            else out.push({ type: "element", tagName: "span", properties: { className: ["word-in"] }, children: [{ type: "text", value: part }] });
          }
        } else {
          walk(child);
          out.push(child);
        }
      }
      node.children = out;
    };
    walk(tree);
  };
}

function nodeText(node: HastNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(nodeText).join("");
}

function CodeBlock({ node, children }: ComponentProps<"pre"> & { node?: HastNode }) {
  const [copied, setCopied] = useState(false);
  const code = node?.children?.find((c) => c.tagName === "code");
  const className = (code?.properties?.className as string[] | undefined)?.find((c) => c.startsWith("language-"));
  const language = className?.replace("language-", "") ?? "";
  const text = nodeText(code).replace(/\n$/, "");

  return (
    <div className="relative mb-3 overflow-hidden rounded-lg bg-[var(--code-surface)] font-sans shadow-[0_0_0_0.5px_var(--line-strong)]">
      <div className="flex h-9 items-center justify-between px-3 text-xs text-muted">
        <span className="font-mono">{language}</span>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          aria-label="Copy code"
          className="flex size-6 items-center justify-center rounded-md hover:bg-hover hover:text-fg"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 pb-4 font-mono text-[13px] leading-[1.6] text-fg">{children}</pre>
    </div>
  );
}

const components: Components = {
  pre: CodeBlock as Components["pre"],
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto rounded-lg shadow-[0_0_0_1px_var(--line)]">
      <table>{children}</table>
    </div>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

interface MarkdownProps {
  text: string;
  animateWords?: boolean;
  className?: string;
}

export const Markdown = memo(function Markdown({ text, animateWords = false, className = "" }: MarkdownProps) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={animateWords ? [rehypeWordFade] : []}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
