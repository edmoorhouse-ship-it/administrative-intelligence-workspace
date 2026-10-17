import { profile } from "@/profiles";

export type AdminRoleId = "principal" | "dean" | "ese" | "finance" | "office" | "board";

export interface AdminRole {
  id: AdminRoleId;
  label: string;
  greetingName: string;
  initials: string;
  lens: string;
}

/** The active profile's roles. The ids are fixed slots; the profile picks which exist and names them. */
export const ROLES: AdminRole[] = profile.roles;

export const DEFAULT_ROLE_ID: AdminRoleId = "principal";

export function getRole(id: string | undefined): AdminRole {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

export function isKnownRole(id: unknown): id is AdminRoleId {
  return typeof id === "string" && ROLES.some((r) => r.id === id);
}
