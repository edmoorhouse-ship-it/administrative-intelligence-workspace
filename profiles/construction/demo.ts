import type { Area } from "../../lib/access";
import { portfolio, PORTFOLIO_AREA, PORTFOLIO_AS_OF } from "../../lib/construction/portfolio.ts";

// Used only when OPENROUTER_API_KEY is missing: a fixed snapshot built straight from the sample
// portfolio, so the chat can be tried before a key is set. No model is involved. Each section checks
// the role first, the same way the live prompt does.

const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US")}`;
const signedUsd = (n: number) => (n > 0 ? `+${usd(n)}` : usd(n));
const name = (id: string) => portfolio.projects.find((p) => p.id === id)?.name ?? id;
const NOT_SHARED = (what: string) => `_${what} isn't shared with this role. The Preconstruction Director or Estimator has it._`;

function projectsSection() {
  const rows = portfolio.projects.map((p) => `| ${p.id} ${p.name} | ${p.stage} | ${p.units ?? "—"} | ${p.nextMilestone.what} | ${p.nextMilestone.date} (${p.daysToNextMilestone} days) |`);
  return ["### Portfolio", "| Project | Stage | Units | Next milestone | Date |", "|---|---|---:|---|---|", ...rows, "", "[projects]"].join("\n");
}

function coverageSection() {
  const open = portfolio.coverage.filter((c) => c.daysUntilDue >= 0 && c.coverageStatus !== "COVERED").sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const rows = open.map((c) => `| ${name(c.project)} | ${c.trade} | ${c.bidDue} (${c.daysUntilDue} days) | ${c.submitted} of ${c.invited} | ${c.stillBidding} | **${c.coverageStatus}** |`);
  const silent = open.flatMap((c) => c.bidders.filter((b) => b.status === "No response").map((b) => `${b.name} (${c.trade}, ${name(c.project)}, last contact ${b.daysSinceContact} days ago)`));
  return [
    `### Bid coverage gaps (target ${portfolio.meta.targetBidsPerTrade} bids per trade)`,
    "| Project | Trade | Due | Submitted | Still bidding | Coverage |",
    "|---|---|---|---:|---:|---|",
    ...rows,
    "",
    silent.length ? `Chase first, no response yet: ${silent.join("; ")}.` : "No silent bidders on open packages.",
    "[coverage]",
  ].join("\n");
}

function budgetSection(can: (a: Area) => boolean) {
  if (!can(PORTFOLIO_AREA.pricing)) return ["### Estimate vs budget", NOT_SHARED("Pricing")].join("\n");
  const rows = portfolio.pricing.estimates.map(
    (e) => `| ${e.name} | ${e.stage} | ${usd(e.total)} | ${usd(e.developmentBudget)} | ${signedUsd(e.overUnderBudget)} (${e.overUnderPct}%) | ${e.perUnit ? usd(e.perUnit) : "—"} | $${e.perGsf} |`,
  );
  const t = portfolio.pricing.portfolioTotals;
  return [
    "### Estimate vs Development budget",
    "| Project | Stage | Estimate | Budget | Over / (under) | $/unit | $/GSF |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...rows,
    `| **Portfolio** | | **${usd(t.estimate)}** | **${usd(t.developmentBudget)}** | **${signedUsd(t.overUnderBudget)}** | | |`,
    "",
    "Estimate = direct cost + contingency (by stage) + insurance + SDI/bonds + fee. [pricing.estimates, pricing.portfolioTotals]",
  ].join("\n");
}

function veSection(can: (a: Area) => boolean) {
  if (!can(PORTFOLIO_AREA.pricing)) return ["### VE and decisions", NOT_SHARED("VE and pricing decisions")].join("\n");
  const ve = portfolio.pricing.veLog.map((v) => `| ${v.id} | ${v.item} | ${v.savings === null ? "Not priced" : usd(v.savings)} | ${v.status} | ${v.decideBy ?? "—"} |`);
  const decisions = portfolio.pricing.decisionsNeeded.map((d, i) => `${i + 1}. ${name(d.project)}: ${d.decision} (${d.owner}, by ${d.by})`);
  return [
    "### VE log",
    "| ID | Item | Savings | Status | Decide by |",
    "|---|---|---:|---|---|",
    ...ve,
    "",
    "> Memo-only credits are not in the carry until accepted.",
    "",
    "### Decisions needed",
    ...decisions,
    "",
    "[pricing.veLog, pricing.decisionsNeeded]",
  ].join("\n");
}

function rfiSection(can: (a: Area) => boolean) {
  if (!can(PORTFOLIO_AREA.projectRecords)) return ["### RFIs", "_Project records aren't shared with this role. The Project Manager has them._"].join("\n");
  const rows = portfolio.projectRecords.rfis.map((r) => `| ${r.id} | ${name(r.project)} | ${r.subject} | ${r.status}${r.daysUntilDue !== null && r.daysUntilDue < 0 ? ` (**${-r.daysUntilDue} day${r.daysUntilDue === -1 ? "" : "s"} overdue**)` : ""} | ${r.costImpact} |`);
  const addenda = portfolio.addenda.map((a) => `- ${name(a.project)} ${a.number} (${a.issued}): ${a.summary}${a.bidderAcknowledgement ? ` ${a.bidderAcknowledgement}` : ""}`);
  return ["### RFIs", "| RFI | Project | Subject | Status | Cost impact |", "|---|---|---|---|---|", ...rows, "", "### Addenda", ...addenda, "", "[projectRecords.rfis, addenda]"].join("\n");
}

function riskSection(can: (a: Area) => boolean) {
  if (!can(PORTFOLIO_AREA.contractsAndRisk)) return ["### Risks", "_Contracts and risk aren't shared with this role. The Preconstruction Director has them._"].join("\n");
  const rows = portfolio.contractsAndRisk.risks.map((r) => `| ${r.id} | ${name(r.project)} | ${r.risk} | ${r.owner} | ${r.mitigation} |`);
  return ["### Open risks", "| ID | Project | Risk | Owner | Mitigation |", "|---|---|---|---|---|", ...rows, "", "[contractsAndRisk.risks]"].join("\n");
}

export function buildConstructionDemo(question: string, can: (area: Area) => boolean, modelLabel: string): string {
  const q = question.toLowerCase();
  const sections: string[] = [];
  if (/cover|bidder|chase|due|invite|reminder|silent/.test(q)) sections.push(coverageSection());
  if (/budget|estimate|gmp|cost|development|\$|per unit|spread/.test(q)) sections.push(budgetSection(can));
  if (/\bve\b|value engineer|decision|carry|credit/.test(q)) sections.push(veSection(can));
  if (/rfi|drawing|addend|asi/.test(q)) sections.push(rfiSection(can));
  if (/risk|lead time|switchgear|insurance|bond|escalat/.test(q)) sections.push(riskSection(can));
  if (sections.length === 0) sections.push(projectsSection(), coverageSection());

  return [
    "> **Demo mode — no OpenRouter key configured.** This reply was generated locally from the sample portfolio, not by a model. " +
      `Add \`OPENROUTER_API_KEY\` to \`.env.local\` and restart \`npm run dev\` to get live answers from ${modelLabel}.`,
    "",
    `> **Sample data** — figures below come from the workspace's illustrative portfolio (as of ${PORTFOLIO_AS_OF}); verify against the estimate and BuildingConnected before use.`,
    "",
    ...sections.flatMap((s) => [s, ""]),
  ].join("\n");
}
