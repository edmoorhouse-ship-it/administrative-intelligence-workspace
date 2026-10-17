"use client";

import { useState } from "react";
import { CalendarClock, Check, ChevronDown, FlaskConical, MapPin, MessageSquare, ScrollText, Users, X } from "lucide-react";
import { DATA_AS_OF } from "@/lib/data-notice";
import {
  coverage,
  KIND_LABEL,
  SAMPLE_VENDORS,
  shortDate,
  STATUS_LABEL,
  upcoming,
  VENDOR_CARDS,
  vendorsContext,
  type AgreementStatus,
  type Vendor,
} from "@/lib/vendors";
import { withDecisions } from "@/lib/tool-pages";
import { DecisionDeck, ToolChat, useDecisions, type ToolDock } from "./tool-dock";

const PILL: Record<AgreementStatus, string> = {
  active: "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]",
  fulfilled: "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]",
  pending: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]",
  negotiation: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]",
  received: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]",
  expired: "bg-danger/10 text-danger",
  missing: "bg-danger/10 text-danger",
};

function StatusPill({ status }: { status: AgreementStatus }) {
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium ${PILL[status]}`}>{STATUS_LABEL[status]}</span>;
}

function Tile({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "critical" }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`mt-1 text-[24px] font-semibold leading-tight ${tone === "critical" ? "text-danger" : "text-fg"}`}>{value}</p>
      <p className="mt-0.5 text-[12px] text-muted">{note}</p>
    </div>
  );
}

function VendorCard({ vendor, open, onToggle, onAsk, disabled }: { vendor: Vendor; open: boolean; onToggle: () => void; onAsk: () => void; disabled: boolean }) {
  const cov = coverage(vendor);
  const gaps = cov.filter((c) => !c.ok).length;
  return (
    <li className={`rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)] transition-shadow ${open ? "shadow-[0_0_0_1px_var(--line-strong),0_8px_24px_-16px_rgb(0_0_0/0.25)]" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-fg">{vendor.name}</span>
            <span className="text-[12px] text-muted">{KIND_LABEL[vendor.kind]}</span>
            {vendor.studentData && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand dark:bg-brand/25 dark:text-[#b7c6f2]">Student data</span>}
            {vendor.onCampus && (
              <span className="inline-flex items-center gap-1 rounded-full bg-active px-2 py-0.5 text-[11px] text-secondary">
                <Users className="size-3" />
                On campus
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-secondary">{vendor.relationship}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cov.map((c) => (
              <span
                key={c.type}
                title={`${c.why}: ${STATUS_LABEL[c.status]}`}
                className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[12px] ${c.ok ? "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]" : "bg-danger/10 text-danger"}`}
              >
                {c.ok ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                {c.type}
              </span>
            ))}
          </div>
        </div>
        <span className={`mt-0.5 shrink-0 text-[12px] font-medium ${gaps ? "text-danger" : "text-[#1f6b3a] dark:text-[#9bd8ae]"}`}>{gaps ? `${gaps} gap${gaps === 1 ? "" : "s"}` : "Covered"}</span>
        <ChevronDown className={`mt-0.5 size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="anim-action-in border-t border-line px-4 pb-4 pt-3">
          <ul className="space-y-3">
            {vendor.agreements.map((a, i) => (
              <li key={`${a.type}-${i}`} className="rounded-lg bg-page px-3 py-2.5 shadow-[0_0_0_1px_var(--line)]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-fg">{a.type}</span>
                  <StatusPill status={a.status} />
                  <span className="ml-auto text-[12px] tabular-nums text-muted">
                    {a.effectiveIso ? shortDate(a.effectiveIso) : ""}
                    {a.expiresIso ? ` → ${shortDate(a.expiresIso)}` : a.effectiveIso ? " → no end date" : ""}
                  </span>
                </div>
                {a.autoRenew && (
                  <p className="mt-1 text-[12px] text-secondary">
                    Auto-renews for {a.autoRenew.months} months; {a.autoRenew.noticeDays} days&apos; notice to stop it.
                  </p>
                )}
                {a.terms && <p className="mt-1 text-[13px] leading-5 text-secondary">{a.terms}</p>}
                {a.note && <p className="mt-1 text-[13px] leading-5 text-secondary">{a.note}</p>}
                {a.location && (
                  <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
                    <MapPin className="size-3" />
                    {a.location}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {vendor.link && <p className="mt-3 text-[12px] leading-5 text-muted">{vendor.link}</p>}
          <button
            type="button"
            disabled={disabled}
            onClick={onAsk}
            className="mt-3 flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-secondary shadow-[0_0_0_1px_var(--line)] transition-[background-color,transform] duration-100 hover:bg-hover hover:text-fg active:scale-[0.96] disabled:opacity-40"
          >
            <MessageSquare className="size-3.5" />
            Ask about this vendor
          </button>
        </div>
      )}
    </li>
  );
}

/** Vendor agreements: what's on file, what's missing, and what comes due, from sample data. */
export function VendorsView({ dock }: { dock: ToolDock }) {
  const [open, setOpen] = useState<string | null>(null);
  const decisions = useDecisions();
  const vendors = SAMPLE_VENDORS;
  const soon = upcoming(vendors);
  const allCoverage = vendors.flatMap(coverage);
  const gaps = allCoverage.filter((c) => !c.ok).length;
  const active = vendors.flatMap((v) => v.agreements).filter((a) => a.status === "active").length;
  const selected = vendors.find((v) => v.id === open) ?? null;
  const ask = (text: string, v: Vendor | null = selected) => dock.onAsk("vendors", text, withDecisions(vendorsContext(vendors, v), VENDOR_CARDS, decisions));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <ScrollText className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[13px] text-muted">Micanopy Area Cooperative School</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Vendors</h1>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-secondary shadow-[0_0_0_1px_var(--line)]">
              <FlaskConical className="size-3.5 text-brand" strokeWidth={1.75} />
              Sample agreements
            </span>
          </div>
        </div>
      </div>
      <p className="mt-5 font-serif text-[17px] leading-7 text-fg">
        Every vendor agreement in one place: what&apos;s on file, what&apos;s missing for the kind of work each vendor does, and what comes due in the next 90 days.
      </p>

      <div className="mt-5 rounded-xl bg-bubble px-4 py-3 text-[13px] leading-5 text-secondary">
        <p>
          <span className="font-medium text-fg">Checked: </span>a sample vendor list built for this workspace, as of {shortDate(DATA_AS_OF)}. The vendors are generic stand-ins, not real companies.
        </p>
        <p className="mt-1">
          <span className="font-medium text-fg">Not connected: </span>contract system, CRM, email, document storage, and chat. Search those for signed copies before relying on anything here.
        </p>
        <p className="mt-1">Not legal advice. Check each agreement against the signed document.</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Vendors" value={`${vendors.length}`} note={`${vendors.filter((v) => v.studentData).length} hold student data`} />
        <Tile label="Active agreements" value={`${active}`} note="Signed and current" />
        <Tile label="Coming up" value={`${soon.length}`} note="In the next 90 days" />
        <Tile label="Gaps" value={`${gaps}`} note="Expected but not current" tone={gaps ? "critical" : undefined} />
      </div>

      <DecisionDeck cards={VENDOR_CARDS} onAsk={(t) => ask(t, null)} disabled={dock.composer.isStreaming} area="finance" page="Vendors" />

      <section className="mt-8" aria-label="Coming up">
        <h2 className="font-serif text-[20px] text-fg">Coming up</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
          {soon.map((u, i) => (
            <li key={i} className="flex items-start gap-3 px-4 py-3">
              <span
                className={`flex w-16 shrink-0 flex-col items-center rounded-lg py-1 text-center ${u.urgent ? "bg-danger/10 text-danger" : "bg-active text-secondary"}`}
              >
                <CalendarClock className="size-3.5" />
                <span className="mt-0.5 text-[11px] font-semibold tabular-nums">{u.days < 0 ? "Passed" : u.days === 0 ? "Today" : `${u.days} days`}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-fg">{u.vendor.name}</p>
                <p className="text-[13px] leading-5 text-secondary">{u.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-label="All vendors">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-[20px] text-fg">All vendors</h2>
          <span className="text-[13px] text-muted">Open one for its agreements</span>
        </div>
        <ul className="mt-3 space-y-2.5">
          {vendors.map((v) => (
            <VendorCard
              key={v.id}
              vendor={v}
              open={open === v.id}
              onToggle={() => setOpen(open === v.id ? null : v.id)}
              disabled={dock.composer.isStreaming}
              onAsk={() => ask(`Give me the agreement status for ${v.name}: what's on file, what's missing, and what I should do next.`, v)}
            />
          ))}
        </ul>
      </section>

      <ToolChat tool="vendors" onAsk={(t) => ask(t)} composer={dock.composer} />
    </div>
  );
}
