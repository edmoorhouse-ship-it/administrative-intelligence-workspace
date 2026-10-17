import type { Area } from "./access";

/** One line in the shared activity feed: who did what, a person or an agent working for one. */
export interface ActivityEntry {
  id: string;
  at: string;
  actor: {
    name: string;
    role: string;
    kind: "person" | "agent";
    /** For agents: the person whose action set the agent going. */
    via?: string;
  };
  action: string;
  /** Who may see the line. A finance edit stays out of the front office's feed. */
  area: Area;
  page?: string;
}
