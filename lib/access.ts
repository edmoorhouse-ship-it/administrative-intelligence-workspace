import { profile } from "@/profiles";
import type { AdminRoleId } from "./roles";
import type { ToolId } from "./tools";

/**
 * Who may see what. The server checks these on every shared read and write, on the brain, on the
 * activity feed, and on what the chat is given; the sidebar uses the same table to hide pages.
 *
 *   general   everyone signed in
 *   students  student records: attendance, grades, the roster
 *   supports  IEP, 504, ESE, and FTE exceptions tied to a student
 *   finance   budget, cash, payroll, claims, purchasing, tax
 */

export type Area = "general" | "students" | "supports" | "finance";
export const AREAS: Area[] = ["general", "students", "supports", "finance"];

/** Area names, with the active profile's renames applied. */
export const AREA_LABEL: Record<Area, string> = {
  general: "Everyone",
  students: "Student records",
  supports: "IEP & 504",
  finance: "Finance",
  ...profile.areaLabels,
};

const ROLE_AREAS: Record<AdminRoleId, Area[]> = {
  principal: ["general", "students", "supports", "finance"],
  dean: ["general", "students", "supports"],
  ese: ["general", "students", "supports"],
  finance: ["general", "finance"],
  office: ["general", "students"],
  board: ["general", "finance"],
};

export const isArea = (a: unknown): a is Area => typeof a === "string" && (AREAS as string[]).includes(a);

export const areasFor = (role: AdminRoleId): Area[] => profile.roleAreas?.[role] ?? ROLE_AREAS[role] ?? ["general"];

export const canAccess = (role: AdminRoleId, area: Area) => areasFor(role).includes(area);

/** Approving makes a proposal shared truth. The Director approves anything; Finance approves finance. */
export const canApprove = (role: AdminRoleId, area: Area) => role === "principal" || (role === "finance" && area === "finance");

/** Only the Director adds staff, changes roles, or turns accounts off. */
export const canManageTeam = (role: AdminRoleId) => role === "principal";

/** The area each tool page belongs to. */
export const TOOL_AREA: Record<ToolId, Area> = {
  pulse: "general",
  calendar: "general",
  students: "students",
  inbox: "general",
  canva: "general",
  tax: "finance",
  restock: "finance",
  reimb: "finance",
  vendors: "finance",
  onboarding: "general",
  security: "general",
  mac: "general",
};

/** A tool opens when the profile includes it and the role can see its area. */
export const canOpenTool = (role: AdminRoleId, tool: ToolId) => profile.tools.includes(tool) && canAccess(role, TOOL_AREA[tool]);
