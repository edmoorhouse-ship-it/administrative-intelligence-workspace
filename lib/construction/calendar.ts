/**
 * The preconstruction calendar, built from dates the sample portfolio already has: bid due dates,
 * addenda, pre-bid meetings and walks, milestones, drawing issues, proposal validity, RFI responses,
 * VE and Development decisions, and two standing meetings. Every event carries an area, so each
 * person sees only what their role covers. Titles never carry dollar amounts.
 *
 * Server only: the portfolio holds pricing, so the browser gets these events through
 * /api/calendar/base, already filtered to the role.
 */

import type { CalEvent } from "../calendar";
import { portfolio, RECURRING } from "./portfolio.ts";

const SOURCE = "Sample portfolio";
/** The window the calendar fills (the shared calendar uses the same range). */
const FROM = "2026-08-01";
const TO = "2027-06-30";

const DAY = 86_400_000;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const name = (id: string) => portfolio.projects.find((p) => p.id === id)?.name ?? id;

export function constructionEvents(): CalEvent[] {
  const out: CalEvent[] = [];
  const add = (e: Omit<CalEvent, "id" | "source" | "kind"> & { kind?: CalEvent["kind"] }) =>
    out.push({ kind: "event", source: SOURCE, ...e, id: `pc-${out.length}` });

  for (const c of portfolio.coverage) {
    const open = c.daysUntilDue >= 0 ? ` · ${c.submitted} of ${c.invited} in, ${c.coverageStatus.toLowerCase()}` : "";
    add({ date: c.bidDue, time: "2:00 PM", title: `Bids due: ${name(c.project)} ${c.trade}`, area: "general", deadline: true, detail: `${c.package}${open}` });
  }
  for (const a of portfolio.addenda) add({ date: a.issued, title: `${name(a.project)} ${a.number} issued`, area: "general", detail: a.summary });
  for (const m of portfolio.meetings) add({ date: m.date, time: m.time, title: `${name(m.project)}: ${m.what}`, area: "general" });
  for (const p of portfolio.projects) add({ date: p.nextMilestone.date, title: `${p.name}: ${p.nextMilestone.what}`, area: "general", deadline: true, detail: `${p.stage} stage` });

  for (const d of portfolio.projectRecords.drawingLog) add({ date: d.date, title: `${name(d.project)} ${d.set}`, area: "students", detail: d.note });
  for (const r of portfolio.projectRecords.rfis) {
    if (r.status === "Open") add({ date: r.due, title: `${r.id} response due: ${r.subject}`, area: "students", deadline: true, detail: `To ${r.to}. Cost impact: ${r.costImpact.toLowerCase()}.` });
  }

  for (const v of portfolio.pricing.veLog) {
    if (v.decideBy) add({ date: v.decideBy, title: `${v.id} decision: ${v.item}`, area: "finance", deadline: true, detail: `${name(v.project)} · ${v.status}` });
  }
  // VE decisions are already on the calendar from the VE log.
  const veWithDates = new Set(portfolio.pricing.veLog.filter((v) => v.decideBy).map((v) => v.id));
  for (const d of portfolio.pricing.decisionsNeeded.filter((d) => !veWithDates.has(d.decision.split(" ")[0]))) add({ date: d.by, title: `Decision: ${d.decision}`, area: "finance", deadline: true, detail: `${name(d.project)} · ${d.owner}` });
  for (const v of portfolio.pricing.proposalValidity) add({ date: v.validThrough, title: `Proposal validity ends: ${v.bidder}`, area: "finance", deadline: true, detail: v.package });

  const { preconWeekly, developmentCostReview } = RECURRING;
  for (let iso = FROM; iso <= TO; iso = addDays(iso, 1)) {
    if (weekday(iso) === preconWeekly.weekday) add({ date: iso, time: preconWeekly.time, title: preconWeekly.what, area: "general", kind: "recurring" });
  }
  for (let iso = developmentCostReview.firstDate; iso <= TO; iso = addDays(iso, developmentCostReview.everyDays)) {
    add({ date: iso, time: developmentCostReview.time, title: developmentCostReview.what, area: "finance", kind: "recurring" });
  }

  return out
    .filter((e) => e.date >= FROM && e.date <= TO)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
}
