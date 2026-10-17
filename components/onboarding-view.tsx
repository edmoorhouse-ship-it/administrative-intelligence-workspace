"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, FileText, PartyPopper, Plus, Trash2, UserPlus, X } from "lucide-react";
import { newId } from "@/lib/chat-utils";
import { DATA_AS_OF } from "@/lib/macs-data";
import {
  DEFAULT_ONBOARDING,
  hasProfileBlock,
  HIRE_STEPS,
  onboardingContext,
  profileGaps,
  normalizeOnboarding,
  SETUP_STEPS,
  withProfile,
  type NewHire,
  type OnboardingState,
  type SchoolProfile,
  type SetupStep,
} from "@/lib/onboarding";
import { ROLES, getRole, type AdminRoleId } from "@/lib/roles";
import type { ToolId } from "@/lib/tools";
import { logActivity, useShared } from "@/lib/shared-client";
import { ToolChat, type ToolDock } from "./tool-dock";
import { profile } from "@/profiles";

interface OnboardingViewProps {
  dock: ToolDock;
  customInstructions: string;
  onSaveInstructions: (text: string) => void;
  onOpen: (tool: ToolId) => void;
}

/** A ring that fills as steps are done. */
function ProgressRing({ done, total, size = 64 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const complete = done === total;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={5} className="stroke-active" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - done / total)}
          className={`transition-[stroke-dashoffset] duration-700 ease-out ${complete ? "stroke-[#2f8a4f]" : "stroke-brand"}`}
        />
      </svg>
      <span className="absolute text-[13px] font-semibold tabular-nums text-fg">
        {complete ? <Check className="size-5 text-[#2f8a4f]" strokeWidth={3} /> : `${done}/${total}`}
      </span>
    </span>
  );
}

const STEP_TITLES: Record<SetupStep, string> = {
  profile: "School profile",
  mail: "Mail",
  books: "Bookkeeping",
  checkin: "Daily check-in",
  mac: "Meet Mac",
};

function StepCard({
  index,
  title,
  status,
  done,
  open,
  onToggle,
  children,
}: {
  index: number;
  title: string;
  status: string;
  done: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li className={`rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)] transition-shadow ${open ? "shadow-[0_0_0_1px_var(--line-strong),0_8px_24px_-16px_rgb(0_0_0/0.25)]" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
            done ? "anim-pop-in bg-[#2f8a4f] text-white" : "bg-active text-secondary"
          }`}
        >
          {done ? <Check className="size-4" strokeWidth={3} /> : index}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-medium ${done ? "text-secondary" : "text-fg"}`}>{title}</span>
          <span className="block truncate text-[13px] text-muted">{status}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="anim-action-in border-t border-line px-4 pb-4 pt-3.5">{children}</div>}
    </li>
  );
}

function ActionButton({ onClick, children, primary = false }: { onClick: () => void; children: ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm transition-[transform,opacity,background-color] duration-100 active:scale-[0.96] ${
        primary ? "bg-fg text-page hover:opacity-90" : "bg-page text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

const FIELD =
  "w-full rounded-lg bg-page px-3 py-2 text-[14px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-fg">{label}</span>
      {hint && <span className="ml-1.5 text-[12px] text-muted">{hint}</span>}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const HEADACHE_EXAMPLES = ["e.g. FTE survey deadlines", "e.g. IEP review timelines", "e.g. reimbursements arriving late"];

function ProfileForm({
  profile,
  onChange,
  saved,
  onSave,
  onRemove,
}: {
  profile: SchoolProfile;
  onChange: (p: SchoolProfile) => void;
  saved: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  const gaps = profileGaps(profile);
  const set = <K extends keyof SchoolProfile>(key: K, value: SchoolProfile[K]) => onChange({ ...profile, [key]: value });

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-6 text-secondary">
        A few facts about MACS so every chat starts with the right picture. The first lines come from the public website.
      </p>
      <Field label="The school">
        <textarea rows={2} value={profile.school} onChange={(e) => set("school", e.target.value)} className={`${FIELD} resize-y`} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <Field label="Size">
          <input value={profile.size} onChange={(e) => set("size", e.target.value)} className={FIELD} />
        </Field>
        <Field label="Leadership team" hint="people">
          <input
            inputMode="numeric"
            value={profile.teamSize}
            onChange={(e) => set("teamSize", e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            placeholder="How many?"
            className={`${FIELD} tabular-nums`}
          />
        </Field>
      </div>
      <Field label="Biggest day-to-day headaches" hint="at least two">
        <span className="block space-y-2">
          {profile.headaches.map((h, i) => (
            <input
              key={i}
              value={h}
              onChange={(e) => {
                const next = [...profile.headaches] as SchoolProfile["headaches"];
                next[i] = e.target.value;
                set("headaches", next);
              }}
              placeholder={HEADACHE_EXAMPLES[i]}
              className={FIELD}
            />
          ))}
        </span>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tools in use">
          <input value={profile.tools} onChange={(e) => set("tools", e.target.value)} className={FIELD} />
        </Field>
        <Field label="Rhythm">
          <input value={profile.rhythm} onChange={(e) => set("rhythm", e.target.value)} className={FIELD} />
        </Field>
      </div>
      <div>
        <span className="text-[13px] font-medium text-fg">How answers should read</span>
        <div className="mt-1.5 flex gap-2" role="radiogroup">
          {(
            [
              ["short", "Short and direct"],
              ["detailed", "Detailed, with tables"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={profile.answers === value}
              onClick={() => set("answers", value)}
              className={`h-9 rounded-full px-4 text-sm transition-[background-color,transform] duration-100 active:scale-95 ${
                profile.answers === value ? "bg-brand text-white" : "bg-page text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          disabled={gaps.length > 0}
          onClick={onSave}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-fg px-4 text-sm text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
        >
          <Check className="size-4" strokeWidth={2.5} />
          {saved ? "Update every chat" : "Save to every chat"}
        </button>
        {gaps.length > 0 ? (
          <span className="text-[13px] text-muted">Still needed: {gaps.join(" and ")}.</span>
        ) : saved ? (
          <>
            <span className="text-[13px] text-[#1f6b3a] dark:text-[#9bd8ae]">Saved. New chats know the school profile.</span>
            <button type="button" onClick={onRemove} className="text-[13px] text-muted underline-offset-2 hover:text-fg hover:underline">
              Remove from chats
            </button>
          </>
        ) : (
          <span className="text-[13px] text-muted">Adds it to your custom instructions. You can remove it any time.</span>
        )}
      </div>
    </div>
  );
}

function HireCard({
  hire,
  onToggle,
  onRemove,
  onGuide,
  guideDisabled,
}: {
  hire: NewHire;
  onToggle: (step: string) => void;
  onRemove: () => void;
  onGuide: () => void;
  guideDisabled: boolean;
}) {
  const done = hire.done.length;
  const ready = done === HIRE_STEPS.length;
  const starts = hire.startIso ? new Date(`${hire.startIso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No start date";
  return (
    <li className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center gap-3">
        <ProgressRing done={done} total={HIRE_STEPS.length} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-medium text-fg">
            <span className="truncate">{hire.code || "New staff member"}</span>
            {ready && (
              <span className="anim-pop-in inline-flex items-center gap-1 rounded-full bg-[#e5f3ea] px-2 py-0.5 text-[11px] font-semibold text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]">
                <PartyPopper className="size-3" />
                Ready
              </span>
            )}
          </p>
          <p className="truncate text-[13px] text-muted">
            {[hire.position, `starts ${starts}`, getRole(hire.view).label].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${hire.code || "this staff member"}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-danger"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      <ul className="mt-3 space-y-0.5">
        {HIRE_STEPS.map((step) => {
          const checked = hire.done.includes(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => onToggle(step.id)}
                className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left text-[14px] leading-6 transition-[background-color,transform] duration-100 hover:bg-hover active:scale-[0.99]"
              >
                <span
                  className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full transition-colors ${
                    checked ? "bg-[#2f8a4f] text-white" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]"
                  }`}
                >
                  {checked && <Check className="size-2.5" strokeWidth={3.5} />}
                </span>
                <span className={checked ? "text-muted line-through decoration-line-strong" : "text-fg"}>{step.label(hire)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-line pt-3">
        <button
          type="button"
          disabled={guideDisabled}
          onClick={onGuide}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96] disabled:opacity-40"
        >
          <FileText className="size-3.5" />
          Draft their first-week guide
        </button>
      </div>
    </li>
  );
}

const EMPTY_HIRE = { code: "", position: "", startIso: DATA_AS_OF, view: "dean" as AdminRoleId };

function AddHireForm({ onAdd, onCancel }: { onAdd: (h: NewHire) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(EMPTY_HIRE);
  const ready = draft.code.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onAdd({ id: newId(), ...draft, code: draft.code.trim().toUpperCase(), position: draft.position.trim(), done: [] });
      }}
      className="anim-action-in rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line-strong)]"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Role code" hint="not a name">
          <input autoFocus value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="e.g. T-3-B" className={FIELD} />
        </Field>
        <Field label="Position">
          <input value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} placeholder="e.g. Grade 3 teacher" className={FIELD} />
        </Field>
        <Field label="Starts">
          <input type="date" value={draft.startIso} onChange={(e) => setDraft({ ...draft, startIso: e.target.value })} className={FIELD} />
        </Field>
        <Field label="Workspace view">
          <select value={draft.view} onChange={(e) => setDraft({ ...draft, view: e.target.value as AdminRoleId })} className={FIELD}>
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-muted">
        Use a role code until the privacy decision on the Security check page is made. This page goes to the AI provider when you ask a question about it.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={!ready}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-fg px-4 text-sm text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
        >
          <Plus className="size-4" />
          Add
        </button>
        <button type="button" onClick={onCancel} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-secondary hover:bg-hover hover:text-fg">
          <X className="size-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Onboarding: set the workspace up for MACS, then bring each new staff member on. */
export function OnboardingView({ dock, customInstructions, onSaveInstructions, onOpen }: OnboardingViewProps) {
  const [shared, change] = useShared<OnboardingState>("onboarding", DEFAULT_ONBOARDING);
  const state = normalizeOnboarding(shared);
  const setState = (fn: (s: OnboardingState) => OnboardingState) => change((s) => fn(normalizeOnboarding(s)));
  const [adding, setAdding] = useState(false);
  const saved = hasProfileBlock(customInstructions);
  const firstOpen = SETUP_STEPS.find((s) => !(s === "profile" ? state.steps.profile && saved : state.steps[s]));
  const [open, setOpen] = useState<SetupStep | null>(firstOpen ?? null);


  const steps = { ...state.steps, profile: state.steps.profile && saved };
  const done = SETUP_STEPS.filter((s) => steps[s]).length;
  const left = SETUP_STEPS.filter((s) => !steps[s]);
  const ask = (text: string) => dock.onAsk("onboarding", text, onboardingContext(state));

  const complete = (step: SetupStep) => {
    setState((s) => ({ ...s, steps: { ...s.steps, [step]: true } }));
    const next = SETUP_STEPS.find((x) => x !== step && !steps[x]);
    setOpen(next ?? null);
  };

  // The save starts before the other page opens, so it lands even though this page unmounts.
  const go = (step: SetupStep, tool: ToolId) => {
    setState((s) => ({ ...s, steps: { ...s.steps, [step]: true } }));
    void logActivity(`finished the "${STEP_TITLES[step]}" setup step`, "general", "Onboarding");
    onOpen(tool);
  };

  const updateHire = (id: string, fn: (h: NewHire) => NewHire) =>
    setState((s) => ({ ...s, hires: s.hires.map((h) => (h.id === id ? fn(h) : h)) }));

  const gaps = profileGaps(state.profile);
  const status: Record<SetupStep, string> = {
    profile: steps.profile ? "Saved to every chat" : gaps.length ? `Needs ${gaps.join(" and ")}` : "Ready to save",
    mail: steps.mail ? "Pasting into Inbox triage" : "Choose how mail comes in",
    books: steps.books ? "Spreadsheets, pasted from Excel" : "Use the spreadsheets you have",
    checkin: steps.checkin ? "Business pulse each morning" : "Pick a daily starting point",
    mac: steps.mac ? "Said hello" : "Ask Mac what needs you today",
  };

  const hiresReady = state.hires.filter((h) => h.done.length === HIRE_STEPS.length).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <UserPlus className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[13px] text-muted">{profile.org}</p>
          <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Onboarding</h1>
        </div>
      </div>
      <p className="mt-5 font-serif text-[17px] leading-7 text-fg">Set the workspace up for MACS, then bring each new staff member on.</p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
        <ProgressRing done={done} total={SETUP_STEPS.length} />
        <div className="min-w-0 flex-1">
          {left.length === 0 ? (
            <>
              <p className="text-[17px] font-medium text-fg">MACS is set up.</p>
              <p className="mt-0.5 text-[13px] text-muted">Every chat knows the school, and each tool has a starting point.</p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-medium text-fg">
                {left.length} step{left.length === 1 ? "" : "s"} to finish setup
              </p>
              <p className="mt-0.5 truncate text-[13px] text-muted">Next: {left.map((s) => STEP_TITLES[s]).join(", ")}</p>
            </>
          )}
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[22px] font-semibold tabular-nums leading-none text-fg">{state.hires.length}</p>
          <p className="mt-1 text-[12px] text-muted">new staff · {hiresReady} ready</p>
        </div>
      </div>

      <h2 className="mt-10 font-serif text-[20px] text-fg">Set up MACS</h2>
      <ol className="mt-3 space-y-2.5">
        <StepCard index={1} title={STEP_TITLES.profile} status={status.profile} done={steps.profile} open={open === "profile"} onToggle={() => setOpen(open === "profile" ? null : "profile")}>
          <ProfileForm
            profile={state.profile}
            onChange={(p) => setState((s) => ({ ...s, profile: p }))}
            saved={saved}
            onSave={() => {
              onSaveInstructions(withProfile(customInstructions, state.profile));
              complete("profile");
            }}
            onRemove={() => {
              onSaveInstructions(withProfile(customInstructions, null));
              setState((s) => ({ ...s, steps: { ...s.steps, profile: false } }));
            }}
          />
        </StepCard>

        <StepCard index={2} title={STEP_TITLES.mail} status={status.mail} done={steps.mail} open={open === "mail"} onToggle={() => setOpen(open === "mail" ? null : "mail")}>
          <p className="text-[14px] leading-6 text-secondary">
            Microsoft 365 has no connector in this workspace yet. For now, paste the messages you haven&apos;t answered into Inbox triage, and it sorts them into decisions and drafts. Nothing is sent.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton primary onClick={() => go("mail", "inbox")}>
              Open Inbox triage <ArrowRight className="size-4" />
            </ActionButton>
            <ActionButton onClick={() => complete("mail")}>Paste for now</ActionButton>
          </div>
        </StepCard>

        <StepCard index={3} title={STEP_TITLES.books} status={status.books} done={steps.books} open={open === "books"} onToggle={() => setOpen(open === "books" ? null : "books")}>
          <p className="text-[14px] leading-6 text-secondary">
            Keep the spreadsheets you have. Reimbursements and Restock work like Excel: copy rows in Excel, click a cell here, and paste. Download for Excel takes them back out with the formulas live.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton primary onClick={() => go("books", "reimb")}>
              Open Reimbursements <ArrowRight className="size-4" />
            </ActionButton>
            <ActionButton onClick={() => go("books", "restock")}>Open Restock</ActionButton>
          </div>
        </StepCard>

        <StepCard index={4} title={STEP_TITLES.checkin} status={status.checkin} done={steps.checkin} open={open === "checkin"} onToggle={() => setOpen(open === "checkin" ? null : "checkin")}>
          <p className="text-[14px] leading-6 text-secondary">
            Start each day with the Business pulse: cash, deadlines, and the one priority, with decisions you can tap.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton primary onClick={() => go("checkin", "pulse")}>
              Open Business pulse <ArrowRight className="size-4" />
            </ActionButton>
          </div>
        </StepCard>

        <StepCard index={5} title={STEP_TITLES.mac} status={status.mac} done={steps.mac} open={open === "mac"} onToggle={() => setOpen(open === "mac" ? null : "mac")}>
          <p className="text-[14px] leading-6 text-secondary">
            Mac is the chief of staff you can text in the app. Ask what needs you today. Texting from a phone isn&apos;t connected yet.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton primary onClick={() => go("mac", "mac")}>
              Open Text Mac <ArrowRight className="size-4" />
            </ActionButton>
          </div>
        </StepCard>
      </ol>

      <div className="mt-10 flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-[20px] text-fg">New staff</h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96]"
          >
            <Plus className="size-3.5" />
            Add someone
          </button>
        )}
      </div>
      <div className="mt-3 space-y-2.5">
        {adding && (
          <AddHireForm
            onAdd={(h) => {
              setState((s) => ({ ...s, hires: [h, ...s.hires] }));
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {state.hires.length === 0 && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center transition-colors hover:bg-hover"
          >
            <UserPlus className="size-5 text-muted" strokeWidth={1.75} />
            <span className="text-[14px] text-fg">No one in onboarding right now</span>
            <span className="text-[13px] text-muted">Add a new staff member to get a five-step checklist and a first-week guide.</span>
          </button>
        ) : (
          <ul className="space-y-2.5">
            {state.hires.map((h) => (
              <HireCard
                key={h.id}
                hire={h}
                onToggle={(step) =>
                  updateHire(h.id, (x) => ({ ...x, done: x.done.includes(step) ? x.done.filter((d) => d !== step) : [...x.done, step] }))
                }
                onRemove={() => setState((s) => ({ ...s, hires: s.hires.filter((x) => x.id !== h.id) }))}
                guideDisabled={dock.composer.isStreaming}
                onGuide={() =>
                  ask(
                    `Write a first-week guide for ${h.code}${h.position ? `, our new ${h.position}` : ""}, starting ${h.startIso || "soon"}, who will use the ${getRole(h.view).label} view. Day by day, short, and practical. Include the data rules and the steps still open on their checklist.`,
                  )
                }
              />
            ))}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[12px] text-muted">Onboarding is shared with everyone signed in to the workspace.</p>

      <ToolChat tool="onboarding" onAsk={ask} composer={dock.composer} />
    </div>
  );
}
