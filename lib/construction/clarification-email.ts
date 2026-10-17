/**
 * Bidder-specific clarification emails, built from the questions the leveling package already found
 * for that bidder (deliverable H). Each email asks only about that bidder's own gaps, groups them so
 * they read quickly, asks for a revised total if anything changes the price, and gives a reply-by
 * date. Plain text, ready to paste into Outlook. The workspace never sends anything.
 *
 * Pure: no dates from the clock, no network. The page passes today's date in.
 */

export interface ClarificationInput {
  bidder: string;
  /** Project and package as the run knows them ("NOT STATED" when the proposals don't say). */
  project: string;
  pkg: string;
  /** From the bidder's current proposal record. */
  proposalDate: string;
  revision: number | null;
  contact: string;
  questions: string[];
}

export interface ClarificationEmail {
  bidder: string;
  subject: string;
  body: string;
  questionCount: number;
}

export type ClarificationStatus = "drafted" | "sent" | "answered";

/** One shared tracking entry. No dollar amounts or question text: just where the email stands. */
export interface ClarificationTrack {
  key: string;
  pkg: string;
  round: string;
  bidder: string;
  questions: number;
  status: ClarificationStatus;
  updatedBy: string;
  updatedAt: string;
}

export const STATUS_TEXT: Record<ClarificationStatus, string> = {
  drafted: "Drafted, not sent",
  sent: "Marked sent",
  answered: "Answer in",
};

const NOT_STATED = "NOT STATED";
export const DEFAULT_REPLY_DAYS = 2;

export const trackKey = (pkg: string, round: string, bidder: string) => `${pkg.trim().toLowerCase()}|${round.trim().toLowerCase()}|${bidder.trim().toLowerCase()}`;

// ---- Dates --------------------------------------------------------------------------------

const DAY = 86_400_000;
const atNoon = (iso: string) => new Date(`${iso}T12:00:00Z`);
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

/** The date `n` business days after `iso`, skipping Saturdays and Sundays (holidays are not known). */
export function businessDaysAfter(iso: string, n: number): string {
  let d = atNoon(iso);
  let left = n;
  while (left > 0) {
    d = new Date(d.getTime() + DAY);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return isoOf(d);
}

/** "Wednesday, October 21". */
export const longDate = (iso: string) => atNoon(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortDate = (iso: string) => atNoon(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// ---- Grouping -----------------------------------------------------------------------------

const GROUPS: { title: string; test: RegExp }[] = [
  { title: "Price and math", test: /line items total|not tied to a bid form line|correct base|base without|price the option/i },
  { title: "Drawings", test: /drawing set/i },
  { title: "Terms", test: /hold pricing|escalation|mobilization|deposit|firm proposal|budget pricing|bond rate/i },
];
const SCOPE = "Scope";

export function groupQuestions(questions: string[]): { title: string; questions: string[] }[] {
  const out = new Map<string, string[]>([[SCOPE, []], ...GROUPS.map((g) => [g.title, []] as [string, string[]])]);
  for (const q of questions) out.get(GROUPS.find((g) => g.test.test(q))?.title ?? SCOPE)!.push(q);
  return [...out].filter(([, qs]) => qs.length).map(([title, qs]) => ({ title, questions: qs }));
}

// ---- The email ----------------------------------------------------------------------------

/** "Hi Dana," when the proposal names a person; "Hi [Name]," otherwise. */
function greeting(contact: string): string {
  const first = contact && contact !== NOT_STATED ? contact.trim().split(/[\s,]+/)[0] : "";
  return /^[A-Z][a-z'-]+$/.test(first) ? `Hi ${first},` : "Hi [Name],";
}

function proposalRef(input: ClarificationInput): string {
  const parts = [input.proposalDate !== NOT_STATED ? `dated ${input.proposalDate}` : "", input.revision ? `Rev ${input.revision}` : ""].filter(Boolean);
  return parts.length ? `your proposal (${parts.join(", ")})` : "your proposal";
}

/** The draft for one bidder, or null when there is nothing to ask (no email for a clean bid). */
export function clarificationEmail(input: ClarificationInput, replyBy: string | null): ClarificationEmail | null {
  const questions = [...new Set(input.questions.map((q) => q.trim()).filter(Boolean))];
  if (questions.length === 0) return null;

  const pkg = input.pkg.trim() || "[Package]";
  const project = input.project !== NOT_STATED && input.project.trim() ? `${input.project.trim()} ` : "";
  const subject = `${project}${pkg}: clarifications for ${input.bidder}${replyBy ? ` (reply by ${shortDate(replyBy)})` : ""}`;

  let n = 0;
  const groups = groupQuestions(questions);
  const sections = groups.map((g) => [...(groups.length > 1 ? [g.title] : []), ...g.questions.map((q) => `${++n}. ${q}`)].join("\n"));

  const body = [
    greeting(input.contact),
    "",
    `Thanks for ${proposalRef(input)} for ${project}${pkg}. Before we finish leveling, please clear up the ${questions.length === 1 ? "item" : `${questions.length} items`} below.`,
    "",
    sections.join("\n\n"),
    "",
    `${replyBy ? `Please reply by ${longDate(replyBy)}.` : "Please reply as soon as you can."} If any answer changes your price, include a revised total.`,
    "",
    "Thanks,",
    "[Your name]",
  ].join("\n");

  return { bidder: input.bidder, subject, body, questionCount: questions.length };
}

/** What the Copy button puts on the clipboard. */
export const emailText = (e: ClarificationEmail) => `Subject: ${e.subject}\n\n${e.body}`;
