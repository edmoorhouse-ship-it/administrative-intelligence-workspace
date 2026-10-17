import { PUBLIC_AT_A_GLANCE } from "./school-sections";
import { getRole, type AdminRoleId } from "./roles";

/**
 * Onboarding state: getting the workspace set up for MACS, then bringing each new staff member on.
 * Shared by everyone signed in. The school profile reaches chats only when the user saves it into
 * their custom instructions.
 */

export const SETUP_STEPS = ["profile", "mail", "books", "checkin", "mac"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export interface SchoolProfile {
  school: string;
  size: string;
  teamSize: string;
  headaches: [string, string, string];
  tools: string;
  rhythm: string;
  answers: "short" | "detailed";
}

export interface NewHire {
  id: string;
  /** A role code such as T-3-B, not a name, until the privacy decision is made. */
  code: string;
  position: string;
  startIso: string;
  view: AdminRoleId;
  done: string[];
}

export interface OnboardingState {
  steps: Record<SetupStep, boolean>;
  profile: SchoolProfile;
  hires: NewHire[];
}

/** Starting values come from the public website and the choices already made in setup. */
export const DEFAULT_ONBOARDING: OnboardingState = {
  steps: { profile: false, mail: false, books: false, checkin: true, mac: false },
  profile: {
    school: "Micanopy Area Cooperative School: a public charter school in Micanopy, Florida, VPK through Grade 7, sponsored by Alachua County Public Schools.",
    size: `${PUBLIC_AT_A_GLANCE.enrolledStudents} students and ${PUBLIC_AT_A_GLANCE.teachersAndStaff} teachers and staff (public website).`,
    teamSize: "",
    headaches: ["", "", ""],
    tools: "Microsoft 365 for mail. Spreadsheets for bookkeeping.",
    rhythm: "Daily check-in with the Business pulse.",
    answers: "short",
  },
  hires: [],
};

export const HIRE_STEPS: { id: string; label: (h: NewHire) => string }[] = [
  { id: "view", label: (h) => `Set their view to ${getRole(h.view).label} in the footer menu` },
  { id: "rules", label: () => "Walk through the data rules: remove student names and IDs before pasting" },
  { id: "inbox", label: () => "Try Inbox triage with a few test messages" },
  { id: "share", label: () => "Ask the Director what can be shared outside the school" },
  { id: "mac", label: () => "Text Mac one question" },
];

/** Fills in anything missing from a saved copy, so older saves keep working. */
export function normalizeOnboarding(saved: Partial<OnboardingState> | null | undefined): OnboardingState {
  if (!saved) return DEFAULT_ONBOARDING;
  return {
    steps: { ...DEFAULT_ONBOARDING.steps, ...saved.steps },
    profile: { ...DEFAULT_ONBOARDING.profile, ...saved.profile },
    hires: Array.isArray(saved.hires) ? saved.hires : [],
  };
}

/** What the profile still needs before it can be saved. */
export function profileGaps(p: SchoolProfile): string[] {
  const gaps: string[] = [];
  if (!(Number(p.teamSize) > 0)) gaps.push("leadership team size");
  const named = p.headaches.filter((h) => h.trim()).length;
  if (named < 2) gaps.push(named === 1 ? "one more headache" : "two headaches");
  return gaps;
}

const OPEN = "[School profile from Onboarding]";
const CLOSE = "[/School profile]";

export function profileBlock(p: SchoolProfile) {
  const headaches = p.headaches.map((h) => h.trim()).filter(Boolean);
  return [
    OPEN,
    `School: ${p.school.trim()}`,
    `Size: ${p.size.trim()}`,
    `Leadership team: ${p.teamSize.trim()} people`,
    `Biggest day-to-day headaches: ${headaches.join("; ")}`,
    `Tools in use: ${p.tools.trim()}`,
    `Rhythm: ${p.rhythm.trim()}`,
    `Answer style: ${p.answers === "short" ? "short and direct, lead with the decision" : "detailed, with tables and the arithmetic shown"}`,
    CLOSE,
  ].join("\n");
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const blockPattern = () => new RegExp(`\\n*${escapeRe(OPEN)}[\\s\\S]*?${escapeRe(CLOSE)}\\n*`, "g");

export const hasProfileBlock = (instructions: string) => instructions.includes(OPEN);

/** Replaces the profile block in the user's custom instructions, leaving their own text alone. */
export function withProfile(instructions: string, p: SchoolProfile | null) {
  const rest = instructions.replace(blockPattern(), "\n\n").trim();
  if (!p) return rest;
  return [rest, profileBlock(p)].filter(Boolean).join("\n\n");
}

export function onboardingContext(state: OnboardingState) {
  const done = SETUP_STEPS.filter((s) => state.steps[s]).length;
  const hires = state.hires.map(
    (h) => `- ${h.code || "No code"} (${h.position || "no position"}), starts ${h.startIso || "date not set"}: ${h.done.length} of ${HIRE_STEPS.length} steps done. Still open: ${HIRE_STEPS.filter((s) => !h.done.includes(s.id)).map((s) => s.label(h)).join("; ") || "none"}.`,
  );
  return [
    `Workspace setup: ${done} of ${SETUP_STEPS.length} steps done (${SETUP_STEPS.map((s) => `${s} ${state.steps[s] ? "done" : "open"}`).join(", ")}).`,
    `School profile draft:\n${profileBlock(state.profile)}`,
    hires.length ? `New staff in onboarding (role codes, not names):\n${hires.join("\n")}` : "No new staff in onboarding.",
  ].join("\n\n");
}
