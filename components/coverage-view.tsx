"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ClipboardList, Copy, FlaskConical, Mail, Phone, TriangleAlert, UserPlus } from "lucide-react";
import type { BoardBidder, BoardTrade, CoverageBoard } from "@/lib/construction/coverage";
import { SAMPLE_DATA_NOTICE } from "@/lib/data-notice";
import { profile } from "@/profiles";

type Tab = "board" | "calls" | "emails";

const CHIP: Record<BoardBidder["status"], string> = {
  Submitted: "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]",
  Bidding: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]",
  "No response": "bg-danger/10 text-danger",
  Declined: "bg-active text-muted line-through",
};

const STATUS_PILL = (s: string) =>
  s === "COVERED"
    ? "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]"
    : s === "AT RISK"
      ? "bg-danger/10 text-danger"
      : s === "WATCH"
        ? "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]"
        : "bg-active text-muted";

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const ago = (days: number) => (days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`);
const dueText = (t: BoardTrade) => (t.closed ? `Closed ${shortDate(t.bidDue)}` : `Due ${shortDate(t.bidDue)} · ${t.daysUntilDue === 0 ? "today" : `${t.daysUntilDue} days`}`);

function BidderChip({ b }: { b: BoardBidder }) {
  return (
    <span
      title={`${b.name}: ${b.status}, last contact ${b.lastContact} (${ago(b.daysSinceContact)})${b.chase ? ". Worth a chase." : ""}`}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium ${CHIP[b.status]} ${b.chase ? "ring-2 ring-danger/40" : ""}`}
    >
      {b.name.replace(/ \(sample\)$/, "")}
      <span className="font-normal opacity-75">· {b.status === "No response" ? `silent ${b.daysSinceContact}d` : b.status === "Bidding" ? `${b.daysSinceContact}d` : b.status.toLowerCase()}</span>
    </span>
  );
}

function TradeRow({ t, target }: { t: BoardTrade; target: number }) {
  return (
    <li className={`px-4 py-3 ${t.closed ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-fg">{t.trade}</p>
          <p className="text-[12px] text-muted">
            {t.package} · {dueText(t)} · {t.leveling}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-secondary">
            {t.submitted} of {target} in{t.stillBidding ? ` · ${t.stillBidding} bidding` : ""}
          </span>
          <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium ${STATUS_PILL(t.coverageStatus)}`}>{t.coverageStatus}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {t.bidders.map((b) => (
          <BidderChip key={b.name} b={b} />
        ))}
      </div>
      {(t.note || t.needMore > 0) && (
        <p className="mt-2 text-[12px] leading-5 text-secondary">
          {t.needMore > 0 && <span className="font-medium text-danger">Invite {t.needMore} more to reach {target}. </span>}
          {t.note}
        </p>
      )}
    </li>
  );
}

/** Who owes what, trade by trade. Read-only: statuses come from the data, and emails are drafts you send. */
export function CoverageView() {
  const [board, setBoard] = useState<CoverageBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("board");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    // The session call signs you in on this computer in no-passcode mode; then the board loads for your role.
    fetch("/api/session")
      .then(() => fetch("/api/coverage", { cache: "no-store" }))
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) setError(data.signIn ? "Open the workspace and sign in first, then come back to this page." : (data.error ?? "The board couldn't load."));
        else setBoard(data);
      })
      .catch(() => setError("Could not reach the workspace server. Is it still running in Terminal?"));
  }, []);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-page">
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> {profile.workspaceName}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ClipboardList className="size-7 text-brand" strokeWidth={1.5} />
          <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Coverage board</h1>
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] text-secondary shadow-[0_0_0_1px_var(--line)]">
            <FlaskConical className="size-3.5 text-brand" strokeWidth={1.75} />
            Sample data
          </span>
        </div>
        <p className="mt-1.5 max-w-3xl text-[14px] leading-6 text-secondary">
          Who owes what, trade by trade. A bidder stays open until a usable proposal arrives, they decline, or you drop them; &ldquo;bidding&rdquo; is not a commitment.
          Read-only for now: statuses come from the data, and the chase emails are drafts you send from Outlook.
        </p>
        <p className="mt-1 text-[12px] leading-5 text-muted">{SAMPLE_DATA_NOTICE}</p>

        {error && (
          <p className="mt-6 flex items-center gap-2 text-[14px] text-danger">
            <TriangleAlert className="size-4" /> {error}
          </p>
        )}
        {!board && !error && <p className="mt-6 text-[14px] text-muted">Loading the board…</p>}

        {board && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["Open trades", board.summary.openTrades, `as of ${shortDate(board.asOf)}`],
                  ["At risk", board.summary.atRisk, `can't reach ${board.target} bids as it stands`],
                  ["On watch", board.summary.watch, `could reach ${board.target} if open bidders submit`],
                  ["Bidders to chase", board.summary.toChase, `of ${board.summary.openBidders} still open`],
                ] as [string, number, string][]
              ).map(([label, value, context]) => (
                <div key={label} className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
                  <p className="text-[13px] text-muted">{label}</p>
                  <p className="mt-1 font-serif text-[26px] leading-tight tabular-nums text-fg">{value}</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-muted">{context}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-1 border-b border-line" role="tablist">
              {(
                [
                  ["board", "Board"],
                  ["calls", `Call list (${board.callList.length})`],
                  ["emails", `Chase emails (${board.chaseEmails.length})`],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${tab === id ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "board" && (
              <div className="mt-4 space-y-6">
                {board.findMore.length > 0 && (
                  <section className="rounded-xl border-l-4 border-danger bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
                    <h2 className="flex items-center gap-2 text-[14px] font-medium text-fg">
                      <UserPlus className="size-4 text-danger" /> Find more bidders
                    </h2>
                    <ul className="mt-2 space-y-1.5 text-[14px] leading-6 text-secondary">
                      {board.findMore.map((f) => (
                        <li key={f.package}>{f.text}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {board.projects.map((p) => (
                  <section key={p.id}>
                    <h2 className="font-serif text-[20px] text-fg">
                      {p.name} <span className="text-[14px] text-muted">· {p.stage}</span>
                    </h2>
                    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
                      {p.trades.map((t) => (
                        <TradeRow key={t.package} t={t} target={board.target} />
                      ))}
                    </ul>
                  </section>
                ))}
                <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
                  {(Object.keys(CHIP) as BoardBidder["status"][]).map((s) => (
                    <span key={s} className={`inline-flex h-6 items-center rounded-full px-2 ${CHIP[s]}`}>
                      {s}
                    </span>
                  ))}
                  <span className="inline-flex h-6 items-center rounded-full px-2 ring-2 ring-danger/40">Ring: worth a chase</span>
                  <span>Days are since last contact. Bid amounts are not on this board.</span>
                </p>
              </div>
            )}

            {tab === "calls" && (
              <div className="mt-4 overflow-x-auto">
                <p className="mb-3 text-[13px] text-muted">
                  At-risk trades first, then the soonest due, then the longest silence. A bidder still bidding makes the list after 3 quiet days.
                </p>
                <table className="w-full text-left text-[14px]">
                  <thead className="text-[12px] uppercase tracking-[0.06em] text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Bidder</th>
                      <th className="py-2 pr-3">Trade</th>
                      <th className="py-2 pr-3">Due</th>
                      <th className="py-2 pr-3">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.callList.map((c) => (
                      <tr key={`${c.package}-${c.bidder}`} className="border-b border-line align-top">
                        <td className="py-2 pr-3 tabular-nums text-muted">{c.rank}</td>
                        <td className="py-2 pr-3 text-fg">
                          <span className="flex items-center gap-1.5">
                            <Phone className="size-3.5 text-muted" /> {c.bidder}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-secondary">
                          {c.projectName} · {c.trade}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-secondary">{shortDate(c.bidDue)}</td>
                        <td className="py-2 pr-3 text-[13px] text-muted">{c.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "emails" && (
              <div className="mt-4 space-y-4">
                <p className="text-[13px] text-muted">
                  Drafts only. Each one names that bidder&apos;s package and due date, and the latest addendum when there is one. Copy it into Outlook, add the address, and send it
                  yourself.
                </p>
                {board.chaseEmails.map((e) => {
                  const key = `${e.package}-${e.bidder}`;
                  return (
                    <article key={key} className="rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
                      <header className="flex items-center gap-2 border-b border-line px-4 py-3 text-[15px] font-medium text-fg">
                        <Mail className="size-4 text-brand" strokeWidth={1.75} /> {e.bidder}
                      </header>
                      <div className="px-4 py-3">
                        <p className="text-[13px] text-muted">
                          Subject: <span className="text-fg">{e.subject}</span>
                        </p>
                        <pre className="mt-3 whitespace-pre-wrap font-sans text-[14px] leading-6 text-fg">{e.body}</pre>
                      </div>
                      <footer className="border-t border-line px-4 py-3">
                        <button
                          type="button"
                          onClick={() => copy(key, `Subject: ${e.subject}\n\n${e.body}`)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-medium text-white hover:opacity-90"
                        >
                          {copied === key ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copied === key ? "Copied" : "Copy subject and email"}
                        </button>
                      </footer>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
