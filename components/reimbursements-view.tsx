"use client";

import { useState } from "react";
import { Banknote, Copy } from "lucide-react";
import { newId } from "@/lib/chat-utils";
import { DATA_AS_OF } from "@/lib/macs-data";
import { followUpDraft, rowFor, SAMPLE_CLAIMS, summarize, usd, type Claim, type ClaimRow, type ClaimState } from "@/lib/reimbursements";
import { reimbCards, reimbContext, withDecisions } from "@/lib/tool-pages";
import { logActivityOnce, useShared } from "@/lib/shared-client";
import { copyText } from "./clipboard";
import { SheetGrid, type SheetColumn, type SheetTone } from "./sheet-grid";
import { DecisionDeck, ToolChat, useDecisions, type ToolDock } from "./tool-dock";

const STATE_LABEL: Record<ClaimState, string> = { paid: "Received", waiting: "Waiting", overdue: "Overdue" };
const STATE_TONE: Record<ClaimState, SheetTone | undefined> = { paid: "good", waiting: undefined, overdue: "bad" };

const textField = (key: "program" | "payer" | "note") => ({
  get: (c: Claim) => c[key],
  set: (c: Claim, v: string | number) => ({ ...c, [key]: String(v) }),
});
const dateField = (key: "submittedIso" | "expectedIso" | "receivedIso") => ({
  get: (c: Claim) => c[key],
  set: (c: Claim, v: string | number) => ({ ...c, [key]: String(v) }),
});

/** Status and days late follow rowFor; the formulas give Excel the same rule, using TODAY(). */
const CLAIM_COLUMNS: SheetColumn<Claim>[] = [
  { key: "program", header: "Program", width: 210, kind: "text", ...textField("program") },
  { key: "payer", header: "Payer", width: 200, kind: "text", ...textField("payer") },
  {
    key: "amount",
    header: "Amount (USD)",
    width: 110,
    kind: "number",
    fixed: 2,
    sum: true,
    get: (c) => c.amount,
    set: (c, v) => ({ ...c, amount: Math.max(0, Number(v)) }),
  },
  { key: "submitted", header: "Submitted", width: 92, kind: "date", ...dateField("submittedIso") },
  { key: "expected", header: "Expected by", width: 92, kind: "date", ...dateField("expectedIso") },
  { key: "received", header: "Received on", width: 92, kind: "date", ...dateField("receivedIso") },
  {
    key: "late",
    header: "Days late",
    width: 74,
    kind: "computed",
    numeric: true,
    get: (c) => {
      const r = rowFor(c);
      return r.state === "overdue" && Number.isFinite(r.daysLate) ? r.daysLate : 0;
    },
    formula: (r, L) => `=IF(${L("received")}${r}<>"",0,MAX(0,TODAY()-${L("expected")}${r}))`,
  },
  {
    key: "status",
    header: "Status",
    width: 84,
    kind: "computed",
    get: (c) => STATE_LABEL[rowFor(c).state],
    tone: (c) => STATE_TONE[rowFor(c).state],
    formula: (r, L) => `=IF(${L("received")}${r}<>"","Received",IF(TODAY()>${L("expected")}${r},"Overdue","Waiting"))`,
  },
  { key: "note", header: "Note", width: 200, kind: "text", ...textField("note") },
];

const newClaim = (): Claim => ({
  id: newId(),
  program: "",
  payer: "",
  amount: 0,
  submittedIso: DATA_AS_OF,
  expectedIso: DATA_AS_OF,
  receivedIso: "",
  note: "",
});

export function ReimbursementsView({ dock }: { dock: ToolDock }) {
  const [claims, changeClaims] = useShared<Claim[]>("reimbursements", SAMPLE_CLAIMS);
  const [approved, setApproved] = useState(false);
  const setClaims = (next: Claim[]) => {
    changeClaims(() => next);
    logActivityOnce("reimb-sheet", "updated the Claims sheet", "finance", "Reimbursements");
  };

  const summary = summarize(claims);
  const decisions = useDecisions();
  const cards = reimbCards(claims);
  const ask = (text: string) => dock.onAsk("reimb", text, withDecisions(reimbContext(claims), cards, decisions));
  const isSample = claims.some((c) => SAMPLE_CLAIMS.some((s) => s.id === c.id));

  return (
    <div className="w-full pb-16 pt-8">
      <div className="mx-auto w-full max-w-3xl px-4">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
            <Banknote className="size-6" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[13px] text-muted">Micanopy Area Cooperative School</p>
            <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Reimbursements</h1>
          </div>
        </div>

        <p className="mt-5 font-serif text-[17px] leading-7 text-fg">
          Track the claims the school has submitted to ACPS and the state. Overdue ones get a follow-up letter to the payer, drafted for your approval. Nothing is sent.
        </p>

        {isSample && (
          <div className="mt-5 rounded-xl bg-bubble px-4 py-3 text-[13px] leading-5 text-secondary">
            <span className="font-medium text-fg">Sample claims. </span>
            These starter claims and dates are illustrative. Replace them with the claims you actually submitted, or paste them in from Excel. Everyone with finance access sees the same sheet.
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
            <p className="text-[13px] text-muted">Still owed to the school</p>
            <p className="mt-1 font-serif text-[28px] leading-tight tabular-nums text-fg">{usd(summary.outstanding)}</p>
          </div>
          <div className="rounded-2xl bg-surface p-5 shadow-[0_0_0_1px_var(--line)]">
            <p className="text-[13px] text-muted">Past the expected date</p>
            <p className={`mt-1 font-serif text-[28px] leading-tight tabular-nums ${summary.overdue.length ? "text-danger" : "text-fg"}`}>
              {usd(summary.overdueAmount)}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {summary.overdue.length} claim{summary.overdue.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <DecisionDeck cards={cards} onAsk={ask} disabled={dock.composer.isStreaming} heading="Overdue: decide" area="finance" page="Reimbursements" />
      </div>

      <div className="mx-auto mt-8 w-full max-w-6xl px-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-[20px] text-fg">Claims</h2>
          {isSample && (
            <button type="button" onClick={() => setClaims([])} className="text-[13px] text-muted hover:text-fg">
              Clear sample claims
            </button>
          )}
        </div>
        <SheetGrid
          sheetName="Claims"
          columns={CLAIM_COLUMNS}
          rows={claims}
          onChange={setClaims}
          makeRow={newClaim}
          rowKey={(c) => c.id}
          fileName={`MACS reimbursements ${DATA_AS_OF}`}
        />
        <p className="mt-2 text-[12px] text-muted">
          Days late and status are calculated as of {DATA_AS_OF}. In the downloaded file they use TODAY(), so they keep updating in Excel.
        </p>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4">
        <section className="mt-10 border-t border-line pt-6">
          <h2 className="font-serif text-[20px] text-fg">Follow-up letters</h2>
          {summary.overdue.length === 0 ? (
            <p className="mt-2 text-[14px] text-muted">No claim is past its expected date.</p>
          ) : !approved ? (
            <div className="mt-3">
              <p className="text-[14px] leading-6 text-secondary">
                Approve to see the follow-up letters for the {summary.overdue.length} overdue claim{summary.overdue.length === 1 ? "" : "s"}. You review and send each one yourself.
              </p>
              <button type="button" onClick={() => setApproved(true)} className="mt-3 h-9 rounded-lg bg-fg px-4 text-sm text-page hover:opacity-90">
                Show follow-up letters
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-4">
              <p className="text-[13px] text-muted">Drafts only. Fill in the payer contact and your name before sending.</p>
              {summary.overdue.map((r) => (
                <LetterBlock key={r.claim.id} row={r} />
              ))}
              <button type="button" onClick={() => setApproved(false)} className="text-[13px] text-muted hover:text-fg">
                Hide letters
              </button>
            </div>
          )}
        </section>

        <ToolChat tool="reimb" onAsk={ask} composer={dock.composer} />
      </div>
    </div>
  );
}

function LetterBlock({ row }: { row: ClaimRow }) {
  const text = followUpDraft(row.claim, DATA_AS_OF);
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl bg-page shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-sm font-medium text-fg">
          {row.claim.program} · {usd(row.claim.amount)}
        </p>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(text)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-secondary hover:bg-hover hover:text-fg"
        >
          <Copy className="size-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap border-t border-line px-4 py-3 font-mono text-[12px] leading-5 text-fg">{text}</pre>
    </div>
  );
}
