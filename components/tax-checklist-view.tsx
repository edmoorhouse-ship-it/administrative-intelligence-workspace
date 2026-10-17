"use client";

import { Check, Receipt } from "lucide-react";
import { setDecision } from "@/lib/decisions";
import { logActivity } from "@/lib/shared-client";
import { TAX_CHECKLIST, TAX_NOTE } from "@/lib/tax-checklist";
import { TAX_CARDS, taxContext, taxQuestionId, withDecisions } from "@/lib/tool-pages";
import { DecisionDeck, ToolChat, useDecisions, type ToolDock } from "./tool-dock";
import { profile } from "@/profiles";

/** Checklist of questions for the school's accountant. Gives no dates or amounts of tax owed. */
export function TaxChecklistView({ dock }: { dock: ToolDock }) {
  const decisions = useDecisions();
  const ask = (text: string) => dock.onAsk("tax", text, withDecisions(taxContext(decisions), TAX_CARDS, decisions));
  const total = TAX_CHECKLIST.reduce((n, item) => n + item.ask.length, 0);
  const answered = TAX_CHECKLIST.reduce((n, item, i) => n + item.ask.filter((_, j) => decisions[taxQuestionId(i, j)]).length, 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <Receipt className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[13px] text-muted">{profile.org}</p>
          <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Tax &amp; filings checklist</h1>
        </div>
      </div>

      <p className="mt-5 font-serif text-[17px] leading-7 text-fg">{TAX_NOTE}</p>

      <DecisionDeck cards={TAX_CARDS} onAsk={ask} disabled={dock.composer.isStreaming} area="finance" page="Tax checklist" />

      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[20px] text-fg">Questions</h2>
        <span className="text-[13px] tabular-nums text-muted">
          {answered} of {total} answered
        </span>
      </div>

      {TAX_CHECKLIST.map((item, i) => (
        <section key={item.title} className="mt-4 rounded-xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-serif text-[19px] leading-snug text-fg">
              <span className="mr-2 text-muted">{i + 1}.</span>
              {item.title}
            </h2>
            {item.ask.every((_, j) => decisions[taxQuestionId(i, j)]) ? (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-[#e5f3ea] px-2 text-[11px] font-medium text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]">
                Answered
              </span>
            ) : (
              <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-[#fbf0cf] px-2 text-[11px] font-medium text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]">
                To confirm
              </span>
            )}
          </div>
          <p className="mt-2 text-[14px] leading-6 text-secondary">{item.why}</p>
          <ul className="mt-3 space-y-1 text-[14px] leading-6 text-fg">
            {item.ask.map((q, j) => {
              const id = taxQuestionId(i, j);
              const done = Boolean(decisions[id]);
              return (
                <li key={q}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => {
                      setDecision(id, done ? null : "answered");
                      void logActivity(`${done ? "reopened" : "marked answered"}: "${q}"`, "finance", "Tax checklist");
                    }}
                    className="-mx-2 flex w-[calc(100%+1rem)] gap-3 rounded-lg px-2 py-1.5 text-left transition-[background-color,transform] duration-100 hover:bg-hover active:scale-[0.99]"
                  >
                    <span
                      className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                        done ? "bg-[#2f8a4f] text-white" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
                      }`}
                    >
                      {done && <Check className="size-2.5" strokeWidth={3.5} />}
                    </span>
                    <span className={done ? "text-muted line-through decoration-line-strong" : ""}>{q}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <ToolChat tool="tax" onAsk={ask} composer={dock.composer} />
    </div>
  );
}
