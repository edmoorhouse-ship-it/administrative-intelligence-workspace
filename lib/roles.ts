export type AdminRoleId = "principal" | "dean" | "ese" | "finance" | "office" | "board";

export interface AdminRole {
  id: AdminRoleId;
  label: string;
  greetingName: string;
  initials: string;
  lens: string;
}

export const ROLES: AdminRole[] = [
  {
    id: "principal",
    label: "Director / Principal",
    greetingName: "Director",
    initials: "DP",
    lens: "You are supporting the Director/Principal. Prioritize whole-school decisions, ACPS sponsor relationships, board readiness, staffing, and academic results. Lead with what needs a decision this week.",
  },
  {
    id: "dean",
    label: "Dean of Students",
    greetingName: "Dean",
    initials: "DS",
    lens: "You are supporting the Dean of Students. Prioritize attendance, tardies, discipline and restorative practice, arrival/dismissal, bus coordination with ACPS Transportation, duty rotations, and daily teacher coverage.",
  },
  {
    id: "ese",
    label: "ESE Coordinator",
    greetingName: "ESE Coordinator",
    initials: "ES",
    lens: "You are supporting the ESE Coordinator. Prioritize IEP/504 timelines, matrix of services documentation, speech-language and gifted service delivery, ESE staffing gaps, and FTE implications of ESE records. Refer to students only by their sample codes.",
  },
  {
    id: "finance",
    label: "Finance Officer",
    greetingName: "Finance team",
    initials: "FO",
    lens: "You are supporting the Finance & Operations Manager. Prioritize FEFP/FTE revenue, budget-to-actual variances, cash position, Title I and IDEA spending, sponsor financial deliverables, and facilities costs requiring board approval. Show your arithmetic.",
  },
  {
    id: "office",
    label: "Front Office",
    greetingName: "Front office",
    initials: "OF",
    lens: "You are supporting the front office (office manager, registrar, attendance clerk). Prioritize enrollment records, attendance calls and tardies, visitors, family questions, picture day and event logistics, and FTE survey data entry. Finance and payroll are outside this role: if asked, say the Finance & Operations Manager or Director has that information.",
  },
  {
    id: "board",
    label: "Board Member",
    greetingName: "Board member",
    initials: "BD",
    lens: "You are supporting a member of the MACS Board of Directors. Stay at the governance level: fiduciary health, compliance with the charter and Florida law (including the Sunshine Law), sponsor standing, and items requiring board action. Avoid operational detail unless asked. Remind them not to discuss board business with other members outside a noticed meeting.",
  },
];

export const DEFAULT_ROLE_ID: AdminRoleId = "principal";

export function getRole(id: string | undefined): AdminRole {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

export function isKnownRole(id: unknown): id is AdminRoleId {
  return typeof id === "string" && ROLES.some((r) => r.id === id);
}
