import type { PromptStarter } from "../../lib/starters";

export const macsStarters: PromptStarter[] = [
  {
    // Format adapted from the small-business plugin's monday-brief chain: one merged document, one thing.
    id: "monday-brief",
    chip: "Monday brief",
    title: "Monday Brief: The Week Ahead at MACS",
    subtitle: "Snapshot, the week's shape, commitments due, and the one thing",
    icon: "sunrise",
    prompt:
      "Give me my Monday brief for this week as one document I can read in under two minutes. (1) Snapshot: budget pace, cash and days on hand, enrollment, and the watch-list items, each number with its comparison. (2) The week ahead: the shape of the week from the school calendar and upcoming events — field trips or events that pull staff, days already lost to holidays or early release, and where the real work blocks are. Describe the shape; don't list every event. (3) Commitments due: deadlines this week or already overdue (IEP reviews, FTE submission, board notice, sponsor deliverables, open P1 facilities tickets), each with an owner. (4) Close with the one thing: pick a single priority and say why — the deadline, the dollar amount, or the person waiting. No list of five priorities. Name any missing sources once, in one line at the bottom.",
  },
  {
    id: "board-summary",
    chip: "Board summary",
    title: "Generate ACPS Board Compliance & Financial Summary",
    subtitle: "Q1 budget-to-actual, Sunshine Law status, sponsor deliverables",
    icon: "landmark",
    prompt:
      "Prepare a board-ready compliance and financial summary for the November 10 Board of Directors meeting. Include: (1) Q1 budget-to-actual by line, flagging any line more than 10 percentage points ahead of the 25% pace; (2) cash on hand and days of cash; (3) Sunshine Law status — meeting notices, minutes, governance training, and open public records requests; (4) ACPS sponsor deliverables and readiness for the November 18 site visit; (5) a numbered list of items that need a board vote. Use tables where they help and cite the dataset sections you used.",
  },
  {
    id: "fast-gaps",
    chip: "FAST PM1 gaps",
    title: "Analyze FAST PM1 Math & Reading Growth Gaps",
    subtitle: "Cohort changes since PM3, subgroup gaps, i-Ready cross-check",
    icon: "chart",
    prompt:
      "Analyze FAST PM1 results for reading and math. For each grade, compare PM1 to the same cohort's prior-year PM3 and to the ACPS average, and rank the largest declines. Call out subgroup gaps (students with disabilities, free/reduced lunch) and cross-check against i-Ready Diagnostic 1. Then recommend specific, schedulable interventions using our programs (UFLI Foundations, HMH Into Reading, enVision) to act on before the PM2 window opens. Show the key numbers in a table and cite the dataset sections you used.",
  },
  {
    id: "fte-audit",
    chip: "FTE Survey 2 audit",
    title: "FTE Survey 2 Audit Readiness & ESE Roster Check",
    subtitle: "Membership exceptions, matrix of services, class size, certification",
    icon: "clipboard",
    prompt:
      "Run an audit-readiness check for FTE Survey 2. Reconcile membership and attendance-window exceptions, ESE matrix of services documentation, ELL plans, class-size compliance, and teacher certification / out-of-field reporting. Estimate the net revenue impact of each unresolved exception, list IEP reviews that are overdue or due before the district submission deadline, and finish with a punch list (owner, due date, action) sorted by urgency. Cite the dataset sections you used.",
  },
  {
    id: "newsletter",
    chip: "Weekly newsletter",
    title: "Draft ParentSquare Weekly Newsletter from Faculty Notes",
    subtitle: "Family-friendly, grouped by grade band, key dates included",
    icon: "newspaper",
    prompt:
      "Draft this Friday's ParentSquare weekly newsletter from the faculty notes. Make it warm, concise, and family-friendly; group items by grade band (VPK/K-2, 3-5, Middle School, Specials, Schoolwide); include key upcoming dates, the Wednesday early-dismissal reminder, and morning arrival info. Keep it under 350 words. Leave out anything a teacher marked not to announce, and list separately any item that needs staff confirmation before it goes out.",
  },
];
