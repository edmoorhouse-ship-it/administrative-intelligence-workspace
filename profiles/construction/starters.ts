import type { PromptStarter } from "../../lib/starters";

/** Quick starts for the preconstruction team. Every email is a draft; the user sends it. */
export const constructionStarters: PromptStarter[] = [
  {
    id: "week-ahead",
    chip: "Week ahead",
    title: "Preconstruction Week Ahead",
    subtitle: "Bids due, coverage gaps, open RFIs, decisions, and the one thing",
    icon: "sunrise",
    prompt:
      "Give me the week ahead across the portfolio as one page I can read in two minutes. (1) Bids due in the next seven days, with coverage against our three-bid target and who to chase first. (2) Open RFIs and addenda that could change pricing. (3) Decisions needed this week and from whom. (4) Where each project stands against the Development budget, if I can see pricing. Close with the one thing to do first and why. Name anything missing from the data once, at the bottom.",
  },
  {
    id: "bid-reminder",
    chip: "Bid reminder",
    title: "Draft a Bid Due Reminder to Subcontractors",
    subtitle: "Two sentences, due date, how to submit",
    icon: "mail",
    prompt:
      "Draft a short reminder to subcontractors that bids are due soon. Two sentences: the package, the due date and time, and that proposals go through BuildingConnected or by reply email. Leave [brackets] for the project, package, and date I haven't given you. It is a draft for me to send; don't say it was sent.",
  },
  {
    id: "clarification",
    chip: "Clarification email",
    title: "Draft a Bidder-Specific Clarification Email",
    subtitle: "Only this bidder's gaps: what's included, what changes the price",
    icon: "help",
    prompt:
      "Help me draft a clarification email to one bidder. I'll paste their proposal or list their gaps. Ask only about that bidder's actual gaps (scope not stated, exclusions that need an add, alternates without a price, math that doesn't tie), never about scope they already included. For each, ask what is included and what it changes in the price, then ask for a revised total. Short and direct. It is a draft for me to send.",
  },
  {
    id: "rfi",
    chip: "Architect RFI",
    title: "Draft an RFI to the Design Team",
    subtitle: "Question, drawing reference, suggested answer, cost impact",
    icon: "file",
    prompt:
      "Draft an RFI to the architect or engineer. I'll describe the conflict or missing information. Format: subject; the question in one or two sentences; drawing and spec references; a suggested resolution; and whether it affects cost or schedule. Leave [brackets] for anything I haven't given you.",
  },
  {
    id: "spread",
    chip: "Explain a price spread",
    title: "Explain the Spread Between Bidders",
    subtitle: "Missing scope, bundles, quantities, terms; not a ranking",
    icon: "scale",
    prompt:
      "Explain why the bids for a trade are spread apart. I'll paste the bidder totals and what each includes or excludes. Sort the reasons into missing scope, bundled scope, quantities, assemblies, exclusions, allowances, alternates, and commercial terms. Don't call any bid complete or lowest while material scope is still unpriced; say what clarification would close each gap. For a full leveling, point me to the Bid leveling page.",
  },
  {
    id: "development-summary",
    chip: "Development summary",
    title: "Write a One-Page Cost Summary for Development",
    subtitle: "Bottom line, drivers, VE options, risks, decisions needed",
    icon: "landmark",
    prompt:
      "Write a one-page cost summary for Development from the numbers I give you. Order: the bottom line against budget; the three to five biggest cost drivers; value engineering options with what each saves and gives up; open risks and allowances; and the decisions needed, each with a date. Plain language, a table where it helps, and mark anything not yet leveled as preliminary.",
  },
];
