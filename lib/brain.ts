import { canAccess, type Area } from "./access";
import type { AdminRoleId } from "./roles";
import { PUBLIC_AT_A_GLANCE, SITE_CHECKED_ON } from "./school-sections";

/**
 * The shared brain: what MACS staff have agreed is true, each fact with its source and who
 * approved it. People and agents propose; the Director (or Finance, for finance facts) approves
 * before a fact reaches every chat. That is "AI prepares, a person acts", built into the brain.
 */

export type FactSource = "website" | "staff" | "agent" | "sample";
export type FactStatus = "approved" | "proposed" | "rejected";

export interface Author {
  name: string;
  /** A staff role, or "website" / "agent" for facts that came from there. */
  role: AdminRoleId | "website" | "agent";
  /** For agents: the person whose question set the agent going. */
  via?: string;
}

export interface Fact {
  id: string;
  text: string;
  area: Area;
  source: FactSource;
  /** Where it came from: a page of the app, or a website address. */
  origin?: string;
  status: FactStatus;
  author: Author;
  createdAt: string;
  reviewedBy?: Author;
  reviewedAt?: string;
}

export const SOURCE_LABEL: Record<FactSource, string> = {
  website: "Website",
  staff: "Staff",
  agent: "Agent",
  sample: "Sample",
};

export const MAX_FACT = 600;

const site: Author = { name: "macschool.us", role: "website" };
const seeded = "2026-10-15T08:00:00.000Z";

/** Starting facts. Website facts are public and real; sample facts are illustrative. */
export const BRAIN_SEED: Fact[] = [
  {
    id: "seed-school",
    text: "MACS is a public charter school in Micanopy, Florida, serving VPK through Grade 7, sponsored by Alachua County Public Schools.",
    area: "general",
    source: "website",
    origin: "https://macschool.us",
    status: "approved",
    author: site,
    createdAt: seeded,
  },
  {
    id: "seed-size",
    text: `The public website reports ${PUBLIC_AT_A_GLANCE.enrolledStudents} enrolled students and ${PUBLIC_AT_A_GLANCE.teachersAndStaff} teachers and staff (checked ${SITE_CHECKED_ON}). The workspace's sample dataset models a 300-student school.`,
    area: "general",
    source: "website",
    origin: "https://macschool.us",
    status: "approved",
    author: site,
    createdAt: seeded,
  },
  {
    id: "seed-parade",
    text: "The public calendar lists the Halloween Parade on Friday, Oct 30.",
    area: "general",
    source: "website",
    origin: "https://macschool.us",
    status: "approved",
    author: site,
    createdAt: seeded,
  },
  {
    id: "seed-board-5000",
    text: "Board approval is required for any single expenditure over $5,000 (sample fiscal policy).",
    area: "finance",
    source: "sample",
    status: "approved",
    author: { name: "Finance & Operations Manager", role: "finance" },
    createdAt: seeded,
  },
  {
    id: "seed-campus-opens",
    text: "Campus opens at 7:15 AM; early arrivals go to the cafeteria for breakfast and i-Ready. Tardy bell 7:50 AM (sample schedule; confirm against the published bell schedule).",
    area: "general",
    source: "sample",
    status: "approved",
    author: { name: "Dean of Students", role: "dean" },
    createdAt: seeded,
  },
  {
    id: "seed-iep-invites",
    text: "IEP meeting invitations go to families at least 10 days ahead, from the ESE Coordinator (sample practice).",
    area: "supports",
    source: "sample",
    status: "approved",
    author: { name: "ESE Coordinator", role: "ese" },
    createdAt: seeded,
  },
  {
    id: "seed-family-night",
    text: "Fall Family Night is Friday, Oct 30, 5:30 to 7:00 PM, in the cafeteria.",
    area: "general",
    source: "agent",
    origin: "Canva",
    status: "proposed",
    author: { name: "Mac", role: "agent", via: "Director" },
    createdAt: seeded,
  },
];

export const canSeeFact = (f: Fact, role: AdminRoleId) => canAccess(role, f.area);

/** How a fact reads in the activity feed. */
export const factSummary = (f: Pick<Fact, "text">) => (f.text.length > 90 ? `${f.text.slice(0, 90)}…` : f.text);

/** The approved facts a role can see, for the system prompt. */
export function brainContext(facts: Fact[], role: AdminRoleId): string {
  const visible = facts.filter((f) => f.status === "approved" && canSeeFact(f, role));
  if (visible.length === 0) return "";
  const lines = visible.map((f) => `- [${SOURCE_LABEL[f.source]}${f.author.role === "website" ? "" : `, added by ${f.author.name}`}] ${f.text}`);
  return `\n## Shared brain (approved by MACS staff)\nWhat the team has agreed is true. Use it, cite it as [brain], and prefer it over guesses. Website facts are public; Sample facts are illustrative.\n${lines.join("\n")}\n`;
}

/** The line an agent ends its reply with to propose a fact. The workspace files it for approval. */
export const SUGGEST_PREFIX = "Suggest for the brain:";

export function suggestedFact(reply: string): string | null {
  const line = reply.trim().split("\n").reverse().find((l) => l.trim());
  if (!line) return null;
  const match = line.trim().replace(/^[*_>\s]+/, "").replace(/[*_]+/g, "");
  if (!match.toLowerCase().startsWith(SUGGEST_PREFIX.toLowerCase())) return null;
  const text = match.slice(SUGGEST_PREFIX.length).trim();
  return text.length >= 8 ? text.slice(0, MAX_FACT) : null;
}
