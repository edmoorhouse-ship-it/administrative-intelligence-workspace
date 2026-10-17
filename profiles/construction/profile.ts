import type { Profile } from "../types";

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
  features: { leveling: true },
};
