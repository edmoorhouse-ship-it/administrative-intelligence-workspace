"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bot, Brain, Check, Globe, KeyRound, Plus, Trash2, UserRound, X } from "lucide-react";
import { AREA_LABEL, areasFor, canApprove, canManageTeam, type Area } from "@/lib/access";
import type { ActivityEntry } from "@/lib/activity";
import { BRAIN_SEED, SOURCE_LABEL, type Fact, type FactSource } from "@/lib/brain";
import { getRole, ROLES, type AdminRoleId } from "@/lib/roles";
import { brainAction, changeTeam, fetchTeam, useShared, useTeam, type Account, type Person } from "@/lib/shared-client";

const EMPTY_FEED: ActivityEntry[] = [];

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SOURCE_STYLE: Record<FactSource, { icon: ReactNode; cls: string }> = {
  website: { icon: <Globe className="size-3" />, cls: "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]" },
  staff: { icon: <UserRound className="size-3" />, cls: "bg-brand/10 text-brand dark:bg-brand/25 dark:text-[#b7c6f2]" },
  agent: { icon: <Bot className="size-3" />, cls: "bg-[#f3e8fb] text-[#6b2f8f] dark:bg-[#33223f] dark:text-[#d6b3ef]" },
  sample: { icon: <span className="text-[10px] font-bold">S</span>, cls: "bg-active text-secondary" },
};

function SourceBadge({ source }: { source: FactSource }) {
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium ${SOURCE_STYLE[source].cls}`}>
      {SOURCE_STYLE[source].icon}
      {SOURCE_LABEL[source]}
    </span>
  );
}

function AreaChip({ area }: { area: Area }) {
  return <span className="inline-flex h-5 items-center rounded-full px-2 text-[11px] text-muted shadow-[0_0_0_1px_var(--line)]">{AREA_LABEL[area]}</span>;
}

function byLine(f: Fact) {
  const who = f.author.role === "website" ? f.author.name : f.author.role === "agent" ? `${f.author.name} for ${f.author.via ?? "staff"}` : f.author.name;
  const reviewed = f.reviewedBy && f.reviewedBy.name !== f.author.name ? `, approved by ${f.reviewedBy.name}` : "";
  return `${who}${f.origin && f.author.role !== "website" ? ` · from ${f.origin}` : ""}${reviewed}`;
}

function Avatar({ name, agent }: { name: string; agent?: boolean }) {
  return agent ? (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f3e8fb] text-[#6b2f8f] dark:bg-[#33223f] dark:text-[#d6b3ef]">
      <Bot className="size-4" />
    </span>
  ) : (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white">{name.trim().charAt(0).toUpperCase()}</span>
  );
}

const approverFor = (area: Area) => (area === "finance" ? "the Director or Finance" : "the Director");

function BrainTab({ me }: { me: Person }) {
  const [facts] = useShared<Fact[]>("brain", BRAIN_SEED);
  const [text, setText] = useState("");
  const [area, setArea] = useState<Area>("general");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const areas = areasFor(me.role);
  const waiting = facts.filter((f) => f.status === "proposed");
  const approved = facts.filter((f) => f.status === "approved");
  const declined = facts.filter((f) => f.status === "rejected").length;
  const addsDirectly = canApprove(me.role, area);

  const act = async (key: string, change: Parameters<typeof brainAction>[0]) => {
    setBusy(key);
    setError(await brainAction(change));
    setBusy(null);
  };

  return (
    <div>
      <section aria-label="Waiting for approval">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[20px] text-fg">Waiting for approval</h2>
          <span className="text-[13px] text-muted">{waiting.length ? `${waiting.length} waiting` : "Nothing waiting"}</span>
        </div>
        <p className="mt-1 text-[13px] text-muted">Agents and staff propose. A person approves before a fact reaches every chat.</p>
        <div className="mt-3 space-y-2.5">
          {waiting.map((f) => (
            <div key={f.id} className="anim-settle rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
              <p className="text-[15px] leading-6 text-fg">{f.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                <SourceBadge source={f.source} />
                <AreaChip area={f.area} />
                <span>
                  {byLine(f)} · {ago(f.createdAt)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canApprove(me.role, f.area) ? (
                  <>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void act(f.id, { action: "approve", id: f.id })}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-fg px-3.5 text-sm text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
                    >
                      <Check className="size-4" strokeWidth={2.5} />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void act(f.id, { action: "reject", id: f.id })}
                      className="flex h-9 items-center gap-1.5 rounded-lg bg-page px-3.5 text-sm text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96] disabled:opacity-40"
                    >
                      <X className="size-4" />
                      Turn down
                    </button>
                  </>
                ) : (
                  <span className="text-[13px] text-muted">Waiting for {approverFor(f.area)}.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (text.trim().length < 8 || busy) return;
          await act("add", { action: addsDirectly ? "add" : "propose", text, area, origin: "Brain" });
          setText("");
        }}
        className="mt-8 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]"
      >
        <label htmlFor="brain-new" className="text-[14px] font-medium text-fg">
          {addsDirectly ? "Add to the brain" : "Propose a fact"}
        </label>
        <textarea
          id="brain-new"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          placeholder="One fact, in a full sentence. No student names."
          className="mt-2 w-full resize-y rounded-lg bg-page px-3 py-2 text-[14px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as Area)}
            aria-label="Who can see it"
            className="h-9 rounded-lg bg-page px-2.5 text-sm text-fg shadow-[0_0_0_1px_var(--line)] outline-none"
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                Seen by: {AREA_LABEL[a]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={text.trim().length < 8 || busy !== null}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-fg px-3.5 text-sm text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
          >
            <Plus className="size-4" />
            {addsDirectly ? "Add" : "Propose"}
          </button>
          <span className="text-[12px] text-muted">{addsDirectly ? "You can approve this area, so it's added at once." : `Goes to ${approverFor(area)} for approval.`}</span>
        </div>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </form>

      <section className="mt-8" aria-label="What the brain knows">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[20px] text-fg">What the brain knows</h2>
          <span className="text-[13px] text-muted">
            {approved.length} facts{declined ? ` · ${declined} turned down` : ""}
          </span>
        </div>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
          {approved.map((f) => (
            <li key={f.id} className="group flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-6 text-fg">{f.text}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
                  <SourceBadge source={f.source} />
                  <AreaChip area={f.area} />
                  <span>{byLine(f)}</span>
                </div>
              </div>
              {canApprove(me.role, f.area) && (
                <button
                  type="button"
                  aria-label="Remove this fact"
                  disabled={busy !== null}
                  onClick={() => void act(f.id, { action: "remove", id: f.id })}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-hover hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ActivityTab() {
  const [feed] = useShared<ActivityEntry[]>("activity", EMPTY_FEED);
  return (
    <section aria-label="Activity">
      <p className="text-[13px] text-muted">Everything staff and agents do in the workspace, newest first. You see the lines your role covers.</p>
      {feed.length === 0 ? (
        <p className="mt-6 text-center text-[14px] text-muted">Nothing yet. Choices, edits, and approvals show up here.</p>
      ) : (
        <ol className="mt-4 space-y-1">
          {feed.slice(0, 200).map((e) => (
            <li key={e.id} className="anim-settle flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-hover">
              <Avatar name={e.actor.name} agent={e.actor.kind === "agent"} />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-6 text-fg">
                  <span className="font-medium">{e.actor.name}</span>
                  {e.actor.kind === "agent" && e.actor.via && <span className="text-muted"> for {e.actor.via}</span>} {e.action}
                </p>
                <p className="text-[12px] text-muted">
                  {ago(e.at)}
                  {e.page ? ` · ${e.page}` : ""}
                  {e.actor.kind === "person" ? ` · ${getRole(e.actor.role).label}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const INPUT = "h-9 rounded-lg bg-page px-2.5 text-sm text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]";

function TeamTab({ me }: { me: Person }) {
  const { here } = useTeam();
  const [users, setUsers] = useState<Account[] | null>(null);
  const [draft, setDraft] = useState({ name: "", role: "office" as AdminRoleId, passcode: "" });
  const [reset, setReset] = useState<{ id: string; passcode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const manager = canManageTeam(me.role);

  useEffect(() => {
    void fetchTeam().then(setUsers);
  }, []);

  const send = async (body: Record<string, unknown>) => {
    const out = await changeTeam(body);
    if (out.users) setUsers(out.users);
    setError(out.error ?? null);
    return !out.error;
  };

  return (
    <div className="space-y-8">
      <section aria-label="Here now">
        <h2 className="font-serif text-[20px] text-fg">Here now</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {here.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 shadow-[0_0_0_1px_var(--line)]">
              <span className="relative">
                <Avatar name={p.name} />
                <span className="absolute -bottom-px -right-px size-2.5 rounded-full bg-[#2f8a4f] ring-2 ring-surface" />
              </span>
              <span className="text-[13px] text-fg">
                {p.name}
                {p.id === me.id ? " (you)" : ""}
              </span>
              <span className="text-[12px] text-muted">{getRole(p.role).label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Staff accounts">
        <h2 className="font-serif text-[20px] text-fg">Staff accounts</h2>
        <p className="mt-1 text-[13px] text-muted">
          Each person signs in with their own passcode. Roles decide what they see: the front office doesn&apos;t see finance, and Finance doesn&apos;t see IEPs.
        </p>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
          {(users ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={u.name} />
              <div className="min-w-0 flex-1">
                <p className={`text-[14px] font-medium ${u.active === false ? "text-muted line-through" : "text-fg"}`}>{u.name}</p>
                <p className="text-[12px] text-muted">{getRole(u.role).label}{u.active === false ? " · turned off" : ""}</p>
              </div>
              {manager && u.id !== me.id && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <select value={u.role} onChange={(e) => void send({ action: "update", id: u.id, role: e.target.value })} aria-label={`Role for ${u.name}`} className={INPUT}>
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {reset?.id === u.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await send({ action: "update", id: u.id, passcode: reset.passcode })) setReset(null);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input autoFocus type="password" value={reset.passcode} onChange={(e) => setReset({ id: u.id, passcode: e.target.value })} placeholder="New passcode" className={`${INPUT} w-36`} />
                      <button type="submit" className="h-9 rounded-lg bg-fg px-3 text-sm text-page hover:opacity-90">Save</button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => setReset({ id: u.id, passcode: "" })} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-secondary hover:bg-hover hover:text-fg">
                      <KeyRound className="size-3.5" />
                      Reset passcode
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void send({ action: "update", id: u.id, active: u.active === false })}
                    className="h-9 rounded-lg px-2.5 text-sm text-secondary hover:bg-hover hover:text-fg"
                  >
                    {u.active === false ? "Turn on" : "Turn off"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {manager && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await send({ action: "add", ...draft })) setDraft({ name: "", role: draft.role, passcode: "" });
            }}
            className="mt-4 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]"
          >
            <p className="text-[14px] font-medium text-fg">Add someone</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" aria-label="Name" className={`${INPUT} w-48`} />
              <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as AdminRoleId })} aria-label="Role" className={INPUT}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input type="password" value={draft.passcode} onChange={(e) => setDraft({ ...draft, passcode: e.target.value })} placeholder="First passcode (8+)" aria-label="First passcode" className={`${INPUT} w-44`} />
              <button
                type="submit"
                disabled={!draft.name.trim() || draft.passcode.length < 8}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-fg px-3.5 text-sm text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.96] disabled:opacity-40"
              >
                <Plus className="size-4" />
                Add
              </button>
            </div>
            <p className="mt-2 text-[12px] text-muted">Give them the passcode in person. They can&apos;t see it again here.</p>
          </form>
        )}
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </section>
    </div>
  );
}

const TABS = ["brain", "activity", "team"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { brain: "Brain", activity: "Activity", team: "Team" };

/** The shared brain: sourced facts, approvals, the activity feed, and the team. */
export function BrainView({ me }: { me: Person }) {
  const [tab, setTab] = useState<Tab>("brain");
  const [facts] = useShared<Fact[]>("brain", BRAIN_SEED);
  const waiting = facts.filter((f) => f.status === "proposed").length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <Brain className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[13px] text-muted">Micanopy Area Cooperative School</p>
          <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Shared brain</h1>
        </div>
      </div>
      <p className="mt-5 font-serif text-[17px] leading-7 text-fg">
        One memory for the whole leadership team. Every fact says where it came from. Mac and the other agents propose; a person approves before it becomes shared truth.
      </p>

      <div className="mt-6 flex h-9 rounded-lg bg-active p-px" role="tablist" aria-label="Brain sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md text-sm transition-colors ${tab === t ? "bg-surface text-fg shadow-[0_0_0_0.5px_var(--line),0_1px_2px_rgb(0_0_0/0.06)]" : "text-muted hover:text-secondary"}`}
          >
            {TAB_LABEL[t]}
            {t === "brain" && waiting > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">{waiting}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "brain" ? <BrainTab me={me} /> : tab === "activity" ? <ActivityTab /> : <TeamTab me={me} />}
      </div>
    </div>
  );
}
