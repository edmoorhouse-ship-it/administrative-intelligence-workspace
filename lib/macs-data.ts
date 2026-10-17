/**
 * MACS operational dataset — SAMPLE DATA ONLY.
 *
 * Every figure, ID, date, roster entry, and status in this file is illustrative.
 * None of it comes from Micanopy Area Cooperative School, Alachua County Public
 * Schools, or FLDOE records. Student and staff identifiers are role codes, not
 * people. Replace each section with exports from the real systems of record
 * before using any output for decisions, board materials, or sponsor reporting.
 *
 * Derived numbers (totals, ratios, revenue, variances, ages) are computed below
 * rather than typed in, so the dataset stays internally consistent when edited.
 */

import { canAccess } from "./access";
import { DATA_AS_OF, SAMPLE_DATA_NOTICE } from "./data-notice";
import type { AdminRoleId } from "./roles";
import { attendanceSummary, GRADES, gradeSummary, sectionSize, STUDENTS, subgroupGap, type Grade } from "./student-roster";

export { DATA_AS_OF, SAMPLE_DATA_NOTICE };

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

const pct = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Enrollment
// ---------------------------------------------------------------------------

/** Families waiting for a seat, by grade (sample). Everything else per grade comes from the student roster. */
const waitlistByGrade: Record<Grade, number> = { VPK: 9, K: 6, "1": 4, "2": 3, "3": 2, "4": 2, "5": 1, "6": 0, "7": 0 };

const enrollmentByGrade = GRADES.map((grade) => {
  const g = gradeSummary(grade);
  return { grade, students: g.students, sections: g.sections, fefpFunded: grade !== "VPK", swd: g.swd, ell: g.ell, frl: g.frl, waitlist: waitlistByGrade[grade] };
});

const studentsIn = (grade: Grade) => enrollmentByGrade.find((g) => g.grade === grade)?.students ?? 0;
/** "K section A (17)" or "Grade 3 section B (17)", sized from the roster. */
const section = (name: string) => {
  const [grade, letter] = name.split("-");
  return `${grade === "K" ? "K" : `Grade ${grade}`} section ${letter} (${sectionSize(name)})`;
};
const SPEECH_LANGUAGE = ["SI", "LI", "SLD, LI"];
const slpCaseload = STUDENTS.filter((st) => st.iep && SPEECH_LANGUAGE.includes(st.iep.eligibility)).length;

const totalEnrollment = sum(enrollmentByGrade.map((g) => g.students));
const fefpEligibleStudents = sum(
  enrollmentByGrade.filter((g) => g.fefpFunded).map((g) => g.students),
);

// ---------------------------------------------------------------------------
// Staffing
// ---------------------------------------------------------------------------

type StaffCategory = "leadership" | "office" | "instructional" | "specials" | "support" | "operations";

interface StaffMember {
  id: string;
  role: string;
  category: StaffCategory;
  fte: number;
  assignment: string;
  certification?: string;
  flag?: string;
  vacant?: boolean;
}

const roster: StaffMember[] = [
  { id: "L-01", role: "Director / Principal", category: "leadership", fte: 1, assignment: "School leader; ACPS sponsor liaison; Board reporting" },
  { id: "L-02", role: "Dean of Students", category: "leadership", fte: 1, assignment: "Discipline, attendance, arrival/dismissal, coverage scheduling" },
  { id: "L-03", role: "ESE Coordinator", category: "leadership", fte: 1, assignment: "IEP/504 compliance, matrix of services, SLP and gifted coordination" },
  { id: "L-04", role: "Finance & Operations Manager", category: "leadership", fte: 1, assignment: "Budget, payroll, FEFP reconciliation, facilities vendors" },
  { id: "O-01", role: "Office Manager / Registrar", category: "office", fte: 1, assignment: "Enrollment records, FTE survey data entry, ParentSquare admin" },
  { id: "O-03", role: "Records & Data Assistant", category: "office", fte: 0.5, assignment: "Student records, FTE survey documentation, attendance follow-up" },
  { id: "O-02", role: "Attendance & Front Desk Clerk", category: "office", fte: 0.75, assignment: "Daily attendance, tardies, visitor management" },
  { id: "T-VPK-A", role: "VPK Lead Teacher", category: "instructional", fte: 1, assignment: `VPK (${studentsIn("VPK")} students)`, certification: "VPK instructor credential" },
  { id: "T-K-A", role: "Kindergarten Teacher", category: "instructional", fte: 1, assignment: section("K-A"), certification: "Professional — Elementary K-6" },
  { id: "T-K-B", role: "Kindergarten Teacher", category: "instructional", fte: 1, assignment: section("K-B"), certification: "Professional — Elementary K-6", flag: "Reading endorsement in progress (competency 3 of 5)" },
  { id: "T-1-A", role: "Grade 1 Teacher", category: "instructional", fte: 1, assignment: section("1-A"), certification: "Professional — Elementary K-6" },
  { id: "T-1-B", role: "Grade 1 Teacher", category: "instructional", fte: 1, assignment: section("1-B"), certification: "Professional — Elementary K-6" },
  { id: "T-2-A", role: "Grade 2 Teacher", category: "instructional", fte: 1, assignment: section("2-A"), certification: "Professional — Elementary K-6" },
  { id: "T-2-B", role: "Grade 2 Teacher", category: "instructional", fte: 1, assignment: section("2-B"), certification: "Professional — Elementary K-6" },
  { id: "T-3-A", role: "Grade 3 Teacher", category: "instructional", fte: 1, assignment: section("3-A"), certification: "Professional — Elementary K-6" },
  { id: "T-3-B", role: "Grade 3 Teacher", category: "instructional", fte: 1, assignment: section("3-B"), certification: "Temporary — Elementary K-6", flag: "Temporary certificate expires 2027-06-30; subject-area exam not yet passed" },
  { id: "T-4-A", role: "Grade 4 Teacher", category: "instructional", fte: 1, assignment: `${section("4-A")}; gifted pull-out Wednesdays`, certification: "Professional — Elementary K-6, Gifted endorsement" },
  { id: "T-4-B", role: "Grade 4 Teacher", category: "instructional", fte: 1, assignment: section("4-B"), certification: "Professional — Elementary K-6" },
  { id: "T-5-A", role: "Grade 5 Teacher", category: "instructional", fte: 1, assignment: `${section("5-A")}; ELA/SS block`, certification: "Professional — Elementary K-6" },
  { id: "T-5-B", role: "Grade 5 Teacher", category: "instructional", fte: 1, assignment: `${section("5-B")}; math/science block`, certification: "Professional — Elementary K-6" },
  { id: "T-MS-ELA", role: "Middle School ELA & Civics Teacher", category: "instructional", fte: 1, assignment: "M/J ELA 6 & 7; M/J Civics (7)", certification: "Professional — English 6-12", flag: "Out-of-field for M/J Civics (no Social Science cert) — parent notification + in-field plan required" },
  { id: "T-MS-MATH", role: "Middle School Math Teacher", category: "instructional", fte: 1, assignment: "M/J Math 6 & 7", certification: "Professional — Middle Grades Math 5-9" },
  { id: "T-MS-SCI", role: "Middle School Science Teacher", category: "instructional", fte: 1, assignment: "M/J Science 6 & 7 incl. lab", certification: "Professional — Middle Grades Science 5-9" },
  { id: "T-ESE-A", role: "ESE Teacher (Support Facilitation)", category: "instructional", fte: 1, assignment: "K-3 support facilitation and resource", certification: "Professional — ESE K-12" },
  { id: "T-ESE-B", role: "ESE Teacher (Support Facilitation)", category: "instructional", fte: 1, assignment: "Grades 4-7 support facilitation and resource", certification: "Professional — ESE K-12" },
  { id: "S-ART", role: "Art Teacher", category: "specials", fte: 0.5, assignment: "K-7 art (Mon/Tue/Thu AM)" },
  { id: "S-MUS", role: "Music Teacher", category: "specials", fte: 0.5, assignment: "K-7 music (Wed/Thu/Fri)" },
  { id: "S-PE", role: "Physical Education Teacher", category: "specials", fte: 1, assignment: "K-7 PE" },
  { id: "R-INT", role: "Reading Interventionist (Title I)", category: "support", fte: 0.5, assignment: "Tier 2/3 UFLI small groups, K-3" },
  { id: "C-SLP", role: "Speech-Language Pathologist (contracted)", category: "support", fte: 0.4, assignment: `Tuesdays and Thursdays; caseload ${slpCaseload}` },
  { id: "C-COUN", role: "School Counselor (contracted)", category: "support", fte: 0.5, assignment: "Mon/Wed/Fri; SEL groups, 504 support" },
  { id: "P-VPK", role: "VPK Assistant", category: "support", fte: 1, assignment: "VPK classroom" },
  { id: "P-K1", role: "Paraprofessional (K-1)", category: "support", fte: 1, assignment: "K-1 literacy centers; 7:15 cafeteria i-Ready supervision" },
  { id: "P-23", role: "Paraprofessional (grades 2-3)", category: "support", fte: 1, assignment: "Grades 2-3 literacy centers and UFLI groups" },
  { id: "P-ESE-1", role: "Paraprofessional (ESE)", category: "support", fte: 1, assignment: "ESE inclusion support, grades 2-5" },
  { id: "P-ESE-2", role: "Paraprofessional (ESE / Title I)", category: "support", fte: 1, assignment: "ESE inclusion support, grades 6-7", vacant: true, flag: "Vacant since 2026-09-15; 2 IEPs list para support minutes in grades 6-7" },
  { id: "OPS-CUS-1", role: "Lead Custodian", category: "operations", fte: 1, assignment: "Historic brick building, cafeteria, grounds" },
  { id: "OPS-CUS-2", role: "Custodian", category: "operations", fte: 0.5, assignment: "Modulars A-C (afternoons)" },
  { id: "OPS-FS-1", role: "Food Service Lead", category: "operations", fte: 1, assignment: "Breakfast 7:15-7:45, lunch service" },
  { id: "OPS-FS-2", role: "Food Service Assistant", category: "operations", fte: 0.75, assignment: "Lunch service" },
  { id: "OPS-FS-3", role: "Food Service Assistant", category: "operations", fte: 0.75, assignment: "Breakfast and lunch service" },
  { id: "OPS-WRAP-1", role: "VPK Wrap-Around Caregiver", category: "operations", fte: 0.6, assignment: "VPK wrap 11:00 AM-5:30 PM" },
  { id: "OPS-WRAP-2", role: "VPK Wrap-Around Caregiver", category: "operations", fte: 0.6, assignment: "VPK wrap 11:00 AM-5:30 PM" },
];

const classroomAndEseTeachers = roster.filter((s) => s.category === "instructional");
const instructionalFte = sum(classroomAndEseTeachers.map((s) => s.fte));
const studentTeacherRatio = Math.round((totalEnrollment / instructionalFte) * 10) / 10;

// ---------------------------------------------------------------------------
// FTE / FEFP (sample per-FTE amount — replace with the ACPS FEFP calculation)
// ---------------------------------------------------------------------------

const estimatedFundsPerUnweightedFte = 9_150;
// s. 1002.33(20)(a), F.S.: up to 5%, with a 250-student threshold. This sample applies 5% to every
// student, which understates revenue above 250 students; verify the current statute and ACPS practice.
const sponsorAdminFeeRate = 0.05;
const grossFefp = fefpEligibleStudents * estimatedFundsPerUnweightedFte;
const sponsorAdminFee = Math.round(grossFefp * sponsorAdminFeeRate);
const netFefp = grossFefp - sponsorAdminFee;
const netValuePerFte = Math.round(estimatedFundsPerUnweightedFte * (1 - sponsorAdminFeeRate) * 100) / 100;

const survey2Exceptions = [
  { studentId: "S-1350", grade: "4", issue: "Withdrew 2026-10-02 (moved out of county) but still in survey membership file", action: "Remove from Survey 2 membership before district submission", fteAtRisk: 0, owner: "O-01", due: "2026-10-16" },
  { studentId: "S-1362", grade: "2", issue: "Enrolled 2026-10-07; attended 10/07-10/09 of survey week", action: "Eligible — confirm enrollment date and attendance in file", fteAtRisk: 0, owner: "O-01", due: "2026-10-16" },
  { studentId: "S-1377", grade: "6", issue: "No attendance recorded in the 11-day attendance window (survey week + 6 prior school days)", action: "Locate attendance documentation or exclude from Survey 2 count", fteAtRisk: 0.5, owner: "O-02", due: "2026-10-19" },
  { studentId: "S-1260", grade: "7", issue: "Matrix of Services (254) dated 2025-11-19; IEP annual review not until 2026-11-19", action: "Confirm matrix on file covers survey week and supports the 254 cost factor", fteAtRisk: 0, owner: "L-03", due: "2026-10-19" },
  { studentId: "S-1388", grade: "K", issue: "ELL plan missing annual ELL committee date", action: "Complete ELL plan documentation", fteAtRisk: 0, owner: "L-03", due: "2026-10-21" },
  { studentId: "(course) M/J Civics", grade: "7", issue: "Taught by out-of-field teacher T-MS-ELA", action: "Report out-of-field status; confirm parent notification letters sent", fteAtRisk: 0, owner: "L-01", due: "2026-10-21" },
];

const classSizeCaps = { "PK-3": 18, "4-8": 22 };
const bandOf = (gradeBand: string, grades: Grade[], cap: number) => {
  const rows = enrollmentByGrade.filter((g) => grades.includes(g.grade));
  const students = sum(rows.map((g) => g.students));
  const sections = sum(rows.map((g) => g.sections));
  return { gradeBand, cap, students, sections, averageClassSize: Math.round((students / sections) * 10) / 10, headroomPerSection: Math.round((cap - students / sections) * 10) / 10 };
};
const classSize = [
  bandOf("K-3", ["K", "1", "2", "3"], classSizeCaps["PK-3"]),
  bandOf("4-5", ["4", "5"], classSizeCaps["4-8"]),
  bandOf("6-7 core courses", ["6", "7"], classSizeCaps["4-8"]),
];
/** Sections at their band's cap if compliance were measured per classroom. */
const sectionsAtCap = GRADES.filter((g) => g !== "VPK").flatMap((g) => {
  const cap = ["K", "1", "2", "3"].includes(g) ? classSizeCaps["PK-3"] : classSizeCaps["4-8"];
  return ["A", "B"].map((x) => `${g}-${x}`).filter((name) => sectionSize(name) >= cap);
});

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

// % scoring Level 3+ (grades 3-7, FAST ELA Reading / Math) or at/above benchmark (K-2, FAST Star).
// priorYearPm3 is the SAME cohort's spring score in the prior grade.
const pm1 = (grade: Grade, subject: "elaLevel3Pct" | "mathLevel3Pct") => Math.round(gradeSummary(grade)[subject] ?? 0);

const fastPm1 = {
  ela: [
    { grade: "K", instrument: "FAST Star Early Literacy", pm1: pm1("K", "elaLevel3Pct"), priorYearPm3: null, acpsPm1Avg: 55 },
    { grade: "1", instrument: "FAST Star Early Literacy", pm1: pm1("1", "elaLevel3Pct"), priorYearPm3: 72, acpsPm1Avg: 54 },
    { grade: "2", instrument: "FAST Star Reading", pm1: pm1("2", "elaLevel3Pct"), priorYearPm3: 69, acpsPm1Avg: 52 },
    { grade: "3", instrument: "FAST ELA Reading", pm1: pm1("3", "elaLevel3Pct"), priorYearPm3: 68, acpsPm1Avg: 41 },
    { grade: "4", instrument: "FAST ELA Reading", pm1: pm1("4", "elaLevel3Pct"), priorYearPm3: 63, acpsPm1Avg: 43 },
    { grade: "5", instrument: "FAST ELA Reading", pm1: pm1("5", "elaLevel3Pct"), priorYearPm3: 66, acpsPm1Avg: 45 },
    { grade: "6", instrument: "FAST ELA Reading", pm1: pm1("6", "elaLevel3Pct"), priorYearPm3: 64, acpsPm1Avg: 42 },
    { grade: "7", instrument: "FAST ELA Reading", pm1: pm1("7", "elaLevel3Pct"), priorYearPm3: 61, acpsPm1Avg: 44 },
  ],
  math: [
    { grade: "K", instrument: "FAST Star Math", pm1: pm1("K", "mathLevel3Pct"), priorYearPm3: null, acpsPm1Avg: 57 },
    { grade: "1", instrument: "FAST Star Math", pm1: pm1("1", "mathLevel3Pct"), priorYearPm3: 71, acpsPm1Avg: 51 },
    { grade: "2", instrument: "FAST Star Math", pm1: pm1("2", "mathLevel3Pct"), priorYearPm3: 66, acpsPm1Avg: 48 },
    { grade: "3", instrument: "FAST Math", pm1: pm1("3", "mathLevel3Pct"), priorYearPm3: 70, acpsPm1Avg: 38 },
    { grade: "4", instrument: "FAST Math", pm1: pm1("4", "mathLevel3Pct"), priorYearPm3: 66, acpsPm1Avg: 40 },
    { grade: "5", instrument: "FAST Math", pm1: pm1("5", "mathLevel3Pct"), priorYearPm3: 61, acpsPm1Avg: 36 },
    { grade: "6", instrument: "FAST Math", pm1: pm1("6", "mathLevel3Pct"), priorYearPm3: 63, acpsPm1Avg: 34 },
    { grade: "7", instrument: "FAST Math", pm1: pm1("7", "mathLevel3Pct"), priorYearPm3: 55, acpsPm1Avg: 37 },
  ],
};

const withCohortChange = (rows: typeof fastPm1.ela) =>
  rows.map((r) => ({
    ...r,
    cohortChangePts: r.priorYearPm3 === null ? null : r.pm1 - r.priorYearPm3,
    vsAcpsPts: r.pm1 - r.acpsPm1Avg,
  }));

// ---------------------------------------------------------------------------
// ESE & student services
// ---------------------------------------------------------------------------

const iepMatrix = Object.fromEntries(
  ["251", "252", "253", "254", "255"].map((level) => [level, STUDENTS.filter((st) => st.iep?.matrix === level).length]),
) as Record<"251" | "252" | "253" | "254" | "255", number>;
const attendance = attendanceSummary();
const familyCount = new Set(STUDENTS.map((st) => st.familyId)).size;
// Sample: about 7% of families have no working contact in ParentSquare.
const reachableFamilies = familyCount - Math.round(familyCount * 0.068);

const iepReviewsDue = [
  { studentId: "S-1107", grade: "4", eligibility: "SLD", reviewDue: "2026-10-09", caseManager: "T-ESE-A", status: "Parent rescheduled twice; meeting set 2026-10-16" },
  { studentId: "S-1042", grade: "2", eligibility: "SLD, LI", reviewDue: "2026-10-20", caseManager: "T-ESE-A", status: "Meeting scheduled 2026-10-19; parent invite sent" },
  { studentId: "S-1188", grade: "K", eligibility: "SI (speech)", reviewDue: "2026-10-28", caseManager: "C-SLP", status: "Draft IEP in progress" },
  { studentId: "S-1215", grade: "6", eligibility: "OHI", reviewDue: "2026-11-04", caseManager: "T-ESE-A", status: "Not scheduled" },
  { studentId: "S-1233", grade: "1", eligibility: "LI", reviewDue: "2026-11-12", caseManager: "C-SLP", status: "Parent invite drafted" },
  { studentId: "S-1260", grade: "7", eligibility: "ASD", reviewDue: "2026-11-19", caseManager: "T-ESE-A", status: "Not scheduled; student turns 14 during this IEP year — transition planning section required (verify s. 1003.5716, F.S.)" },
  { studentId: "S-1301", grade: "3", eligibility: "SLD", reviewDue: "2026-12-08", caseManager: "T-ESE-A", status: "Not scheduled" },
].map((r) => {
  const days = daysBetween(DATA_AS_OF, r.reviewDue);
  return { ...r, daysUntilDue: days, overdue: days < 0 };
});

// ---------------------------------------------------------------------------
// Finance (FY 2026-27, July 1 - June 30). YTD = through 2026-09-30 (25% of year).
// ---------------------------------------------------------------------------

const ytdShareOfYear = 0.25;

const revenue = [
  { line: "FEFP (net of 5% ACPS admin fee)", budget: netFefp, ytdActual: Math.round(netFefp * 0.25) },
  { line: "VPK (Division of Early Learning)", budget: 57_000, ytdActual: 11_400 },
  { line: "Title I, Part A (via ACPS)", budget: 107_900, ytdActual: 20_500 },
  { line: "IDEA Part B flow-through (via ACPS)", budget: 57_400, ytdActual: 8_600 },
  { line: "Charter school capital outlay", budget: 126_600, ytdActual: 31_650 },
  { line: "VPK wrap-around care fees", budget: 69_400, ytdActual: 16_200 },
  { line: "Food service (NSLP reimbursement + sales)", budget: 162_400, ytdActual: 37_700 },
  { line: "Fundraising & community donations", budget: 61_900, ytdActual: 9_400 },
];

const expenses = [
  { line: "Instructional salaries & benefits", budget: 1_890_000, ytdActual: 451_800 },
  { line: "Administrative salaries & benefits", budget: 340_000, ytdActual: 84_500 },
  { line: "ESE contracted services (SLP, evaluations)", budget: 79_800, ytdActual: 24_600 },
  { line: "Substitute teachers", budget: 30_300, ytdActual: 11_500, note: "Sept absences + unfilled days" },
  { line: "Curriculum & licenses (UFLI, HMH, enVision, McGraw Hill, Studies Weekly, i-Ready)", budget: 83_900, ytdActual: 64_900, note: "Front-loaded annual renewals — expected" },
  { line: "Facilities maintenance & repairs", budget: 54_000, ytdActual: 21_600, note: "Modular B HVAC + roof diagnostics" },
  { line: "Utilities", budget: 72_000, ytdActual: 19_800 },
  { line: "Insurance", budget: 48_000, ytdActual: 24_000, note: "Semi-annual premium — expected" },
  { line: "Food service operations", budget: 154_100, ytdActual: 36_500 },
  { line: "Technology", budget: 41_300, ytdActual: 12_500 },
  { line: "Transportation & field trips", budget: 24_800, ytdActual: 5_400 },
  { line: "Audit, legal & sponsor fees (non-FEFP)", budget: 26_000, ytdActual: 14_500, note: "FY26 audit fee paid — expected" },
  { line: "Contingency", budget: 55_000, ytdActual: 0 },
];

const withVariance = <T extends { budget: number; ytdActual: number }>(rows: T[]) =>
  rows.map((r) => {
    const expectedYtd = Math.round(r.budget * ytdShareOfYear);
    return {
      ...r,
      percentOfBudgetUsed: pct(r.ytdActual, r.budget),
      expectedYtdAt25Pct: expectedYtd,
      varianceVsExpected: r.ytdActual - expectedYtd,
    };
  });

const totalRevenueBudget = sum(revenue.map((r) => r.budget));
const totalExpenseBudget = sum(expenses.map((r) => r.budget));
const cashOnHand = 564_000;
const daysCashOnHand = Math.round(cashOnHand / (totalExpenseBudget / 365));

const titleIAllocation = 107_900;
const titleIUses = [
  { use: "Reading interventionist R-INT (0.5 FTE)", amount: 36_000 },
  { use: "Paraprofessional P-ESE-2 (Title I share; position vacant)", amount: 24_000 },
  { use: "Parent & family engagement set-aside (1%)", amount: Math.round(titleIAllocation * 0.01) },
  { use: "Paraprofessional P-23 (Title I share)", amount: 26_000 },
  { use: "UFLI decodable readers & intervention materials", amount: 11_000 },
  { use: "Teacher PD (UFLI, HMH Into Reading)", amount: 7_000 },
];

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

const facilityTickets = [
  { id: "FAC-041", building: "Historic brick building", issue: "Roof flashing leak above Room 4 after heavy rain; ceiling tile stained", priority: "P1", status: "Vendor quote received ($6,800); awaiting approval", opened: "2026-09-21", owner: "L-04", estimate: 6_800 },
  { id: "FAC-044", building: "Modular B", issue: "HVAC compressor short-cycling; room hit 81°F on 10/05", priority: "P1", status: "Temporary repair 10/06; replacement quote pending", opened: "2026-09-29", owner: "L-04", estimate: 9_400 },
  { id: "FAC-047", building: "Modular A", issue: "Ramp handrail loose at second post", priority: "P1", status: "Coned off; custodian repair scheduled 10/15", opened: "2026-10-09", owner: "OPS-CUS-1", estimate: 150 },
  { id: "FAC-038", building: "Cafeteria", issue: "Walk-in cooler door gasket torn; temp log within range", priority: "P2", status: "Part ordered", opened: "2026-09-10", owner: "OPS-FS-1", estimate: 420 },
  { id: "FAC-039", building: "Playground", issue: "Engineered wood fiber surface below depth under swings", priority: "P2", status: "Open — needs 20 cubic yards", opened: "2026-09-12", owner: "OPS-CUS-1", estimate: 1_900 },
  { id: "FAC-042", building: "Bus loop (Seminary Ave entrance)", issue: "Pothole at car-line entrance", priority: "P2", status: "Reported to grounds vendor", opened: "2026-09-24", owner: "L-04", estimate: 650 },
  { id: "FAC-045", building: "Modular C", issue: "Wi-Fi access point drops connections during i-Ready testing", priority: "P2", status: "Open", opened: "2026-10-01", owner: "L-04", estimate: 380 },
  { id: "FAC-031", building: "Historic brick building", issue: "Exterior window trim paint failing (historic sash — use preservation-appropriate methods)", priority: "P3", status: "Deferred to summer 2027", opened: "2026-08-20", owner: "L-04", estimate: 4_200 },
  { id: "FAC-046", building: "Campus-wide", issue: "Annual fire extinguisher inspection due November", priority: "P2", status: "Vendor not yet booked", opened: "2026-10-05", owner: "L-04", estimate: 300 },
  { id: "FAC-036", building: "Historic brick building", issue: "Annual termite inspection", priority: "P3", status: "Scheduled 2026-10-27", opened: "2026-09-02", owner: "L-04", estimate: 0 },
].map((t) => ({ ...t, ageDays: daysBetween(t.opened, DATA_AS_OF), boardApprovalRequired: t.estimate > 5_000 }));

// ---------------------------------------------------------------------------
// Assembled dataset
// ---------------------------------------------------------------------------

export const macsData = {
  meta: {
    dataStatus: "SAMPLE — illustrative, not school records",
    notice: SAMPLE_DATA_NOTICE,
    asOf: DATA_AS_OF,
    schoolYear: "2026-27",
    school: "Micanopy Area Cooperative School (MACS)",
    location: "Micanopy, FL (Alachua County); campus on Seminary Ave",
    website: "macschool.us",
    type: "Public charter school",
    sponsor: "Alachua County Public Schools (ACPS) — Charter School Office",
    gradeSpan: "Pre-K/VPK through Grade 7",
    leadershipTeam: ["Director / Principal", "Dean of Students", "ESE Coordinator", "Finance & Operations Manager", "Board of Directors"],
    privacy: "Students are identified only by sample codes (S-####). Staff are identified by role codes. Never add real student names to this dataset or to prompts.",
    unverifiedProfileFacts:
      "Curriculum list, schedule times, and program details mirror the project brief and have not been checked against macschool.us or MACS staff.",
    priorYearSchoolGrade: null as string | null,
    priorYearSchoolGradeNote: "Not included — enter the official FLDOE school grade here.",
  },

  curriculum: {
    earlyLiteracyAndReading: ["UFLI Foundations (K-2 phonics; Tier 2/3 intervention K-3)", "HMH Into Reading (K-5 core ELA)", "Top Score Writing (K-7)", "i-Ready Diagnostic (K-7 progress monitoring, 3x/year)"],
    math: ["enVision Mathematics (K-7)"],
    science: ["McGraw Hill Science (K-5)", "Middle school lab science (6-7)"],
    socialStudies: ["Studies Weekly (K-5)", "M/J Civics (Grade 7, Civics EOC)"],
  },

  assessmentCalendar: {
    note: "Sample windows — confirm against the FLDOE 2026-27 statewide assessment schedule.",
    fastWindows: [
      { window: "PM1", dates: "2026-08-17 to 2026-09-25", status: "Complete" },
      { window: "PM2", dates: "2026-12-01 to 2027-01-22", status: "Upcoming", daysUntilOpen: daysBetween(DATA_AS_OF, "2026-12-01") },
      { window: "PM3", dates: "2027-05-03 to 2027-05-28", status: "Upcoming" },
    ],
    otherStatewide: [
      { assessment: "Civics EOC (Grade 7)", window: "May 2027", students: studentsIn("7") },
      { assessment: "Statewide Science Assessment (Grade 5)", window: "May 2027", students: studentsIn("5") },
      { assessment: "Statewide Science Assessment (Grade 8)", window: "Not applicable", students: 0, note: "MACS ends at Grade 7" },
    ],
  },

  enrollment: {
    total: totalEnrollment,
    fefpEligibleK7: fefpEligibleStudents,
    vpkNote: "VPK students are funded through the Division of Early Learning, not FEFP, and are excluded from FTE survey counts.",
    capacity: 320,
    utilizationPct: pct(totalEnrollment, 320),
    byGrade: enrollmentByGrade,
    totalWaitlist: sum(enrollmentByGrade.map((g) => g.waitlist)),
    studentsWithDisabilities: sum(enrollmentByGrade.map((g) => g.swd)),
    englishLanguageLearners: sum(enrollmentByGrade.map((g) => g.ell)),
    freeReducedLunch: sum(enrollmentByGrade.map((g) => g.frl)),
    freeReducedLunchPct: pct(sum(enrollmentByGrade.map((g) => g.frl)), totalEnrollment),
    plans504: STUDENTS.filter((st) => st.plan504).length,
    gifted: STUDENTS.filter((st) => st.gifted).length,
    families: new Set(STUDENTS.map((st) => st.familyId)).size,
    rosterNote: "Every figure here is derived from a 300-student sample roster (lib/student-roster.ts) that the Students page shows. Students are codes only.",
    attendance: {
      ytdAverageDailyAttendancePct: attendance.averageDailyAttendancePct,
      chronicallyAbsentStudents: attendance.chronicallyAbsent,
      chronicallyAbsentDefinition: "Missed 10% or more of enrolled days so far this year",
      septemberTardies: attendance.septemberTardies,
      septemberBusRelatedTardies: attendance.septemberBusTardies,
    },
  },

  staffing: {
    instructionalTeacherFte: instructionalFte,
    studentTeacherRatio: `${studentTeacherRatio}:1`,
    ratioMethod: "Total enrollment ÷ classroom + ESE teacher FTE (excludes specials, interventionist, contracted providers).",
    roster,
    vacancies: roster.filter((s) => s.vacant).map((s) => ({ id: s.id, role: s.role, note: s.flag })),
    certificationFlags: roster.filter((s) => s.flag && !s.vacant).map((s) => ({ id: s.id, role: s.role, flag: s.flag })),
    substitutePool: { approvedSubs: 5, septemberFillRatePct: 82, unfilledDaysYtd: 4 },
    coverageMatrixThisWeek: [
      { date: "2026-10-12 (Mon)", absence: "T-2-A (sick)", coverage: "SUB-03 (full day)", status: "Covered" },
      { date: "2026-10-13 (Tue)", absence: "T-MS-SCI (ACPS science PD)", coverage: "L-02 Dean periods 1-3; T-ESE-A period 4", status: "Covered — ESE support minutes missed in period 4" },
      { date: "2026-10-14 (Wed)", absence: "None", coverage: "Early dismissal 1:00 PM; PLC 1:15-2:45", status: "n/a" },
      { date: "2026-10-15 (Thu)", absence: "T-4-B (personal day)", coverage: "UNFILLED as of 3:00 PM 10/14", status: "Needs coverage" },
      { date: "2026-10-16 (Fri)", absence: "C-SLP (contract day off)", coverage: "Speech sessions to be made up", status: "Make-up sessions needed" },
    ],
    dutyRotation: {
      cafeteriaIReady715: ["P-K1 (daily)", "L-02 Dean (Mon/Wed/Fri)", "T-ESE-A (Tue/Thu)"],
      carLine: ["L-02 Dean", "S-PE", "T-5-A"],
      busLoop: ["O-02", "T-MS-MATH"],
    },
  },

  fte: {
    surveyCalendar: [
      { survey: "Survey 1", period: "July 2026 (summer)", applies: "Summer programs only" },
      { survey: "Survey 2", period: "Week of 2026-10-05 to 2026-10-09", applies: "K-7 membership", status: "Survey week complete — reconciliation in progress", districtSubmissionDue: "2026-10-23", daysUntilDue: daysBetween(DATA_AS_OF, "2026-10-23") },
      { survey: "Survey 3", period: "Week of 2027-02-08 to 2027-02-12", applies: "K-7 membership" },
      { survey: "Survey 4", period: "June 2027 (summer)", applies: "Summer programs only" },
      { survey: "Survey 5", period: "Summer 2027", applies: "Prior-year final corrections" },
    ],
    note: "Sample survey dates and deadlines. Membership rule summarized as: enrolled during survey week and in attendance at least one day in the 11-day window (survey week + 6 prior school days). Verify against current FLDOE FTE General Instructions.",
    survey2: {
      studentsInMembershipFile: fefpEligibleStudents + 1,
      studentsWithoutOpenExceptions: fefpEligibleStudents + 1 - survey2Exceptions.filter((e) => e.studentId.startsWith("S-")).length,
      exceptions: survey2Exceptions,
      fteAtRiskTotal: sum(survey2Exceptions.map((e) => e.fteAtRisk)),
      revenueAtRiskNet: Math.round(sum(survey2Exceptions.map((e) => e.fteAtRisk)) * netValuePerFte),
    },
    eseMatrix: {
      iepStudentsByMatrixLevel: iepMatrix,
      note: "Levels 251-253 funded through the ESE Guaranteed Allocation; 254/255 carry separate FEFP cost factors. Matrix forms must be on file and current for survey week.",
    },
    revenueEstimate: {
      method: "Sample: unweighted K-7 FTE × estimated funds per FTE; annualized assuming Survey 3 matches Survey 2.",
      unweightedFte: fefpEligibleStudents,
      estimatedFundsPerUnweightedFte,
      grossFefp,
      sponsorAdminFeeRate,
      sponsorAdminFee,
      netFefp,
      netValuePerFte,
    },
    classSize: {
      caps: classSizeCaps,
      method: "Charter schools measure compliance at the school-level average per grade band (verify s. 1003.03, F.S. and ACPS guidance).",
      bands: classSize,
      watchItem: sectionsAtCap.length
        ? `${sectionsAtCap.join(" and ")} sit at the class-size cap if compliance were measured per classroom. One more enrollment in either would put it over.`
        : "No section is at its cap.",
    },
  },

  assessment: {
    fastPm1: { ela: withCohortChange(fastPm1.ela), math: withCohortChange(fastPm1.math) },
    scoringNote: "Grades 3-7: % Level 3+. Grades K-2: % at/above benchmark on FAST Star. priorYearPm3 = same cohort's spring score in the prior grade. acpsPm1Avg is a sample district comparison.",
    subgroupGapsPm1Grades3to7: [
      { subject: "ELA", group: "Students with disabilities", ...subgroupGap("fastEla", (st) => Boolean(st.iep)) },
      { subject: "ELA", group: "Free/reduced lunch", ...subgroupGap("fastEla", (st) => st.frl) },
      { subject: "Math", group: "Students with disabilities", ...subgroupGap("fastMath", (st) => Boolean(st.iep)) },
      { subject: "Math", group: "Free/reduced lunch", ...subgroupGap("fastMath", (st) => st.frl) },
    ],
    iReadyDiagnostic1: [
      { grade: "K", readingOnOrAbovePct: 22, reading2PlusBelowPct: 0, mathOnOrAbovePct: 18, math2PlusBelowPct: 0 },
      { grade: "1", readingOnOrAbovePct: 24, reading2PlusBelowPct: 9, mathOnOrAbovePct: 20, math2PlusBelowPct: 7 },
      { grade: "2", readingOnOrAbovePct: 31, reading2PlusBelowPct: 14, mathOnOrAbovePct: 26, math2PlusBelowPct: 12 },
      { grade: "3", readingOnOrAbovePct: 33, reading2PlusBelowPct: 18, mathOnOrAbovePct: 25, math2PlusBelowPct: 19 },
      { grade: "4", readingOnOrAbovePct: 38, reading2PlusBelowPct: 15, mathOnOrAbovePct: 29, math2PlusBelowPct: 21 },
      { grade: "5", readingOnOrAbovePct: 40, reading2PlusBelowPct: 17, mathOnOrAbovePct: 24, math2PlusBelowPct: 27 },
      { grade: "6", readingOnOrAbovePct: 35, reading2PlusBelowPct: 24, mathOnOrAbovePct: 21, math2PlusBelowPct: 33 },
      { grade: "7", readingOnOrAbovePct: 39, reading2PlusBelowPct: 21, mathOnOrAbovePct: 27, math2PlusBelowPct: 30 },
    ],
    interventionGroups: [
      { tier: "Tier 2 reading (UFLI small group)", grades: "K-3", students: STUDENTS.filter((st) => st.intervention?.startsWith("Tier 2 reading")).length, provider: "R-INT, P-K1, P-23" },
      { tier: "Tier 3 reading (UFLI intensive)", grades: "1-3", students: STUDENTS.filter((st) => st.intervention?.startsWith("Tier 3 reading")).length, provider: "R-INT" },
      { tier: "Tier 2 math (enVision intervention lessons)", grades: "3-5", students: STUDENTS.filter((st) => st.intervention?.startsWith("Tier 2 math")).length, provider: "Classroom teachers" },
      {
        tier: "Tier 2 math",
        grades: "6-7",
        students: 0,
        provider: "None scheduled — no intervention block in MS schedule",
        studentsBelowLevel3: STUDENTS.filter((st) => (st.grade === "6" || st.grade === "7") && st.fastMath !== null && st.fastMath < 3).length,
      },
    ],
  },

  studentServices: {
    iepCount: sum(Object.values(iepMatrix)),
    speechLanguageOnlyIeps: STUDENTS.filter((st) => st.iep?.speechOnly).length,
    plans504: STUDENTS.filter((st) => st.plan504).length,
    giftedEps: STUDENTS.filter((st) => st.gifted).length,
    iepReviewsDueNext60Days: iepReviewsDue,
    reevaluationsDue: [{ studentId: "S-1042", type: "3-year reevaluation", due: "2026-11-30", status: "Consent for reevaluation not yet requested" }],
    plan504ReviewsDue: [
      { studentId: "S-1145", grade: "5", due: "2026-11-06", status: "Scheduled 2026-11-05" },
      { studentId: "S-1290", grade: "3", due: "2026-11-20", status: "Not scheduled" },
    ],
    speechLanguage: {
      provider: "C-SLP (contracted, Tue/Thu)",
      caseload: slpCaseload,
      requiredMinutesPerWeek: slpCaseload * 50, // sample: 50 minutes per student per week
      octoberMissedSessions: 3,
      note: "Sessions missed 10/06 (provider absence) and 10/16 (contract day off) need documented make-up.",
    },
    gifted: { model: "Weekly 60-minute pull-out, Wednesdays", provider: "T-4-A (gifted endorsed)", eps: STUDENTS.filter((st) => st.gifted).length, grades: "2-7" },
    titleI: {
      allocation: titleIAllocation,
      uses: titleIUses,
      budgeted: sum(titleIUses.map((u) => u.amount)),
      unbudgeted: titleIAllocation - sum(titleIUses.map((u) => u.amount)),
      note: "P-ESE-2 vacancy means its Title I share is unspent year-to-date.",
    },
  },

  governance: {
    board: {
      seats: [
        { seat: "Chair", governanceTraining: "Current (refresher due 2028)" },
        { seat: "Vice Chair", governanceTraining: "Current" },
        { seat: "Treasurer", appointed: "2026-08-11", governanceTraining: "Initial 4-hour training not yet completed — due within 90 days of appointment (2026-11-09); verify s. 1002.33(9)(j), F.S." },
        { seat: "Secretary", governanceTraining: "Current" },
        { seat: "At-large (parent)", governanceTraining: "Current" },
        { seat: "At-large (community)", governanceTraining: "Current" },
        { seat: "At-large (educator)", governanceTraining: "Current" },
      ],
      meetings: [
        { date: "2026-09-08", type: "Regular", noticePosted: "2026-08-31", minutes: "Approved 2026-10-13; posted" },
        { date: "2026-10-13", type: "Regular", noticePosted: "2026-10-05", minutes: "Draft — for approval at 11/10 meeting; not yet posted as draft" },
        {
          date: "2026-11-10",
          type: "Regular",
          noticeDueBy: "2026-11-03",
          noticePolicy: "School policy: post notice 7 days ahead on website and front office (sample policy)",
          agendaStatus: "Not started",
          expectedItems: ["Q1 financial statements", "FTE Survey 2 report", "ACPS site visit preparation", "Approve roof repair FAC-041 ($6,800)", "Approve Modular B HVAC replacement FAC-044 ($9,400)"],
        },
      ],
      sunshineChecklist: [
        "Reasonable public notice of every meeting (posted on website + front office)",
        "Meetings open to the public at an accessible location, with public comment",
        "Minutes promptly recorded and open to inspection",
        "No board-member discussion of board business outside a noticed meeting (email, text, social media)",
        "Public records requests acknowledged and fulfilled promptly; log maintained",
      ],
      fiscalPolicy: "Sample policy: board approval required for any single expenditure over $5,000.",
    },
    publicRecordsLog: [
      { id: "PRR-2026-07", received: "2026-09-29", requester: "Parent", request: "2025-26 board minutes", status: "Fulfilled 2026-10-02" },
      { id: "PRR-2026-08", received: "2026-10-08", requester: "Local media", request: "FY2026-27 adopted budget", status: "Acknowledged 2026-10-09; open" },
      { id: "PRR-2026-09", received: "2026-10-12", requester: "Vendor", request: "Custodial services RFP scoring sheets", status: "Not yet acknowledged" },
    ].map((r) => ({ ...r, daysOpen: r.status.startsWith("Fulfilled") ? null : daysBetween(r.received, DATA_AS_OF) })),
    sponsor: {
      charterTerm: "Sample: current contract term ends 2028-06-30",
      deliverables: [
        { item: "FY2025-26 independent financial audit", due: "2026-09-30", status: "Submitted 2026-09-28" },
        { item: "Monthly financial statement (September)", due: "2026-10-20", status: "Draft in progress" },
        { item: "FTE Survey 2 data to ACPS", due: "2026-10-23", status: "Reconciliation in progress" },
        { item: "Annual site visit (ACPS Charter School Office)", due: "2026-11-18", status: "Prep checklist 40% complete" },
      ],
      siteVisitPrep: [
        { area: "Governance binder (bylaws, minutes, notices, training records)", status: "Missing Treasurer training certificate" },
        { area: "ESE file sample (10 random IEPs)", status: "S-1107 review overdue" },
        { area: "FTE documentation", status: "Pending Survey 2 reconciliation" },
        { area: "Safety: drills log, Alyssa's Law panic alert, safe-school officer coverage", status: "October fire drill not yet run; other items current" },
        { area: "Facilities walk-through", status: "FAC-041 roof and FAC-047 ramp handrail open" },
      ],
    },
  },

  finance: {
    fiscalYear: "FY2026-27 (July 1 - June 30)",
    ytdThrough: "2026-09-30 (25% of year)",
    revenue: withVariance(revenue),
    expenses: withVariance(expenses),
    totals: {
      revenueBudget: totalRevenueBudget,
      expenseBudget: totalExpenseBudget,
      budgetedSurplus: totalRevenueBudget - totalExpenseBudget,
      revenueYtd: sum(revenue.map((r) => r.ytdActual)),
      expenseYtd: sum(expenses.map((r) => r.ytdActual)),
    },
    cashOnHand,
    daysCashOnHand,
    unassignedFundBalanceJune30: 735_000,
    flags: [
      "Substitute line at 38% of budget after 25% of the year",
      "Facilities line at 40% of budget with FAC-041 ($6,800) and FAC-044 ($9,400) still unapproved",
      "Title I paraprofessional share unspent while P-ESE-2 is vacant",
    ],
  },

  facilities: {
    campus: [
      "Historic brick building — main classrooms, front office (preservation-sensitive exterior)",
      "Modular A — grades 4-5",
      "Modular B — middle school (6-7) incl. science lab",
      "Modular C — ESE resource room, specials",
      "Cafeteria / multipurpose — breakfast, 7:15 AM i-Ready access, assemblies",
      "Playground and field",
      "Bus loop and car line off Seminary Ave",
    ],
    tickets: facilityTickets,
    openTickets: facilityTickets.length,
    p1Open: facilityTickets.filter((t) => t.priority === "P1").length,
    averageAgeDays: Math.round(sum(facilityTickets.map((t) => t.ageDays)) / facilityTickets.length),
    estimatedBacklogCost: sum(facilityTickets.map((t) => t.estimate)),
  },

  operations: {
    dailySchedule: {
      note: "Sample times — confirm against the published MACS bell schedule.",
      campusOpens: "7:15 AM",
      breakfastAndCafeteriaIReady: "7:15-7:45 AM (cafeteria; supervised i-Ready practice)",
      tardyBell: "7:50 AM",
      regularDismissal: "2:30 PM (Mon, Tue, Thu, Fri)",
      wednesdayEarlyDismissal: "1:00 PM; staff PLC/PD 1:15-2:45 PM",
    },
    vpk: {
      instructionalBlock: "8:00-11:00 AM (school-year VPK)",
      wrapAroundCare: "11:00 AM-5:30 PM, fee-based",
      wrapEnrolled: STUDENTS.filter((st) => st.wrapCare).length,
      vpkEnrolled: studentsIn("VPK"),
      staffing: "T-VPK-A + P-VPK during VPK block; OPS-WRAP-1/2 for wrap care",
    },
    transportation: {
      provider: "ACPS Transportation",
      routes: [
        { route: "ACPS Route 417 (sample)", riders: STUDENTS.filter((st) => st.bus === "417").length, septemberLateArrivals: 0 },
        { route: "ACPS Route 452 (sample)", riders: STUDENTS.filter((st) => st.bus === "452").length, septemberLateArrivals: 4, averageMinutesLate: 12, note: "Bus-related tardies should be coded excused" },
      ],
    },
    parentCommunications: {
      platform: "ParentSquare",
      families: familyCount,
      reachableFamilies: reachableFamilies,
      reachablePct: pct(reachableFamilies, familyCount),
      weeklyNewsletter: "Fridays 4:00 PM",
      lastNewsletterOpenRatePct: 78,
      spanishPreferenceFamilies: new Set(STUDENTS.filter((st) => st.homeLanguage === "Spanish").map((st) => st.familyId)).size,
    },
    discipline: { referrals: { august: 12, september: 19, octoberToDate: 8 }, topCategories: ["Bus conduct", "Disruption", "Technology misuse"], restorativeConferencesYtd: 16 },
    safetyDrills: [
      { drill: "Fire", august: "Done", september: "Done", october: "Due by 2026-10-30" },
      { drill: "Active assailant / lockdown", august: "Done", september: "n/a", october: "n/a" },
      { drill: "Severe weather", august: "n/a", september: "Done", october: "n/a" },
    ],
    upcomingCalendar: [
      { date: "2026-10-15", event: "T-4-B absent — coverage needed" },
      { date: "2026-10-16", event: "IEP meeting S-1107 (overdue review)" },
      { date: "2026-10-21", event: "Wednesday early dismissal 1:00 PM" },
      { date: "2026-10-23", event: "FTE Survey 2 data due to ACPS" },
      { date: "2026-10-28", event: "Picture day retakes" },
      { date: "2026-10-30", event: "Fall Family Night, 5:30-7:00 PM (cafeteria)" },
      { date: "2026-11-03", event: "Board meeting notice must be posted" },
      { date: "2026-11-10", event: "Board of Directors regular meeting, 6:00 PM" },
      { date: "2026-11-11", event: "Veterans Day — no school" },
      { date: "2026-11-18", event: "ACPS Charter School Office site visit" },
      { date: "2026-11-23 to 2026-11-27", event: "Thanksgiving break" },
    ],
  },

  facultyNotesForNewsletter: {
    week: "2026-10-12 to 2026-10-16",
    notes: [
      { from: "T-VPK-A", note: "VPK learning about fall + apples. Need empty paper towel tubes for a project by Wed 10/21." },
      { from: "T-K-A / T-K-B", note: "UFLI lessons 1-14 done, working on short a words. Sight word rings coming home Friday — practice 5 min a night." },
      { from: "T-1-A", note: "Into Reading module 2 wrapping. Book orders due 10/23." },
      { from: "T-2-B", note: "enVision topic 3 test next Thursday. Ask kids to explain how they add 2-digit numbers." },
      { from: "T-3-A", note: "Top Score Writing — opinion paragraphs. Thanks to the families who sent in reading logs!!" },
      { from: "T-4-A", note: "Multiplication facts practice — i-Ready lessons at home count. Gifted group starting a bridge-building challenge." },
      { from: "T-5-B", note: "Science: states of matter lab Friday. Studies Weekly week 6 quiz Thursday." },
      { from: "T-MS-SCI", note: "Lab safety contracts must be signed and returned before Friday's lab or student observes only." },
      { from: "T-MS-ELA", note: "7th grade civics: mock town council debate 10/29 — families welcome to watch, 1:30 in Modular B." },
      { from: "S-ART", note: "Collecting egg cartons and clean jars." },
      { from: "S-PE", note: "Students need closed-toe shoes on PE days. Field day date TBD — do not announce yet." },
      { from: "O-01 Front office", note: "Picture retakes Tue 10/28. Update emergency contacts in ParentSquare." },
      { from: "L-02 Dean", note: "Car line: please stay in your car and pull all the way forward. Campus opens 7:15 — students arriving early go to the cafeteria for breakfast and i-Ready." },
      { from: "L-01 Director", note: "Fall Family Night 10/30 5:30-7. Thank PTO for the playground mulch fundraiser (amount TBD — confirm with Finance before printing)." },
    ],
  },
};

export type MacsData = typeof macsData;

/** Compact JSON of the dataset for the model's context window. */
export const macsDataJson = JSON.stringify(macsData);

const OMITTED = "Not shared with this role.";

/**
 * The dataset as one role may see it in chat: finance only for Finance, the Director, and the
 * Board; IEP, 504, and student-level FTE exceptions only for the Director, Dean, and ESE.
 */
export function macsDataJsonFor(role: AdminRoleId): string {
  const finance = canAccess(role, "finance");
  const supports = canAccess(role, "supports");
  if (finance && supports) return macsDataJson;
  const fte = {
    ...macsData.fte,
    ...(finance ? {} : { revenueEstimate: OMITTED }),
    ...(supports ? {} : { eseMatrix: OMITTED, survey2: { ...macsData.fte.survey2, exceptions: OMITTED } }),
  };
  return JSON.stringify({
    ...macsData,
    fte,
    finance: finance ? macsData.finance : OMITTED,
    studentServices: supports ? { ...macsData.studentServices, ...(finance ? {} : { titleI: OMITTED }) } : OMITTED,
  });
}
