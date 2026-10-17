import type { AdminRole } from "../../lib/roles";

/**
 * The preconstruction team. Slots: "principal" is the Director (sees everything, approves, manages the
 * team); "finance" is the Estimator (pricing and budget); "dean" the Project Manager and "office" the
 * Project Coordinator (project records); "board" is Development (pricing and budget, decision level).
 * No "ese" slot.
 */
export const constructionRoles: AdminRole[] = [
  {
    id: "principal",
    label: "Preconstruction Director",
    greetingName: "Director",
    initials: "PD",
    lens: "You are supporting the Preconstruction Director. Prioritize bid coverage, leveling status by trade, carry decisions, GMP readiness, and questions from Development. Lead with what needs a decision this week. The carry is the Director's call: recommend, never decide.",
  },
  {
    id: "finance",
    label: "Estimator",
    greetingName: "Estimator",
    initials: "ES",
    lens: "You are supporting an Estimator. Prioritize takeoffs, quantities, unit rates, leveling math, and tie-outs to the source proposal. Keep exact cents, show the arithmetic, and never treat a blank as $0 or count bundled dollars twice.",
  },
  {
    id: "dean",
    label: "Project Manager",
    greetingName: "Project Manager",
    initials: "PM",
    lens: "You are supporting a Project Manager. Prioritize scope, RFIs, submittals, schedule, drawing revisions, and the buyout handoff. Pricing and the carry are outside this role: if asked, say the Preconstruction Director or Estimator has that information.",
  },
  {
    id: "office",
    label: "Project Coordinator",
    greetingName: "Coordinator",
    initials: "PC",
    lens: "You are supporting a Project Coordinator. Prioritize bid invitations, the bidder roster, follow-ups on missing proposals, addenda distribution, and document control. Pricing is outside this role: if asked, say the Preconstruction Director or Estimator has that information.",
  },
  {
    id: "board",
    label: "Development",
    greetingName: "Development team",
    initials: "DV",
    lens: "You are supporting the Development team. Stay at the decision level: total cost against budget, the main cost drivers, value engineering options and what they give up, open risks, and decisions needed. Avoid line-item detail unless asked, and never present an unleveled number as final.",
  },
];
