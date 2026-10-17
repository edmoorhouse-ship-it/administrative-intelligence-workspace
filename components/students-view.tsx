"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Backpack, Bus, FlaskConical, MessageSquare, Search, X } from "lucide-react";
import { SAMPLE_DATA_NOTICE } from "@/lib/data-notice";
import { macsData } from "@/lib/macs-data";
import { attendanceSummary, GRADES, SCHOOL_DAYS_SO_FAR, STUDENTS, type FastLevel, type Grade, type Student } from "@/lib/student-roster";
import { applyFilters, describeFilters, studentCards, studentsContext, SUPPORT_FILTERS, type StudentFilters, type SupportFilter } from "@/lib/students-page";
import { withDecisions } from "@/lib/tool-pages";
import { SheetGrid, type SheetColumn, type SheetTone } from "./sheet-grid";
import { ChartCard, Columns, LEVEL_COLORS, LevelRows, type LevelRow } from "./student-charts";
import { DecisionDeck, ToolChat, useDecisions, type ToolDock } from "./tool-dock";

const gradeName = (g: Grade) => (g === "VPK" ? "VPK" : g === "K" ? "Kindergarten" : `Grade ${g}`);
const levelTone = (l: FastLevel | null): SheetTone | undefined => (l === 1 ? "bad" : l === 2 ? "neutral" : undefined);
const yes = (v: boolean) => (v ? "Yes" : "");

const ROSTER_COLUMNS: SheetColumn<Student>[] = [
  { key: "id", header: "Student", width: 74, kind: "text", get: (s) => s.id },
  { key: "grade", header: "Grade", width: 56, kind: "text", get: (s) => s.grade },
  { key: "section", header: "Section", width: 64, kind: "text", get: (s) => s.section },
  { key: "teacher", header: "Homeroom", width: 84, kind: "text", get: (s) => s.teacher },
  { key: "iep", header: "IEP", width: 78, kind: "text", get: (s) => (s.iep ? s.iep.eligibility : "") },
  { key: "504", header: "504", width: 46, kind: "text", get: (s) => yes(s.plan504) },
  { key: "ell", header: "ELL", width: 46, kind: "text", get: (s) => yes(s.ell) },
  { key: "frl", header: "F/R lunch", width: 70, kind: "text", get: (s) => yes(s.frl) },
  { key: "gifted", header: "Gifted", width: 56, kind: "text", get: (s) => yes(s.gifted) },
  {
    key: "attendance",
    header: "Attendance %",
    width: 96,
    kind: "number",
    fixed: 1,
    get: (s) => s.attendancePct,
    tone: (s) => (s.chronicAbsence ? "bad" : s.attendancePct < 95 ? "neutral" : undefined),
  },
  { key: "absent", header: "Days absent", width: 84, kind: "number", get: (s) => s.daysAbsent },
  { key: "tardies", header: "Sept tardies", width: 84, kind: "number", get: (s) => s.septemberTardies },
  { key: "ela", header: "FAST ELA", width: 74, kind: "number", get: (s) => s.fastEla, tone: (s) => levelTone(s.fastEla) },
  { key: "math", header: "FAST Math", width: 78, kind: "number", get: (s) => s.fastMath, tone: (s) => levelTone(s.fastMath) },
  { key: "intervention", header: "Intervention", width: 210, kind: "text", get: (s) => s.intervention ?? "" },
  { key: "bus", header: "Bus", width: 52, kind: "text", get: (s) => s.bus ?? "" },
  { key: "family", header: "Family", width: 64, kind: "text", get: (s) => s.familyId },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 shrink-0 rounded-full px-3 text-[13px] transition-[background-color,transform] duration-100 active:scale-95 ${
        active ? "bg-brand text-white" : "bg-surface text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Tile({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "critical" }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`mt-1 text-[24px] font-semibold leading-tight ${tone === "critical" ? "text-danger" : "text-fg"}`}>{value}</p>
      {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
    </div>
  );
}

function LevelPill({ label, level }: { label: string; level: FastLevel | null }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-page px-3 py-2 shadow-[0_0_0_1px_var(--line)]">
      <span className="text-[13px] text-secondary">{label}</span>
      {level === null ? (
        <span className="text-[13px] text-muted">Not tested</span>
      ) : (
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
          <span className="size-2.5 rounded-[2px]" style={{ background: LEVEL_COLORS[level - 1] }} />
          Level {level}
        </span>
      )}
    </div>
  );
}

function StudentCard({ student, onAsk, disabled }: { student: Student | null; onAsk: (s: Student) => void; disabled: boolean }) {
  if (!student) {
    return (
      <aside className="rounded-2xl border border-dashed border-line-strong p-5 text-center">
        <Backpack className="mx-auto size-5 text-muted" strokeWidth={1.75} />
        <p className="mt-2 text-[14px] text-fg">Pick a student</p>
        <p className="mt-1 text-[13px] text-muted">Click any row in the roster to see that student here.</p>
      </aside>
    );
  }
  const siblings = STUDENTS.filter((s) => s.familyId === student.familyId && s.id !== student.id);
  const supports = [
    student.iep && `IEP · ${student.iep.eligibility} · matrix ${student.iep.matrix}`,
    student.plan504 && "504 plan",
    student.ell && "ELL",
    student.frl && "Free/reduced lunch",
    student.gifted && "Gifted",
    student.wrapCare && "VPK wrap care",
  ].filter(Boolean) as string[];
  const present = student.daysEnrolled - student.daysAbsent;
  return (
    <aside className="anim-action-in rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] lg:sticky lg:top-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-[13px] font-semibold text-white">{student.grade}</span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-fg">{student.id}</p>
          <p className="truncate text-[12px] text-muted">
            {gradeName(student.grade)} · section {student.section} · {student.teacher}
          </p>
        </div>
      </div>

      {supports.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {supports.map((x) => (
            <span key={x} className="rounded-full bg-active px-2 py-0.5 text-[11px] text-secondary">
              {x}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-secondary">Attendance</span>
          <span className={`text-[15px] font-semibold tabular-nums ${student.chronicAbsence ? "text-danger" : "text-fg"}`}>{student.attendancePct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-active">
          <div className={`h-full rounded-full ${student.chronicAbsence ? "bg-danger" : "bg-brand"}`} style={{ width: `${student.attendancePct}%` }} />
        </div>
        <p className="mt-1 text-[12px] text-muted">
          {present} of {student.daysEnrolled} days{student.chronicAbsence ? " · chronically absent" : ""} · {student.septemberTardies} September tardies
        </p>
      </div>

      <div className="mt-4 space-y-1.5">
        <LevelPill label="FAST ELA (PM1)" level={student.fastEla} />
        <LevelPill label="FAST Math (PM1)" level={student.fastMath} />
      </div>

      <dl className="mt-4 space-y-1.5 text-[13px]">
        {student.intervention && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Intervention</dt>
            <dd className="text-right text-fg">{student.intervention}</dd>
          </div>
        )}
        {student.bus && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Bus</dt>
            <dd className="flex items-center gap-1 text-fg">
              <Bus className="size-3.5 text-muted" /> ACPS Route {student.bus}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Family</dt>
          <dd className="text-right text-fg">
            {student.familyId}
            {siblings.length > 0 && <span className="block text-[12px] text-muted">Siblings: {siblings.map((s) => `${s.id} (${s.grade})`).join(", ")}</span>}
          </dd>
        </div>
        {student.enrolledIso !== "2026-08-10" && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Enrolled</dt>
            <dd className="text-fg">{student.enrolledIso}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onAsk(student)}
        className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-fg text-sm text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
      >
        <MessageSquare className="size-4" />
        Ask about {student.id}
      </button>
    </aside>
  );
}

const ATTENDANCE_BANDS = [
  { label: "<85%", test: (p: number) => p < 85, chronic: true },
  { label: "85–90%", test: (p: number) => p >= 85 && p < 90, chronic: true },
  { label: "90–95%", test: (p: number) => p >= 90 && p < 95, chronic: false },
  { label: "95–98%", test: (p: number) => p >= 95 && p < 98, chronic: false },
  { label: "98%+", test: (p: number) => p >= 98, chronic: false },
];

/** The 300-student sample roster: filters, totals, charts, decisions, and the roster as a sheet. */
export function StudentsView({ dock }: { dock: ToolDock }) {
  const [filters, setFilters] = useState<StudentFilters>({ grade: "all", supports: [], query: "" });
  const [subject, setSubject] = useState<"fastEla" | "fastMath">("fastEla");
  const [selected, setSelected] = useState<Student | null>(null);
  const decisions = useDecisions();

  const shown = useMemo(() => applyFilters(STUDENTS, filters), [filters]);
  const cards = useMemo(() => studentCards(STUDENTS), []);
  const att = attendanceSummary(shown);
  const tested = shown.filter((s) => s[subject] !== null);
  const onLevel = tested.filter((s) => (s[subject] ?? 0) >= 3).length;
  const ask = (text: string) => dock.onAsk("students", text, withDecisions(studentsContext(STUDENTS, shown, filters, selected), cards, decisions));
  const onSelect = useCallback((s: Student | null) => setSelected(s), []);

  const toggleSupport = (id: SupportFilter) =>
    setFilters((f) => ({ ...f, supports: f.supports.includes(id) ? f.supports.filter((x) => x !== id) : [...f.supports, id] }));
  const filtered = filters.grade !== "all" || filters.supports.length > 0 || filters.query.trim() !== "";

  const levelRows: LevelRow[] = GRADES.filter((g) => g !== "VPK").map((g) => {
    const counts: LevelRow["counts"] = [0, 0, 0, 0, 0];
    for (const s of shown) if (s.grade === g && s[subject] !== null) counts[(s[subject] as number) - 1]++;
    return { label: g, counts };
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <Backpack className="size-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-muted">Micanopy Area Cooperative School</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Students</h1>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-secondary shadow-[0_0_0_1px_var(--line)]">
              <FlaskConical className="size-3.5 text-brand" strokeWidth={1.75} />
              Sample roster
            </span>
          </div>
        </div>
      </div>
      <p className="mt-4 max-w-3xl text-[13px] leading-5 text-muted">
        {STUDENTS.length} illustrative students, identified by code only. Attendance covers the {SCHOOL_DAYS_SO_FAR} school days through {macsData.meta.asOf}; FAST levels are PM1. {SAMPLE_DATA_NOTICE}
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <Chip active={filters.grade === "all"} onClick={() => setFilters((f) => ({ ...f, grade: "all" }))}>
            All grades
          </Chip>
          {GRADES.map((g) => (
            <Chip key={g} active={filters.grade === g} onClick={() => setFilters((f) => ({ ...f, grade: f.grade === g ? "all" : g }))}>
              {g}
            </Chip>
          ))}
          <label className="ml-auto flex h-8 w-36 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 shadow-[0_0_0_1px_var(--line)] focus-within:shadow-[0_0_0_1px_var(--line-strong)]">
            <Search className="size-3.5 text-muted" />
            <input
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="S-1107"
              aria-label="Find a student by code"
              className="w-full bg-transparent text-[13px] text-fg outline-none placeholder:text-muted"
            />
          </label>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {SUPPORT_FILTERS.map((x) => (
            <Chip key={x.id} active={filters.supports.includes(x.id)} onClick={() => toggleSupport(x.id)}>
              {x.label}
            </Chip>
          ))}
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters({ grade: "all", supports: [], query: "" })}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[13px] text-muted hover:bg-hover hover:text-fg"
            >
              <X className="size-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Students" value={`${shown.length}`} note={filtered ? `of ${STUDENTS.length} · ${describeFilters(filters)}` : `of ${macsData.enrollment.capacity} seats · ${macsData.enrollment.totalWaitlist} waitlisted`} />
        <Tile label="Attendance" value={`${att.averageDailyAttendancePct}%`} note="Average daily, year to date" />
        <Tile label="Chronically absent" value={`${att.chronicallyAbsent}`} note="Missed 10% or more of days" tone={att.chronicallyAbsent > 0 ? "critical" : undefined} />
        <Tile
          label={`On grade level, ${subject === "fastEla" ? "ELA" : "math"}`}
          value={tested.length ? `${Math.round((onLevel / tested.length) * 100)}%` : "–"}
          note={`${onLevel} of ${tested.length} tested at Level 3+`}
        />
      </div>

      <DecisionDeck cards={cards} onAsk={ask} disabled={dock.composer.isStreaming} heading="Decide" area="students" page="Students" />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Students by grade" note={filtered ? describeFilters(filters) : `${STUDENTS.length} students in ${GRADES.length} grades`}>
          <Columns
            unit="students"
            data={GRADES.map((g) => ({ label: g, value: shown.filter((s) => s.grade === g).length, tip: gradeName(g) }))}
          />
        </ChartCard>
        <ChartCard title="Attendance spread" note="Students by year-to-date attendance">
          <Columns
            unit="students"
            data={ATTENDANCE_BANDS.map((b) => ({
              label: b.label,
              value: shown.filter((s) => b.test(s.attendancePct)).length,
              tip: b.chronic ? `${b.label} attendance · chronically absent` : `${b.label} attendance`,
              color: b.chronic ? "var(--viz-critical)" : undefined,
              flag: b.chronic ? "Chronic" : undefined,
            }))}
          />
        </ChartCard>
      </div>

      <div className="mt-4">
        <ChartCard
          title="FAST PM1 levels by grade"
          note="Share of tested students at each level. The number at the end is the share at Level 3+."
          action={
            <div className="flex rounded-lg bg-active p-px" role="tablist" aria-label="Subject">
              {(
                [
                  ["fastEla", "ELA"],
                  ["fastMath", "Math"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={subject === value}
                  onClick={() => setSubject(value)}
                  className={`h-7 rounded-md px-3 text-[12px] transition-colors ${subject === value ? "bg-surface text-fg shadow-[0_0_0_0.5px_var(--line),0_1px_2px_rgb(0_0_0/0.06)]" : "text-muted hover:text-secondary"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <LevelRows rows={levelRows} />
        </ChartCard>
      </div>

      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[20px] text-fg">Roster</h2>
        <span className="text-[13px] text-muted">Click a row to open the student card</span>
      </div>
      <div className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <SheetGrid
            sheetName="Students"
            columns={ROSTER_COLUMNS}
            rows={shown}
            onChange={() => {}}
            makeRow={() => STUDENTS[0]}
            rowKey={(s) => s.id}
            fileName={`MACS sample roster ${macsData.meta.asOf}`}
            readOnly
            onSelect={onSelect}
            maxHeight={520}
          />
        </div>
        <StudentCard
          student={selected}
          disabled={dock.composer.isStreaming}
          onAsk={(s) => ask(`Tell me about ${s.id}. What stands out, and what should someone do next for this student?`)}
        />
      </div>

      <ToolChat tool="students" onAsk={ask} composer={dock.composer} />
    </div>
  );
}
