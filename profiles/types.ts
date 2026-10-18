import type { StaticImageData } from "next/image";
import type { Area } from "../lib/access";
import type { AdminRole, AdminRoleId } from "../lib/roles";
import type { PromptStarter } from "../lib/starters";
import type { ToolId } from "../lib/tools";

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
 * Server-only parts (the dataset, the assistant's prompt, the brain's starting facts) are wired by
 * profile id in lib/system-prompt.ts, lib/brain.ts, and app/api/chat so they stay out of the browser.
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
  /**
   * The people who use the workspace. Each fills one of the six fixed role slots, which carry the
   * access rules in lib/access.ts (the "principal" slot sees everything, approves anything, and
   * manages the team; "finance" sees and approves the finance area). Leave out slots the business
   * does not need. The first role is the fallback for unknown ids.
   */
  roles: AdminRole[];
  /** Overrides which areas a role slot sees; slots left out keep the defaults in lib/access.ts. */
  roleAreas?: Partial<Record<AdminRoleId, Area[]>>;
  /** Renames the access areas for this business; areas left out keep the school names. */
  areaLabels?: Partial<Record<Area, string>>;
  /** Tool pages in the sidebar, in order. Each is still limited by the role's areas. */
  tools: ToolId[];
  /** The sample dataset's "today" (YYYY-MM-DD). */
  dataAsOf: string;
  /** One line shown wherever the workspace labels sample data. */
  dataNotice: string;
  /** Suggestion chips under the home composer. */
  starters: PromptStarter[];
  /** The floating calendar helper (shown when features.manny is on). */
  helper: {
    name: string;
    /** Who it is, in a phrase: "the school's executive assistant". */
    role: string;
    /** "manatee" draws Manny; "badge" draws a calendar on the brand color. */
    face: "manatee" | "badge";
  };
  features: {
    /** The Bid leveling page. */
    leveling: boolean;
    /** The coverage board page (pricing roles only). */
    coverage: boolean;
    /** The school sections list in the sidebar (Academics, Operations, ...). */
    schoolSections: boolean;
    /** The floating calendar helper (Manny for MACS). */
    manny: boolean;
  };
}
