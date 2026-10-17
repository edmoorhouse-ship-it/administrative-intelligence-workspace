import { DEMO_PAGES, type DemoPageId } from "./demo-pages";
import type { Decisions } from "./decisions";
import { pulse, STATUS_LABEL } from "./pulse";
import { summarize, usd, type Claim } from "./reimbursements";
import { computeAll, type RestockItem } from "./restock";
import { TAX_CHECKLIST, TAX_NOTE } from "./tax-checklist";
import { MAX_TOOL_CONTEXT, type ToolId } from "./tools";

/**
 * What each tool page offers for interaction: decision cards and suggested questions, plus a
 * plain-text snapshot of the page that rides along when a chat starts there. Card content
 * comes from the same data the page shows; nothing here adds facts.
 */

export interface DecisionOption {
  id: string;
  label: string;
  /** When set, choosing this option also opens a chat with this request. */
  ask?: string;
}

export interface DecisionCard {
  id: string;
  title: string;
  detail: string;
  urgency?: "critical" | "warn";
  options: DecisionOption[];
}

export const TOOL_PROMPTS: Partial<Record<ToolId, string[]>> = {
  calendar: [
    "What's on the calendar this week?",
    "Which deadlines are at risk?",
    "Draft a reminder for next week's deadlines.",
  ],
  vendors: [
    "What needs attention before the Nov 10 board meeting?",
    "Which vendors touch student data without a DPA?",
    "Draft a reminder schedule for renewals and insurance certificates.",
  ],
  students: [
    "Who should the Dean call this week about attendance?",
    "Where are our biggest reading gaps?",
    "Summarize grade 6 for the board.",
  ],
  pulse: [
    "What should I tackle first today?",
    "Explain why spending is ahead of pace.",
    "Draft a two-minute board update from this pulse.",
  ],
  tax: [
    "Which of these questions matter most right now?",
    "Draft the email to our accountant.",
    "What records should I gather first?",
  ],
  restock: [
    "What runs out first?",
    "Should this order be split across months?",
    "Draft the PO email to the first vendor.",
  ],
  reimb: [
    "Which claim should I chase first?",
    "How does the late claim affect cash?",
    "Draft follow-ups for the overdue claims.",
  ],
  canva: [
    "Write a caption for the flyer post.",
    "Draft a reminder for the family newsletter.",
    "What should change before printing?",
  ],
  onboarding: [
    "What's left to finish setup?",
    "Write a first-week guide for a new teacher.",
    "What should a new hire never paste here?",
  ],
  security: [
    "What should we fix before using real records?",
    "Explain the sign-in gap in plain words.",
    "Draft a note to the board about AI and privacy.",
  ],
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const clip = (text: string) => (text.length > MAX_TOOL_CONTEXT ? `${text.slice(0, MAX_TOOL_CONTEXT - 1)}…` : text);

/** Short stable id from text, so a card keeps its recorded choice across visits. */
function slug(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Appends the choices already recorded on this page, so the chat knows what was decided. */
export function withDecisions(context: string, cards: DecisionCard[], decisions: Decisions) {
  const made = cards.flatMap((c) => {
    const choice = decisions[c.id]?.choice;
    const option = c.options.find((o) => o.id === choice);
    return option ? [`- ${c.title}: ${option.label}`] : [];
  });
  return clip(made.length ? `${context}\n\nChoices the user recorded on this page:\n${made.join("\n")}` : context);
}

// ---- Business pulse ---------------------------------------------------------

export const PULSE_CONTEXT = clip(
  [
    `Overall: ${STATUS_LABEL[pulse.overall]}. ${pulse.overallLine}`,
    "Summary:",
    ...pulse.tldr.map((t) => `- ${t}`),
    `One priority: ${pulse.priority}`,
    "This week:",
    ...pulse.thisWeek.map((w) => `- ${w.when}: ${w.text}`),
    "Watch list:",
    ...pulse.watch.map((w) => `- [${STATUS_LABEL[w.status]}] ${w.text}`),
  ].join("\n"),
);

/** The student record named in today's priority, so the watch list doesn't repeat it as a card. */
const priorityRecord = pulse.priority.match(/\bS-\d+\b/)?.[0];

export const PULSE_CARDS: DecisionCard[] = [
  {
    id: "pulse-priority",
    title: "Today's one priority",
    detail: pulse.priority,
    urgency: "critical",
    options: [
      { id: "mine", label: "I'm on it" },
      {
        id: "draft",
        label: "Draft a note to the owner",
        ask: `Draft a short note to the owner of today's priority so they can close it. Keep it to a few sentences, and mark it as a draft for me to send. The priority: ${pulse.priority}`,
      },
      { id: "later", label: "Not today" },
    ],
  },
  ...pulse.watch
    .filter((w) => !priorityRecord || !w.text.includes(priorityRecord))
    .slice(0, 3)
    .map((w): DecisionCard => {
      const [first, ...rest] = w.text.split(/(?<=\.)\s+/);
      return {
        id: `pulse-watch-${slug(w.text)}`,
        title: first,
        detail: rest.join(" "),
        urgency: w.status === "critical" ? "critical" : "warn",
        options: [
          { id: "mine", label: "I'll handle it" },
          {
            id: "draft",
            label: "Draft a note",
            ask: `Draft a short note to the person who owns this item, for me to review and send. Item: ${w.text}`,
          },
          { id: "later", label: "Not now" },
        ],
      };
    }),
];

// ---- Tax checklist ----------------------------------------------------------

export const taxQuestionId = (item: number, question: number) => `tax-q-${item}-${question}`;

export function taxContext(decisions: Decisions) {
  const lines = TAX_CHECKLIST.flatMap((item, i) => [
    `${i + 1}. ${item.title}. ${item.why}`,
    ...item.ask.map((q, j) => `   - [${decisions[taxQuestionId(i, j)] ? "answered" : "open"}] ${q}`),
  ]);
  return clip([TAX_NOTE, ...lines].join("\n"));
}

export const TAX_CARDS: DecisionCard[] = [
  {
    id: "tax-send",
    title: "Send the open questions to the accountant?",
    detail: "Tick the questions you already have answers to. The email covers the rest.",
    options: [
      {
        id: "draft",
        label: "Draft the email",
        ask: "Draft a short email to our accountant asking the questions on the tax checklist that are still open. Plain language, no tax conclusions, and mark it as a draft for me to send.",
      },
      { id: "later", label: "Not yet" },
    ],
  },
];

// ---- Restock ----------------------------------------------------------------

export function restockContext(items: RestockItem[]) {
  const s = computeAll(items);
  return clip(
    [
      `To order now: ${usd(s.committed)} across ${plural(s.toOrder.length, "item")} and ${plural(s.vendors.length, "vendor")}.${s.needsBoard ? " Above the USD 5,000 board approval line." : ""}`,
      "Items:",
      ...s.rows.map(
        (r) =>
          `- ${r.item.name || "Unnamed item"} (${r.item.vendor || "no vendor"}): ${r.item.count} on hand, ${r.item.weeklyUse}/week, lead ${r.item.leadDays} days, ${r.item.onOrder} already ordered. ${r.label}.${r.orderQty > 0 ? ` Order ${r.orderQty} for ${usd(r.cost)}.` : ""}${r.item.note ? ` Note: ${r.item.note}` : ""}`,
      ),
    ].join("\n"),
  );
}

// ---- Reimbursements ---------------------------------------------------------

export function reimbContext(claims: Claim[]) {
  const s = summarize(claims);
  return clip(
    [
      `Still owed: ${usd(s.outstanding)}. Past the expected date: ${usd(s.overdueAmount)} across ${plural(s.overdue.length, "claim")}.`,
      "Claims:",
      ...s.rows.map(
        (r) =>
          `- ${r.claim.program || "Unnamed claim"} from ${r.claim.payer || "no payer"}: ${usd(r.claim.amount)}, submitted ${r.claim.submittedIso}, expected ${r.claim.expectedIso}, ${r.state === "paid" ? `received ${r.claim.receivedIso}` : r.state === "overdue" ? `${r.daysLate} days late` : "not yet due"}.`,
      ),
    ].join("\n"),
  );
}

export function reimbCards(claims: Claim[]): DecisionCard[] {
  return summarize(claims).overdue.map((r) => ({
    id: `reimb-${r.claim.id}`,
    title: `${r.claim.program || "A claim"} is ${r.daysLate} days late`,
    detail: `${usd(r.claim.amount)} from ${r.claim.payer || "the payer"}, expected ${r.claim.expectedIso}.`,
    urgency: "critical",
    options: [
      {
        id: "draft",
        label: "Draft a follow-up",
        ask: `Draft a short, polite follow-up to ${r.claim.payer || "the payer"} about ${r.claim.program}: a claim for ${usd(r.claim.amount)}, submitted ${r.claim.submittedIso}, expected by ${r.claim.expectedIso}, not yet received. Mark it as a draft for me to send.`,
      },
      { id: "call", label: "I'll call them" },
      { id: "wait", label: "Wait a week" },
    ],
  }));
}

// ---- Demo pages (Canva, Onboarding, Security, Text Mac) --------------------

export function demoContext(id: DemoPageId) {
  const page = DEMO_PAGES[id];
  return clip(
    [
      `${page.title}: ${page.subtitle}`,
      page.intro,
      ...page.sections.flatMap((s) => [`${s.heading}:`, ...s.items.map((i) => `- ${i.label}: ${i.text}${i.state ? ` [${i.state}]` : ""}`)]),
      page.footnote ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export const DEMO_CARDS: Partial<Record<DemoPageId, DecisionCard[]>> = {
  canva: [
    {
      id: "canva-date",
      title: "Is Friday, Oct 30 the right date?",
      detail: "The flyer says Oct 30, 5:30 to 7:00 PM, in the cafeteria. The public calendar lists the Halloween Parade the same day.",
      urgency: "warn",
      options: [
        { id: "confirmed", label: "Date is confirmed" },
        {
          id: "ask",
          label: "Ask the front office",
          ask: "Draft a short note to the front office asking them to confirm the Fall Family Night date and time (Friday, Oct 30, 5:30 to 7:00 PM, cafeteria), since the public calendar lists the Halloween Parade the same day. Mark it as a draft for me to send.",
        },
        { id: "hold", label: "Hold printing" },
      ],
    },
    {
      id: "canva-badge",
      title: "Use the official Manatees badge?",
      detail: "Canva drew its own manatee. The official badge isn't on the flyer yet.",
      options: [
        { id: "official", label: "Use the official badge" },
        { id: "keep", label: "Keep the drawing" },
      ],
    },
  ],
  security: [
    {
      id: "sec-real-records",
      title: "Serve real records only after sign-in?",
      detail: "Sign-in and roles are in. The sample dataset still ships in the page code, so real records have to come from the server after sign-in.",
      urgency: "critical",
      options: [
        { id: "yes", label: "Yes, before real records" },
        {
          id: "ask",
          label: "What would that take?",
          ask: "What would it take to serve the school's dataset from the server only after sign-in, instead of building it into the page code? Keep it short and practical.",
        },
        { id: "later", label: "Not now" },
      ],
    },
    {
      id: "sec-ai",
      title: "What may go to the AI provider?",
      detail: "Pasted text and the dataset go to OpenRouter. A privacy decision is needed before real records go in.",
      urgency: "critical",
      options: [
        { id: "sample", label: "Sample data only for now" },
        {
          id: "ask",
          label: "Help me decide",
          ask: "Help me decide what MACS information may be sent to an AI provider. Walk through student records, staff records, and finance, and list what the board or ACPS should weigh in on.",
        },
      ],
    },
    {
      id: "sec-lint-tooling",
      title: "Update the lint tooling when a fix ships?",
      detail: "All 5 high-severity npm warnings are in the lint tooling, not in what ships with the app. npm's suggested fix is a downgrade, so the fix is to wait for a newer version.",
      urgency: "warn",
      options: [
        { id: "yes", label: "Yes, when a fix ships" },
        { id: "leave", label: "Leave it" },
      ],
    },
  ],
};
