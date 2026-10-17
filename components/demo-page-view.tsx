"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import { ArrowUp, ArrowUpRight, Check, CircleAlert, CircleDashed, Copy, MessageSquare, RotateCcw, Smartphone, Sparkles } from "lucide-react";
import { DEMO_PAGES, type DemoItem, type DemoPageId, type DemoSection, type DemoThread, type ItemState } from "@/lib/demo-pages";
import { suggestedFact } from "@/lib/brain";
import type { AdminRoleId } from "@/lib/roles";
import { brainAction, logActivity } from "@/lib/shared-client";
import type { ToolId } from "@/lib/tools";
import { DEMO_CARDS, demoContext, PULSE_CARDS, withDecisions } from "@/lib/tool-pages";
import { copyText } from "./clipboard";
import { DecisionDeck, ToolChat, useDecisions, type ToolDock } from "./tool-dock";
import { profile } from "@/profiles";

const PILL: Record<ItemState, { label: string; cls: string }> = {
  pass: { label: "Passing", cls: "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]" },
  open: { label: "Open", cls: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]" },
  blocker: { label: "Before real use", cls: "bg-danger/10 text-danger" },
  info: { label: "Info", cls: "bg-active text-secondary" },
};

function ItemRow({ item }: { item: DemoItem }) {
  const state = item.state ?? "info";
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={`mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium ${PILL[state].cls}`}>
        {PILL[state].label}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-fg">{item.label}</p>
        <p className="mt-0.5 text-[14px] leading-6 text-secondary">{item.text}</p>
      </div>
    </li>
  );
}

/** Settings the Text Mac thread needs to ask the assistant directly. */
export interface LiveChatConfig {
  model: string;
  role: AdminRoleId;
  customInstructions: string;
}

type Bubble = { from: "mac" | "you"; text: string; time?: string; failed?: string };

/** Mac's avatar. The ring version marks Mac's identity in the thread header. */
function MacAvatar({ size = "size-7", ring = false }: { size?: string; ring?: boolean }) {
  const face = (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white`}>M</span>
  );
  return ring ? <span className="shrink-0 rounded-full bg-linear-to-br from-brand to-gold p-[2px]">{face}</span> : face;
}

const threadContext = (thread: DemoThread) =>
  `${demoContext("mac")}\n\nEarlier in this thread (a sample written from the sample dataset):\n${thread.messages
    .map((m) => `${m.from === "mac" ? "Mac" : "User"}: ${m.text}`)
    .join("\n")}`;

const QUICK_REPLIES = ["What needs me today?", "Show me the case manager note", "What can wait until next week?"];

/**
 * The Text Mac conversation. The opening messages are a sample; anything sent goes to the
 * workspace's assistant, which answers as Mac. Nothing leaves the app by text message, and the
 * thread isn't saved.
 */
function useMacThread(thread: DemoThread, live: LiveChatConfig) {
  const [extra, setExtra] = useState<Bubble[]>([]);
  // busy: a reply is on its way or still streaming. waiting: no words from Mac yet.
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return false;
    const history = [...extra.filter((b) => !b.failed), { from: "you" as const, text }];
    setExtra((prev) => [...prev, { from: "you", text }]);
    setBusy(true);
    setWaiting(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    // Marks the user's message when nothing came back, or Mac's reply when it stopped partway.
    const fail = (reason: string) => {
      const who = reply ? "mac" : "you";
      setExtra((prev) => {
        const at = prev.findLastIndex((b) => b.from === who);
        return prev.map((b, i) => (i === at ? { ...b, failed: reason } : b));
      });
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: live.model,
          role: live.role,
          customInstructions: live.customInstructions,
          toolId: "mac",
          toolContext: threadContext(thread),
          messages: history.map((b) => ({ role: b.from === "you" ? "user" : "assistant", content: b.text })),
        }),
      });
      if (!res.ok || !res.body) {
        let reason = `Request failed (${res.status}).`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) reason = body.error;
        } catch {
          // keep the status line
        }
        fail(reason);
        return true;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        const first = reply === "";
        reply += chunk;
        setWaiting(false);
        setExtra((prev) =>
          first ? [...prev, { from: "mac", text: reply }] : prev.map((b, i) => (i === prev.length - 1 ? { ...b, text: reply } : b)),
        );
      }
      if (!reply.trim()) fail("Mac didn't answer. Try again.");
      else {
        void logActivity("replied in Text Mac", "general", "Text Mac", "Mac");
        const fact = suggestedFact(reply);
        if (fact) void brainAction({ action: "propose", text: fact, area: "general", origin: "Text Mac", agent: "Mac" });
      }
    } catch (err) {
      if (!controller.signal.aborted) fail(err instanceof Error ? err.message : "Connection error.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setWaiting(false);
      setBusy(false);
    }
    return true;
  };

  const reset = () => {
    abortRef.current?.abort();
    setExtra([]);
  };

  const bubbles: Bubble[] = [...thread.messages, ...extra];
  return { bubbles, sampleCount: thread.messages.length, live: extra.length > 0, busy, waiting, send, reset };
}

type MacThread = ReturnType<typeof useMacThread>;

function CopyReply({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }
      }}
      className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted opacity-0 transition-opacity hover:bg-hover hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ThreadView({ mac, dayLabel, inputRef }: { mac: MacThread; dayLabel: string; inputRef: RefObject<HTMLInputElement | null> }) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { bubbles, busy, waiting } = mac;
  const lastText = bubbles[bubbles.length - 1]?.text;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [bubbles.length, lastText, waiting]);

  const submit = async (text: string) => {
    if (busy || !text.trim()) return;
    if (text === draft) setDraft("");
    await mac.send(text);
  };

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line),0_12px_32px_-18px_rgb(50_76_154/0.35)]">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <MacAvatar size="size-9" ring />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium leading-5 text-fg">Mac</p>
          <p className="truncate text-[12px] text-muted">Chief of staff · answers here in the app</p>
        </div>
        {mac.live && (
          <button
            type="button"
            onClick={() => {
              mac.reset();
              inputRef.current?.focus();
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary transition-colors hover:bg-hover hover:text-fg"
          >
            <RotateCcw className="size-3.5" />
            Start over
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex h-[460px] flex-col overflow-y-auto overscroll-contain px-4 py-4">
        <p className="pb-3 text-center text-[12px] text-muted">{dayLabel}</p>
        {bubbles.map((m, i) => {
          const grouped = bubbles[i - 1]?.from === m.from;
          const fresh = i >= mac.sampleCount;
          return m.from === "you" ? (
            <div key={i} className={`flex flex-col items-end ${grouped ? "mt-1.5" : "mt-4"} ${fresh ? "anim-um-enter" : ""}`}>
              <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-bubble px-4 py-2.5 text-[15px] leading-5 text-fg">
                {m.text}
              </div>
              {m.failed && (
                <span className="mt-1 flex max-w-[80%] items-start gap-1 text-right text-[12px] text-danger [overflow-wrap:anywhere]">
                  <CircleAlert className="mt-px size-3.5 shrink-0" />
                  Not answered. {m.failed}
                </span>
              )}
              {m.time && <span className="mt-1 text-[11px] text-muted">{m.time}</span>}
            </div>
          ) : (
            <div key={i} className={`group flex items-start gap-2.5 ${grouped ? "mt-1.5" : "mt-4"} ${fresh ? "anim-message-in" : ""}`}>
              {grouped ? <span className="w-7 shrink-0" /> : <MacAvatar />}
              <div className="min-w-0 max-w-[80%]">
                <p className="whitespace-pre-wrap break-words pt-1 text-[15px] leading-6 text-fg">{m.text}</p>
                {m.failed && (
                  <span className="mt-1 flex items-start gap-1 text-[12px] text-danger [overflow-wrap:anywhere]">
                    <CircleAlert className="mt-px size-3.5 shrink-0" />
                    Reply cut off. {m.failed}
                  </span>
                )}
                <div className="flex h-6 items-center gap-1">
                  {m.time && <span className="text-[11px] text-muted">{m.time}</span>}
                  {fresh && !(busy && i === bubbles.length - 1) && <CopyReply text={m.text} />}
                </div>
              </div>
            </div>
          );
        })}
        {waiting && (
          <div className="anim-message-in mt-4 flex items-center gap-2.5" role="status" aria-label="Mac is typing">
            <MacAvatar />
            <span className="flex items-center gap-1 rounded-full bg-bubble px-3 py-2">
              {[0, 1, 2].map((d) => (
                <span key={d} className="typing-dot size-1.5 rounded-full bg-muted" style={{ animationDelay: `${d * 160}ms` }} />
              ))}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-2.5 flex gap-2 overflow-x-auto pb-0.5">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => void submit(q)}
              className="shrink-0 rounded-full bg-brand/8 px-3 py-1.5 text-[13px] text-brand transition-[transform,background-color] duration-100 hover:bg-brand/15 active:scale-95 disabled:opacity-40 dark:bg-brand/20 dark:text-[#b7c6f2] dark:hover:bg-brand/30"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft);
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message Mac…"
            aria-label="Message Mac"
            maxLength={2000}
            className="h-10 min-w-0 flex-1 rounded-xl bg-page px-3.5 text-[15px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]"
          />
          <button
            type="submit"
            disabled={!draft.trim() || busy}
            aria-label="Send"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-send text-white transition-[opacity,transform] hover:opacity-90 active:scale-90 disabled:cursor-default disabled:opacity-40"
          >
            <ArrowUp className="size-4" strokeWidth={2.25} />
          </button>
        </form>
      </div>
    </div>
  );
}

const URGENCY_DOT = { critical: "bg-danger", warn: "bg-[#c9a227]" };

/** What's on Mac's radar today, from the business pulse. Tapping one asks Mac about it. */
function RadarCard({ mac, onAsk }: { mac: MacThread; onAsk: () => void }) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-gold" strokeWidth={2} />
        <h2 className="text-[14px] font-medium text-fg">On Mac&apos;s radar</h2>
      </div>
      <p className="mt-0.5 text-[12px] text-muted">From today&apos;s business pulse. Tap one to ask Mac.</p>
      <ul className="mt-3 space-y-1.5">
        {PULSE_CARDS.slice(0, 3).map((card) => {
          const summary = card.id === "pulse-priority" ? card.detail : `${card.title} ${card.detail}`.trim();
          return (
          <li key={card.id}>
            <button
              type="button"
              disabled={mac.busy}
              onClick={() => {
                onAsk();
                // The first sentence is enough: Mac has the full sample dataset behind it.
                void mac.send(`What should I do about this? ${summary.split(/(?<=\.)\s+/)[0]}`);
              }}
              className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-[background-color,transform] duration-100 hover:bg-hover active:scale-[0.98] disabled:opacity-50"
            >
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${URGENCY_DOT[card.urgency ?? "warn"]}`} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-[13px] leading-5 text-fg">{summary}</span>
              </span>
              <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted transition-transform group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-fg" />
            </button>
          </li>
          );
        })}
      </ul>
    </section>
  );
}

const SETUP_ICON: Record<ItemState, { icon: ReactNode; tone: string }> = {
  pass: { icon: <Check className="size-3" strokeWidth={3} />, tone: "bg-[#2f8a4f] text-white" },
  open: { icon: <CircleDashed className="size-3" strokeWidth={2.25} />, tone: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]" },
  blocker: { icon: <CircleAlert className="size-3" strokeWidth={2.25} />, tone: "bg-danger/10 text-danger" },
  info: { icon: <CircleDashed className="size-3" strokeWidth={2.25} />, tone: "bg-active text-secondary" },
};

/** The steps between Mac in the app and Mac on a phone, with how many are done. */
function SetupCard({ section, footnote }: { section: DemoSection; footnote?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const done = section.items.filter((i) => i.state === "pass").length;
  const total = section.items.length;
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center gap-2">
        <Smartphone className="size-4 text-brand" strokeWidth={2} />
        <h2 className="flex-1 text-[14px] font-medium text-fg">Mac on your phone</h2>
        <span className="text-[12px] tabular-nums text-muted">
          {done} of {total} ready
        </span>
      </div>
      <div className="mt-3 flex gap-1" aria-hidden>
        {section.items.map((item, i) => (
          <span key={item.label} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < done ? "bg-[#2f8a4f]" : "bg-active"}`} />
        ))}
      </div>
      <ul className="mt-3 space-y-0.5">
        {section.items.map((item) => {
          const state = item.state ?? "info";
          const expanded = open === item.label;
          return (
            <li key={item.label}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : item.label)}
                className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-hover"
              >
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${SETUP_ICON[state].tone}`}>{SETUP_ICON[state].icon}</span>
                <span className={`flex-1 text-[13px] ${state === "pass" ? "text-muted" : "text-fg"}`}>{item.label}</span>
                {state === "blocker" && <span className="text-[11px] text-danger">Before real use</span>}
              </button>
              {expanded && <p className="anim-action-in pb-2 pl-9 pr-1.5 text-[12px] leading-5 text-secondary">{item.text}</p>}
            </li>
          );
        })}
      </ul>
      {footnote && <p className="mt-3 border-t border-line pt-3 text-[12px] leading-5 text-muted">{footnote}</p>}
    </section>
  );
}

/** A demo page. Its content states what is real and what is still open. */
export function DemoPageView({ id, dock, live }: { id: Extract<DemoPageId, ToolId>; dock: ToolDock; live: LiveChatConfig }) {
  const page = DEMO_PAGES[id];
  const cards = DEMO_CARDS[id] ?? [];
  const decisions = useDecisions();
  const ask = (text: string) => dock.onAsk(id, text, withDecisions(demoContext(id), cards, decisions));
  const fallbackThread: DemoThread = { dayLabel: "", messages: [] };
  const mac = useMacThread(page.thread ?? fallbackThread, live);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  if (page.thread) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
            <MessageSquare className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[13px] text-muted">{profile.org}</p>
            <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">{page.title}</h1>
          </div>
        </div>
        <p className="mt-5 font-serif text-[17px] leading-7 text-fg">{page.subtitle}</p>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div ref={threadRef} className="scroll-mt-4">
            <ThreadView mac={mac} dayLabel={page.thread.dayLabel} inputRef={inputRef} />
          </div>
          <aside className="space-y-4">
            <RadarCard mac={mac} onAsk={() => threadRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })} />
            {page.sections[0] && <SetupCard section={page.sections[0]} footnote={page.footnote} />}
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <p className="text-[13px] text-muted">{profile.org}</p>
      <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">{page.title}</h1>
      <p className="mt-1 text-[14px] text-muted">{page.subtitle}</p>
      <p className="mt-5 font-serif text-[17px] leading-7 text-fg">{page.intro}</p>

      {page.image && (
        <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row">
          <div className="w-full overflow-hidden rounded-xl shadow-[0_0_0_1px_var(--line)] sm:w-64">
            <Image
              src={page.image.src}
              alt={page.image.alt}
              width={page.image.width}
              height={page.image.height}
              className="h-auto w-full"
            />
          </div>
          {page.link && (
            <a
              href={page.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-fg px-4 text-sm text-page hover:opacity-90"
            >
              {page.link.label}
              <ArrowUpRight className="size-4" />
            </a>
          )}
        </div>
      )}

      <DecisionDeck cards={cards} onAsk={ask} disabled={dock.composer.isStreaming} page={page.title} />

      {page.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="border-b border-line pb-2 font-serif text-[20px] text-fg">{section.heading}</h2>
          <ul className="divide-y divide-line">
            {section.items.map((item) => (
              <ItemRow key={`${item.label}-${item.text}`} item={item} />
            ))}
          </ul>
        </section>
      ))}

      {page.footnote && (
        <p className="mt-8 rounded-xl bg-bubble px-4 py-3 text-[13px] leading-5 text-secondary">{page.footnote}</p>
      )}

      <ToolChat tool={id} onAsk={ask} composer={dock.composer} />
    </div>
  );
}
