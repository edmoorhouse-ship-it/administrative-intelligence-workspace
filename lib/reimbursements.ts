import { DATA_AS_OF } from "./macs-data";

/**
 * Reimbursement claims MACS has submitted to ACPS and the state. These are the school's real
 * receivables: money owed by a payer, not by families. Follow-ups go to the payer, drafted for
 * approval. Nothing here sends a letter or contacts families.
 */

export interface Claim {
  id: string;
  program: string;
  payer: string;
  amount: number; // USD claimed
  submittedIso: string;
  expectedIso: string;
  receivedIso: string; // empty until paid
  note: string;
}

export type ClaimState = "paid" | "overdue" | "waiting";

/** Starter claims are SAMPLE values. Replace them with the school's submitted claims. */
export const SAMPLE_CLAIMS: Claim[] = [
  {
    id: "c1",
    program: "Title I, Part A (sample)",
    payer: "Alachua County Public Schools",
    amount: 20500,
    submittedIso: "2026-09-30",
    expectedIso: "2026-10-31",
    receivedIso: "",
    note: "",
  },
  {
    id: "c2",
    program: "IDEA Part B flow-through (sample)",
    payer: "Alachua County Public Schools",
    amount: 8600,
    submittedIso: "2026-09-30",
    expectedIso: "2026-10-31",
    receivedIso: "",
    note: "",
  },
  {
    id: "c3",
    program: "VPK program (sample)",
    payer: "State early learning program",
    amount: 11400,
    submittedIso: "2026-08-31",
    expectedIso: "2026-09-30",
    receivedIso: "",
    note: "Expected date has passed",
  },
];

const DAY_MS = 86_400_000;

export const usd = (n: number) => `USD ${Math.round(n).toLocaleString("en-US")}`;

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(`${toIso}T12:00:00`) - Date.parse(`${fromIso}T12:00:00`)) / DAY_MS);

export interface ClaimRow {
  claim: Claim;
  state: ClaimState;
  daysLate: number; // positive when past the expected date
}

export function rowFor(claim: Claim): ClaimRow {
  if (claim.receivedIso) return { claim, state: "paid", daysLate: 0 };
  const late = daysBetween(claim.expectedIso, DATA_AS_OF);
  return { claim, state: late > 0 ? "overdue" : "waiting", daysLate: Math.max(0, late) };
}

export function summarize(claims: Claim[]) {
  const rows = claims.map(rowFor);
  const open = rows.filter((r) => r.state !== "paid");
  const overdue = rows.filter((r) => r.state === "overdue");
  return {
    rows,
    outstanding: open.reduce((sum, r) => sum + r.claim.amount, 0),
    overdueAmount: overdue.reduce((sum, r) => sum + r.claim.amount, 0),
    overdue,
  };
}

/** Follow-up letter to the payer. Marked as a draft: it is not sent. Contact details are placeholders. */
export function followUpDraft(claim: Claim, dateIso: string): string {
  return [
    "FOLLOW-UP: DRAFT, NOT SENT",
    `To: [contact name], ${claim.payer}`,
    `Date: ${dateIso}`,
    `Subject: Payment status for ${claim.program}`,
    "",
    `Our claim for ${claim.program}, submitted ${claim.submittedIso} for ${usd(claim.amount)}, had an expected payment date of ${claim.expectedIso}. We have not yet received payment. Could you confirm the status of this claim and the expected payment date?`,
    "",
    "Thank you,",
    "[Name]",
    "Finance & Operations Manager",
    "Micanopy Area Cooperative School",
  ].join("\n");
}
