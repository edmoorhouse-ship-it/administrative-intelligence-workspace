import { AREA_LABEL, canAccess, type Area } from "./access";
import { macsData } from "./macs-data";
import type { AdminRoleId } from "./roles";
import { SCHOOL_SECTIONS, SITE_CHECKED_ON } from "./school-sections";
import { SAMPLE_VENDORS, upcoming as vendorDeadlines } from "./vendors";

/**
 * One calendar for MACS, built from dates the workspace already has: the public school calendar,
 * the sample deadlines, IEP and 504 reviews, FAST testing windows, Survey 2 records with FTE at
 * stake, vendor dates, and the weekly newsletter. Every event carries an area, so each person sees
 * only what their role covers.
 * Public dates are real (macschool.us); everything else is sample data.
 */

export type EventKind = "public" | "event" | "recurring";

export interface CalEvent {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  time?: string;
  title: string;
  area: Area;
  kind: EventKind;
  /** A date something has to happen by. */
  deadline?: boolean;
  detail?: string;
  source: string;
}

const PUBLIC_SOURCE = `macschool.us, checked ${SITE_CHECKED_ON}`;
const SAMPLE_SOURCE = "Sample dataset";

/** Dates as ISO strings, read as local dates. */
export const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseIso = (iso: string) => new Date(`${iso}T12:00:00`);
export const addDays = (iso: string, n: number) => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
export const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86_400_000);

export const AREA_NAME: Record<Area, string> = AREA_LABEL;

/** Lines from the sample dataset that say what they are, not just when. */
const datasetArea = (text: string): Area => {
  if (/IEP|504|ESE|reevaluation/i.test(text)) return "supports";
  if (/FTE|financial|budget|payroll|ACPS/i.test(text)) return "finance";
  return "general";
};

function publicEvents(): CalEvent[] {
  const seen = new Set<string>();
  const out: CalEvent[] = [];
  for (const section of SCHOOL_SECTIONS.filter((s) => s.id === "calendar" || s.id === "upcoming-events")) {
    for (const e of section.events ?? []) {
      const key = `${e.date}|${e.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `pub-${out.length}`, date: e.date, time: e.time && e.time !== "All Day" ? e.time : undefined, title: e.title, area: "general", kind: "public", source: PUBLIC_SOURCE });
    }
  }
  return out;
}

function datasetEvents(): CalEvent[] {
  const out: CalEvent[] = [];
  const { operations, studentServices, assessmentCalendar, fte, governance, facilities } = macsData;

  // Some dataset entries are ranges ("2026-11-23 to 2026-11-27"): the calendar uses the first day.
  for (const e of operations.upcomingCalendar) {
    const deadline = /due|must be/i.test(e.event);
    const range = e.date.includes(" to ") ? e.date.replace(/^.*? to /, "") : null;
    out.push({
      id: `cal-${e.date.slice(0, 10)}-${out.length}`,
      date: e.date.slice(0, 10),
      title: e.event,
      area: datasetArea(e.event),
      kind: "event",
      deadline,
      detail: range ? `Runs through ${range}.` : undefined,
      source: SAMPLE_SOURCE,
    });
  }
  // The dataset's calendar already lists these board dates; don't show them twice.
  const listedBoard = new Set(operations.upcomingCalendar.filter((e) => /Board/.test(e.event)).map((e) => e.date.slice(0, 10)));
  const listedNotice = new Set(operations.upcomingCalendar.filter((e) => /notice/i.test(e.event)).map((e) => e.date.slice(0, 10)));

  for (const r of studentServices.iepReviewsDueNext60Days) {
    out.push({
      id: `iep-${r.studentId}`,
      date: r.reviewDue,
      title: `IEP review due · ${r.studentId} (grade ${r.grade})`,
      area: "supports",
      kind: "event",
      deadline: true,
      detail: `Case manager ${r.caseManager}. ${r.status}`,
      source: SAMPLE_SOURCE,
    });
  }
  for (const r of studentServices.reevaluationsDue) {
    out.push({ id: `reeval-${r.studentId}`, date: r.due, title: `${r.type} due · ${r.studentId}`, area: "supports", kind: "event", deadline: true, detail: r.status, source: SAMPLE_SOURCE });
  }
  for (const r of studentServices.plan504ReviewsDue) {
    out.push({ id: `504-${r.studentId}`, date: r.due, title: `504 plan review · ${r.studentId} (grade ${r.grade})`, area: "supports", kind: "event", deadline: true, detail: r.status, source: SAMPLE_SOURCE });
  }

  for (const w of assessmentCalendar.fastWindows) {
    const m = /(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/.exec(w.dates);
    if (!m) continue;
    out.push({ id: `fast-open-${w.window}`, date: m[1], title: `FAST ${w.window} window opens`, area: "students", kind: "event", detail: `Testing runs through ${m[2]}.`, source: SAMPLE_SOURCE });
    out.push({ id: `fast-close-${w.window}`, date: m[2], title: `FAST ${w.window} window closes`, area: "students", kind: "event", deadline: true, source: SAMPLE_SOURCE });
  }

  for (const s of fte.surveyCalendar) {
    const first = /\d{4}-\d{2}-\d{2}/.exec(s.period);
    if (first && s.applies.includes("K-7")) {
      out.push({ id: `survey-${s.survey}`, date: first[0], title: `${s.survey} week starts`, area: "finance", kind: "event", detail: `${s.period}. Membership is counted for FEFP.`, source: SAMPLE_SOURCE });
    }
  }
  // The records the Pulse escalates: FTE (and so revenue) at stake. Tied to a student, so IEP & 504.
  for (const x of fte.survey2.exceptions.filter((x) => x.fteAtRisk > 0)) {
    out.push({
      id: `survey2-${x.studentId}`,
      date: x.due,
      title: `Close Survey 2 record · ${x.studentId} (grade ${x.grade})`,
      area: "supports",
      kind: "event",
      deadline: true,
      detail: `${x.action}. ${x.fteAtRisk} FTE at stake. Owner ${x.owner}.`,
      source: SAMPLE_SOURCE,
    });
  }

  for (const d of governance.sponsor.deliverables) {
    if (/Monthly financial/i.test(d.item)) {
      out.push({ id: `sponsor-${d.due}`, date: d.due, title: d.item, area: "finance", kind: "event", deadline: true, detail: d.status, source: SAMPLE_SOURCE });
    }
  }

  for (const m of governance.board.meetings) {
    if (!listedBoard.has(m.date)) out.push({
      id: `board-${m.date}`,
      date: m.date,
      title: `Board of Directors meeting`,
      area: "general",
      kind: "event",
      detail: m.type === "Regular" ? `Regular meeting. Minutes: ${m.minutes}` : m.type,
      source: SAMPLE_SOURCE,
    });
    if (m.noticeDueBy && !listedNotice.has(m.noticeDueBy)) {
      out.push({ id: `board-notice-${m.date}`, date: m.noticeDueBy, title: `Post the notice for the ${m.date} board meeting`, area: "general", kind: "event", deadline: true, detail: m.noticePolicy, source: SAMPLE_SOURCE });
    }
  }

  for (const t of facilities.tickets) {
    const iso = /\d{4}-\d{2}-\d{2}/.exec(t.status);
    if (iso) out.push({ id: `fac-${t.id}`, date: iso[0], title: `${t.building}: ${t.issue.split(";")[0].split(" after ")[0]}`, area: "general", kind: "event", detail: `${t.id} · ${t.status}`, source: SAMPLE_SOURCE });
  }

  for (const d of operations.safetyDrills) {
    const iso = /\d{4}-\d{2}-\d{2}/.exec(d.october);
    if (iso) out.push({ id: `drill-${d.drill}`, date: iso[0], title: `${d.drill} drill due`, area: "general", kind: "event", deadline: true, source: SAMPLE_SOURCE });
  }

  for (const u of vendorDeadlines(SAMPLE_VENDORS)) {
    out.push({ id: `vendor-${u.vendor.id}-${u.dueIso}-${out.length}`, date: u.dueIso, title: u.text, area: "finance", kind: "event", deadline: true, detail: u.vendor.name, source: "Vendor agreements (sample)" });
  }

  return out;
}

/** Every Friday, for the weekly family newsletter. Shown as a dot, not a chip. */
function newsletterEvents(from: string, to: string): CalEvent[] {
  const out: CalEvent[] = [];
  for (let iso = from; iso <= to; iso = addDays(iso, 1)) {
    if (parseIso(iso).getDay() === 5) {
      out.push({ id: `news-${iso}`, date: iso, time: "4:00 PM", title: "Weekly family newsletter", area: "general", kind: "recurring", detail: "Goes to ParentSquare every Friday.", source: SAMPLE_SOURCE });
    }
  }
  return out;
}

const byDate = (a: CalEvent, b: CalEvent) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title);

/** Everything on the calendar, across the school year. Built once. */
export const CALENDAR_EVENTS: CalEvent[] = [...publicEvents(), ...datasetEvents(), ...newsletterEvents("2026-08-01", "2027-06-30")].sort(byDate);

/** The events a role may see. */
export function eventsFor(role: AdminRoleId, events: CalEvent[] = CALENDAR_EVENTS): CalEvent[] {
  return events.filter((e) => canAccess(role, e.area));
}

export function eventsOn(events: CalEvent[], iso: string) {
  return events.filter((e) => e.date === iso);
}

/** A month as 5 or 6 weeks, starting on Sunday. Days from the neighbouring months are included. */
export function monthWeeks(year: number, month: number) {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + days) / 7);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === month };
  });
}

export const weekdayName = (iso: string, style: "long" | "short" = "long") => parseIso(iso).toLocaleDateString("en-US", { weekday: style });
export const fullDate = (iso: string) => parseIso(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const shortDay = (iso: string) => parseIso(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Plain-text view of the next few weeks, as the chat sees it. Only what the role covers. */
export function calendarContext(events: CalEvent[], today: string, days = 21): string {
  const end = addDays(today, days);
  const rows = events
    .filter((e) => e.date >= today && e.date <= end && e.kind !== "recurring")
    .map((e) => `- ${e.date} (${weekdayName(e.date, "short")})${e.time ? ` ${e.time}` : ""}: ${e.title} [${AREA_NAME[e.area]}]${e.deadline ? " DEADLINE" : ""}${e.detail ? ` · ${e.detail}` : ""}`);
  const friday = events.some((e) => e.kind === "recurring") ? "Newsletter goes out every Friday at 4:00 PM." : "";
  const text = [`Calendar, ${today} to ${end} (what this person's role covers):`, ...rows, friday].filter(Boolean).join("\n");
  return text.length > 7_500 ? `${text.slice(0, 7_499)}…` : text;
}

// ---- Events people and the calendar assistant add -------------------------------------

export type SharedStatus = "approved" | "proposed" | "rejected";

/** An event someone added, or the calendar assistant proposed. Kept in the shared store. */
export interface SharedEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  area: Area;
  detail?: string;
  deadline?: boolean;
  status: SharedStatus;
  author: { name: string; role: string; via?: string };
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export const SHARED_START = "2026-08-01";
export const SHARED_END = "2027-06-30";

/** Shared events as calendar entries. Only approved ones show as settled; proposals show with a dashed look. */
export function sharedAsCalendar(list: SharedEvent[]): CalEvent[] {
  return list
    .filter((e) => e.status !== "rejected")
    .map((e) => ({
      id: `shared-${e.id}`,
      date: e.date,
      time: e.time,
      title: e.title,
      area: e.area,
      kind: "event" as const,
      deadline: e.deadline,
      detail: e.status === "proposed" ? `Waiting for approval. ${e.detail ?? ""}`.trim() : e.detail,
      source: e.status === "proposed" ? `Proposed by ${e.author.name}` : `Added by ${e.author.name}`,
    }));
}

export const AREA_LABEL_FOR_SUGGESTION: Record<string, Area> = Object.fromEntries(
  (Object.entries(AREA_NAME) as [Area, string][]).map(([area, name]) => [name.toLowerCase(), area]),
);

/** The line the calendar assistant ends a reply with to propose an event. */
export const CALENDAR_SUGGEST_PREFIX = "Suggest for the calendar:";

/**
 * Reads "Suggest for the calendar: 2026-11-05 | 9:00 AM | Staff training | Everyone". Titles with
 * "deadline" or "due" are marked as deadlines. The server checks every field again before saving.
 */
export function suggestedCalendarEvent(reply: string): { date: string; time?: string; title: string; area: Area; deadline: boolean } | null {
  const line = reply.trim().split("\n").reverse().find((l) => l.trim());
  if (!line) return null;
  const text = line.trim().replace(/^[*_>\s]+/, "").replace(/[*_]+/g, "");
  if (!text.toLowerCase().startsWith(CALENDAR_SUGGEST_PREFIX.toLowerCase())) return null;
  const parts = text.slice(CALENDAR_SUGGEST_PREFIX.length).split("|").map((p) => p.trim());
  if (parts.length < 3) return null;
  const [date, time, title, areaName = "everyone"] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < SHARED_START || date > SHARED_END) return null;
  const area = AREA_LABEL_FOR_SUGGESTION[areaName.toLowerCase()];
  if (!area || title.length < 4) return null;
  const deadline = /deadline|due/i.test(title);
  const hasTime = Boolean(time) && !/^(all day|-|—|none|n\/a)$/i.test(time);
  return { date, time: hasTime ? time.slice(0, 20) : undefined, title: title.slice(0, 120), area, deadline };
}

/** Deadlines in the next week, from the visible calendar. Nothing is marked done here, so only upcoming ones show. */
export function upcomingDeadlines(events: CalEvent[], today: string) {
  const end = addDays(today, 7);
  return events.filter((e) => e.deadline && e.date >= today && e.date <= end && e.kind !== "recurring").sort((a, b) => a.date.localeCompare(b.date));
}
