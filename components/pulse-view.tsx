"use client";

import { FlaskConical } from "lucide-react";
import { SAMPLE_DATA_NOTICE } from "@/lib/data-notice";
import { pulse, STATUS_LABEL, type PulseLine, type Status } from "@/lib/pulse";
import { PULSE_CARDS, PULSE_CONTEXT, withDecisions } from "@/lib/tool-pages";
import { DecisionDeck, ToolChat, useDecisions, type ToolDock } from "./tool-dock";

const PILL: Record<Status, string> = {
  good: "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]",
  warn: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]",
  critical: "bg-danger/10 text-danger",
  na: "bg-active text-muted",
};

const DOT: Record<Status, string> = {
  good: "bg-[#2f8a4f]",
  warn: "bg-[#c9a227]",
  critical: "bg-danger",
  na: "bg-muted",
};

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium ${PILL[status]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function LineText({ line }: { line: PulseLine }) {
  return (
    <span className="flex gap-2.5">
      {line.status ? <span className={`mt-2 size-1.5 shrink-0 rounded-full ${DOT[line.status]}`} /> : <span className="mt-2 size-1.5 shrink-0" />}
      <span>{line.text}</span>
    </span>
  );
}

/** Business pulse for MACS: one page, same structure as the business-pulse skill. */
export function PulseView({ dock }: { dock: ToolDock }) {
  const decisions = useDecisions();
  const ask = (text: string) => dock.onAsk("pulse", text, withDecisions(PULSE_CONTEXT, PULSE_CARDS, decisions));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <p className="text-[13px] text-muted">{pulse.dateLabel}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Business pulse</h1>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-secondary shadow-[0_0_0_1px_var(--line)]">
          <FlaskConical className="size-3.5 text-brand" strokeWidth={1.75} />
          Sample data
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted">{SAMPLE_DATA_NOTICE}</p>

      <div className="mt-6 flex items-start gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
        <StatusPill status={pulse.overall} />
        <p className="text-[15px] leading-6 text-fg">{pulse.overallLine}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {pulse.tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] text-muted">{t.label}</p>
              <StatusPill status={t.status} />
            </div>
            <p className="mt-2 font-serif text-[24px] leading-tight tabular-nums text-fg">{t.value}</p>
            <p className="mt-1 text-[12px] leading-5 text-muted">{t.context}</p>
          </div>
        ))}
      </div>

      <DecisionDeck cards={PULSE_CARDS} onAsk={ask} disabled={dock.composer.isStreaming} page="Business pulse" />

      <section className="mt-8">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">TL;DR</h2>
        <ul className="mt-2 space-y-2 text-[15px] leading-6 text-fg">
          {pulse.tldr.map((t) => (
            <li key={t} className="flex gap-3">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {pulse.sections.map((s) => (
        <section key={s.title} className="mt-8">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
            <h2 className="font-serif text-[20px] text-fg">{s.title}</h2>
            <StatusPill status={s.status} />
          </div>
          <ul className="mt-3 space-y-2 text-[14px] leading-6 text-fg">
            {s.lines.map((l) => (
              <li key={l.text}>
                <LineText line={l} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="font-serif text-[20px] text-fg">This week</h2>
        {pulse.thisWeek.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">Nothing scheduled in the next 10 days.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
            {pulse.thisWeek.map((w) => (
              <li key={`${w.iso}-${w.text}`} className="flex gap-4 px-4 py-2.5 text-[14px]">
                <span className="w-24 shrink-0 text-secondary">{w.when}</span>
                <span className="min-w-0 text-fg">{w.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-[20px] text-fg">Watch list</h2>
        {pulse.watch.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">No urgent items. The check ran.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pulse.watch.map((w) => (
              <li key={w.text} className="flex items-start gap-3 rounded-xl bg-surface px-4 py-3 text-[14px] leading-6 text-fg shadow-[0_0_0_1px_var(--line)]">
                <StatusPill status={w.status} />
                <span className="min-w-0">{w.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-2xl border-l-4 border-gold bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">#1 priority</h2>
        <p className="mt-2 font-serif text-[18px] leading-7 text-fg">{pulse.priority}</p>
      </section>

      <ToolChat tool="pulse" onAsk={ask} composer={dock.composer} />

      <section className="mt-10 border-t border-line pt-4">
        <h2 className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Appendix</h2>
        <dl className="mt-3 space-y-2 text-[12px] leading-5 text-muted">
          {pulse.appendix.map((a) => (
            <div key={a.label} className="flex gap-3">
              <dt className="w-28 shrink-0 text-secondary">{a.label}</dt>
              <dd className="min-w-0">{a.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
