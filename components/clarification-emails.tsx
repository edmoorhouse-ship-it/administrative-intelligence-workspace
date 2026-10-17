"use client";

import { useMemo, useState } from "react";
import { Check, CircleCheck, Copy, Mail, RotateCcw, Send } from "lucide-react";
import {
  businessDaysAfter,
  clarificationEmail,
  DEFAULT_REPLY_DAYS,
  emailText,
  STATUS_TEXT,
  trackKey,
  type ClarificationStatus,
  type ClarificationTrack,
} from "@/lib/construction/clarification-email";
import type { LevelingRun } from "@/lib/construction/run-leveling";
import { logActivity, useShared, useTeam } from "@/lib/shared-client";

const NO_TRACKS: ClarificationTrack[] = [];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const PILL: Record<ClarificationStatus, string> = {
  drafted: "bg-active text-secondary",
  sent: "bg-[#fbf0cf] text-[#7a5a00] dark:bg-[#3a3118] dark:text-[#ecd07a]",
  answered: "bg-[#e5f3ea] text-[#1f6b3a] dark:bg-[#1d3327] dark:text-[#9bd8ae]",
};

const small = "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Deliverable H as emails: one draft per bidder with something to clear up, built only from that
 * bidder's own gaps. Copy it into Outlook and send it yourself; then mark it sent here so the team
 * sees where it stands. Nothing is sent from the workspace, and nothing is marked sent for you.
 */
export function ClarificationEmails({ run }: { run: LevelingRun }) {
  const [replyBy, setReplyBy] = useState(() => businessDaysAfter(today(), DEFAULT_REPLY_DAYS));
  const [noDate, setNoDate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tracks, setTracks] = useShared<ClarificationTrack[]>("clarifications", NO_TRACKS);
  const me = useTeam().me;

  const emails = useMemo(
    () => run.clarifications.map((c) => ({ input: c, email: clarificationEmail(c, noDate ? null : replyBy) })),
    [run.clarifications, replyBy, noDate],
  );
  const drafts = emails.filter((e) => e.email);
  const clean = emails.filter((e) => !e.email).map((e) => e.input.bidder);

  const trackFor = (bidder: string) => tracks.find((t) => t.key === trackKey(run.pkg, run.round, bidder));

  const setStatus = (bidder: string, questions: number, status: ClarificationStatus | null) => {
    const key = trackKey(run.pkg, run.round, bidder);
    setTracks((list) => {
      const rest = list.filter((t) => t.key !== key);
      if (!status) return rest;
      return [...rest, { key, pkg: run.pkg, round: run.round, bidder, questions, status, updatedBy: me?.name ?? "Someone", updatedAt: new Date().toISOString() }];
    });
    if (status === "sent") void logActivity(`marked the ${run.pkg} clarification email to ${bidder} as sent`, "general", "Bid leveling");
    if (status === "answered") void logActivity(`marked ${bidder}'s ${run.pkg} clarification answers as in`, "general", "Bid leveling");
  };

  const copy = async (bidder: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(bidder);
      setTimeout(() => setCopied((c) => (c === bidder ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-surface p-4 text-[13px] leading-5 text-secondary shadow-[0_0_0_1px_var(--line)]">
        <p>
          <span className="font-medium text-fg">Drafts only.</span> Each email asks a bidder about its own gaps and nothing it already answered. Copy it into Outlook, add the
          recipient, read it over, and send it yourself. Then mark it sent here so the team sees where it stands.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-muted">Reply by</span>
            <input
              type="date"
              value={replyBy}
              disabled={noDate}
              onChange={(e) => e.target.value && setReplyBy(e.target.value)}
              className="h-8 rounded-lg bg-page px-2 text-[13px] text-fg shadow-[0_0_0_1px_var(--line)] disabled:opacity-50"
            />
          </label>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} />
            No date
          </label>
          <span className="text-[12px] text-muted">Default: {DEFAULT_REPLY_DAYS} business days from today (weekends skipped, holidays not).</span>
        </div>
      </div>

      {drafts.length === 0 && <p className="text-[14px] text-muted">Every bidder&apos;s proposal is clear as read. No clarification emails to draft.</p>}

      {drafts.map(({ input, email }) => {
        const e = email!;
        const track = trackFor(input.bidder);
        const status = track?.status ?? "drafted";
        return (
          <article key={input.bidder} className="rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-[15px] font-medium text-fg">
                  <Mail className="size-4 text-brand" strokeWidth={1.75} />
                  {input.bidder}
                </h3>
                <p className="mt-0.5 text-[12px] text-muted">
                  {e.questionCount} {e.questionCount === 1 ? "question" : "questions"}
                  {track && track.status !== "drafted" ? ` · ${STATUS_TEXT[track.status].toLowerCase()} by ${track.updatedBy}, ${when(track.updatedAt)}` : ""}
                </p>
              </div>
              <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium ${PILL[status]}`}>{STATUS_TEXT[status]}</span>
            </header>
            <div className="px-4 py-3">
              <p className="text-[13px] text-muted">
                Subject: <span className="text-fg">{e.subject}</span>
              </p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-[14px] leading-6 text-fg">{e.body}</pre>
            </div>
            <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
              <button type="button" onClick={() => copy(input.bidder, emailText(e))} className={`${small} bg-brand text-white hover:opacity-90`}>
                {copied === input.bidder ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied === input.bidder ? "Copied" : "Copy subject and email"}
              </button>
              {status === "drafted" && (
                <button type="button" onClick={() => setStatus(input.bidder, e.questionCount, "sent")} className={`${small} text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover`}>
                  <Send className="size-4" /> I sent it
                </button>
              )}
              {status === "sent" && (
                <button type="button" onClick={() => setStatus(input.bidder, e.questionCount, "answered")} className={`${small} text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover`}>
                  <CircleCheck className="size-4" /> Answer is in
                </button>
              )}
              {status !== "drafted" && (
                <button type="button" onClick={() => setStatus(input.bidder, e.questionCount, null)} className={`${small} text-muted hover:bg-hover hover:text-fg`}>
                  <RotateCcw className="size-4" /> Back to draft
                </button>
              )}
              {status === "answered" && <span className="text-[12px] text-muted">Run the revised proposal through leveling to clear these items.</span>}
            </footer>
          </article>
        );
      })}

      {clean.length > 0 && (
        <p className="text-[13px] text-muted">
          Nothing to clarify, no email drafted: <span className="text-secondary">{clean.join(", ")}</span>
          {/[.!?]$/.test(clean[clean.length - 1]) ? "" : "."}
        </p>
      )}
    </div>
  );
}
