/**
 * Preconstruction pulse: one page, the same shape as the MACS business pulse (overall status, TL;DR,
 * tiles, sections, this week, watch list, one priority, appendix), computed from the sample
 * portfolio for one role. Sections a role can't see are left out, not blanked.
 *
 * Bands (owner's choice): an estimate under budget is on track; 0-3% over is Watch; more than 3%
 * over is Act now, at every stage. Coverage uses the three-bid target.
 */

import type { Area } from "../access";
import type { PulseLine, PulseSection, PulseTile, PulseWeekItem, Status } from "../pulse";
import { portfolio, PORTFOLIO_AREA, PORTFOLIO_AS_OF, TARGET_BIDS, daysUntil } from "./portfolio.ts";

export const BUDGET_WATCH_PCT = 0;
export const BUDGET_ACT_PCT = 3;

const STATUS_LABEL: Record<Status, string> = { good: "On track", warn: "Watch", critical: "Act now", na: "No data" };
const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const millions = (n: number) => `${n < 0 ? "-" : "+"}$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const weekdayDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const name = (id: string) => portfolio.projects.find((p) => p.id === id)?.name ?? id;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Ends a phrase with one period, even when it already ends in "?" or ".". */
const sentence = (text: string) => (/[.?!]$/.test(text) ? text : `${text}.`);

const worst = (statuses: Status[]): Status =>
  statuses.includes("critical") ? "critical" : statuses.includes("warn") ? "warn" : statuses.includes("good") ? "good" : "na";

/** Budget color for an estimate: under is good, 0-3% over is Watch, more than 3% over is Act now. */
export const budgetStatus = (overUnderPct: number): Status =>
  overUnderPct <= BUDGET_WATCH_PCT ? "good" : overUnderPct <= BUDGET_ACT_PCT ? "warn" : "critical";

const coverageColor = (s: string): Status => (s === "COVERED" ? "good" : s === "AT RISK" ? "critical" : s.startsWith("CLOSED") ? "na" : "warn");

export interface Pulse {
  dateLabel: string;
  overall: Status;
  overallLine: string;
  tldr: string[];
  tiles: PulseTile[];
  sections: PulseSection[];
  thisWeek: PulseWeekItem[];
  watch: { text: string; status: Status }[];
  priority: string;
  appendix: { label: string; value: string }[];
  /** The page as text, for a chat started from it. */
  context: string;
}

export function constructionPulse(can: (area: Area) => boolean): Pulse {
  const seesPricing = can(PORTFOLIO_AREA.pricing);
  const seesRecords = can(PORTFOLIO_AREA.projectRecords);
  const seesRisk = can(PORTFOLIO_AREA.contractsAndRisk);
  const { coverage, projects } = portfolio;
  const { estimates, portfolioTotals, decisionsNeeded, proposalValidity, veSummary } = portfolio.pricing;
  const { rfis } = portfolio.projectRecords;
  const { risks } = portfolio.contractsAndRisk;

  // ---- Bid coverage & due dates (everyone)
  const open = coverage.filter((c) => c.daysUntilDue >= 0).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const dueThisWeek = open.filter((c) => c.daysUntilDue <= 7);
  const atRisk = open.filter((c) => c.coverageStatus === "AT RISK");
  const atRiskThisWeek = dueThisWeek.filter((c) => c.coverageStatus === "AT RISK");
  const silent = open.flatMap((c) => c.bidders.filter((b) => b.status === "No response").map((b) => ({ ...b, package: c })));
  const coverageStatus: Status = atRiskThisWeek.length ? "critical" : open.some((c) => c.coverageStatus !== "COVERED") ? "warn" : "good";

  // ---- Leveling progress (everyone)
  const bidPackages = coverage.filter((c) => c.leveling !== "Budget pricing only");
  const leveled = bidPackages.filter((c) => c.leveling === "Leveled");
  const inProgress = bidPackages.filter((c) => c.leveling === "In leveling" || c.leveling === "Clarifications out");
  const waiting = bidPackages.filter((c) => c.leveling === "Waiting on bids" || c.leveling === "Not started");
  const closedNotLeveled = bidPackages.filter((c) => c.daysUntilDue < 0 && c.leveling !== "Leveled");
  const levelingStatus: Status = closedNotLeveled.length ? "warn" : "good";

  // ---- Estimate vs budget (pricing)
  const budgetColors = estimates.map((e) => budgetStatus(e.overUnderPct));
  const budgetOverall: Status = seesPricing ? worst(budgetColors) : "na";
  const portfolioPct = Math.round((portfolioTotals.overUnderBudget / portfolioTotals.developmentBudget) * 1000) / 10;
  const notBid = (e: (typeof estimates)[number]) =>
    Object.entries(e.basisMix)
      .filter(([basis]) => basis !== "Leveled bid" && basis !== "Vendor bid (not leveled)")
      .reduce((a, [, amount]) => a + amount, 0);

  // ---- Decisions, RFIs & risks (by area)
  const decisionsSoon = decisionsNeeded.filter((d) => daysUntil(d.by) <= 14).sort((a, b) => a.by.localeCompare(b.by));
  const overdueRfis = rfis.filter((r) => r.daysUntilDue !== null && r.daysUntilDue < 0);
  const openRfis = rfis.filter((r) => r.status === "Open");
  const expiring = proposalValidity.filter((v) => v.daysLeft >= 0 && v.daysLeft <= 21);
  const decisionsStatus = worst([
    ...(seesPricing ? [decisionsSoon.some((d) => daysUntil(d.by) <= 7) ? ("warn" as Status) : ("good" as Status)] : []),
    ...(seesRecords ? [overdueRfis.length ? ("critical" as Status) : openRfis.length ? ("warn" as Status) : ("good" as Status)] : []),
    ...(seesRisk ? [risks.length ? ("warn" as Status) : ("good" as Status)] : []),
  ]);

  // ---- Overall
  const overall = worst([coverageStatus, levelingStatus, budgetOverall, decisionsStatus].filter((s) => s !== "na"));
  const reasons: string[] = [];
  if (atRisk.length) reasons.push(`${plural(atRisk.length, "open trade")} below the ${TARGET_BIDS}-bid target with no one else bidding`);
  if (seesPricing) {
    const red = estimates.filter((e) => budgetStatus(e.overUnderPct) === "critical");
    if (red.length) reasons.push(`${red.map((e) => e.name).join(" and ")} more than ${BUDGET_ACT_PCT}% over budget`);
  }
  if (seesRecords && overdueRfis.length) reasons.push(`${plural(overdueRfis.length, "RFI")} overdue`);
  const overallLine = reasons.length ? `${reasons.join("; ").replace(/^./, (c) => c.toUpperCase())}.` : "Coverage, leveling, and deadlines are inside their bands.";

  const tldr = [
    `${plural(dueThisWeek.length, "trade")} due in the next 7 days, ${atRiskThisWeek.length} of them at risk on coverage; ${plural(silent.length, "silent bidder")} to chase.`,
    `${leveled.length} of ${bidPackages.length} bid packages leveled, ${inProgress.length} in leveling or clarifications, ${waiting.length} waiting on bids.`,
    seesPricing
      ? `Portfolio estimate ${usd(portfolioTotals.estimate)} against ${usd(portfolioTotals.developmentBudget)} budget: ${millions(portfolioTotals.overUnderBudget)} (${portfolioPct}%).`
      : seesRecords
        ? `${plural(openRfis.length, "open RFI")}, ${overdueRfis.length} overdue.`
        : `${plural(projects.length, "project")} in precon; next milestone ${projects.map((p) => p.nextMilestone).sort((a, b) => a.date.localeCompare(b.date))[0].what.toLowerCase()} on ${shortDate(projects.map((p) => p.nextMilestone).sort((a, b) => a.date.localeCompare(b.date))[0].date)}.`,
  ];

  const tiles: PulseTile[] = [
    {
      label: "Bids due in 7 days",
      value: String(dueThisWeek.length),
      context: `${atRiskThisWeek.length} at risk, ${dueThisWeek.filter((c) => c.coverageStatus === "WATCH").length} on watch (target ${TARGET_BIDS} bids)`,
      status: coverageStatus,
    },
    {
      label: "Packages leveled",
      value: `${leveled.length} of ${bidPackages.length}`,
      context: `${inProgress.length} in leveling, ${waiting.length} waiting on bids`,
      status: levelingStatus,
    },
    seesPricing
      ? {
          label: "Portfolio vs budget",
          value: millions(portfolioTotals.overUnderBudget),
          context: `${portfolioPct}% across ${plural(estimates.length, "project")}`,
          status: budgetStatus(portfolioPct),
        }
      : {
          label: seesRecords ? "Open RFIs" : "Next milestone",
          value: seesRecords ? String(openRfis.length) : shortDate([...projects].sort((a, b) => a.nextMilestone.date.localeCompare(b.nextMilestone.date))[0].nextMilestone.date),
          context: seesRecords ? `${overdueRfis.length} overdue` : [...projects].sort((a, b) => a.nextMilestone.date.localeCompare(b.nextMilestone.date))[0].nextMilestone.what,
          status: seesRecords ? (overdueRfis.length ? "critical" : openRfis.length ? "warn" : "good") : "na",
        },
  ];

  const sections: PulseSection[] = [
    {
      title: "Bid coverage & due dates",
      status: coverageStatus,
      lines: [
        ...open.map(
          (c): PulseLine => ({
            text: `${name(c.project)} ${c.trade}: due ${shortDate(c.bidDue)} (${c.daysUntilDue} days), ${c.submitted} of ${c.invited} in, ${c.stillBidding} still bidding. ${c.coverageStatus}.`,
            status: coverageColor(c.coverageStatus),
          }),
        ),
        ...(silent.length
          ? [{ text: `No response yet: ${silent.map((b) => `${b.name} (${b.package.trade}, ${b.daysSinceContact} days)`).join("; ")}.` }]
          : []),
      ],
    },
    {
      title: "Leveling progress",
      status: levelingStatus,
      lines: [
        ...inProgress.map((c): PulseLine => ({ text: `${name(c.project)} ${c.trade}: ${c.leveling.toLowerCase()}.${c.note ? ` ${c.note}` : ""}`, status: "warn" })),
        ...leveled.map((c): PulseLine => ({ text: `${name(c.project)} ${c.trade}: leveled with ${plural(c.submitted, "bid")}. The carry is the Director's call.`, status: "good" })),
        { text: `${plural(waiting.length, "package")} waiting on bids; leveling starts when they're in. Proposals are leveled on the Bid leveling page.` },
      ],
    },
  ];

  if (seesPricing) {
    sections.push({
      title: "Estimate vs budget",
      status: budgetOverall,
      lines: [
        ...estimates.map(
          (e): PulseLine => ({
            text: `${e.name} (${e.stage}): ${usd(e.total)} vs ${usd(e.developmentBudget)}, ${millions(e.overUnderBudget)} (${e.overUnderPct}%)${e.perUnit ? `, ${usd(e.perUnit)}/unit` : ""}. ${usd(notBid(e))} still estimate, allowance, or plug.`,
            status: budgetStatus(e.overUnderPct),
          }),
        ),
        {
          text: `VE pending with Development: ${veSummary
            .filter((v) => v.pendingDevelopment > 0)
            .map((v) => `${name(v.project)} ${usd(v.pendingDevelopment)}`)
            .join("; ") || "none"}. Accepted VE is already in the numbers; memo-only credits are not.`,
        },
        { text: `Bands: under budget is On track; 0-${BUDGET_ACT_PCT}% over is Watch; more than ${BUDGET_ACT_PCT}% over is Act now, at every stage.` },
      ],
    });
  }

  const decisionLines: PulseLine[] = [
    ...(seesPricing ? decisionsSoon.map((d): PulseLine => ({ text: `Decision by ${shortDate(d.by)}: ${d.decision} (${d.owner}, ${name(d.project)}).`, status: daysUntil(d.by) <= 7 ? "warn" : undefined })) : []),
    ...(seesPricing ? expiring.map((v): PulseLine => ({ text: `${v.bidder} proposal (${v.package}) is valid through ${shortDate(v.validThrough)}, ${v.daysLeft} days.`, status: "warn" })) : []),
    ...(seesRecords
      ? openRfis.map((r): PulseLine => ({ text: `${r.id} (${name(r.project)}): ${sentence(r.subject)} Due ${shortDate(r.due)}${r.daysUntilDue !== null && r.daysUntilDue < 0 ? `, ${plural(-r.daysUntilDue, "day")} overdue` : ""}. Cost impact: ${r.costImpact.toLowerCase()}.`, status: r.daysUntilDue !== null && r.daysUntilDue < 0 ? "critical" : undefined }))
      : []),
    ...(seesRisk ? risks.map((r): PulseLine => ({ text: `${r.id} (${name(r.project)}): ${sentence(r.risk)} ${r.mitigation} Owner: ${r.owner}.` })) : []),
  ];
  if (decisionLines.length) sections.push({ title: "Decisions, RFIs & risks", status: decisionsStatus, lines: decisionLines });

  // ---- This week (next 10 days)
  const soon = (iso: string) => daysUntil(iso) >= 0 && daysUntil(iso) <= 10;
  const thisWeek: PulseWeekItem[] = [
    ...open.filter((c) => soon(c.bidDue)).map((c) => ({ iso: c.bidDue, when: weekdayDate(c.bidDue), text: `Bids due: ${name(c.project)} ${c.trade}` })),
    ...portfolio.meetings.filter((m) => soon(m.date)).map((m) => ({ iso: m.date, when: weekdayDate(m.date), text: `${name(m.project)}: ${m.what}, ${m.time}` })),
    ...projects.filter((p) => soon(p.nextMilestone.date)).map((p) => ({ iso: p.nextMilestone.date, when: weekdayDate(p.nextMilestone.date), text: `${p.name}: ${p.nextMilestone.what}` })),
    ...(seesPricing ? decisionsNeeded.filter((d) => soon(d.by)).map((d) => ({ iso: d.by, when: weekdayDate(d.by), text: `Decision due: ${d.decision}` })) : []),
    ...(seesRecords ? openRfis.filter((r) => soon(r.due)).map((r) => ({ iso: r.due, when: weekdayDate(r.due), text: `${r.id} response due` })) : []),
  ].sort((a, b) => a.iso.localeCompare(b.iso) || a.text.localeCompare(b.text));

  // ---- Watch list
  const watch: { text: string; status: Status }[] = [
    ...atRisk.map((c) => ({ status: (c.daysUntilDue <= 7 ? "critical" : "warn") as Status, text: `${name(c.project)} ${c.trade}: ${c.submitted} of ${c.invited} bids with ${c.daysUntilDue} days left and nobody else bidding.${c.note ? ` ${c.note}` : ""}` })),
    ...closedNotLeveled.map((c) => ({ status: "warn" as Status, text: `${name(c.project)} ${c.trade}: bids closed ${shortDate(c.bidDue)}, still ${c.leveling.toLowerCase()}.` })),
    ...(seesRecords ? overdueRfis.map((r) => ({ status: "critical" as Status, text: `${r.id} is ${plural(-r.daysUntilDue!, "day")} overdue: ${sentence(r.subject)}` })) : []),
    ...(seesPricing ? estimates.filter((e) => budgetStatus(e.overUnderPct) === "critical").map((e) => ({ status: "critical" as Status, text: `${e.name} is ${e.overUnderPct}% over budget at ${e.stage} (${millions(e.overUnderBudget)}).` })) : []),
    ...(seesPricing ? expiring.map((v) => ({ status: "warn" as Status, text: `${v.bidder} proposal expires ${shortDate(v.validThrough)}; re-confirm before the carry.` })) : []),
  ].sort((a, b) => (a.status === b.status ? 0 : a.status === "critical" ? -1 : 1));

  // ---- One priority: the at-risk trade due soonest, else the reddest estimate, else the oldest overdue RFI.
  const firstRisk = atRisk.find((c) => c.daysUntilDue <= 7);
  const reddest = seesPricing ? [...estimates].sort((a, b) => b.overUnderPct - a.overUnderPct).find((e) => budgetStatus(e.overUnderPct) === "critical") : undefined;
  const priority = firstRisk
    ? `Get coverage on ${name(firstRisk.project)} ${firstRisk.trade} before ${shortDate(firstRisk.bidDue)}: ${firstRisk.submitted} of ${firstRisk.invited} bids in and nobody else bidding. Chase ${firstRisk.bidders.filter((b) => b.status === "No response").map((b) => b.name).join(" and ") || "new bidders"} today${firstRisk.note ? `. ${firstRisk.note}` : "."}`
    : reddest
      ? `Bring ${reddest.name} back toward budget: ${reddest.overUnderPct}% over at ${reddest.stage}. Start with the VE log.`
      : "No trade is at risk this week. Work the watch list.";

  const appendix = [
    { label: "Window", value: `Portfolio as of ${PORTFOLIO_AS_OF}. "This week" looks 10 days ahead.` },
    { label: "Sources", value: "Sample portfolio (lib/construction/portfolio.ts). Not connected to BuildingConnected, Outlook, or the estimate workbook." },
    {
      label: "Thresholds",
      value: `Coverage target ${TARGET_BIDS} bids per trade. Budget: under is On track, 0-${BUDGET_ACT_PCT}% over is Watch, more than ${BUDGET_ACT_PCT}% over is Act now (owner's choice, one band for every stage).`,
    },
    ...(seesPricing && seesRecords && seesRisk ? [] : [{ label: "Not shown", value: [!seesPricing && "pricing and decisions", !seesRecords && "RFIs and drawings", !seesRisk && "contracts and risk"].filter(Boolean).join(", ") + " (outside this role)." }]),
  ];

  const pulse = {
    dateLabel: new Date(`${PORTFOLIO_AS_OF}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
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
  const context = [
    `Overall: ${STATUS_LABEL[overall]}. ${overallLine}`,
    "Summary:",
    ...tldr.map((t) => `- ${t}`),
    ...sections.flatMap((s) => [`${s.title} (${STATUS_LABEL[s.status]}):`, ...s.lines.map((l) => `- ${l.text}`)]),
    "Watch list:",
    ...watch.map((w) => `- [${STATUS_LABEL[w.status]}] ${w.text}`),
    `Priority: ${priority}`,
  ].join("\n");
  return { ...pulse, context: context.length > 7_500 ? `${context.slice(0, 7_499)}…` : context };
}
