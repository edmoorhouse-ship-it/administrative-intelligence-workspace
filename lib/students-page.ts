import { macsData } from "./macs-data";
import { attendanceSummary, GRADES, gradeSummary, type Grade, type Student } from "./student-roster";
import type { DecisionCard } from "./tool-pages";
import { MAX_TOOL_CONTEXT } from "./tools";

/** Filters, decisions, and the chat snapshot for the Students page. Codes only, never names. */

export type SupportFilter = "iep" | "504" | "ell" | "frl" | "gifted" | "chronic" | "intervention" | "below";

export const SUPPORT_FILTERS: { id: SupportFilter; label: string; test: (s: Student) => boolean }[] = [
  { id: "iep", label: "IEP", test: (s) => Boolean(s.iep) },
  { id: "504", label: "504", test: (s) => s.plan504 },
  { id: "ell", label: "ELL", test: (s) => s.ell },
  { id: "frl", label: "Free/reduced lunch", test: (s) => s.frl },
  { id: "gifted", label: "Gifted", test: (s) => s.gifted },
  { id: "chronic", label: "Chronically absent", test: (s) => s.chronicAbsence },
  { id: "intervention", label: "In intervention", test: (s) => Boolean(s.intervention) },
  { id: "below", label: "Below Level 3", test: (s) => (s.fastEla !== null && s.fastEla < 3) || (s.fastMath !== null && s.fastMath < 3) },
];

export interface StudentFilters {
  grade: Grade | "all";
  supports: SupportFilter[];
  query: string;
}

export function applyFilters(students: Student[], f: StudentFilters) {
  const q = f.query.trim().toUpperCase().replace(/^S-?/, "");
  const tests = SUPPORT_FILTERS.filter((x) => f.supports.includes(x.id));
  return students.filter(
    (s) => (f.grade === "all" || s.grade === f.grade) && tests.every((t) => t.test(s)) && (!q || s.id.replace("S-", "").includes(q)),
  );
}

export const describeFilters = (f: StudentFilters) =>
  [f.grade === "all" ? "all grades" : f.grade === "VPK" ? "VPK" : f.grade === "K" ? "kindergarten" : `grade ${f.grade}`, ...SUPPORT_FILTERS.filter((x) => f.supports.includes(x.id)).map((x) => x.label.toLowerCase()), f.query ? `code contains "${f.query}"` : ""]
    .filter(Boolean)
    .join(", ");

const levelText = (l: number | null) => (l === null ? "not tested" : `Level ${l}`);

export function studentLine(s: Student) {
  return [
    `${s.id}: grade ${s.grade}, section ${s.section}, homeroom ${s.teacher}`,
    s.iep ? `IEP (${s.iep.eligibility}, matrix ${s.iep.matrix})` : "",
    s.plan504 ? "504 plan" : "",
    s.ell ? "ELL" : "",
    s.frl ? "free/reduced lunch" : "",
    s.gifted ? "gifted" : "",
    `attendance ${s.attendancePct}% (${s.daysAbsent} of ${s.daysEnrolled} days absent${s.chronicAbsence ? ", chronically absent" : ""})`,
    `September tardies ${s.septemberTardies}${s.septemberBusTardies ? ` (${s.septemberBusTardies} bus)` : ""}`,
    `FAST PM1 ELA ${levelText(s.fastEla)}, math ${levelText(s.fastMath)}`,
    s.intervention ?? "",
    s.bus ? `rides ACPS Route ${s.bus}` : "",
    `family ${s.familyId}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function studentsContext(all: Student[], shown: Student[], filters: StudentFilters, selected: Student | null) {
  const a = attendanceSummary(shown);
  const chronic = all.filter((s) => s.chronicAbsence);
  const lines = [
    `Sample roster: ${all.length} students (codes only). Showing ${shown.length} for ${describeFilters(filters)}.`,
    `Shown: attendance ${a.averageDailyAttendancePct}%, ${a.chronicallyAbsent} chronically absent, ${shown.filter((s) => s.iep).length} IEPs, ${shown.filter((s) => s.plan504).length} 504 plans, ${shown.filter((s) => s.ell).length} ELL, ${shown.filter((s) => s.frl).length} free/reduced lunch, ${shown.filter((s) => s.intervention).length} in intervention.`,
    "By grade (students; % Level 3+ ELA / math):",
    ...GRADES.map((g) => {
      const x = gradeSummary(g);
      return `- ${g}: ${x.students}; ${x.elaLevel3Pct ?? "n/a"}% / ${x.mathLevel3Pct ?? "n/a"}%`;
    }),
    `Chronically absent (${chronic.length}): ${chronic.map((s) => `${s.id} (gr ${s.grade}, ${s.attendancePct}%)`).join(", ")}.`,
    selected ? `Selected student: ${studentLine(selected)}.` : "",
  ].filter(Boolean);
  const text = lines.join("\n");
  return text.length > MAX_TOOL_CONTEXT ? `${text.slice(0, MAX_TOOL_CONTEXT - 1)}…` : text;
}

export function studentCards(all: Student[]): DecisionCard[] {
  const chronic = all.filter((s) => s.chronicAbsence);
  const msMath = all.filter((s) => (s.grade === "6" || s.grade === "7") && s.fastMath !== null && s.fastMath < 3);
  const atCap = macsData.fte.classSize.watchItem;
  const cards: DecisionCard[] = [];
  if (chronic.length) {
    cards.push({
      id: "students-chronic",
      title: `${chronic.length} students are chronically absent`,
      detail: `Each has missed 10% or more of their days this year: ${chronic.slice(0, 6).map((s) => s.id).join(", ")}${chronic.length > 6 ? ", and more" : ""}.`,
      urgency: "critical",
      options: [
        {
          id: "draft",
          label: "Draft family check-ins",
          ask: `Draft a warm, short family check-in note and a two-minute call script the Dean can use for chronically absent students. Refer to students only by code: ${chronic.map((s) => s.id).join(", ")}. Mark everything as a draft for a person to send.`,
        },
        { id: "dean", label: "The Dean will call" },
        { id: "later", label: "Not now" },
      ],
    });
  }
  if (msMath.length) {
    cards.push({
      id: "students-ms-math",
      title: `${msMath.length} middle schoolers are below Level 3 in math`,
      detail: "Grades 6 and 7 have no math intervention block in the schedule, so none of them get Tier 2 support.",
      urgency: "warn",
      options: [
        {
          id: "draft",
          label: "Draft an intervention plan",
          ask: `Draft a plan for Tier 2 math in grades 6-7 for the ${msMath.length} students below Level 3 on FAST PM1. Suggest where a 30-minute block could fit, who could teach it, and how to group students. Keep it practical.`,
        },
        { id: "plc", label: "Raise it at PLC" },
        { id: "later", label: "Not now" },
      ],
    });
  }
  if (atCap.includes("cap")) {
    cards.push({
      id: "students-class-cap",
      title: "Two sections are at the class-size cap",
      detail: atCap,
      urgency: "warn",
      options: [
        { id: "route", label: "Route new seats elsewhere" },
        {
          id: "ask",
          label: "What are my options?",
          ask: "Two K-3 sections are at the 18-student cap. What are our options for the next K-3 enrollments, and what should the front office tell families on the waitlist?",
        },
      ],
    });
  }
  return cards;
}
