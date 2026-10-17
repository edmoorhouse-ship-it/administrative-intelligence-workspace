/**
 * Preconstruction portfolio — SAMPLE DATA ONLY.
 *
 * Four invented Florida projects at different stages, so every part of the workflow has something to
 * show: a garden-style job at DD, a wrap at Permit-set bidding, a podium at GMP buyout, and an
 * industrial building at SD. Every project, bidder, number, and date is made up. No employer, project,
 * vendor, or person in this file is real.
 *
 * Money is whole dollars (estimate level; the leveling engine works in cents). Totals, markups,
 * variances, $/unit, coverage, and days-until are computed below, so editing a line keeps everything
 * consistent.
 */

import type { Area } from "../access.ts";

export const PORTFOLIO_AS_OF = "2026-10-16";

export const PORTFOLIO_NOTICE =
  "Sample data: invented projects, bidders, and figures for demonstration only. Not company records. Verify against the estimate, BuildingConnected, and the drawings before use.";

const DAY = 86_400_000;
export const daysUntil = (iso: string, from = PORTFOLIO_AS_OF) => Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / DAY);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

// ---- Projects ----------------------------------------------------------------------------

export type Stage = "SD" | "DD" | "Permit" | "GMP";
export type ProjectId = "P-101" | "P-102" | "P-103" | "P-104";

interface ProjectInfo {
  id: ProjectId;
  name: string;
  product: string;
  construction: string;
  units: number | null;
  gsf: number;
  location: string;
  stage: Stage;
  stageGoal: string;
  currentSet: string;
  nextMilestone: { what: string; date: string };
}

const projectInfo: ProjectInfo[] = [
  {
    id: "P-101",
    name: "Heron Flats",
    product: "Garden-style walk-ups: eleven 3-story residential buildings, clubhouse, pool, surface parking",
    construction: "Type V-B wood frame on slab-on-grade",
    units: 264,
    gsf: 296_000,
    location: "Central Florida (sample)",
    stage: "DD",
    stageGoal: "DD estimate against the pro forma; budget pricing from framing, roofing, and MEP",
    currentSet: "DD set 2026-10-02",
    nextMilestone: { what: "DD estimate to Development", date: "2026-11-06" },
  },
  {
    id: "P-102",
    name: "Saltmarsh Commons",
    product: "Wrap: 4-story wood frame wrapped around a 5-level precast parking garage",
    construction: "Type III-A wood over Type I-A precast garage",
    units: 312,
    gsf: 365_000,
    location: "Florida Gulf Coast (sample)",
    stage: "Permit",
    stageGoal: "Permit-set bids; hard bid leveling for the permit estimate",
    currentSet: "Permit set 2026-09-18 with Addenda 1-3",
    nextMilestone: { what: "Most trade bids due", date: "2026-10-21" },
  },
  {
    id: "P-103",
    name: "Banyan Yard",
    product: "Podium: 5 stories of wood over a 2-level concrete podium with ground-floor retail",
    construction: "Type III-A wood over Type I-A cast-in-place podium",
    units: 236,
    gsf: 312_000,
    location: "South Florida (sample)",
    stage: "GMP",
    stageGoal: "Buyout leveling, VE decisions, and the GMP package",
    currentSet: "GMP set 2026-08-28 with ASI-04 (2026-10-09)",
    nextMilestone: { what: "GMP to Development", date: "2026-11-13" },
  },
  {
    id: "P-104",
    name: "Gateway Logistics Center",
    product: "Industrial: single-story cross-dock warehouse with 9,000 SF of office",
    construction: "Tilt-wall concrete, steel joists, TPO roof",
    units: null,
    gsf: 412_000,
    location: "Central Florida (sample)",
    stage: "SD",
    stageGoal: "Conceptual estimate from the SD narrative and $/SF benchmarks",
    currentSet: "SD narrative 2026-10-09",
    nextMilestone: { what: "Conceptual estimate to Development", date: "2026-11-06" },
  },
];

// ---- Estimates (pricing & budget) ---------------------------------------------------------

type Basis = "Leveled bid" | "Vendor bid (not leveled)" | "Budget pricing" | "Estimate" | "Allowance" | "Plug (single bid)";
interface EstimateLine {
  division: string;
  amount: number;
  basis: Basis;
  note?: string;
}

/** Contingency drops as the drawings firm up. Insurance, SDI/bond, and fee are the same sample rates on every job. */
const CONTINGENCY: Record<Stage, number> = { SD: 0.08, DD: 0.05, Permit: 0.04, GMP: 0.03 };
const INSURANCE = 0.016;
const SDI = 0.012;
const FEE = 0.04;

const budgets: Record<ProjectId, number> = {
  "P-101": 46_200_000,
  "P-102": 74_900_000,
  "P-103": 69_500_000,
  "P-104": 33_500_000,
};

const lines: Record<ProjectId, EstimateLine[]> = {
  "P-101": [
    { division: "01 General conditions & requirements", amount: 2_980_000, basis: "Estimate" },
    { division: "03 Concrete (slabs on grade)", amount: 3_640_000, basis: "Estimate" },
    { division: "04 Masonry", amount: 380_000, basis: "Estimate" },
    { division: "05 Metals", amount: 520_000, basis: "Estimate" },
    { division: "06 Wood framing & carpentry", amount: 6_870_000, basis: "Budget pricing", note: "Two framers priced the DD set; carried the higher until wall types settle." },
    { division: "07 Roofing, insulation, waterproofing", amount: 2_310_000, basis: "Budget pricing" },
    { division: "08 Windows & doors", amount: 2_460_000, basis: "Estimate", note: "Impact windows not required on this site per the DD narrative; confirm wind-borne debris region." },
    { division: "09 Finishes", amount: 6_720_000, basis: "Estimate" },
    { division: "10-12 Specialties, appliances, cabinets", amount: 3_480_000, basis: "Estimate" },
    { division: "21-23 Fire protection, plumbing, HVAC", amount: 6_960_000, basis: "Budget pricing" },
    { division: "26-28 Electrical & low voltage", amount: 3_720_000, basis: "Budget pricing" },
    { division: "31-33 Sitework & utilities", amount: 4_180_000, basis: "Allowance", note: "Off-site turn lane and lift station carried as a $650,000 allowance inside this line." },
  ],
  "P-102": [
    { division: "01 General conditions & requirements", amount: 4_410_000, basis: "Estimate" },
    { division: "03 Concrete (cast-in-place)", amount: 6_120_000, basis: "Vendor bid (not leveled)", note: "Two of five bids in; bids due 10/21." },
    { division: "03 Precast parking garage", amount: 5_480_800, basis: "Plug (single bid)", note: "Only one precaster has bid. Carried at that bid plus 4% until coverage improves." },
    { division: "04 Masonry", amount: 720_000, basis: "Estimate" },
    { division: "05 Metals", amount: 1_150_000, basis: "Estimate" },
    { division: "06 Wood framing & carpentry", amount: 8_940_000, basis: "Vendor bid (not leveled)" },
    { division: "07 Roofing, insulation, waterproofing", amount: 2_640_000, basis: "Vendor bid (not leveled)" },
    { division: "08 Windows & doors", amount: 3_380_000, basis: "Estimate", note: "Impact-rated; design pressures for corner zones are open (RFI-102-014)." },
    { division: "09 Finishes", amount: 9_410_000, basis: "Estimate", note: "Drywall bids due 10/22 per Addendum 3." },
    { division: "10-12 Specialties, appliances, cabinets", amount: 4_560_000, basis: "Estimate" },
    { division: "14 Elevators", amount: 1_180_000, basis: "Estimate" },
    { division: "21-23 Fire protection, plumbing, HVAC", amount: 10_930_000, basis: "Estimate" },
    { division: "26-28 Electrical & low voltage", amount: 6_020_000, basis: "Estimate" },
    { division: "31-33 Sitework & utilities", amount: 3_860_000, basis: "Estimate" },
  ],
  "P-103": [
    { division: "01 General conditions & requirements", amount: 4_620_000, basis: "Estimate" },
    { division: "03 Concrete (podium)", amount: 8_940_000, basis: "Leveled bid", note: "Leveled; carry recommendation waiting on the Director." },
    { division: "04 Masonry", amount: 610_000, basis: "Leveled bid" },
    { division: "05 Metals", amount: 1_480_000, basis: "Leveled bid" },
    { division: "06 Wood framing & carpentry", amount: 7_260_000, basis: "Leveled bid" },
    { division: "07 Roofing, insulation, waterproofing", amount: 2_870_000, basis: "Leveled bid", note: "Includes the podium deck waterproofing upgrade (see VE-103-02)." },
    { division: "08 Windows, storefront, doors", amount: 3_410_000, basis: "Leveled bid" },
    { division: "09 Finishes", amount: 9_860_000, basis: "Vendor bid (not leveled)", note: "Drywall is in leveling with clarifications out to all three bidders." },
    { division: "10-12 Specialties, appliances, cabinets", amount: 4_190_000, basis: "Leveled bid" },
    { division: "14 Elevators", amount: 1_240_000, basis: "Leveled bid" },
    { division: "21-23 Fire protection, plumbing, HVAC", amount: 9_720_000, basis: "Leveled bid" },
    { division: "26-28 Electrical & low voltage", amount: 5_930_000, basis: "Leveled bid", note: "Switchgear quoted at 52 weeks; see risk R-03." },
    { division: "31-33 Sitework & utilities", amount: 3_150_000, basis: "Leveled bid" },
  ],
  "P-104": [
    { division: "01 General conditions & requirements", amount: 1_420_000, basis: "Estimate" },
    { division: "03 Concrete (tilt-wall panels, slab, foundations)", amount: 9_890_000, basis: "Estimate", note: "412,000 SF slab at 7 in. with ~2,080 LF of 38 ft panels; benchmark $/SF." },
    { division: "05 Structural steel, joists, deck", amount: 6_180_000, basis: "Estimate" },
    { division: "07 TPO roof & insulation", amount: 3_090_000, basis: "Estimate" },
    { division: "08 Dock doors, levelers, storefront", amount: 1_650_000, basis: "Estimate", note: "68 dock positions per the SD narrative." },
    { division: "09 Office finishes (9,000 SF)", amount: 1_310_000, basis: "Estimate" },
    { division: "21 Fire protection (ESFR)", amount: 1_690_000, basis: "Estimate" },
    { division: "22-23 Plumbing & HVAC", amount: 820_000, basis: "Estimate" },
    { division: "26 Electrical", amount: 2_680_000, basis: "Estimate" },
    { division: "31-33 Sitework, paving, stormwater", amount: 2_890_000, basis: "Allowance", note: "Geotech not yet available; carried at benchmark." },
  ],
};

function priceProject(p: ProjectInfo) {
  const ls = lines[p.id];
  const directCost = sum(ls.map((l) => l.amount));
  const contingency = Math.round(directCost * CONTINGENCY[p.stage]);
  const insurance = Math.round(directCost * INSURANCE);
  const sdiAndBond = Math.round(directCost * SDI);
  const fee = Math.round((directCost + contingency + insurance + sdiAndBond) * FEE);
  const total = directCost + contingency + insurance + sdiAndBond + fee;
  const budget = budgets[p.id];
  return {
    project: p.id,
    name: p.name,
    stage: p.stage,
    lines: ls,
    directCost,
    markups: {
      contingency: { rate: `${CONTINGENCY[p.stage] * 100}% of direct cost`, amount: contingency },
      insuranceGlAndBuildersRisk: { rate: `${INSURANCE * 100}% of direct cost`, amount: insurance },
      sdiAndBonds: { rate: `${SDI * 100}% of direct cost`, amount: sdiAndBond },
      fee: { rate: `${FEE * 100}% of cost plus markups`, amount: fee },
    },
    total,
    developmentBudget: budget,
    overUnderBudget: total - budget,
    overUnderPct: pct(total - budget, budget),
    perUnit: p.units ? Math.round(total / p.units) : null,
    perGsf: Math.round((total / p.gsf) * 100) / 100,
    basisMix: Object.fromEntries(
      [...new Set(ls.map((l) => l.basis))].map((b) => [b, sum(ls.filter((l) => l.basis === b).map((l) => l.amount))]),
    ),
  };
}

// ---- Bid packages and coverage ------------------------------------------------------------

export type BidderStatus = "Submitted" | "Bidding" | "Declined" | "No response";
interface Bidder {
  name: string;
  status: BidderStatus;
  lastContact: string;
  /** Base bid in whole dollars; pricing & budget only. */
  base?: number;
  note?: string;
}
interface Package {
  id: string;
  project: ProjectId;
  trade: string;
  bidDue: string;
  leveling: "Not started" | "Waiting on bids" | "In leveling" | "Clarifications out" | "Leveled" | "Budget pricing only";
  bidders: Bidder[];
  note?: string;
}

/** Target qualified bids per trade before leveling (sample policy). */
export const TARGET_BIDS = 3;

const packages: Package[] = [
  {
    id: "P-101 06-1000",
    project: "P-101",
    trade: "Wood framing (DD budget pricing)",
    bidDue: "2026-10-30",
    leveling: "Budget pricing only",
    bidders: [
      { name: "Live Oak Framing (sample)", status: "Submitted", lastContact: "2026-10-12", base: 6_540_000 },
      { name: "Gulfline Builders (sample)", status: "Submitted", lastContact: "2026-10-13", base: 6_870_000 },
      { name: "Tri-County Carpentry (sample)", status: "Bidding", lastContact: "2026-10-09" },
    ],
  },
  {
    id: "P-101 23-0000",
    project: "P-101",
    trade: "Plumbing & HVAC (DD budget pricing)",
    bidDue: "2026-10-30",
    leveling: "Budget pricing only",
    bidders: [
      { name: "Bayshore Mechanical (sample)", status: "Bidding", lastContact: "2026-10-14" },
      { name: "Sunbelt Plumbing & Air (sample)", status: "No response", lastContact: "2026-10-05" },
    ],
  },
  {
    id: "P-102 03-3000",
    project: "P-102",
    trade: "Cast-in-place concrete",
    bidDue: "2026-10-21",
    leveling: "Waiting on bids",
    bidders: [
      { name: "Coquina Concrete (sample)", status: "Submitted", lastContact: "2026-10-15", base: 5_980_000 },
      { name: "Keystone Flatwork (sample)", status: "Submitted", lastContact: "2026-10-14", base: 6_260_000, note: "Excludes concrete pumping; the pump add is not stated." },
      { name: "Riverbend Structures (sample)", status: "Bidding", lastContact: "2026-10-13" },
      { name: "Atlas Pour (sample)", status: "Bidding", lastContact: "2026-10-10" },
      { name: "Shoreline Concrete (sample)", status: "Declined", lastContact: "2026-10-06", note: "Backlog." },
    ],
  },
  {
    id: "P-102 03-4000",
    project: "P-102",
    trade: "Precast parking garage",
    bidDue: "2026-10-21",
    leveling: "Waiting on bids",
    bidders: [
      { name: "Meridian Precast (sample)", status: "Submitted", lastContact: "2026-10-12", base: 5_270_000, note: "Valid 30 days; steel escalation clause." },
      { name: "Southern Span Precast (sample)", status: "No response", lastContact: "2026-10-01" },
      { name: "Peninsula Structural (sample)", status: "No response", lastContact: "2026-10-01" },
    ],
    note: "Single-bid risk. A cast-in-place post-tensioned alternate is being priced (VE-102-01).",
  },
  {
    id: "P-102 06-1000",
    project: "P-102",
    trade: "Wood framing",
    bidDue: "2026-10-21",
    leveling: "Waiting on bids",
    bidders: [
      { name: "Live Oak Framing (sample)", status: "Submitted", lastContact: "2026-10-14", base: 8_720_000 },
      { name: "Gulfline Builders (sample)", status: "Submitted", lastContact: "2026-10-15", base: 9_150_000 },
      { name: "Tri-County Carpentry (sample)", status: "Submitted", lastContact: "2026-10-15", base: 8_940_000, note: "Includes trusses; others exclude." },
      { name: "Pinecrest Framing (sample)", status: "Bidding", lastContact: "2026-10-12" },
    ],
  },
  {
    id: "P-102 07-5000",
    project: "P-102",
    trade: "Roofing",
    bidDue: "2026-10-21",
    leveling: "Waiting on bids",
    bidders: [
      { name: "Tidewater Roofing (sample)", status: "Submitted", lastContact: "2026-10-13", base: 1_460_000 },
      { name: "Crestline Roof Systems (sample)", status: "Submitted", lastContact: "2026-10-15", base: 1_520_000 },
      { name: "Harbor Roofing (sample)", status: "Bidding", lastContact: "2026-10-09" },
      { name: "Solano Roofing (sample)", status: "Declined", lastContact: "2026-10-07" },
    ],
  },
  {
    id: "P-102 08-5000",
    project: "P-102",
    trade: "Impact windows",
    bidDue: "2026-10-21",
    leveling: "Waiting on bids",
    bidders: [
      { name: "Clearview Glazing (sample)", status: "Submitted", lastContact: "2026-10-14", base: 2_910_000, note: "Priced at the design pressures shown; corner zones assumed same as field." },
      { name: "Stormguard Windows (sample)", status: "Bidding", lastContact: "2026-10-13" },
      { name: "Coastal Fenestration (sample)", status: "Bidding", lastContact: "2026-10-12" },
      { name: "Bay Glass & Glazing (sample)", status: "Bidding", lastContact: "2026-10-08" },
    ],
  },
  {
    id: "P-102 09-2100",
    project: "P-102",
    trade: "Drywall",
    bidDue: "2026-10-22",
    leveling: "Waiting on bids",
    bidders: [
      { name: "Summit Drywall (sample)", status: "Bidding", lastContact: "2026-10-15" },
      { name: "Coastal Interiors (sample)", status: "Bidding", lastContact: "2026-10-14" },
      { name: "Bayline Walls (sample)", status: "Bidding", lastContact: "2026-10-12" },
      { name: "Ridgeway Interiors (sample)", status: "Bidding", lastContact: "2026-10-09" },
      { name: "Palmline Drywall (sample)", status: "No response", lastContact: "2026-10-02" },
    ],
    note: "Due date moved from 10/21 to 10/22 by Addendum 3 (revised wall types).",
  },
  {
    id: "P-102 26-0000",
    project: "P-102",
    trade: "Electrical",
    bidDue: "2026-10-21",
    leveling: "Waiting on bids",
    bidders: [
      { name: "Brightline Electric (sample)", status: "Bidding", lastContact: "2026-10-14" },
      { name: "Volt South (sample)", status: "Bidding", lastContact: "2026-10-13" },
      { name: "Gulf Current Electric (sample)", status: "No response", lastContact: "2026-10-03" },
    ],
  },
  {
    id: "P-103 03-3000",
    project: "P-103",
    trade: "Podium concrete",
    bidDue: "2026-09-30",
    leveling: "Leveled",
    bidders: [
      { name: "Coquina Concrete (sample)", status: "Submitted", lastContact: "2026-10-08", base: 8_940_000, note: "Normalized low; complete scope." },
      { name: "Riverbend Structures (sample)", status: "Submitted", lastContact: "2026-10-07", base: 8_610_000, note: "Headline low, but excludes the post-tensioning; normalized $9.12M." },
      { name: "Atlas Pour (sample)", status: "Submitted", lastContact: "2026-10-06", base: 9_380_000 },
    ],
    note: "Carry recommendation drafted; the carry is the Director's call.",
  },
  {
    id: "P-103 09-2100",
    project: "P-103",
    trade: "Drywall",
    bidDue: "2026-10-09",
    leveling: "Clarifications out",
    bidders: [
      { name: "Summit Drywall (sample)", status: "Submitted", lastContact: "2026-10-14", note: "Revision 2 received; see the Bid leveling sample." },
      { name: "Coastal Interiors (sample)", status: "Submitted", lastContact: "2026-10-13", note: "Email proposal with 12 open clarifications." },
      { name: "Bayline Walls (sample)", status: "Submitted", lastContact: "2026-10-12", note: "Lump sum; silent on several scope items, not eligible to rank yet." },
    ],
    note: "The three sample proposals on the Bid leveling page are this package. Amounts live there, from the proposals.",
  },
  {
    id: "P-103 14-2000",
    project: "P-103",
    trade: "Elevators",
    bidDue: "2026-09-25",
    leveling: "Leveled",
    bidders: [
      { name: "Vertical Lift Co. (sample)", status: "Submitted", lastContact: "2026-10-02", base: 1_240_000, note: "38-week lead time from approved submittals." },
      { name: "Summit Elevator (sample)", status: "Submitted", lastContact: "2026-10-01", base: 1_310_000, note: "34-week lead time." },
    ],
    note: "Two bids only; only two manufacturers serve this area for this product (sample).",
  },
  {
    id: "P-103 26-0000",
    project: "P-103",
    trade: "Electrical",
    bidDue: "2026-09-30",
    leveling: "Leveled",
    bidders: [
      { name: "Brightline Electric (sample)", status: "Submitted", lastContact: "2026-10-09", base: 5_930_000, note: "Switchgear 52 weeks." },
      { name: "Volt South (sample)", status: "Submitted", lastContact: "2026-10-08", base: 6_140_000, note: "Switchgear 44 weeks with an alternate manufacturer." },
      { name: "Gulf Current Electric (sample)", status: "Submitted", lastContact: "2026-10-07", base: 6_380_000 },
    ],
  },
];

function coverage(p: Package) {
  const count = (s: BidderStatus) => p.bidders.filter((b) => b.status === s).length;
  const submitted = count("Submitted");
  const stillBidding = count("Bidding");
  const closed = daysUntil(p.bidDue) < 0;
  const coverageStatus =
    submitted >= TARGET_BIDS ? "COVERED" : closed ? `CLOSED WITH ${submitted} BID${submitted === 1 ? "" : "S"}` : submitted + stillBidding >= TARGET_BIDS ? "WATCH" : "AT RISK";
  return {
    package: p.id,
    project: p.project,
    trade: p.trade,
    bidDue: p.bidDue,
    daysUntilDue: daysUntil(p.bidDue),
    leveling: p.leveling,
    invited: p.bidders.length,
    submitted,
    stillBidding,
    declined: count("Declined"),
    noResponse: count("No response"),
    coverageStatus,
    bidders: p.bidders.map(({ name, status, lastContact }) => ({ name, status, lastContact, daysSinceContact: -daysUntil(lastContact) })),
    ...(p.note ? { note: p.note } : {}),
  };
}

function bidResults(p: Package) {
  const priced = p.bidders.filter((b) => b.base !== undefined);
  return {
    package: p.id,
    trade: p.trade,
    leveling: p.leveling,
    bids: p.bidders.filter((b) => b.status === "Submitted").map(({ name, base, note }) => ({ bidder: name, base: base ?? "See Bid leveling page", ...(note ? { note } : {}) })),
    ...(priced.length >= 2
      ? {
          headlineLow: Math.min(...priced.map((b) => b.base!)),
          headlineHigh: Math.max(...priced.map((b) => b.base!)),
          headlineSpread: Math.max(...priced.map((b) => b.base!)) - Math.min(...priced.map((b) => b.base!)),
          caution: "Headline only: raw bases, not leveled. Never call the low bid the carry.",
        }
      : {}),
  };
}

// ---- Addenda, drawings, RFIs (project records) --------------------------------------------

const addenda = [
  { project: "P-102", number: "Addendum 1", issued: "2026-09-30", summary: "Revised unit plan A2; door hardware sets." },
  { project: "P-102", number: "Addendum 2", issued: "2026-10-07", summary: "Pre-bid meeting minutes; garage lighting changes." },
  { project: "P-102", number: "Addendum 3", issued: "2026-10-14", summary: "Revised wall types (UL assemblies at corridors); drywall bids moved to 10/22.", bidderAcknowledgement: "7 of 21 active bidders have acknowledged." },
];

const drawingLog = [
  { project: "P-101", set: "DD set", date: "2026-10-02", note: "Architectural, structural narrative, MEP narrative." },
  { project: "P-102", set: "Permit set", date: "2026-09-18" },
  { project: "P-102", set: "Addendum 3 sheets", date: "2026-10-14", note: "A-501 to A-505 wall types." },
  { project: "P-103", set: "GMP set", date: "2026-08-28" },
  { project: "P-103", set: "ASI-04", date: "2026-10-09", note: "Retail storefront revised; not yet priced." },
  { project: "P-104", set: "SD narrative", date: "2026-10-09", note: "No drawings yet; geotech pending." },
];

const rfis = [
  { id: "RFI-102-014", project: "P-102", subject: "Window design pressures for corner zones not shown", to: "Architect", sent: "2026-10-08", due: "2026-10-15", status: "Open", costImpact: "Likely", note: "Window bids are pricing field-zone pressures." },
  { id: "RFI-102-015", project: "P-102", subject: "Precast garage to wood-frame transfer connections", to: "Structural engineer", sent: "2026-10-12", due: "2026-10-19", status: "Open", costImpact: "Possible" },
  { id: "RFI-103-031", project: "P-103", subject: "Elevator shaft wall rating", to: "Architect", sent: "2026-10-01", due: "2026-10-08", status: "Answered 2026-10-14", costImpact: "None", note: "2-hour shaft wall confirmed; matches drywall form." },
  { id: "RFI-103-032", project: "P-103", subject: "Retail storefront: Florida product approval for revised system (ASI-04)", to: "Architect", sent: "2026-10-12", due: "2026-10-20", status: "Open", costImpact: "Possible" },
  { id: "RFI-101-006", project: "P-101", subject: "Clubhouse pool equipment: owner-furnished or GC?", to: "Development", sent: "2026-10-09", due: "2026-10-16", status: "Open", costImpact: "Likely", note: "Not carried in the DD estimate." },
].map((r) => ({ ...r, daysUntilDue: r.status === "Open" ? daysUntil(r.due) : null }));

// ---- VE and decisions (pricing & budget) ---------------------------------------------------

const veLog = [
  { id: "VE-101-01", project: "P-101", item: "Third-floor plate height 9'-0\" to 8'-8\"", savings: 312_000, tradeoff: "Lower ceilings on the top floor; marketing to confirm.", status: "Pending Development", decideBy: "2026-11-04" },
  { id: "VE-101-02", project: "P-101", item: "Clubhouse roof: standing-seam metal to architectural shingle", savings: 48_000, tradeoff: "Shorter roof life; look changes.", status: "Accepted", decideBy: null },
  { id: "VE-102-01", project: "P-102", item: "Precast garage to cast-in-place post-tensioned", savings: null, tradeoff: "Longer garage schedule; may improve bid coverage.", status: "Pricing requested", decideBy: "2026-10-30" },
  { id: "VE-103-01", project: "P-103", item: "Residential corridors: LVT to carpet tile", savings: 186_400, tradeoff: "Lower durability and more replacement over time.", status: "Pending Development", decideBy: "2026-10-28" },
  { id: "VE-103-02", project: "P-103", item: "Podium deck waterproofing: hot rubberized to fluid-applied", savings: 142_000, tradeoff: "Warranty drops from 20 to 10 years; architect review needed.", status: "Proposed", decideBy: "2026-10-28" },
  { id: "VE-103-03", project: "P-103", item: "Drywall: Level 3 finish in closets (voluntary bidder credit)", savings: 38_500, tradeoff: "Offered by one drywall bidder only. Memo only until accepted; never netted into the carry.", status: "Memo only", decideBy: null },
];

const veSummary = (Object.keys(budgets) as ProjectId[]).map((project) => {
  const items = veLog.filter((v) => v.project === project);
  return {
    project,
    accepted: sum(items.filter((v) => v.status === "Accepted").map((v) => v.savings ?? 0)),
    pendingDevelopment: sum(items.filter((v) => v.status === "Pending Development").map((v) => v.savings ?? 0)),
    notYetPriced: items.filter((v) => v.savings === null).map((v) => v.id),
  };
});

const decisionsNeeded = [
  { project: "P-103", decision: "Concrete carry: Coquina (normalized low) or Riverbend (headline low, excludes PT)", owner: "Preconstruction Director", by: "2026-10-23" },
  { project: "P-103", decision: "VE-103-01 corridor flooring", owner: "Development", by: "2026-10-28" },
  { project: "P-101", decision: "VE-101-01 plate height", owner: "Development", by: "2026-11-04" },
  { project: "P-101", decision: "Pool equipment: owner-furnished or GC (RFI-101-006)", owner: "Development", by: "2026-10-23" },
];

// ---- Contracts & risk ----------------------------------------------------------------------

const risks = [
  { id: "R-01", project: "P-102", risk: "Single precast bid; escalation clause and 30-day validity", exposure: "Up to 4% carried as a plug; validity lapses 2026-11-11", owner: "Preconstruction Director", mitigation: "Chase the two silent precasters; price the CIP alternate (VE-102-01)." },
  { id: "R-02", project: "P-102", risk: "Window design pressures for corner zones unknown (RFI-102-014)", exposure: "Window bids may be light at corners", owner: "Project Manager", mitigation: "Hold window leveling until the RFI answer; ask bidders for a corner-zone add." },
  { id: "R-03", project: "P-103", risk: "Switchgear lead time 52 weeks", exposure: "Schedule; possible early release deposit", owner: "Project Manager", mitigation: "Development decision on an early release purchase order; alternate manufacturer at 44 weeks." },
  { id: "R-04", project: "P-103", risk: "Named-storm builder's risk deductible (5% of values)", exposure: "Insurance cost and uninsured deductible in hurricane season", owner: "Preconstruction Director", mitigation: "Confirm the deductible with the insurance broker before GMP." },
  { id: "R-05", project: "P-104", risk: "No geotech report; site and foundations at benchmark", exposure: "Wide range on sitework and slab", owner: "Estimator", mitigation: "Carry an allowance and state it; update when the geotech arrives." },
];

const contractTerms = {
  developmentAgreement: "GMP with a 50/50 shared-savings split on buyout (sample terms).",
  subcontractorBonding: "Subcontracts over $1,000,000 need a payment and performance bond or enrollment in subcontractor default insurance (sample policy).",
  insuranceProgram: "Contractor-controlled insurance (CCIP) on P-102 and P-103; bidders must price without their own GL for on-site work (sample).",
};

// ---- Assembly and role filtering -----------------------------------------------------------

const priced = projectInfo.map(priceProject);

export const portfolio = {
  meta: {
    dataStatus: "SAMPLE: invented projects, bidders, and figures",
    notice: PORTFOLIO_NOTICE,
    asOf: PORTFOLIO_AS_OF,
    company: "A multifamily developer-builder, preconstruction group (sample)",
    region: "Florida",
    money: "Whole US dollars at estimate level. Bid leveling itself keeps cents on the Bid leveling page.",
    biddingSystems: "Invitations and bids in BuildingConnected; follow-ups by Outlook. BuildingConnected entry is manual.",
    floridaNotes: [
      "Florida sales tax is 6% plus a county discretionary surtax on materials; rates vary by county. Confirm the county rate and whether each bid includes tax.",
      "Wind design follows the Florida Building Code; exterior products need Florida Product Approval (or a Miami-Dade NOA in the HVHZ). Check approvals on windows, doors, storefront, and roofing.",
      "Hurricane season (June-November) drives builder's risk named-storm deductibles and schedule float.",
    ],
    targetBidsPerTrade: TARGET_BIDS,
  },
  projects: projectInfo.map((p) => ({ ...p, daysToNextMilestone: daysUntil(p.nextMilestone.date) })),
  coverage: packages.map(coverage),
  addenda,
  pricing: {
    estimates: priced,
    portfolioTotals: {
      estimate: sum(priced.map((p) => p.total)),
      developmentBudget: sum(priced.map((p) => p.developmentBudget)),
      overUnderBudget: sum(priced.map((p) => p.overUnderBudget)),
    },
    bidResults: packages.map(bidResults),
    veLog,
    veSummary,
    decisionsNeeded,
  },
  projectRecords: { drawingLog, rfis },
  contractsAndRisk: { risks, contractTerms },
};

export type Portfolio = typeof portfolio;

/** Which area each top-level part belongs to. Meta, projects, coverage, and addenda are for everyone. */
export const PORTFOLIO_AREA = {
  pricing: "finance",
  projectRecords: "students",
  contractsAndRisk: "supports",
} as const satisfies Partial<Record<keyof Portfolio, Area>>;

const OMITTED = "Not shared with this role.";

/** The portfolio as one role may see it: each part is either all there or replaced with a note. */
export function portfolioFor(can: (area: Area) => boolean) {
  return {
    ...portfolio,
    pricing: can(PORTFOLIO_AREA.pricing) ? portfolio.pricing : OMITTED,
    projectRecords: can(PORTFOLIO_AREA.projectRecords) ? portfolio.projectRecords : OMITTED,
    contractsAndRisk: can(PORTFOLIO_AREA.contractsAndRisk) ? portfolio.contractsAndRisk : OMITTED,
  };
}
