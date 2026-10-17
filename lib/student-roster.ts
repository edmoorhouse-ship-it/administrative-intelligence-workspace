import { DATA_AS_OF } from "./data-notice";

/**
 * MACS student roster: SAMPLE DATA ONLY. 300 illustrative students, identified by code (S-####),
 * never by name. The roster is generated from a fixed seed, so it is the same on every load, and
 * the per-grade counts below are hit exactly. Students named elsewhere in the sample dataset
 * (IEP reviews, FTE exceptions, 504 reviews) keep the traits those stories need.
 *
 * The roster stays out of the model's prompt; lib/macs-data.ts sends only the totals it derives.
 */

export const GRADES = ["VPK", "K", "1", "2", "3", "4", "5", "6", "7"] as const;
export type Grade = (typeof GRADES)[number];

export type Eligibility = "SLD" | "SLD, LI" | "SI" | "LI" | "OHI" | "ASD" | "EBD" | "InD" | "DD";
export type MatrixLevel = "251" | "252" | "253" | "254";
/** FAST achievement level 1-5. Grades K-2 map FAST Star categories onto the same scale (3+ = at/above benchmark). */
export type FastLevel = 1 | 2 | 3 | 4 | 5;

export interface Student {
  id: string;
  grade: Grade;
  section: string;
  teacher: string;
  familyId: string;
  enrolledIso: string;
  iep: { eligibility: Eligibility; matrix: MatrixLevel; speechOnly: boolean } | null;
  plan504: boolean;
  ell: boolean;
  frl: boolean;
  gifted: boolean;
  homeLanguage: "English" | "Spanish";
  bus: "417" | "452" | null;
  wrapCare: boolean;
  daysEnrolled: number;
  daysAbsent: number;
  attendancePct: number;
  chronicAbsence: boolean;
  septemberTardies: number;
  septemberBusTardies: number;
  fastEla: FastLevel | null;
  fastMath: FastLevel | null;
  intervention: string | null;
}

/** Students, sections, and support counts per grade. FAST targets are % at Level 3+ (or at/above benchmark). */
const PLAN: Record<Grade, { students: number; sections: number; iep: number; ell: number; frl: number; plan504: number; gifted: number; ela: number | null; math: number | null }> = {
  VPK: { students: 20, sections: 1, iep: 3, ell: 0, frl: 8, plan504: 0, gifted: 0, ela: null, math: null },
  K: { students: 34, sections: 2, iep: 4, ell: 2, frl: 13, plan504: 1, gifted: 0, ela: 58, math: 62 },
  "1": { students: 35, sections: 2, iep: 5, ell: 1, frl: 14, plan504: 1, gifted: 0, ela: 61, math: 55 },
  "2": { students: 34, sections: 2, iep: 5, ell: 1, frl: 13, plan504: 2, gifted: 1, ela: 57, math: 50 },
  "3": { students: 35, sections: 2, iep: 5, ell: 1, frl: 14, plan504: 3, gifted: 2, ela: 48, math: 41 },
  "4": { students: 38, sections: 2, iep: 5, ell: 0, frl: 15, plan504: 2, gifted: 3, ela: 52, math: 45 },
  "5": { students: 38, sections: 2, iep: 4, ell: 1, frl: 14, plan504: 2, gifted: 2, ela: 55, math: 38 },
  "6": { students: 34, sections: 2, iep: 5, ell: 0, frl: 13, plan504: 2, gifted: 2, ela: 50, math: 36 },
  "7": { students: 32, sections: 2, iep: 3, ell: 0, frl: 13, plan504: 2, gifted: 2, ela: 54, math: 42 },
};

/** Students the rest of the sample dataset refers to by code. */
const NAMED: { id: string; grade: Grade; iep?: Eligibility; matrix?: MatrixLevel; plan504?: boolean; ell?: boolean; enrolledIso?: string; absentDays?: number }[] = [
  { id: "S-1107", grade: "4", iep: "SLD" },
  { id: "S-1042", grade: "2", iep: "SLD, LI" },
  { id: "S-1188", grade: "K", iep: "SI" },
  { id: "S-1215", grade: "6", iep: "OHI" },
  { id: "S-1233", grade: "1", iep: "LI" },
  { id: "S-1260", grade: "7", iep: "ASD", matrix: "254" },
  { id: "S-1301", grade: "3", iep: "SLD" },
  { id: "S-1362", grade: "2", enrolledIso: "2026-10-07" },
  { id: "S-1377", grade: "6", absentDays: 13 }, // no attendance in the Survey 2 window
  { id: "S-1388", grade: "K", ell: true },
  { id: "S-1145", grade: "5", plan504: true },
  { id: "S-1290", grade: "3", plan504: true },
];
/** Withdrew 2026-10-02; still in the Survey 2 membership file, so not on the active roster. */
const WITHDRAWN = ["S-1350"];

export const FIRST_DAY = "2026-08-10";
const HOLIDAYS = ["2026-09-07"];
const SPEECH_ONLY: Eligibility[] = ["SI", "LI"];

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function schoolDaysBetween(fromIso: string, toIso: string) {
  let days = 0;
  for (let t = Date.parse(`${fromIso}T12:00:00Z`); t <= Date.parse(`${toIso}T12:00:00Z`); t += 86_400_000) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !HOLIDAYS.includes(iso)) days++;
  }
  return days;
}

function generate(): Student[] {
  const rand = mulberry32(20261014);
  const shuffle = <T,>(items: T[]) => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  /** k items without replacement, more likely the heavier they weigh. */
  /** k items without replacement, heavier ones likelier; items marked `first` are always taken first. */
  const pickWeighted = <T,>(items: T[], k: number, weight: (x: T) => number, first: (x: T) => boolean = () => false) => {
    const keyed = items.map((x) => ({ x, first: first(x), key: Math.pow(rand(), 1 / Math.max(weight(x), 1e-6)) }));
    return keyed.sort((a, b) => Number(b.first) - Number(a.first) || b.key - a.key).slice(0, k).map((e) => e.x);
  };
  const pick = <T,>(items: T[], weights: number[]) => {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) if ((r -= weights[i]) <= 0) return items[i];
    return items[items.length - 1];
  };

  const named = new Set(NAMED.map((n) => n.id));
  const pool = shuffle(
    Array.from({ length: 399 }, (_, i) => `S-${1001 + i}`).filter((id) => !named.has(id) && !WITHDRAWN.includes(id)),
  );
  const totalDays = schoolDaysBetween(FIRST_DAY, DATA_AS_OF);
  const students: Student[] = [];

  for (const grade of GRADES) {
    const plan = PLAN[grade];
    const fixed = NAMED.filter((n) => n.grade === grade);
    const ids = shuffle([...fixed.map((n) => n.id), ...pool.splice(0, plan.students - fixed.length)]);
    const rows: Student[] = ids.map((id, i) => {
      const n = fixed.find((f) => f.id === id);
      const section = plan.sections === 1 ? "A" : i < Math.ceil(plan.students / 2) ? "A" : "B";
      const enrolledIso = n?.enrolledIso ?? FIRST_DAY;
      return {
        id,
        grade,
        section: `${grade}-${section}`,
        teacher: grade === "VPK" ? "T-VPK-A" : grade === "6" || grade === "7" ? "MS team" : `T-${grade}-${section}`,
        familyId: "",
        enrolledIso,
        iep: n?.iep ? { eligibility: n.iep, matrix: n.matrix ?? (SPEECH_ONLY.includes(n.iep) ? "251" : n.iep === "ASD" ? "253" : "251"), speechOnly: SPEECH_ONLY.includes(n.iep) } : null,
        plan504: Boolean(n?.plan504),
        ell: Boolean(n?.ell),
        frl: false,
        gifted: false,
        homeLanguage: "English",
        bus: null,
        wrapCare: false,
        daysEnrolled: enrolledIso === FIRST_DAY ? totalDays : schoolDaysBetween(enrolledIso, DATA_AS_OF),
        daysAbsent: n?.absentDays ?? -1,
        attendancePct: 0,
        chronicAbsence: false,
        septemberTardies: 0,
        septemberBusTardies: 0,
        fastEla: null,
        fastMath: null,
        intervention: null,
      };
    });

    const open = (flag: (s: Student) => boolean) => rows.filter((s) => !named.has(s.id) && !flag(s));
    const fill = (have: number, want: number, from: Student[], apply: (s: Student) => void) => shuffle(from).slice(0, Math.max(0, want - have)).forEach(apply);

    // IEPs, then 504 plans (never both), ELL, free/reduced lunch, gifted.
    const vpkTypes: Eligibility[] = ["DD", "SI", "DD"];
    fill(rows.filter((s) => s.iep).length, plan.iep, open((s) => Boolean(s.iep) || s.plan504), (s) => {
      const eligibility = grade === "VPK" ? vpkTypes[Math.floor(rand() * vpkTypes.length)] : pick<Eligibility>(["SLD", "SI", "LI", "OHI", "ASD", "EBD", "InD"], [45, 18, 10, 10, 7, 6, 4]);
      const matrix: MatrixLevel = SPEECH_ONLY.includes(eligibility) ? "251" : eligibility === "SLD" ? (rand() < 0.75 ? "251" : "252") : eligibility === "OHI" || eligibility === "DD" ? "252" : "253";
      s.iep = { eligibility, matrix, speechOnly: SPEECH_ONLY.includes(eligibility) };
    });
    fill(rows.filter((s) => s.plan504).length, plan.plan504, open((s) => Boolean(s.iep) || s.plan504), (s) => (s.plan504 = true));
    fill(rows.filter((s) => s.ell).length, plan.ell, open((s) => s.ell), (s) => (s.ell = true));
    fill(0, plan.frl, rows, (s) => (s.frl = true));
    fill(0, plan.gifted, rows.filter((s) => !s.iep), (s) => (s.gifted = true));

    // FAST PM1: exactly the planned share at Level 3+; gifted students always, IEP and FRL students less often.
    const level = (above: boolean, s: Student): FastLevel =>
      above
        ? s.gifted
          ? pick<FastLevel>([4, 5], [45, 55])
          : pick<FastLevel>([3, 4, 5], [55, 32, 13])
        : s.iep
          ? pick<FastLevel>([1, 2], [65, 35])
          : pick<FastLevel>([1, 2], [38, 62]);
    for (const subject of ["ela", "math"] as const) {
      const target = plan[subject];
      if (target === null) continue;
      const tested = rows.filter((s) => s.enrolledIso <= "2026-09-25"); // PM1 window closed 9/25
      const above = new Set(pickWeighted(tested, Math.round((tested.length * target) / 100), (s) => (s.iep ? 0.3 : 1) * (s.frl ? 0.55 : 1), (s) => s.gifted));
      for (const s of tested) {
        const l = level(above.has(s), s);
        if (subject === "ela") s.fastEla = l;
        else s.fastMath = l;
      }
    }
    students.push(...rows);
  }

  // Attendance: 15 chronically absent K-7 students (10%+ of days missed); everyone else under 10%.
  const k7 = students.filter((s) => s.grade !== "VPK" && s.daysAbsent < 0 && s.enrolledIso === FIRST_DAY);
  const chronic = new Set(shuffle(k7).slice(0, 14));
  for (const s of students) {
    if (s.daysAbsent < 0) {
      const rate = chronic.has(s) ? 0.12 + rand() * 0.13 : pick([0.01, 0.035, 0.07], [40, 35, 25]) * (0.5 + rand());
      s.daysAbsent = Math.min(Math.round(rate * s.daysEnrolled), chronic.has(s) ? s.daysEnrolled : Math.floor(s.daysEnrolled * 0.099));
    }
    s.attendancePct = Math.round(((s.daysEnrolled - s.daysAbsent) / Math.max(1, s.daysEnrolled)) * 1000) / 10;
    s.chronicAbsence = s.daysEnrolled >= 10 && s.daysAbsent / s.daysEnrolled >= 0.1;
  }

  // Buses (K-7): 42 ride Route 417 and 33 ride Route 452, which ran late four times in September.
  const riders = shuffle(students.filter((s) => s.grade !== "VPK" && s.enrolledIso === FIRST_DAY));
  riders.slice(0, 42).forEach((s) => (s.bus = "417"));
  riders.slice(42, 75).forEach((s) => (s.bus = "452"));
  for (const s of students) {
    if (s.bus === "452") s.septemberBusTardies = pick([0, 1, 2], [30, 55, 15]);
    s.septemberTardies = s.septemberBusTardies + (s.enrolledIso === FIRST_DAY ? pick([0, 1, 2, 4], [86, 9, 3, 2]) : 0);
  }

  // VPK wrap-around care, and families whose home language is Spanish (every ELL student plus three).
  shuffle(students.filter((s) => s.grade === "VPK")).slice(0, 15).forEach((s) => (s.wrapCare = true));
  for (const s of students) if (s.ell) s.homeLanguage = "Spanish";
  shuffle(students.filter((s) => !s.ell)).slice(0, 3).forEach((s) => (s.homeLanguage = "Spanish"));

  // Families: about one student in four has a sibling at MACS in another grade.
  const families: { id: string; grades: Set<Grade> }[] = [];
  for (const s of shuffle(students)) {
    const join = rand() < 0.27 ? families.filter((f) => f.grades.size < 3 && !f.grades.has(s.grade)) : [];
    const family = join.length ? join[Math.floor(rand() * join.length)] : { id: `F-${String(families.length + 1).padStart(3, "0")}`, grades: new Set<Grade>() };
    if (!join.length) families.push(family);
    family.grades.add(s.grade);
    s.familyId = family.id;
  }

  // Intervention groups from PM1: reading K-3 (Tier 3 for Level 1 in grades 1-3), math 3-5 Level 1.
  for (const s of students) {
    const g = s.grade;
    if (["K", "1", "2", "3"].includes(g) && s.fastEla !== null && s.fastEla <= 2) {
      s.intervention = s.fastEla === 1 && g !== "K" ? "Tier 3 reading (UFLI intensive)" : "Tier 2 reading (UFLI small group)";
    } else if (["3", "4", "5"].includes(g) && s.fastMath === 1) {
      s.intervention = "Tier 2 math (enVision intervention lessons)";
    }
  }

  return students.sort((a, b) => a.id.localeCompare(b.id));
}

export const STUDENTS: Student[] = generate();
export const SCHOOL_DAYS_SO_FAR = schoolDaysBetween(FIRST_DAY, DATA_AS_OF);

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

/** Totals by grade, for the dataset and the Students page. */
export function gradeSummary(grade: Grade, students: Student[] = STUDENTS) {
  const rows = students.filter((s) => s.grade === grade);
  const tested = (subject: "fastEla" | "fastMath") => rows.filter((s) => s[subject] !== null);
  const level3 = (subject: "fastEla" | "fastMath") => tested(subject).filter((s) => (s[subject] ?? 0) >= 3).length;
  return {
    grade,
    students: rows.length,
    sections: PLAN[grade].sections,
    swd: rows.filter((s) => s.iep).length,
    ell: rows.filter((s) => s.ell).length,
    frl: rows.filter((s) => s.frl).length,
    plan504: rows.filter((s) => s.plan504).length,
    gifted: rows.filter((s) => s.gifted).length,
    elaLevel3Pct: tested("fastEla").length ? pct(level3("fastEla"), tested("fastEla").length) : null,
    mathLevel3Pct: tested("fastMath").length ? pct(level3("fastMath"), tested("fastMath").length) : null,
  };
}

export const sectionSize = (section: string) => STUDENTS.filter((s) => s.section === section).length;

/** Proficiency gap for a subgroup in grades 3-7. */
export function subgroupGap(subject: "fastEla" | "fastMath", inGroup: (s: Student) => boolean) {
  const tested = STUDENTS.filter((s) => ["3", "4", "5", "6", "7"].includes(s.grade) && s[subject] !== null);
  const share = (rows: Student[]) => pct(rows.filter((s) => (s[subject] ?? 0) >= 3).length, rows.length);
  const group = share(tested.filter(inGroup));
  const rest = share(tested.filter((s) => !inGroup(s)));
  return { proficientPct: Math.round(group), comparisonGroupPct: Math.round(rest), gapPts: Math.round(group) - Math.round(rest) };
}

export function attendanceSummary(students: Student[] = STUDENTS) {
  const enrolled = students.reduce((a, s) => a + s.daysEnrolled, 0);
  const absent = students.reduce((a, s) => a + s.daysAbsent, 0);
  return {
    averageDailyAttendancePct: pct(enrolled - absent, enrolled),
    chronicallyAbsent: students.filter((s) => s.chronicAbsence).length,
    septemberTardies: students.reduce((a, s) => a + s.septemberTardies, 0),
    septemberBusTardies: students.reduce((a, s) => a + s.septemberBusTardies, 0),
  };
}
