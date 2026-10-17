/** The workspace's tool pages. A chat started from one carries a snapshot of what the page showed. */

export const TOOL_IDS = ["pulse", "calendar", "students", "inbox", "canva", "tax", "restock", "reimb", "vendors", "onboarding", "security", "mac"] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export const TOOL_TITLES: Record<ToolId, string> = {
  pulse: "Business pulse",
  calendar: "Calendar",
  students: "Students",
  inbox: "Inbox triage",
  canva: "Canva",
  tax: "Tax checklist",
  restock: "Restock",
  reimb: "Reimbursements",
  vendors: "Vendors",
  onboarding: "Onboarding",
  security: "Security check",
  mac: "Text Mac",
};

/** Longest page snapshot the chat route accepts. */
export const MAX_TOOL_CONTEXT = 8_000;

export function isKnownTool(id: unknown): id is ToolId {
  return typeof id === "string" && (TOOL_IDS as readonly string[]).includes(id);
}
