import type { StaticImageData } from "next/image";

/** The accent colors a profile sets. Everything else (surfaces, text, lines) stays in globals.css. */
export interface Palette {
  /** Main accent: brand card, links, highlights, calendar "Everyone" dots, chart bars. */
  brand: string;
  /** Second accent: card stripes, tagline, warning-ish highlights. */
  accent: string;
  /** The send button. */
  send: string;
  /** Background of the brand card and letter badge. Stays dark in both themes so white text reads. */
  deep: string;
}

/**
 * Who the workspace is for: the parts of the interface that change from one business to the next.
 * Roles, tools, data, and the assistant's prompt move into the profile in later steps (see PLAN.md).
 */
export interface Profile {
  id: string;
  /** Full organization name, shown above page titles: "Micanopy Area Cooperative School". */
  org: string;
  /** The organization name on two lines, for the brand card in the sidebar. */
  orgLines: [string, string];
  /** Short name used in sentences: "MACS". */
  shortName: string;
  /** The product name in the browser tab and the AI disclaimer: "MACS Workspace". */
  workspaceName: string;
  /** Small label at the top of the sidebar: "Leadership Workspace". */
  kicker: string;
  /** Line under the name on the brand card: "Home of the Manatees". */
  tagline: string;
  /** Search and link-preview description. */
  description: string;
  /** An image (square, at least 120px), or up to three letters drawn as a badge. */
  logo: { image: StaticImageData } | { monogram: string };
  colors: { light: Palette; dark: Palette };
  /** Pages this profile shows in the sidebar beyond the shared ones. */
  features: { leveling: boolean };
}
