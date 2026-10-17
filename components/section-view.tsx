"use client";

import type { ComponentProps } from "react";
import { ArrowUpRight, CalendarDays, SearchCheck } from "lucide-react";
import { SECTION_PROMPTS, SITE_CHECKED_ON, type SchoolSection } from "@/lib/school-sections";
import { Composer } from "./composer";
import { SectionIcon } from "./section-icon";
import { profile } from "@/profiles";

interface SectionViewProps {
  section: SchoolSection;
  onAsk: (text: string) => void;
  composer: Omit<ComponentProps<typeof Composer>, "onSend" | "placeholder" | "focusKey">;
}

const checkedLabel = new Date(`${SITE_CHECKED_ON}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

function formatEventDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

/** A school section page: public info from macschool.us plus a composer scoped to the section. */
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function SectionView({ section, onAsk, composer }: SectionViewProps) {
  const host = section.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  // Upcoming Events hides dates that have already passed; Calendar keeps the full list.
  const events = section.id === "upcoming-events" ? section.events?.filter((e) => e.date >= todayIso()) : section.events;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <SectionIcon id={section.id} className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] text-muted">{profile.org}</p>
          <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">{section.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted">
            From
            <a href={section.url} target="_blank" rel="noopener noreferrer" className="text-secondary underline decoration-line-strong underline-offset-2 hover:text-fg">
              {host}
            </a>
            · checked {checkedLabel}
          </p>
        </div>
      </div>

      {section.summary && <p className="mt-6 font-serif text-[17px] leading-7 text-fg">{section.summary}</p>}

      {events && events.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
          {events.map((e, i) => (
            <div key={`${e.date}-${e.title}-${i}`} className={`flex items-start gap-4 px-4 py-3 text-sm ${i ? "border-t border-line" : ""}`}>
              <span className="flex w-28 shrink-0 items-center gap-1.5 text-secondary">
                <CalendarDays className="size-3.5 text-brand" strokeWidth={1.75} />
                {formatEventDate(e.date)}
              </span>
              <span className="min-w-0 flex-1 text-fg">{e.title}</span>
              {e.time && <span className="shrink-0 text-muted">{e.time}</span>}
            </div>
          ))}
        </div>
      )}

      {section.facts.length > 0 && (
        <ul className="mt-6 space-y-2.5">
          {section.facts.map((fact) => (
            <li key={fact} className="flex gap-3 text-[15px] leading-6 text-fg">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-gold" />
              {fact}
            </li>
          ))}
        </ul>
      )}

      {section.links.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {section.links.map((l) => (
            <a
              key={l.url + l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-page px-2.5 text-sm text-secondary shadow-[0_0_0_1px_var(--line)] transition-colors hover:bg-hover hover:text-fg"
            >
              {l.label}
              <ArrowUpRight className="size-3.5 text-muted" />
            </a>
          ))}
        </div>
      )}

      {section.notes && (
        <div className="mt-6 flex gap-2.5 rounded-xl bg-bubble px-4 py-3 text-[13px] leading-5 text-secondary">
          <SearchCheck className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} />
          <p>
            <span className="font-medium text-fg">Website check: </span>
            {section.notes}
          </p>
        </div>
      )}

      <div className="mt-10">
        <Composer {...composer} onSend={onAsk} placeholder={`Ask about ${section.title}…`} focusKey={`section-${section.id}`} />
        <div className="mt-3 flex flex-wrap gap-2">
          {SECTION_PROMPTS[section.id].map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={composer.isStreaming}
              onClick={() => onAsk(prompt)}
              className="rounded-lg bg-page px-2.5 py-1.5 text-left text-sm text-secondary shadow-[0_0_0_1px_var(--line)] transition-colors hover:bg-hover hover:text-fg disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
