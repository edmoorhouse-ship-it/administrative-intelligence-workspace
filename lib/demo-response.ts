import { DATA_AS_OF, macsData } from "./macs-data";
import type { ModelOption } from "./models";

// Used only when OPENROUTER_API_KEY is missing: a deterministic snapshot built
// straight from the sample dataset, so the UI (streaming, tables, callouts) can
// be exercised before a key is configured. No model is involved.

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function enrollmentSection() {
  const { enrollment, staffing } = macsData;
  const rows = enrollment.byGrade.map((g) => `| ${g.grade} | ${g.students} | ${g.sections} | ${g.swd} | ${g.waitlist} |`);
  return [
    "### Enrollment snapshot",
    "| Grade | Students | Sections | SWD | Waitlist |",
    "|---|---:|---:|---:|---:|",
    ...rows,
    `| **Total** | **${enrollment.total}** | | **${enrollment.studentsWithDisabilities}** | **${enrollment.totalWaitlist}** |`,
    "",
    `Student-to-teacher ratio: **${staffing.studentTeacherRatio}** across ${staffing.instructionalTeacherFte} classroom + ESE teacher FTE. [enrollment.byGrade, staffing]`,
  ].join("\n");
}

function fastSection() {
  const rows = macsData.assessment.fastPm1.math
    .filter((r) => r.cohortChangePts !== null)
    .sort((a, b) => (a.cohortChangePts ?? 0) - (b.cohortChangePts ?? 0))
    .map((r) => `| ${r.grade} | ${r.priorYearPm3}% | ${r.pm1}% | ${signed(r.cohortChangePts ?? 0)} | ${signed(r.vsAcpsPts)} |`);
  return [
    "### FAST math — cohort change, prior-year PM3 to PM1",
    "| Grade | Prior PM3 | PM1 | Change (pts) | vs ACPS (pts) |",
    "|---|---:|---:|---:|---:|",
    ...rows,
    "",
    "[assessment.fastPm1.math]",
  ].join("\n");
}

function fteSection() {
  const { survey2, surveyCalendar, revenueEstimate } = macsData.fte;
  const due = surveyCalendar.find((s) => s.survey === "Survey 2");
  const rows = survey2.exceptions.map((e) => `| ${e.studentId} | ${e.issue} | ${e.owner} | ${e.due} |`);
  return [
    `### FTE Survey 2 exceptions (district submission due ${due?.districtSubmissionDue})`,
    "| Record | Issue | Owner | Due |",
    "|---|---|---|---|",
    ...rows,
    "",
    `FTE at risk: **${survey2.fteAtRiskTotal}** ≈ **${usd(survey2.revenueAtRiskNet)}** net at ${usd(revenueEstimate.netValuePerFte)} per FTE. [fte.survey2]`,
  ].join("\n");
}

function financeSection() {
  const flagged = macsData.finance.expenses
    .filter((e) => e.percentOfBudgetUsed - 25 > 10)
    .map((e) => `| ${e.line} | ${usd(e.budget)} | ${usd(e.ytdActual)} | ${e.percentOfBudgetUsed}% |`);
  return [
    "### Expense lines more than 10 points ahead of the 25% pace",
    "| Line | Budget | YTD actual | % used |",
    "|---|---:|---:|---:|",
    ...flagged,
    "",
    `Days of cash on hand: **${macsData.finance.daysCashOnHand}**. [finance.expenses, finance.daysCashOnHand]`,
  ].join("\n");
}

function newsletterSection() {
  const { notes, week } = macsData.facultyNotesForNewsletter;
  return [
    `### Faculty notes on file for ${week}`,
    `${notes.length} notes are ready to draft from, including VPK, K-2, grades 3-5, middle school, specials, and front office. [facultyNotesForNewsletter]`,
  ].join("\n");
}

export function buildDemoResponse(question: string, model: ModelOption): string {
  const q = question.toLowerCase();
  const sections: string[] = [];
  if (/fast|pm1|pm2|i-ready|iready|reading|math|growth/.test(q)) sections.push(fastSection());
  if (/fte|survey|ese|iep|matrix|audit/.test(q)) sections.push(fteSection());
  if (/board|financ|budget|sunshine|acps|compliance/.test(q)) sections.push(financeSection());
  if (/newsletter|parentsquare|faculty/.test(q)) sections.push(newsletterSection());
  if (sections.length === 0) sections.push(enrollmentSection());

  return [
    "> **Demo mode — no OpenRouter key configured.** This reply was generated locally from the sample dataset, not by a model. " +
      `Add \`OPENROUTER_API_KEY\` to \`.env.local\` and restart \`npm run dev\` to get live answers from ${model.label}.`,
    "",
    `> **Sample data** — figures below come from the workspace's illustrative dataset (as of ${DATA_AS_OF}); verify against official records before use.`,
    "",
    ...sections.flatMap((s) => [s, ""]),
  ].join("\n");
}
