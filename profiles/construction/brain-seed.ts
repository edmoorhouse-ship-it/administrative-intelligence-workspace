import type { Fact } from "../../lib/brain";

const seeded = "2026-10-16T08:00:00.000Z";
const director = { name: "Preconstruction Director", role: "principal" } as const;
const estimator = { name: "Estimator", role: "finance" } as const;
const pm = { name: "Project Manager", role: "dean" } as const;

/** Starting facts for the preconstruction team. All sample: the team's working rules, not company policy. */
export const constructionBrainSeed: Fact[] = [
  {
    id: "seed-three-bids",
    text: "We want three qualified bids per trade before leveling. Fewer than three goes to the Director with a reason (sample practice).",
    area: "general",
    source: "sample",
    status: "approved",
    author: director,
    createdAt: seeded,
  },
  {
    id: "seed-bc-manual",
    text: "BuildingConnected entry is manual. The workspace produces a plug table marked READY TO PLUG; only the person who typed it in marks it ENTERED.",
    area: "general",
    source: "sample",
    status: "approved",
    author: director,
    createdAt: seeded,
  },
  {
    id: "seed-drafts",
    text: "Bidder emails, RFIs, and Development summaries are drafts. The person sends them from Outlook.",
    area: "general",
    source: "sample",
    status: "approved",
    author: director,
    createdAt: seeded,
  },
  {
    id: "seed-tax",
    text: "Every leveling confirms whether each bid includes Florida sales tax and the county surtax; tax-exclusive bids get a tax plug, not a guess (sample practice).",
    area: "finance",
    source: "sample",
    status: "approved",
    author: estimator,
    createdAt: seeded,
  },
  {
    id: "seed-voluntary-credits",
    text: "Voluntary credits a bidder offers stay memo-only until Development accepts them; they never reduce the carry on their own.",
    area: "finance",
    source: "sample",
    status: "approved",
    author: estimator,
    createdAt: seeded,
  },
  {
    id: "seed-rfi-route",
    text: "RFIs go to the design team through the Project Manager; estimators send questions to the PM, not to the architect directly (sample practice).",
    area: "students",
    source: "sample",
    status: "approved",
    author: pm,
    createdAt: seeded,
  },
  {
    id: "seed-bonding",
    text: "Subcontracts over $1,000,000 need a bond or subcontractor default insurance enrollment (sample policy).",
    area: "supports",
    source: "sample",
    status: "approved",
    author: director,
    createdAt: seeded,
  },
  {
    id: "seed-drywall-date",
    text: "Saltmarsh Commons drywall bids are due Thursday, Oct 22 (moved by Addendum 3).",
    area: "general",
    source: "agent",
    origin: "Outlook",
    status: "proposed",
    author: { name: "Mac", role: "agent", via: "Project Coordinator" },
    createdAt: seeded,
  },
];
