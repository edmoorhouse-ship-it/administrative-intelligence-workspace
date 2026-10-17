import { PORTFOLIO_AS_OF, PORTFOLIO_NOTICE } from "../../lib/construction/portfolio.ts";
import type { Profile } from "../types";
import { constructionRoles } from "./roles.ts";
import { constructionStarters } from "./starters.ts";

/**
 * Preconstruction: bid leveling and pricing for a multifamily developer-builder. Deliberately generic:
 * no employer name. Change the name, tagline, and colors here; drop a square logo into
 * public/brand/ and import it as `logo: { image }` to replace the monogram.
 */
export const construction: Profile = {
  id: "construction",
  org: "Preconstruction",
  orgLines: ["Preconstruction", "Workspace"],
  shortName: "Precon",
  workspaceName: "Precon Workspace",
  kicker: "Administrative Intelligence",
  tagline: "Bids · Leveling · Pricing",
  description: "Preconstruction workspace: proposal intake, bid forms, bid leveling, and the BuildingConnected plug table.",
  logo: { monogram: "PC" },
  // Steel blue with a safety-orange accent. White on the brand card is 8.7:1; the orange tagline is 4.3:1, like MACS gold.
  colors: {
    light: { brand: "#1f4e79", accent: "#f5a64f", send: "#1f4e79", deep: "#1f4e79" },
    dark: { brand: "#7fb0e0", accent: "#f5a64f", send: "#2f6aa3", deep: "#1b4469" },
  },
  roles: constructionRoles,
  // Estimators read RFIs and drawings; Development sees contracts and risk. The other slots keep the defaults.
  roleAreas: {
    finance: ["general", "finance", "students"],
    board: ["general", "finance", "supports"],
  },
  // The access areas, renamed for a builder. Same rules: pricing is the finance area.
  areaLabels: {
    general: "Everyone",
    finance: "Pricing & budget",
    students: "Project records",
    supports: "Contracts & risk",
  },
  // The school tool pages stay off; Bid leveling is the first construction tool. Pulse and the
  // calendar come back with construction data (PLAN.md step 4).
  tools: [],
  starters: constructionStarters,
  dataAsOf: PORTFOLIO_AS_OF,
  dataNotice: PORTFOLIO_NOTICE,
  features: { leveling: true, schoolSections: false, manny: false },
};
