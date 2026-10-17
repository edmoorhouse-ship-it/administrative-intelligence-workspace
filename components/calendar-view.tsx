"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Flag, MessageSquare, Plus, Repeat, Sparkles, X } from "lucide-react";
import { areasFor, canAccess, canApprove, type Area } from "@/lib/access";
import {
  addDays,
  AREA_NAME,
  CALENDAR_EVENTS,
  type CalEvent,
  calendarContext,
  daysBetween,
  eventsFor,
  fullDate,
  monthWeeks,
  parseIso,
  SHARED_END,
  SHARED_START,
  type SharedEvent,
  sharedAsCalendar,
  shortDay,
  upcomingDeadlines,
  weekdayName,
} from "@/lib/calendar";
import { DATA_AS_OF } from "@/lib/data-notice";
import type { AdminRoleId } from "@/lib/roles";
import { calendarAction, useShared } from "@/lib/shared-client";
import { ToolChat, type ToolDock } from "./tool-dock";
import { profile } from "@/profiles";

const pad = (n: number) => String(n).padStart(2, "0");
const areaVar = (a: Area) => `var(--cal-${a})`;
const NO_EVENTS: SharedEvent[] = [];
const WEEKDAYS = [
  ["S", "Sun"],
  ["M", "Mon"],
  ["T", "Tue"],
  ["W", "Wed"],
  ["T", "Thu"],
  ["F", "Fri"],
  ["S", "Sat"],
] as const;
const FIELD =
  "h-9 w-full rounded-lg bg-page px-2.5 text-[14px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]";

function relative(iso: string, today: string) {
  const n = daysBetween(today, iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

/** One event as a row: colored spine, title, the things that matter, and detail. */
function EventRow({ e }: { e: CalEvent }) {
  return (
    <li className="flex gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-hover">
      <span className="w-[3px] shrink-0 self-stretch rounded-full" style={{ background: areaVar(e.area) }} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-medium leading-5 text-fg">{e.title}</p>
          {e.deadline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
              <Flag className="size-2.5" strokeWidth={2.5} />
              Deadline
            </span>
          )}
          {e.kind === "recurring" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-active px-2 py-0.5 text-[11px] text-secondary">
              <Repeat className="size-2.5" strokeWidth={2.5} />
              Weekly
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-muted">{[e.time, AREA_NAME[e.area], e.source].filter(Boolean).join(" · ")}</p>
        {e.detail && <p className="mt-1 text-[13px] leading-5 text-secondary">{e.detail}</p>}
      </div>
    </li>
  );
}

/** A compact event inside a day cell: tinted, with a colored spine. Proposals are dashed. */
function Chip({ e }: { e: CalEvent }) {
  const c = areaVar(e.area);
  const proposed = e.source.startsWith("Proposed");
  return (
    <span
      className="flex min-w-0 items-center gap-1 truncate rounded-[6px] px-1.5 py-[2px] text-[11px] font-medium leading-4"
      style={{
        background: `color-mix(in srgb, ${c} 13%, transparent)`,
        color: c,
        boxShadow: proposed ? `inset 0 0 0 1px ${c}` : `inset 2px 0 0 ${c}`,
        opacity: proposed ? 0.8 : 1,
      }}
    >
      {e.deadline && <Flag className="size-2.5 shrink-0" strokeWidth={2.5} />}
      <span className="truncate">{e.title}</span>
    </span>
  );
}

/** The school calendar, filtered to the role. Month and agenda views, approvals, and Manny's proposals. */
export function CalendarView({ dock, role }: { dock: ToolDock; role: AdminRoleId }) {
  // The dataset's date, not the clock: the Pulse, Manny, and the chat count from the same day.
  const today = DATA_AS_OF;
  const [cursor, setCursor] = useState(() => {
    const t = parseIso(today);
    return { y: t.getFullYear(), m: t.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<"month" | "agenda">("month");
  const [off, setOff] = useState<Set<Area>>(() => new Set());
  const [shared] = useShared<SharedEvent[]>("events", NO_EVENTS);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: today, time: "", title: "", area: areasFor(role)[0] ?? ("general" as Area), detail: "" });
  const [error, setError] = useState<string | null>(null);

  const everything = useMemo(() => {
    const sharedCal = sharedAsCalendar(shared.filter((e) => canAccess(role, e.area)));
    return [...CALENDAR_EVENTS, ...sharedCal].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  }, [shared, role]);
  const visible = useMemo(() => eventsFor(role, everything).filter((e) => !off.has(e.area)), [everything, role, off]);
  const byIso = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of visible) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [visible]);
  const weeks = useMemo(() => monthWeeks(cursor.y, cursor.m), [cursor]);
  const monthKey = `${cursor.y}-${pad(cursor.m + 1)}`;
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const waiting = shared.filter((e) => e.status === "proposed" && canAccess(role, e.area));
  const deadlines = upcomingDeadlines(visible, today);
  const thisMonth = visible.filter((e) => e.kind !== "recurring" && e.date.startsWith(monthKey)).length;
  const next = visible.find((e) => e.kind !== "recurring" && e.date >= today);
  const selectedEvents = byIso.get(selected) ?? [];
  const agenda = useMemo(() => {
    const out: { iso: string; list: CalEvent[] }[] = [];
    for (let iso = today; iso <= addDays(today, 60); iso = addDays(iso, 1)) {
      const list = byIso.get(iso);
      if (list?.length) out.push({ iso, list });
    }
    return out;
  }, [byIso, today]);

  const ask = (text: string) => dock.onAsk("calendar", text, calendarContext(visible, today));

  const go = (delta: number) =>
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const selectIso = (iso: string) => {
    setSelected(iso);
    const d = parseIso(iso);
    if (d.getFullYear() !== cursor.y || d.getMonth() !== cursor.m) setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const toggleArea = (a: Area) =>
    setOff((prev) => {
      const n = new Set(prev);
      if (n.has(a)) n.delete(a);
      else n.add(a);
      return n;
    });

  // Arrow keys move the selected day, as in a spreadsheet: left and right by a day, up and down by a week.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (step[e.key] === undefined) return;
    e.preventDefault();
    selectIso(addDays(selected, step[e.key]));
  };

  const decide = async (id: string, action: "approve" | "reject") => {
    setError(await calendarAction({ action, id }));
  };

  const approvesDraft = canApprove(role, draft.area);
  const submitDraft = async () => {
    setError(null);
    const fields = {
      date: draft.date,
      time: draft.time.trim() || undefined,
      title: draft.title.trim(),
      area: draft.area,
      detail: draft.detail.trim() || undefined,
    };
    const err = await calendarAction(approvesDraft ? { action: "add", ...fields } : { action: "propose", ...fields });
    if (err) {
      setError(err);
      return;
    }
    setDraft((d) => ({ ...d, time: "", title: "", detail: "" }));
    setAdding(false);
  };

  const segment = (on: boolean) =>
    `flex h-8 items-center rounded-md px-3 text-[13px] transition-colors ${on ? "bg-surface text-fg shadow-[0_0_0_0.5px_var(--line),0_1px_2px_rgb(0_0_0/0.06)]" : "text-muted hover:text-secondary"}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
            <CalendarDays className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[13px] text-muted">{profile.org}</p>
            <h1 className="font-serif text-[34px] font-[400] leading-tight tracking-[-0.01em] text-fg">{monthLabel}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 rounded-lg bg-active p-px" role="tablist" aria-label="Calendar view">
            {(["month", "agenda"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={segment(view === v)}>
                {v === "month" ? "Month" : "Agenda"}
              </button>
            ))}
          </div>
          <div className="flex h-9 items-center rounded-lg bg-active p-px">
            <button type="button" aria-label="Previous month" onClick={() => go(-1)} className="flex size-8 items-center justify-center rounded-md text-secondary transition-[background-color,transform] duration-100 hover:bg-surface hover:text-fg active:scale-90">
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const t = parseIso(today);
                setCursor({ y: t.getFullYear(), m: t.getMonth() });
                setSelected(today);
              }}
              className="h-8 rounded-md px-3 text-[13px] text-secondary transition-colors hover:bg-surface hover:text-fg"
            >
              Today
            </button>
            <button type="button" aria-label="Next month" onClick={() => go(1)} className="flex size-8 items-center justify-center rounded-md text-secondary transition-[background-color,transform] duration-100 hover:bg-surface hover:text-fg active:scale-90">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
          <p className="text-[12px] text-muted">{monthLabel.split(" ")[0]}</p>
          <p className="mt-1 text-[24px] font-semibold leading-tight tabular-nums text-fg">{thisMonth}</p>
          <p className="mt-0.5 text-[12px] text-muted">dates on the calendar</p>
        </div>
        <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
          <p className="text-[12px] text-muted">Waiting for approval</p>
          <p className={`mt-1 text-[24px] font-semibold leading-tight tabular-nums ${waiting.length ? "text-gold" : "text-fg"}`}>{waiting.length}</p>
          <p className="mt-0.5 text-[12px] text-muted">{waiting.length === 1 ? "proposal" : "proposals"} from Manny and staff</p>
        </div>
        <div className="col-span-2 rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] md:col-span-1">
          <p className="text-[12px] text-muted">Next up</p>
          {next ? (
            <>
              <p className="mt-1 truncate text-[15px] font-medium leading-tight text-fg">{next.title}</p>
              <p className="mt-0.5 text-[12px] text-muted">
                {relative(next.date, today)} · {shortDay(next.date)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[14px] text-muted">Nothing scheduled ahead.</p>
          )}
        </div>
      </div>

      {(deadlines.length > 0 || waiting.length > 0) && (
        <section className="mt-5 rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]" aria-label="Needs attention">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" strokeWidth={2} />
            <h2 className="text-[14px] font-medium text-fg">Needs attention</h2>
          </div>
          <ul className="mt-2 space-y-1">
            {waiting.length > 0 && (
              <li>
                <a href="#waiting-for-approval" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-fg transition-colors hover:bg-hover">
                  <CircleAlert className="size-3.5 shrink-0 text-gold" />
                  {waiting.length} {waiting.length === 1 ? "event is" : "events are"} waiting for approval
                </a>
              </li>
            )}
            {deadlines.slice(0, 4).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => selectIso(e.date)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-hover"
                >
                  <Flag className="size-3 shrink-0 text-danger" strokeWidth={2.5} />
                  <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  <span className="shrink-0 text-[12px] text-muted">
                    {relative(e.date, today)} · {shortDay(e.date)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Show or hide areas">
        {areasFor(role).map((a) => {
          const on = !off.has(a);
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              onClick={() => toggleArea(a)}
              className={`flex h-8 items-center gap-2 rounded-full px-3 text-[13px] transition-[background-color,transform,opacity] duration-100 active:scale-95 ${on ? "bg-surface text-fg shadow-[0_0_0_1px_var(--line)]" : "text-muted opacity-60 shadow-[0_0_0_1px_var(--line)]"}`}
            >
              <span className="size-2.5 rounded-full" style={{ background: areaVar(a), opacity: on ? 1 : 0.35 }} />
              {AREA_NAME[a]}
            </button>
          );
        })}
        <span className="ml-auto hidden items-center gap-3 text-[12px] text-muted sm:flex">
          <span className="inline-flex items-center gap-1">
            <Flag className="size-3" strokeWidth={2.5} />
            Deadline
          </span>
          <span className="inline-flex items-center gap-1">
            <Repeat className="size-3" strokeWidth={2.5} />
            Repeats weekly
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-[3px] shadow-[inset_0_0_0_1px_var(--muted)]" />
            Proposed
          </span>
        </span>
      </div>

      {view === "month" ? (
        <>
          <div key={monthKey} className="anim-page-in mt-4 overflow-hidden rounded-2xl shadow-[0_0_0_1px_var(--line),0_16px_40px_-26px_rgb(50_76_154/0.45)]">
            <div className="grid grid-cols-7 border-b border-line bg-surface text-[11px] uppercase tracking-[0.08em] text-muted">
              {WEEKDAYS.map(([short, long]) => (
                <div key={long} className="py-2 text-center">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{long}</span>
                </div>
              ))}
            </div>
            <div
              role="application"
              aria-label={`${monthLabel} calendar. Arrow keys move the selected day.`}
              tabIndex={0}
              onKeyDown={onKey}
              className="grid grid-cols-7 gap-px bg-line outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
            >
              {weeks.map((c) => {
                const list = byIso.get(c.iso) ?? [];
                const items = list.filter((e) => e.kind !== "recurring");
                const newsletter = list.some((e) => e.kind === "recurring");
                const isToday = c.iso === today;
                const isSel = c.iso === selected;
                return (
                  <button
                    key={c.iso}
                    type="button"
                    tabIndex={-1}
                    onClick={() => selectIso(c.iso)}
                    aria-pressed={isSel}
                    aria-label={`${fullDate(c.iso)}${list.length ? `, ${list.length} item${list.length === 1 ? "" : "s"}` : ""}`}
                    className={`group relative flex min-h-[58px] flex-col gap-1 p-1.5 text-left transition-colors duration-150 sm:min-h-[112px] sm:p-2 ${
                      isSel ? "z-[1] bg-brand/[0.07] ring-2 ring-inset ring-brand dark:bg-brand/25" : c.inMonth ? "bg-surface hover:bg-hover" : "bg-page hover:bg-hover"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className={`flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums ${isToday ? "bg-brand font-semibold text-white" : c.inMonth ? "text-fg" : "text-muted"}`}>
                        {c.day}
                      </span>
                    </span>
                    <span className="flex gap-0.5 sm:hidden">
                      {list.slice(0, 4).map((e) => (
                        <span key={e.id} className="size-1.5 rounded-full" style={{ background: e.kind === "recurring" ? "var(--muted)" : areaVar(e.area) }} />
                      ))}
                    </span>
                    <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {items.slice(0, 3).map((e) => (
                        <Chip key={e.id} e={e} />
                      ))}
                      {items.length > 3 && <span className="px-1 text-[11px] text-muted">+{items.length - 3} more</span>}
                      {newsletter && (
                        <span className="flex items-center gap-1 px-1 text-[10px] text-muted">
                          <Repeat className="size-2.5" strokeWidth={2.5} />
                          Newsletter
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section key={selected} className="anim-action-in mt-4 rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-[22px] leading-tight text-fg">{fullDate(selected)}</h2>
              <span className="text-[12px] text-muted">{relative(selected, today)}</span>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="mt-3 text-[14px] text-muted">Nothing on the calendar for this day.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {selectedEvents.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={dock.composer.isStreaming}
                onClick={() => ask(`What should I know about ${fullDate(selected)} on the calendar?`)}
                className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96] disabled:opacity-40"
              >
                <MessageSquare className="size-3.5" />
                Ask about this day
              </button>
            </div>
          </section>
        </>
      ) : (
        <div className="anim-page-in mt-4 overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]">
          {agenda.length === 0 ? (
            <p className="p-10 text-center text-[14px] text-muted">Nothing in the next 60 days for your role.</p>
          ) : (
            <ol className="divide-y divide-line">
              {agenda.map((d) => {
                const isToday = d.iso === today;
                return (
                  <li key={d.iso} className="grid grid-cols-[84px_1fr] gap-4 p-4 sm:grid-cols-[120px_1fr] sm:p-5">
                    <button
                      type="button"
                      onClick={() => {
                        selectIso(d.iso);
                        setView("month");
                      }}
                      className="group text-left"
                      aria-label={`Open ${fullDate(d.iso)} in the month view`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.08em] text-muted">{weekdayName(d.iso, "short")}</p>
                      <p className={`font-serif text-[30px] leading-none tabular-nums transition-colors group-hover:text-brand ${isToday ? "text-brand" : "text-fg"}`}>{parseIso(d.iso).getDate()}</p>
                      <p className="mt-1 text-[12px] text-muted">{isToday ? "Today" : shortDay(d.iso)}</p>
                    </button>
                    <ul className="space-y-1">
                      {d.list.map((e) => (
                        <EventRow key={e.id} e={e} />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      <section id="waiting-for-approval" className="mt-8 scroll-mt-6" aria-label="Waiting for approval">
        <h2 className="font-serif text-[20px] text-fg">Waiting for approval</h2>
        <p className="mt-1 text-[13px] text-muted">Manny and staff propose events. A person approves each one before it goes on the calendar.</p>
        {waiting.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted">Nothing waiting.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
            {waiting.map((e) => (
              <li key={e.id} className="anim-settle flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-fg">{e.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {[shortDay(e.date), e.time, AREA_NAME[e.area], `${e.author.name}${e.author.via ? ` for ${e.author.via}` : ""}`].filter(Boolean).join(" · ")}
                  </p>
                  {e.detail && <p className="mt-1 text-[13px] leading-5 text-secondary">{e.detail}</p>}
                </div>
                {canApprove(role, e.area) ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void decide(e.id, "approve")}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-fg px-3 text-[13px] text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96]"
                    >
                      <Check className="size-3.5" strokeWidth={2.5} />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(e.id, "reject")}
                      className="flex h-8 items-center gap-1.5 rounded-lg bg-page px-3 text-[13px] text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96]"
                    >
                      <X className="size-3.5" />
                      Turn down
                    </button>
                  </div>
                ) : (
                  <span className="text-[13px] text-muted">Waiting for {e.area === "finance" ? "the Director or Finance" : "the Director"}.</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-label="Add to the calendar">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[20px] text-fg">Add to the calendar</h2>
          {!adding && (
            <button
              type="button"
              onClick={() => {
                setDraft((d) => ({ ...d, date: selected }));
                setAdding(true);
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96]"
            >
              <Plus className="size-3.5" />
              Add an event
            </button>
          )}
        </div>
        {adding && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitDraft();
            }}
            className="anim-action-in mt-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line-strong)]"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] text-muted">
                Date
                <input type="date" min={SHARED_START} max={SHARED_END} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={`mt-1 ${FIELD}`} />
              </label>
              <label className="block text-[12px] text-muted">
                Time <span className="text-muted">(optional)</span>
                <input value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} placeholder="e.g. 9:00 AM" className={`mt-1 ${FIELD}`} />
              </label>
              <label className="block text-[12px] text-muted sm:col-span-2">
                Title
                <input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="What's happening" className={`mt-1 ${FIELD}`} />
              </label>
              <label className="block text-[12px] text-muted">
                Who sees it
                <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value as Area })} className={`mt-1 ${FIELD}`}>
                  {areasFor(role).map((a) => (
                    <option key={a} value={a}>
                      {AREA_NAME[a]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] text-muted">
                Note <span className="text-muted">(optional)</span>
                <input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="A line of context" className={`mt-1 ${FIELD}`} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={draft.title.trim().length < 4 || !draft.date}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-fg px-3.5 text-sm text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
              >
                <Plus className="size-4" />
                {approvesDraft ? "Add to the calendar" : "Propose it"}
              </button>
              <button type="button" onClick={() => setAdding(false)} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-secondary hover:bg-hover hover:text-fg">
                <X className="size-4" />
                Cancel
              </button>
              <span className="text-[12px] text-muted">{approvesDraft ? "You can approve this area, so it goes on at once." : `Goes to ${draft.area === "finance" ? "the Director or Finance" : "the Director"} to approve.`}</span>
            </div>
          </form>
        )}
        {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
      </section>

      <ToolChat tool="calendar" onAsk={ask} composer={dock.composer} />
    </div>
  );
}
