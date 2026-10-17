"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Check, Flag, Plus, X } from "lucide-react";
import { areasFor, canAccess, canApprove, type Area } from "@/lib/access";
import {
  addDays,
  AREA_NAME,
  CALENDAR_EVENTS,
  type CalEvent,
  calendarContext,
  CALENDAR_SUGGEST_PREFIX,
  eventsFor,
  type SharedEvent,
  sharedAsCalendar,
  SHARED_END,
  SHARED_START,
  shortDay,
  suggestedCalendarEvent,
  upcomingDeadlines,
} from "@/lib/calendar";
import { DATA_AS_OF } from "@/lib/data-notice";
import type { AdminRoleId } from "@/lib/roles";
import { calendarAction, logActivity, type Person, useShared } from "@/lib/shared-client";

/**
 * Manny, the MACS manatee: the executive assistant in the corner of every page. It owns the
 * calendar for the person signed in. The quick replies answer straight from the calendar, so they
 * work even when the AI is off; anything typed goes to the AI with the calendar as context. Manny
 * proposes and drafts; a person approves, and nothing is sent to anyone.
 */

const NO_EVENTS: SharedEvent[] = [];
const SEEN_KEY = "macs-manny-greeted";
const HIDDEN_KEY = "macs-manny-hidden";

type Card = "week" | "needs" | "tomorrow" | "add";
type Msg = { id: number; from: "manny" | "you"; text?: string; card?: Card; failed?: string };

const QUICK: { label: string; card: Card; ask: string }[] = [
  { label: "What needs me?", card: "needs", ask: "What needs me?" },
  { label: "What's this week?", card: "week", ask: "What's on this week?" },
  { label: "Prep me for tomorrow", card: "tomorrow", ask: "What's tomorrow look like?" },
  { label: "Add to the calendar", card: "add", ask: "I want to add something to the calendar." },
];

const store = {
  get(kind: "session" | "local", key: string) {
    try {
      return (kind === "session" ? sessionStorage : localStorage).getItem(key);
    } catch {
      return null;
    }
  },
  set(kind: "session" | "local", key: string, value: string) {
    try {
      (kind === "session" ? sessionStorage : localStorage).setItem(key, value);
    } catch {
      // private window or blocked storage: Manny just forgets
    }
  },
};

/** The manatee, wearing an executive bow tie. */
export function MannyFace({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#dfe8f6" />
      <ellipse cx="32" cy="35" rx="23" ry="20" fill="#93a6bb" />
      <ellipse cx="32" cy="27" rx="17" ry="12" fill="#a3b4c7" />
      <ellipse cx="32" cy="43" rx="14" ry="9.5" fill="#cdd8e4" />
      <circle cx="22.5" cy="30" r="2.6" fill="#1f2a37" />
      <circle cx="41.5" cy="30" r="2.6" fill="#1f2a37" />
      <circle cx="23.4" cy="29.1" r="0.9" fill="#fff" />
      <circle cx="42.4" cy="29.1" r="0.9" fill="#fff" />
      <circle cx="17.5" cy="38" r="3.4" fill="#f2a9b5" opacity="0.55" />
      <circle cx="46.5" cy="38" r="3.4" fill="#f2a9b5" opacity="0.55" />
      <ellipse cx="28.5" cy="39.5" rx="1.5" ry="1.1" fill="#5a6a7c" />
      <ellipse cx="35.5" cy="39.5" rx="1.5" ry="1.1" fill="#5a6a7c" />
      <g fill="#8193a8">
        <circle cx="24" cy="43" r="0.7" />
        <circle cx="26" cy="45" r="0.7" />
        <circle cx="40" cy="43" r="0.7" />
        <circle cx="38" cy="45" r="0.7" />
      </g>
      <path d="M28.5 46.5 Q32 49.5 35.5 46.5" stroke="#5a6a7c" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M32 56 L24.5 52.2 L24.5 59.8 Z" fill="#324c9a" />
      <path d="M32 56 L39.5 52.2 L39.5 59.8 Z" fill="#324c9a" />
      <circle cx="32" cy="56" r="2" fill="#f4c542" />
    </svg>
  );
}

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
}

/** The calendar this person sees: public dates, sample deadlines, and approved or proposed shared events. */
function useMyCalendar(role: AdminRoleId) {
  const [shared] = useShared<SharedEvent[]>("events", NO_EVENTS);
  const events = useMemo(() => {
    const mine = sharedAsCalendar(shared.filter((e) => canAccess(role, e.area)));
    return eventsFor(role, [...CALENDAR_EVENTS, ...mine]).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  }, [shared, role]);
  const waiting = shared.filter((e) => e.status === "proposed" && canApprove(role, e.area));
  return { events, waiting };
}

function EventLine({ e }: { e: CalEvent }) {
  return (
    <li className="flex items-start gap-2 py-1">
      <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: `var(--cal-${e.area})` }} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-5 text-fg">
          {e.deadline && <Flag className="mr-1 inline size-3 -translate-y-px text-danger" strokeWidth={2.5} />}
          {e.title}
        </p>
        <p className="text-[11px] text-muted">{[shortDay(e.date), e.time].filter(Boolean).join(" · ")}</p>
      </div>
    </li>
  );
}

function AddCard({ role, onDone }: { role: AdminRoleId; onDone: (text: string) => void }) {
  const today = DATA_AS_OF;
  const [f, setF] = useState({ title: "", date: addDays(today, 1), time: "", area: (areasFor(role)[0] ?? "general") as Area });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const approves = canApprove(role, f.area);
  const field = "h-8 w-full rounded-md bg-page px-2 text-[13px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] focus:shadow-[0_0_0_1px_var(--line-strong)]";

  if (done) return null;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fields = { title: f.title.trim(), date: f.date, time: f.time.trim() || undefined, area: f.area };
    const err = await calendarAction(approves ? { action: "add", ...fields } : { action: "propose", ...fields, agent: "Manny" });
    setBusy(false);
    if (err) return setError(err);
    setDone(true);
    onDone(
      approves
        ? `Done. "${fields.title}" is on the calendar for ${shortDay(fields.date)}.`
        : `Proposed "${fields.title}" for ${shortDay(fields.date)}. It's waiting for ${f.area === "finance" ? "the Director or Finance" : "the Director"} to approve.`,
    );
  };

  return (
    <form onSubmit={submit} className="mt-1 space-y-2 rounded-xl bg-surface p-3 shadow-[0_0_0_1px_var(--line)]">
      <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What's happening" aria-label="Event title" className={field} />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" min={SHARED_START} max={SHARED_END} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Date" className={field} />
        <input value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} placeholder="Time (optional)" aria-label="Time" className={field} />
      </div>
      <select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value as Area })} aria-label="Who sees it" className={field}>
        {areasFor(role).map((a) => (
          <option key={a} value={a}>
            {AREA_NAME[a]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={busy || f.title.trim().length < 4}
        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-brand text-[13px] font-medium text-white transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
      >
        <Plus className="size-3.5" strokeWidth={2.5} />
        {approves ? "Put it on the calendar" : "Propose it"}
      </button>
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    </form>
  );
}

export function Manny({
  me,
  model,
  customInstructions,
  onOpenCalendar,
}: {
  me: Person;
  model: string;
  customInstructions: string;
  onOpenCalendar: () => void;
}) {
  const role = me.role;
  const first = me.name.trim().split(/\s+/)[0] || "there";
  const { events, waiting } = useMyCalendar(role);
  // The dataset's date, not the clock: the Pulse and the chat count from the same day.
  const today = DATA_AS_OF;
  const tomorrow = addDays(today, 1);
  const week = events.filter((e) => e.kind !== "recurring" && e.date >= today && e.date <= addDays(today, 6));
  const deadlines = upcomingDeadlines(events, today);

  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // A note rises from the corner once per visit, a moment after the page settles.
  useEffect(() => {
    if (store.get("session", HIDDEN_KEY) || store.get("session", SEEN_KEY)) return;
    const t = setTimeout(() => setNudge(true), 1800);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const push = (...add: Omit<Msg, "id">[]) => setMsgs((prev) => [...prev, ...add.map((m) => ({ ...m, id: nextId.current++ }))]);

  const nudgeText = (() => {
    const bits: string[] = [];
    if (deadlines.length) bits.push(`${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} this week`);
    if (waiting.length) bits.push(`${waiting.length} event${waiting.length === 1 ? "" : "s"} waiting for your OK`);
    return bits.length ? `${greeting(new Date())}, ${first}. You've got ${bits.join(" and ")}. Want the rundown?` : `${greeting(new Date())}, ${first}. The week looks clear. Want a look ahead?`;
  })();

  const begin = (then?: Card) => {
    store.set("session", SEEN_KEY, "1");
    setNudge(false);
    setOpen(true);
    if (msgs.length === 0) {
      push(
        { from: "manny", text: `Hi ${first}, I'm Manny, the school's executive assistant. I'm automated, not a person.` },
        { from: "manny", text: "I keep the calendar straight and tell you what needs you. I draft and propose; you decide." },
      );
    }
    if (then) ask(then);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

  const ask = (card: Card) => {
    const q = QUICK.find((x) => x.card === card)!;
    const lead: Record<Card, string> = {
      needs: waiting.length || deadlines.length ? "Here's what's on your plate:" : "Nothing needs you right now. Nice.",
      week: week.length ? `${week.length} thing${week.length === 1 ? "" : "s"} in the next seven days:` : "Nothing on the calendar for the next seven days.",
      tomorrow: `Tomorrow, ${shortDay(tomorrow)}:`,
      add: "Tell me what it is and when. If it's your area to approve, it goes straight on; otherwise I'll propose it.",
    };
    push({ from: "you", text: q.ask }, { from: "manny", text: lead[card], card });
  };

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    const history = [...msgs.filter((m) => m.text && !m.failed && !m.card), { from: "you" as const, text }];
    push({ from: "you", text });
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let reply = "";
    const replyId = nextId.current++;
    const fail = (raw: string) => {
      // The provider's own wording includes account links; say what it means instead.
      const reason = /credit/i.test(raw) ? "The AI account is out of credit, so I can't answer typed questions right now. The buttons above still work." : raw;
      setMsgs((prev) => {
        const at = reply ? prev.findIndex((m) => m.id === replyId) : prev.findLastIndex((m) => m.from === "you");
        return prev.map((m, i) => (i === at ? { ...m, failed: reason } : m));
      });
    };
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          role,
          customInstructions,
          toolId: "calendar",
          toolContext: calendarContext(events, today),
          messages: history.map((m) => ({ role: m.from === "you" ? "user" : "assistant", content: m.text })),
        }),
      });
      if (!res.ok || !res.body) {
        let reason = `Manny couldn't reach the AI (${res.status}). The buttons above still work.`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) reason = body.error;
        } catch {
          // keep the status line
        }
        return fail(reason);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        const firstChunk = reply === "";
        reply += chunk;
        if (firstChunk) {
          const text = reply;
          setMsgs((prev) => [...prev, { id: replyId, from: "manny", text }]);
        } else {
          const text = reply;
          setMsgs((prev) => prev.map((m) => (m.id === replyId ? { ...m, text } : m)));
        }
      }
      if (!reply.trim()) return fail("Manny didn't answer. Try again, or use the buttons above.");
      void logActivity("asked Manny about the calendar", "general", "Calendar", "Manny");
      const event = suggestedCalendarEvent(reply);
      if (event) {
        const err = await calendarAction({ action: "propose", ...event, agent: "Manny" });
        push({ from: "manny", text: err ? `I tried to propose "${event.title}" but the server said: ${err}` : `I proposed "${event.title}" for ${shortDay(event.date)}. It's waiting for approval.` });
      }
    } catch (err) {
      if (!controller.signal.aborted) fail(err instanceof Error ? err.message : "Connection error.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  };

  const hide = () => {
    store.set("session", HIDDEN_KEY, "1");
    setOpen(false);
    setNudge(false);
    setHidden(true);
  };

  if (hidden) return null;

  const renderCard = (card: Card) => {
    if (card === "needs") {
      return (
        <div className="mt-1 space-y-2">
          {waiting.map((e) => (
            <div key={e.id} className="rounded-xl bg-surface p-3 shadow-[0_0_0_1px_var(--line)]">
              <p className="text-[13px] font-medium text-fg">{e.title}</p>
              <p className="text-[11px] text-muted">
                {[shortDay(e.date), e.time, AREA_NAME[e.area], `from ${e.author.name}`].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => void calendarAction({ action: "approve", id: e.id }).then((err) => push({ from: "manny", text: err ?? `Approved. "${e.title}" is on the calendar.` }))}
                  className="flex h-7 items-center gap-1 rounded-md bg-fg px-2.5 text-[12px] text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-95"
                >
                  <Check className="size-3" strokeWidth={2.5} />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void calendarAction({ action: "reject", id: e.id }).then((err) => push({ from: "manny", text: err ?? `Turned down "${e.title}".` }))}
                  className="flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover active:scale-95"
                >
                  <X className="size-3" />
                  Turn down
                </button>
              </div>
            </div>
          ))}
          {deadlines.length > 0 && (
            <ul className="rounded-xl bg-surface px-3 py-1.5 shadow-[0_0_0_1px_var(--line)]">
              {deadlines.slice(0, 5).map((e) => (
                <EventLine key={e.id} e={e} />
              ))}
            </ul>
          )}
        </div>
      );
    }
    if (card === "week" || card === "tomorrow") {
      const list = card === "week" ? week.slice(0, 7) : events.filter((e) => e.date === tomorrow);
      return (
        <div className="mt-1">
          {list.length > 0 ? (
            <ul className="rounded-xl bg-surface px-3 py-1.5 shadow-[0_0_0_1px_var(--line)]">
              {list.map((e) => (
                <EventLine key={e.id} e={e} />
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Nothing on the calendar. A good day to get ahead.</p>
          )}
          <button type="button" onClick={onOpenCalendar} className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
            Open the calendar
            <ArrowRight className="size-3" />
          </button>
        </div>
      );
    }
    return <AddCard role={role} onDone={(text) => push({ from: "manny", text })} />;
  };

  return (
    <div className="pointer-events-none fixed bottom-24 right-3 z-40 flex flex-col items-end gap-3 md:bottom-5 md:right-5">
      {nudge && !open && (
        <div role="status" className="anim-manny-rise pointer-events-auto relative w-[300px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line),0_18px_40px_-16px_rgb(15_23_42/0.35)]">
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              store.set("session", SEEN_KEY, "1");
              setNudge(false);
            }}
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
          >
            <X className="size-3.5" />
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand">Manny</p>
          <p className="mt-1 pr-4 text-[14px] leading-5 text-fg">{nudgeText}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => begin("needs")}
              className="h-8 rounded-lg bg-brand px-3 text-[13px] font-medium text-white transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96]"
            >
              Show me
            </button>
            <button
              type="button"
              onClick={() => {
                store.set("session", SEEN_KEY, "1");
                setNudge(false);
              }}
              className="h-8 rounded-lg px-3 text-[13px] text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96]"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Manny, your assistant"
          className="anim-manny-rise pointer-events-auto flex h-[min(600px,calc(100dvh-8rem))] w-[380px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl bg-page shadow-[0_0_0_1px_var(--line),0_24px_60px_-20px_rgb(15_23_42/0.45)]"
        >
          <header className="flex items-start gap-3 border-b border-line bg-surface px-4 py-3">
            <MannyFace size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-fg">Manny</p>
              <p className="text-[12px] leading-4 text-muted">Your executive assistant. Automated, not a person. It proposes; you decide.</p>
            </div>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-hover hover:text-fg">
              <X className="size-4" />
            </button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.map((m) =>
              m.from === "you" ? (
                <div key={m.id} className="anim-message-in flex flex-col items-end">
                  <p className={`max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3 py-2 text-[13px] leading-5 text-white ${m.failed ? "opacity-60" : ""}`}>{m.text}</p>
                  {m.failed && <p className="mt-1 max-w-[85%] text-right text-[12px] leading-4 text-danger">{m.failed}</p>}
                </div>
              ) : (
                <div key={m.id} className="anim-message-in max-w-[92%]">
                  {m.text && (
                    <p className="whitespace-pre-wrap rounded-2xl rounded-bl-md bg-surface px-3 py-2 text-[13px] leading-5 text-fg shadow-[0_0_0_1px_var(--line)]">
                      {m.text
                        .split("\n")
                        .filter((l) => !l.replace(/[*_>\s]/g, "").toLowerCase().startsWith(CALENDAR_SUGGEST_PREFIX.replace(/\s/g, "").toLowerCase()))
                        .join("\n")
                        .trim()}
                    </p>
                  )}
                  {m.card && renderCard(m.card)}
                  {m.failed && <p className="mt-1 text-[12px] text-danger">{m.failed}</p>}
                </div>
              ),
            )}
            {msgs.length > 0 && msgs.at(-1)?.from === "you" && !msgs.at(-1)?.failed && busy && (
              <div className="flex w-14 items-center justify-center gap-1 rounded-2xl rounded-bl-md bg-surface py-3 shadow-[0_0_0_1px_var(--line)]" aria-label="Manny is typing">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {QUICK.map((q) => (
              <button
                key={q.card}
                type="button"
                onClick={() => ask(q.card)}
                className="h-8 rounded-full bg-surface px-3 text-[12px] font-medium text-fg shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover active:scale-[0.96]"
              >
                {q.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2 border-t border-line bg-surface px-4 pt-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Manny anything"
              aria-label="Message Manny"
              className="h-10 min-w-0 flex-1 rounded-xl bg-page px-3 text-[14px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_2px_var(--brand)]"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={busy || !input.trim()}
              className="flex size-10 items-center justify-center rounded-xl bg-brand text-white transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              <ArrowRight className="size-4" />
            </button>
          </form>
          <p className="bg-surface px-4 pb-3 pt-2 text-[11px] leading-4 text-muted">
            Manny never sends anything to anyone. Events it suggests wait for approval.{" "}
            <button type="button" onClick={hide} className="underline underline-offset-2 hover:text-fg">
              Hide Manny
            </button>
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => (open ? setOpen(false) : begin())}
        aria-label={open ? "Close Manny" : "Open Manny, your assistant"}
        aria-expanded={open}
        className="pointer-events-auto relative rounded-full shadow-[0_10px_28px_-8px_rgb(50_76_154/0.55)] transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        <span className={open ? "block" : "anim-manny-bob block"}>
          <MannyFace size={60} />
        </span>
        {!open && waiting.length + deadlines.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-danger text-[11px] font-semibold text-white ring-2 ring-page">
            {waiting.length + deadlines.length}
          </span>
        )}
        {open && (
          <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-surface text-fg shadow-[0_0_0_1px_var(--line)]">
            <CalendarDays className="size-3.5" />
          </span>
        )}
      </button>
    </div>
  );
}
