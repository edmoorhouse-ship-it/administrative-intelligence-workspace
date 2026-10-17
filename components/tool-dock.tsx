"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Check, MessageSquare, RotateCcw } from "lucide-react";
import type { Area } from "@/lib/access";
import { getDecisions, getServerDecisions, setDecision, subscribeDecisions } from "@/lib/decisions";
import { logActivity } from "@/lib/shared-client";
import { TOOL_PROMPTS, type DecisionCard } from "@/lib/tool-pages";
import { TOOL_TITLES, type ToolId } from "@/lib/tools";
import { Composer } from "./composer";

export type ComposerBase = Omit<ComponentProps<typeof Composer>, "onSend" | "placeholder" | "focusKey">;

/** What the workspace hands each tool page so it can start a chat about itself. */
export interface ToolDock {
  onAsk: (tool: ToolId, text: string, context: string) => void;
  composer: ComposerBase;
}

export function useDecisions() {
  return useSyncExternalStore(subscribeDecisions, getDecisions, getServerDecisions);
}

const URGENCY_DOT = {
  critical: "bg-danger",
  warn: "bg-[#c9a227]",
  none: "bg-brand",
};

/** Cards with one-tap choices. A choice with a request attached also opens a chat that drafts it. */
export function DecisionDeck({
  cards,
  onAsk,
  disabled,
  heading = "Decide",
  area = "general",
  page,
}: {
  cards: DecisionCard[];
  onAsk: (text: string) => void;
  disabled?: boolean;
  heading?: string;
  /** Who sees these choices in the shared activity feed. */
  area?: Area;
  page?: string;
}) {
  const decisions = useDecisions();
  if (cards.length === 0) return null;
  const decided = cards.filter((c) => decisions[c.id]).length;
  const open = cards.length - decided;

  return (
    <section className="mt-8" aria-label={heading}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[20px] text-fg">{heading}</h2>
        <span className="text-[13px] tabular-nums text-muted">
          {open ? `${open} open` : "All decided"}
          {decided ? ` · ${decided} decided` : ""}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-active" aria-hidden>
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${(decided / cards.length) * 100}%` }}
        />
      </div>

      <div className="mt-4 space-y-2.5">
        {cards.map((card) => {
          const choice = decisions[card.id]?.choice;
          const picked = card.options.find((o) => o.id === choice);
          return picked ? (
            <div key={card.id} className="anim-settle flex items-center gap-3 rounded-xl bg-bubble px-4 py-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#2f8a4f] text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <p className="min-w-0 flex-1 truncate text-[14px] text-secondary">
                <span className="font-medium text-fg">{picked.label}</span>
                <span className="text-muted"> · {card.title}</span>
                {decisions[card.id]?.by && <span className="text-muted"> · {decisions[card.id]?.by}</span>}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDecision(card.id, null);
                  void logActivity(`undid the choice on "${card.title}"`, area, page);
                }}
                className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] text-muted transition-colors hover:bg-hover hover:text-fg"
              >
                <RotateCcw className="size-3" />
                Undo
              </button>
            </div>
          ) : (
            <div key={card.id} className="anim-settle rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
              <div className="flex items-start gap-3">
                <span className={`mt-[7px] size-2 shrink-0 rounded-full ${URGENCY_DOT[card.urgency ?? "none"]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium leading-6 text-fg">{card.title}</p>
                  {card.detail && <p className="mt-0.5 text-[14px] leading-6 text-secondary">{card.detail}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.options.map((o, i) => (
                      <button
                        key={o.id}
                        type="button"
                        disabled={disabled && Boolean(o.ask)}
                        onClick={() => {
                          setDecision(card.id, o.id);
                          void logActivity(`chose "${o.label}" on "${card.title}"`, area, page);
                          if (o.ask) onAsk(o.ask);
                        }}
                        className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm transition-[transform,background-color,opacity] duration-100 active:scale-[0.96] disabled:opacity-40 ${
                          i === 0
                            ? "bg-fg text-page hover:opacity-90"
                            : "bg-page text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover hover:text-fg"
                        }`}
                      >
                        {o.ask && <MessageSquare className="size-3.5" strokeWidth={2} />}
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-5 text-muted">
        <MessageSquare className="mt-1 size-3 shrink-0" strokeWidth={2} />
        <span>means the choice opens a chat that writes the draft. Choices are shared with everyone signed in. Nothing is sent, ordered, or paid.</span>
      </p>
    </section>
  );
}

/** A composer scoped to one tool page. The chat it starts sees a snapshot of the page. */
export function ToolChat({ tool, onAsk, composer }: { tool: ToolId; onAsk: (text: string) => void; composer: ComposerBase }) {
  const prompts = TOOL_PROMPTS[tool] ?? [];
  return (
    <section className="mt-12 border-t border-line pt-6" aria-label={`Ask about ${TOOL_TITLES[tool]}`}>
      <h2 className="font-serif text-[20px] text-fg">Ask about this page</h2>
      <p className="mt-1 text-[13px] text-muted">The chat sees what this page shows, including your edits and choices.</p>
      <div className="mt-4">
        <Composer {...composer} onSend={onAsk} placeholder={`Ask about ${TOOL_TITLES[tool]}…`} focusKey={`tool-${tool}`} />
      </div>
      {prompts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={composer.isStreaming}
              onClick={() => onAsk(prompt)}
              className="rounded-lg bg-page px-2.5 py-1.5 text-left text-sm text-secondary shadow-[0_0_0_1px_var(--line)] transition-[transform,background-color] duration-100 hover:bg-hover hover:text-fg active:scale-[0.97] disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
