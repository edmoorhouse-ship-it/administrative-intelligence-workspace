import { DATA_AS_OF, macsData } from "./macs-data";

/**
 * MACS business pulse, computed from the sample dataset.
 *
 * Shape follows the small-business plugin's business-pulse skill: overall status, TL;DR,
 * sections, this week, watch list, one priority, appendix. Cutoffs use the skill's defaults
 * where they fit a school. Anything labeled "MACS default" is a choice made here, and the
 * Finance & Operations Manager should confirm it before anyone acts on a color.
 */

export type Status = "good" | "warn" | "critical" | "na";

export const STATUS_LABEL: Record<Status, string> = {
  good: "On track",
  warn: "Watch",
  critical: "Act now",
  na: "No data",
};

export interface PulseLine {
  text: string;
  status?: Status;
}
export interface PulseSection {
  title: string;
  status: Status;
  lines: PulseLine[];
}
export interface PulseTile {
  label: string;
  value: string;
  context: string;
  status: Status;
}
export interface PulseWeekItem {
  iso: string;
  when: string;
  text: string;
}

const DAY_MS = 86_400_000;
/** The dataset's year-to-date runs through 2026-09-30, which is 25% of the fiscal year. */
const YTD_SHARE = 0.25;
/** VPK seats as listed on the public Enrollment page (macschool.us, checked 2026-10-14). */
const PUBLIC_VPK_SEATS = 20;

export const usd = (n: number) => `USD ${Math.round(n).toLocaleString("en-US")}`;
const pctOf = (ratio: number) => `${Math.round(ratio * 100)}%`;
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const weekdayDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const daysFrom = (iso: string) =>
  Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${DATA_AS_OF}T12:00:00`)) / DAY_MS);

const worst = (statuses: Status[]): Status =>
  statuses.includes("critical")
    ? "critical"
    : statuses.includes("warn")
      ? "warn"
      : statuses.includes("good")
        ? "good"
        : "na";

const { finance, enrollment, studentServices, fte, governance, facilities, staffing, operations } = macsData;

// ---- Cash & finance ---------------------------------------------------------

const runwayMonths = finance.daysCashOnHand / 30.4;
// Skill default (6 months / 3 months). TODO: confirm with the Finance & Operations Manager.
const runwayStatus: Status = runwayMonths >= 6 ? "good" : runwayMonths >= 3 ? "warn" : "critical";

const revenuePace = finance.totals.revenueBudget * YTD_SHARE;
const expensePace = finance.totals.expenseBudget * YTD_SHARE;
const revenueRatio = finance.totals.revenueYtd / revenuePace;
const spendRatio = finance.totals.expenseYtd / expensePace;
// MACS default: revenue within 5% of pace is on track; spending more than 5% over pace is critical.
const revenueStatus: Status = revenueRatio >= 0.95 ? "good" : revenueRatio >= 0.9 ? "warn" : "critical";
const spendStatus: Status = spendRatio <= 1 ? "good" : spendRatio <= 1.05 ? "warn" : "critical";
const cashStatus = worst([runwayStatus, revenueStatus, spendStatus]);

const netYtd = finance.totals.revenueYtd - finance.totals.expenseYtd;
const netPace = revenuePace - expensePace;

// MACS default: a line counts as "ahead of pace" at 10 points above the 25% mark.
const expenseOverPace = finance.expenses.filter((e) => e.percentOfBudgetUsed - 25 > 10);
// Revenue lines that have collected under a fifth of budget.
const laggingRevenue = finance.revenue.filter((r) => r.ytdActual / r.budget < 0.2).map((r) => r.line);

// ---- Enrollment demand (the school's pipeline) -----------------------------

const openSeats = enrollment.capacity - enrollment.total;
const waitlistPerSeat = enrollment.totalWaitlist / openSeats;
// Pipeline-coverage bands from the skill (2x and 1x), applied to waitlist per open seat.
const demandStatus: Status = waitlistPerSeat >= 2 ? "good" : waitlistPerSeat >= 1 ? "warn" : "critical";
const vpk = enrollment.byGrade.find((g) => g.grade === "VPK");

// ---- Compliance: ESE and FTE ------------------------------------------------

const overdueIeps = studentServices.iepReviewsDueNext60Days.filter((r) => r.overdue);
const eseStatus: Status = overdueIeps.length > 0 ? "critical" : "good";

const submitDue =
  (fte.surveyCalendar as { survey: string; districtSubmissionDue?: string }[]).find((s) => s.survey === "Survey 2")
    ?.districtSubmissionDue ?? "";
const daysToSubmit = daysFrom(submitDue);
const atRisk = fte.survey2.exceptions.filter((e) => e.fteAtRisk > 0);
const urgentMoney = atRisk.some((e) => daysFrom(e.due) <= 7);
const fteStatus: Status = atRisk.length === 0 ? "good" : urgentMoney ? "critical" : "warn";

// ---- Governance, facilities, staffing ---------------------------------------

const boardTickets = facilities.tickets.filter((t) => t.boardApprovalRequired);
const p1Tickets = facilities.tickets.filter((t) => t.priority === "P1");
const p1Total = p1Tickets.reduce((sum, t) => sum + t.estimate, 0);
const upcomingSponsor = governance.sponsor.deliverables.filter((d) => {
  const n = daysFrom(d.due);
  return n >= 0 && n <= 14 && !d.status.startsWith("Submitted");
});
const unacknowledged = governance.publicRecordsLog.filter((r) => r.status.startsWith("Not yet"));
const treasurer = governance.board.seats.find((s) => s.seat === "Treasurer");
const treasurerOpen = Boolean(treasurer?.governanceTraining.includes("not yet completed"));
const uncovered = staffing.coverageMatrixThisWeek.filter((c) => c.status.toLowerCase().includes("needs"));

// ---- Assemble ---------------------------------------------------------------

const priorityExposure = atRisk.find((e) => daysFrom(e.due) <= 7);
const netPerFte = fte.revenueEstimate.netValuePerFte;

const overall: Status = urgentMoney ? "critical" : worst([cashStatus, eseStatus, fteStatus, demandStatus]);

const reasons: string[] = [];
if (runwayStatus === "critical") reasons.push(`cash covers ${runwayMonths.toFixed(1)} months, under the 3-month line`);
if (spendStatus !== "good") reasons.push("spending is running ahead of pace");
if (urgentMoney && priorityExposure)
  reasons.push(`Survey 2 carries ${usd(priorityExposure.fteAtRisk * netPerFte)} with a deadline inside a week`);
if (eseStatus === "critical") reasons.push("an IEP review is overdue");
const overallLine = reasons.length
  ? `${reasons.join("; ").replace(/^./, (c) => c.toUpperCase())}.`
  : "Cash, pace, and deadlines are inside their bands.";

const tldr: string[] = [
  `YTD net is ${usd(netYtd)} against ${usd(netPace)} at budget pace. Spending is ${pctOf(spendRatio)} of pace and revenue ${pctOf(revenueRatio)}.`,
  `FTE Survey 2 is due to ACPS in ${daysToSubmit} days, with ${fte.survey2.fteAtRiskTotal} FTE (about ${usd(fte.survey2.revenueAtRiskNet)} net) still unresolved.`,
  overdueIeps.length
    ? `The IEP review for ${overdueIeps[0].studentId} is ${Math.abs(overdueIeps[0].daysUntilDue)} days overdue; ${overdueIeps[0].status.toLowerCase()}.`
    : "No IEP reviews are overdue.",
];

const tiles: PulseTile[] = [
  {
    label: "Cash on hand",
    value: usd(finance.cashOnHand),
    context: `${finance.daysCashOnHand} days of budgeted spending`,
    status: runwayStatus,
  },
  {
    label: "Revenue vs pace",
    value: pctOf(revenueRatio),
    context: `${usd(finance.totals.revenueYtd)} of ${usd(revenuePace)}`,
    status: revenueStatus,
  },
  {
    label: "Spending vs pace",
    value: pctOf(spendRatio),
    context: `${usd(finance.totals.expenseYtd)} of ${usd(expensePace)}`,
    status: spendStatus,
  },
];

const sections: PulseSection[] = [
  {
    title: "Cash & finance",
    status: cashStatus,
    lines: [
      {
        text: `Cash runway ${runwayMonths.toFixed(1)} months (${finance.daysCashOnHand} days). Threshold to confirm with the Finance & Operations Manager.`,
        status: runwayStatus,
      },
      {
        text: `Revenue at ${pctOf(revenueRatio)} of pace. Lagging lines: ${laggingRevenue.join("; ")}.`,
        status: revenueStatus,
      },
      {
        text: `Spending at ${pctOf(spendRatio)} of pace. Net year-to-date is ${usd(netYtd)} against ${usd(netPace)} at pace. Part of the gap is timing: the dataset notes front-loaded renewals, insurance, and the audit fee.`,
        status: spendStatus,
      },
      ...expenseOverPace.map((e) => ({
        text: `${e.line}: ${e.percentOfBudgetUsed}% of budget used${e.note ? ` (${e.note})` : ""}.`,
        status: "warn" as Status,
      })),
    ],
  },
  {
    title: "Enrollment demand",
    status: demandStatus,
    lines: [
      {
        text: `Enrolled ${enrollment.total} of ${enrollment.capacity} seats, ${openSeats} open, with ${enrollment.totalWaitlist} families waitlisted.`,
        status: demandStatus,
      },
      {
        text: `Waitlist per open seat: ${waitlistPerSeat.toFixed(1)}x. Bands borrowed from the skill's pipeline coverage (2x and 1x).`,
      },
      ...(vpk
        ? [
            {
              text: `VPK: ${vpk.students} enrolled and ${vpk.waitlist} waitlisted, against ${PUBLIC_VPK_SEATS} seats on the public listing. Confirm before quoting a seat to a family.`,
              status: "warn" as Status,
            },
          ]
        : []),
    ],
  },
];

const calendarWeek: PulseWeekItem[] = operations.upcomingCalendar
  .filter((e) => daysFrom(e.date) >= 0 && daysFrom(e.date) <= 10)
  .map((e) => ({ iso: e.date, when: weekdayDate(e.date), text: e.event }));
// Sponsor deliverables that already appear on the calendar are shown once, from the calendar.
const calendarDates = new Set(calendarWeek.map((w) => w.iso));
const thisWeek: PulseWeekItem[] = [
  ...calendarWeek,
  ...upcomingSponsor
    .filter((d) => !calendarDates.has(d.due))
    .map((d) => ({ iso: d.due, when: weekdayDate(d.due), text: `${d.item} (${d.status.toLowerCase()})` })),
].sort((a, b) => a.iso.localeCompare(b.iso));

const watch: { text: string; status: Status }[] = [];
for (const r of overdueIeps)
  watch.push({
    status: "critical",
    text: `IEP review for ${r.studentId} (grade ${r.grade}) is ${Math.abs(r.daysUntilDue)} days overdue. Case manager ${r.caseManager}: ${r.status}.`,
  });
for (const e of atRisk)
  watch.push({
    status: daysFrom(e.due) <= 7 ? "critical" : "warn",
    text: `Survey 2 record ${e.studentId} (grade ${e.grade}): ${e.action}. Owner ${e.owner}, due ${shortDate(e.due)}.`,
  });
for (const c of uncovered)
  watch.push({ status: "warn", text: `${c.date}: ${c.absence}. ${c.coverage}.` });
if (boardTickets.length)
  watch.push({
    status: "warn",
    text: `${boardTickets.map((t) => `${t.id} (${t.building}, ${usd(t.estimate)})`).join(" and ")} need board approval at the November 10 meeting.`,
  });
if (p1Tickets.length > 0)
  watch.push({ status: "warn", text: `${p1Tickets.length} open P1 facilities tickets, estimated at ${usd(p1Total)} together.` });
for (const r of unacknowledged)
  watch.push({ status: "warn", text: `${r.id}: ${r.request}. Received ${shortDate(r.received)}, not yet acknowledged.` });
if (treasurer && treasurerOpen) watch.push({ status: "warn", text: `Treasurer: ${treasurer.governanceTraining}` });
for (const v of staffing.vacancies)
  watch.push({ status: "warn", text: `Vacancy: ${v.role} (${v.id}). ${v.note ?? ""}`.trim() });
watch.sort((a, b) => (a.status === b.status ? 0 : a.status === "critical" ? -1 : b.status === "critical" ? 1 : 0));

const priority = priorityExposure
  ? `Close ${priorityExposure.studentId}'s Survey 2 record before ${shortDate(priorityExposure.due)}. ${priorityExposure.action}. That record carries ${priorityExposure.fteAtRisk} FTE, about ${usd(priorityExposure.fteAtRisk * netPerFte)} in net revenue, and the ACPS submission is due ${shortDate(submitDue)}. Owner: ${priorityExposure.owner}.`
  : "No money is at risk with a deadline inside a week. Work the watch list.";

const appendix: { label: string; value: string }[] = [
  { label: "Window", value: `Dataset as of ${DATA_AS_OF}. Year-to-date runs through 2026-09-30.` },
  {
    label: "Sources",
    value: "MACS sample dataset (lib/macs-data.ts). VPK seat count from the public Enrollment page.",
  },
  {
    label: "Not available",
    value:
      "Bank or ledger feed (cash is the dataset figure), receivables aging, school settlements and deal pipeline (not applicable to a school), email and calendar (not connected in this workspace), ACPS portal.",
  },
  {
    label: "Omitted sections",
    value: "Revenue & sales and receivables aging: no source data.",
  },
  {
    label: "Thresholds",
    value:
      "Cash runway (3 and 6 months) and the overall rollup are the skill defaults, marked TODO: confirm with the Finance & Operations Manager. The 5% pace band, the 10-point expense band, and the 20% revenue-lag line are MACS defaults. Enrollment demand borrows the skill's pipeline bands as an analogy.",
  },
];

export const pulse = {
  dateLabel: new Date(`${DATA_AS_OF}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }),
  overall,
  overallLine,
  tldr,
  tiles,
  sections,
  thisWeek,
  watch,
  priority,
  appendix,
};
