import { construction } from "./construction/profile";
import { macs } from "./macs/profile";
import type { Palette, Profile } from "./types";

export type { Profile } from "./types";

export const PROFILES: Record<string, Profile> = { macs, construction };

/**
 * The active profile, from WORKSPACE_PROFILE in .env.local ("macs" or "construction"). next.config
 * passes it to the browser, so changing it needs a restart of `npm run dev`. Unknown names fall back to MACS.
 */
export const profile: Profile = PROFILES[process.env.WORKSPACE_PROFILE ?? "macs"] ?? macs;

const vars = (p: Palette) =>
  `--brand:${p.brand};--brand-deep:${p.deep};--gold:${p.accent};--send:${p.send};--cal-general:${p.brand};--viz-bar:${p.brand};`;

/**
 * The profile's colors as CSS. The selectors outrank globals.css's :root and .dark, so the profile wins
 * whatever order the stylesheets load in.
 */
export function profileCss(p: Profile = profile): string {
  return `html[data-profile]{${vars(p.colors.light)}}html[data-profile].dark{${vars(p.colors.dark)}}`;
}
