import badge from "@/public/brand/macs-manatees.png";
import { TOOL_IDS } from "../../lib/tools";
import type { Profile } from "../types";
import { macsRoles } from "./roles.ts";
import { macsStarters } from "./starters.ts";

/** Micanopy Area Cooperative School: the first client, and the workspace as it was built. */
export const macs: Profile = {
  id: "macs",
  org: "Micanopy Area Cooperative School",
  orgLines: ["Micanopy Area", "Cooperative School"],
  shortName: "MACS",
  workspaceName: "MACS Workspace",
  kicker: "Leadership Workspace",
  tagline: "Home of the Manatees",
  description: "Administrative intelligence and operations workspace for the MACS leadership team.",
  logo: { image: badge },
  // Navy and gold sampled from the MACS Manatees badge.
  colors: {
    light: { brand: "#324c9a", accent: "#d8b820", send: "#324c9a", deep: "#324c9a" },
    dark: { brand: "#8fa6e6", accent: "#e3c43a", send: "#3f5db5", deep: "#2b4185" },
  },
  roles: macsRoles,
  tools: [...TOOL_IDS],
  starters: macsStarters,
  dataAsOf: "2026-10-14",
  dataNotice: "Sample data: illustrative figures for demonstration only — not MACS, ACPS, or FLDOE records. Verify against official sources before use.",
  helper: { name: "Manny", role: "the school's executive assistant", face: "manatee" },
  features: { leveling: false, schoolSections: true, manny: true },
};
