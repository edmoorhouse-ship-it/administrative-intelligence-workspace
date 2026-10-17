"use client";

import { ChartColumn, ClipboardCheck, Landmark, Newspaper, Sunrise } from "lucide-react";
import { PROMPT_STARTERS, type PromptStarter } from "@/lib/starters";

export const STARTER_ICONS = {
  sunrise: Sunrise,
  landmark: Landmark,
  chart: ChartColumn,
  clipboard: ClipboardCheck,
  newspaper: Newspaper,
} satisfies Record<PromptStarter["icon"], unknown>;

/** Claude-style suggestion chips under the home composer. */
export function PromptStarters({ onPick, disabled }: { onPick: (starter: PromptStarter) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {PROMPT_STARTERS.map((starter) => {
        const Icon = STARTER_ICONS[starter.icon];
        return (
          <button
            key={starter.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(starter)}
            title={`${starter.title} — ${starter.subtitle}`}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-page px-2.5 text-sm text-secondary shadow-[0_0_0_1px_var(--line)] transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            <Icon className="size-4 text-muted" strokeWidth={1.75} />
            {starter.chip}
          </button>
        );
      })}
    </div>
  );
}
