"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, Check, Copy, GitFork, RotateCcw, TriangleAlert } from "lucide-react";
import { getModel } from "@/lib/models";
import type { ChatMessage } from "@/lib/types";
import { copyText } from "./clipboard";
import { Mark } from "./mark";
import { Markdown } from "./markdown";
import { useSmoothText } from "./use-smooth-text";

interface MessageListProps {
  messages: ChatMessage[];
  streamingMessageId: string | null;
  onRegenerate: (messageId: string) => void;
  onFork: (messageId: string) => void;
}

const STICK_THRESHOLD = 96;
const FRESH_MS = 2000;
const STATUS_WORDS = ["Reviewing", "Cross-checking", "Tallying", "Sifting", "Pulling records", "Reconciling"];

export function MessageList({ messages, streamingMessageId, onRegenerate, onFork }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // Follow the bottom while content grows, unless the reader has scrolled up.
  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    scroller.scrollTop = scroller.scrollHeight;
    const observer = new ResizeObserver(() => {
      if (stickRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // A newly sent message always brings the view back to the bottom.
  const lastUserId = [...messages].reverse().find((m) => m.role === "user")?.id;
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !lastUserId) return;
    stickRef.current = true;
    scroller.scrollTop = scroller.scrollHeight;
  }, [lastUserId]);

  // Only real user input detaches the view; programmatic scrolls never do.
  const release = () => {
    stickRef.current = false;
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    if (atBottom) stickRef.current = true;
    setShowJump(!atBottom && !stickRef.current);
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onWheel={(e) => e.deltaY < 0 && release()}
        onTouchMove={release}
        onPointerDown={(e) => e.target === e.currentTarget && release()}
        className="h-full overflow-y-auto"
      >
        <div ref={contentRef} className="mx-auto w-full max-w-3xl px-4 pb-10 pt-9">
          {messages.map((m, i) => {
            const next = messages[i + 1];
            return m.role === "user" ? (
              <UserMessage key={m.id} message={m} onFork={() => onFork(m.id)} />
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                isStreaming={m.id === streamingMessageId}
                isLast={m.id === lastAssistantId && !next}
                canRegenerate={m.id === lastAssistantId && streamingMessageId === null}
                onRegenerate={() => onRegenerate(m.id)}
                onFork={() => onFork(m.id)}
              />
            );
          })}
        </div>
      </div>
      {showJump && (
        <button
          type="button"
          aria-label="Scroll to latest"
          onClick={() => {
            stickRef.current = true;
            setShowJump(false);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          }}
          className="anim-pop-in absolute bottom-3 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full bg-surface text-secondary hover:text-fg"
          style={{ boxShadow: "var(--menu-shadow)" }}
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const date = new Date(ts);
  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function UserMessage({ message, onFork }: { message: ChatMessage; onFork: () => void }) {
  const [fresh] = useState(() => Date.now() - message.createdAt < FRESH_MS);
  return (
    <div className={`group relative mb-10 flex flex-col items-end ${fresh ? "anim-um-enter" : ""}`}>
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-bubble px-4 py-3 text-[15px] leading-5 text-fg">
        {message.content}
      </div>
      <div className="absolute right-0 top-full mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <span className="px-1.5 text-[11px] text-muted">{relativeTime(message.createdAt)}</span>
        <CopyButton text={message.content} />
        <ActionButton label="Fork to new chat" onClick={onFork}>
          <GitFork className="size-[15px]" strokeWidth={1.75} />
        </ActionButton>
      </div>
    </div>
  );
}

interface AssistantMessageProps {
  message: ChatMessage;
  isStreaming: boolean;
  isLast: boolean;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onFork: () => void;
}

function AssistantMessage({ message, isStreaming, isLast, canRegenerate, onRegenerate, onFork }: AssistantMessageProps) {
  // Only replies that start streaming while mounted get the live reveal.
  const [live] = useState(() => message.status === "streaming");
  const [statusWord] = useState(() => STATUS_WORDS[Math.floor(Math.random() * STATUS_WORDS.length)]);
  const { text, caughtUp } = useSmoothText(message.content, live);
  const revealing = isStreaming || !caughtUp;
  const waiting = isStreaming && text.length === 0;

  // The working mark rides just below the growing text.
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !revealing) return;
    const observer = new ResizeObserver(() => setContentHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [revealing, waiting]);

  if (message.status === "error") {
    return (
      <div className="mb-10">
        <div className="flex gap-2.5 rounded-xl bg-danger/5 px-4 py-3 text-sm text-fg shadow-[0_0_0_1px_color-mix(in_srgb,var(--danger)_25%,transparent)]">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0 flex-1 leading-relaxed">
            {message.content}
            {canRegenerate && (
              <button type="button" onClick={onRegenerate} className="ml-2 font-medium text-fg underline underline-offset-2">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="mb-10 flex h-8 items-center gap-2 ps-1" aria-live="polite">
        <Mark size={16} working />
        <span className="shimmer-text text-sm">{statusWord}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${revealing ? "pb-14" : "mb-10"}`}>
      <div ref={contentRef} className={live ? "anim-message-in" : ""}>
        <Markdown text={text} animateWords={revealing} />
      </div>

      {revealing && (
        <div
          className="absolute left-0.5 top-0"
          style={{ transform: `translateY(${contentHeight + 14}px)`, transition: "transform 210ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <Mark size={32} working />
        </div>
      )}

      {!revealing && (
        <>
          {message.status === "stopped" && <p className="mt-1 ps-1 text-[13px] text-muted">Response stopped.</p>}
          <div className={`mt-2 flex items-center gap-0.5 ${live ? "anim-action-in" : ""} ${isLast ? "" : "opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100"}`}>
            <CopyButton text={message.content} label="Copy" />
            {canRegenerate && (
              <ActionButton label="Retry" onClick={onRegenerate}>
                <RotateCcw className="size-[15px]" strokeWidth={1.75} />
              </ActionButton>
            )}
            <ActionButton label="Fork to new chat" onClick={onFork}>
              <GitFork className="size-[15px]" strokeWidth={1.75} />
            </ActionButton>
            <span className="ps-1.5 text-[11px] text-muted">
              {relativeTime(message.createdAt)}
              {message.model ? ` · ${getModel(message.model).label}` : ""}
            </span>
          </div>
          {isLast && (
            <div className={`mt-6 ps-0.5 ${live ? "anim-settle" : ""}`}>
              <Mark size={32} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover hover:text-fg"
    >
      {children}
    </button>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ActionButton
      label={copied ? "Copied" : label}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? <Check className="size-[15px] text-fg" /> : <Copy className="size-[15px]" strokeWidth={1.75} />}
    </ActionButton>
  );
}
