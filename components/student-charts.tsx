"use client";

import { useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";

/**
 * Small charts for the Students page, built to the dataviz skill's specs: thin bars (24px max)
 * with 4px rounded data ends on one baseline, 2px surface gaps between stacked segments, a
 * per-mark tooltip on hover and keyboard focus, recessive gridlines, and text in text colors.
 */

interface Tip {
  x: number;
  y: number;
  value: string;
  label: string;
  color: string;
}

function useTip() {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const place = (target: Element, clientX: number | null, value: string, label: string, color: string) => {
    const box = ref.current?.getBoundingClientRect();
    const mark = target.getBoundingClientRect();
    if (!box) return;
    setTip({ x: (clientX ?? mark.left + mark.width / 2) - box.left, y: mark.top - box.top, value, label, color });
  };
  const handlers = (value: string, label: string, color: string) => ({
    onPointerMove: (e: PointerEvent<HTMLElement>) => place(e.currentTarget, e.clientX, value, label, color),
    onPointerLeave: () => setTip(null),
    onFocus: (e: FocusEvent<HTMLElement>) => place(e.currentTarget, null, value, label, color),
    onBlur: () => setTip(null),
  });
  const layer = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-surface px-2.5 py-1.5 text-[12px] shadow-[0_0_0_1px_var(--line),0_6px_18px_-6px_rgb(0_0_0/0.25)]"
      style={{ left: tip.x, top: tip.y - 6 }}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-[2px] w-3 rounded-full" style={{ background: tip.color }} />
        <span className="font-semibold tabular-nums text-fg">{tip.value}</span>
      </span>
      <span className="block text-secondary">{tip.label}</span>
    </div>
  );
  return { ref, handlers, layer };
}

export function ChartCard({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium text-fg">{title}</h3>
          {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const niceMax = (v: number) => {
  const step = v <= 10 ? 2 : v <= 40 ? 10 : v <= 100 ? 20 : 50;
  return Math.max(step, Math.ceil(v / step) * step);
};

export interface Column {
  label: string;
  value: number;
  tip: string;
  color?: string;
  flag?: string;
}

/** Vertical columns on one baseline. Single series unless a column carries a status color and flag. */
export function Columns({ data, unit, height = 150 }: { data: Column[]; unit: string; height?: number }) {
  const { ref, handlers, layer } = useTip();
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const ticks = [0, max / 2, max];
  return (
    <div ref={ref} className="relative">
      <div className="relative flex gap-1 pl-7" style={{ height }}>
        {ticks.map((t) => (
          <div key={t} className="pointer-events-none absolute inset-x-0 flex items-center" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="w-6 -translate-y-px pr-1 text-right text-[10px] tabular-nums text-muted">{t}</span>
            <span className={`h-px flex-1 ${t === 0 ? "bg-[var(--viz-axis)]" : "bg-[var(--viz-grid)]"}`} />
          </div>
        ))}
        {data.map((d) => {
          const color = d.color ?? "var(--viz-bar)";
          return (
            <button
              key={d.label}
              type="button"
              aria-label={`${d.label}: ${d.value} ${unit}`}
              {...handlers(`${d.value} ${unit}`, d.tip, color)}
              className="group relative z-[1] flex h-full flex-1 items-end justify-center rounded-md outline-none focus-visible:bg-hover"
            >
              <span
                className="block w-full max-w-6 rounded-t-[4px] transition-[filter] duration-150 group-hover:brightness-110 group-focus-visible:brightness-110"
                style={{ height: `${(d.value / max) * 100}%`, background: color, minHeight: d.value > 0 ? 2 : 0 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1 pl-7">
        {data.map((d) => (
          <span key={d.label} className="flex flex-1 flex-col items-center text-center">
            <span className="text-[11px] text-secondary">{d.label}</span>
            {d.flag && (
              <span className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted">
                <CircleAlert className="size-2.5" style={{ color: d.color }} />
                {d.flag}
              </span>
            )}
          </span>
        ))}
      </div>
      {layer}
    </div>
  );
}

export const LEVEL_COLORS = ["var(--viz-l1)", "var(--viz-l2)", "var(--viz-l3)", "var(--viz-l4)", "var(--viz-l5)"];

export interface LevelRow {
  label: string;
  counts: [number, number, number, number, number];
}

/** One 100% bar per grade, Level 1 to 5 left to right, with the share at Level 3+ at the end. */
export function LevelRows({ rows }: { rows: LevelRow[] }) {
  const { ref, handlers, layer } = useTip();
  return (
    <div ref={ref} className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-secondary" aria-hidden>
        {LEVEL_COLORS.map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="size-2.5 rounded-[2px]" style={{ background: c }} />
            Level {i + 1}
          </span>
        ))}
        <span className="text-muted">Level 3+ is on grade level</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const total = row.counts.reduce((a, b) => a + b, 0);
          const onLevel = row.counts[2] + row.counts[3] + row.counts[4];
          const lastFilled = row.counts.reduce((last, n, i) => (n > 0 ? i : last), -1);
          return (
            <div key={row.label} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-[11px] text-secondary">{row.label}</span>
              <div className="flex h-5 flex-1 gap-[2px]">
                {total === 0 ? (
                  <span className="flex-1 rounded-[4px] bg-active" />
                ) : (
                  row.counts.map((n, i) =>
                    n === 0 ? null : (
                      <button
                        key={i}
                        type="button"
                        aria-label={`${row.label === "K" ? "Kindergarten" : `Grade ${row.label}`}, Level ${i + 1}: ${n} students`}
                        {...handlers(`${n} student${n === 1 ? "" : "s"} · ${Math.round((n / total) * 100)}%`, `${row.label === "K" ? "Kindergarten" : `Grade ${row.label}`}, Level ${i + 1}`, LEVEL_COLORS[i])}
                        className={`h-full outline-none transition-[filter] duration-150 hover:brightness-110 focus-visible:brightness-110 focus-visible:ring-2 focus-visible:ring-fg ${i === lastFilled ? "rounded-r-[4px]" : ""}`}
                        style={{ flexGrow: n, flexBasis: 0, background: LEVEL_COLORS[i] }}
                      />
                    ),
                  )
                )}
              </div>
              <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-fg">{total ? `${Math.round((onLevel / total) * 100)}%` : "–"}</span>
            </div>
          );
        })}
      </div>
      {layer}
    </div>
  );
}
