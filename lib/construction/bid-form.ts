/**
 * Bid form builder: a BuildingConnected-native form (Line Items, Alternates, Inclusions) for one trade,
 * built around the project's areas, plus the mapping that puts every bidder onto it.
 *
 * Rules from docs/construction/leveling-spec.md: build around the project, not one bidder; a line earns
 * its place when someone priced it or the estimate needs it; the combined row is an optional fallback,
 * added only when a bidder gave no usable breakout; alternates stay separate; Yes/No questions only for
 * real issues; a form the user already made is used as-is. Every bidder must fit without a fake
 * breakout, and `fitReport` proves it by running each one through the leveling engine.
 */

import { type AlternateRow, type BidForm, type FormRow, type InclusionAnswer, type InclusionRow, type LineRow, levelBidder } from "./leveling.ts";
import { type FormMapping, type ProposalRecord, toProposal } from "./intake.ts";

// ---- Project areas -----------------------------------------------------------------------

export interface Area {
  id: string;
  label: string;
  /** Words in a vendor's breakout label that place it in this area. */
  keywords: string[];
  /** Keep the row even if no bidder priced it (an estimate row or known risk). */
  required?: boolean;
}

/** A starting set for garden and wrap multifamily. Each project can pass its own. */
export const MULTIFAMILY_AREAS: Area[] = [
  { id: "res", label: "Residential", keywords: ["residential", "unit", "units", "building", "buildings", "bldg", "corridor", "corridors", "apartment"] },
  { id: "amenity", label: "Clubhouse / Amenity", keywords: ["clubhouse", "amenity", "leasing", "fitness", "pool house", "lobby"] },
  { id: "garage", label: "Garages", keywords: ["garage", "garages", "carport", "parking"] },
  { id: "site", label: "Site", keywords: ["site", "trash", "compactor", "monument", "enclosure", "maintenance building", "mail kiosk"] },
];

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9/"' ]+/g, " ");

/** The areas a breakout label names. More than one means ambiguous: the dollars stay unmapped. */
function areasFor(label: string, areas: Area[]): Area[] {
  const text = ` ${words(label)} `;
  return areas.filter((a) => a.keywords.some((k) => text.includes(` ${k.toLowerCase()} `)));
}

// ---- Alternates and inclusion topics -----------------------------------------------------

/** "DEDUCT - Substitute 1/2" board at unit ceilings" and "DEDUCT for 1/2" board ..." are the same alternate. */
function alternateKey(label: string): string {
  return words(label)
    .replace(/\b(add|deduct|credit|alternate|alt|substitute|for|of|option)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface Topic {
  id: string;
  question: string;
  keywords: string[];
  /** Commercial items asked whenever any bidder mentions them; scope items only when bidders differ. */
  commercial?: boolean;
}

export const COMMON_TOPICS: Topic[] = [
  { id: "inc-tax", question: "Sales tax included in base bid?", keywords: ["sales tax", "tax"], commercial: true },
  { id: "inc-bond", question: "Payment and performance bond included in base bid?", keywords: ["bond"], commercial: true },
  { id: "inc-permits", question: "Permits and fees included in base bid?", keywords: ["permit", "permits"], commercial: true },
  { id: "inc-ocip", question: "OCIP / CCIP enrollment included?", keywords: ["ocip", "ccip"], commercial: true },
  { id: "inc-engineering", question: "Engineering / shop drawings included?", keywords: ["engineering", "shop drawings"], commercial: true },
  { id: "inc-soffits", question: "Exterior soffits and ceilings included in base bid?", keywords: ["soffit", "soffits", "exterior ceilings"] },
  { id: "inc-unbalanced", question: "Unbalanced wall assemblies included in base bid?", keywords: ["unbalanced wall"] },
  { id: "inc-deflection", question: "Deflection track at rated walls included in base bid?", keywords: ["deflection track"] },
  { id: "inc-firecaulk", question: "Fire caulking at penetrations included?", keywords: ["fire caulk", "firestop", "fire stop"] },
  { id: "inc-patching", question: "Patching after other trades included?", keywords: ["patching", "patch"] },
  { id: "inc-access-panels", question: "Access panels included in base bid?", keywords: ["access panel"] },
];

/** What one bidder's proposal says about a topic: its own words only, never another bidder's. */
export function topicAnswer(r: ProposalRecord, topic: Topic): InclusionAnswer {
  const hit = (items: { value: string }[]) => items.some((i) => topic.keywords.some((k) => words(i.value).includes(k)));
  const inc = hit(r.inclusions);
  const exc = hit(r.exclusions);
  if (inc && exc) return "conflicting";
  if (inc) return "yes";
  if (exc) return "no";
  return "not-stated";
}

// ---- Building the form -------------------------------------------------------------------

export interface BuildOptions {
  project: string;
  round: string;
  /** The exact BuildingConnected package, e.g. "09: Drywall". */
  pkg: string;
  /** Current revisions only (see currentRecords). */
  records: ProposalRecord[];
  areas?: Area[];
  topics?: Topic[];
  /** Project-specific Yes/No questions the user wants asked, with keywords to read answers from. */
  extraQuestions?: Topic[];
  /** A form the user already made. Used as-is: no rows added, removed, or renamed. */
  existing?: BidForm;
}

export interface BuiltForm {
  form: BidForm;
  /** One mapping per bidder, keyed by vendor, ready for toProposal. */
  mappings: Record<string, FormMapping>;
  /** Why rows were added or left out, and dollars that could not be placed. */
  notes: string[];
}

export function buildBidForm(o: BuildOptions): BuiltForm {
  const notes: string[] = [];
  const records = o.records;
  const topics = [...(o.extraQuestions ?? []), ...(o.topics ?? COMMON_TOPICS)];

  // A user's form defines the areas: its own line labels become the matching words.
  const areas: Area[] = o.existing
    ? o.existing.rows.flatMap((r) => (r.section === "line" && r.kind === "base" ? [{ id: r.id, label: r.label, keywords: [words(r.label).trim()] }] : []))
    : (o.areas ?? MULTIFAMILY_AREAS);

  // Where each bidder's breakouts land.
  const lineMaps = new Map<string, Record<string, string>>();
  const pricedAreas = new Set<string>();
  const needsCombined: string[] = [];
  for (const r of records) {
    const map: Record<string, string> = {};
    for (const b of r.breakouts) {
      const hits = areasFor(b.label, areas);
      if (hits.length === 1) {
        map[b.label] = hits[0].id;
        pricedAreas.add(hits[0].id);
      } else if (hits.length > 1) {
        notes.push(`${r.vendor}: "${b.label}" could be ${hits.map((h) => h.label).join(" or ")}; left unmapped until you decide.`);
      } else {
        notes.push(`${r.vendor}: "${b.label}" does not match a project area; its dollars stay visible as unmapped.`);
      }
    }
    lineMaps.set(r.vendor, map);
    if (!r.breakouts.length && r.vendorBase) needsCombined.push(r.vendor);
  }

  let form: BidForm;
  if (o.existing) {
    form = o.existing;
    notes.push("Using your form as-is.");
  } else {
    const lines: LineRow[] = areas
      .filter((a) => pricedAreas.has(a.id) || a.required)
      .map((a) => ({ id: a.id, section: "line", label: a.label, kind: "base" }));
    for (const a of areas) if (!pricedAreas.has(a.id) && !a.required) notes.push(`No bidder priced ${a.label}; left off the form.`);
    if (needsCombined.length) {
      lines.push({ id: "combined", section: "line", label: `Complete ${o.pkg.replace(/^\d+\s*:?\s*/, "")} Scope - Combined`, kind: "combined", covers: lines.map((l) => l.id) });
      notes.push(`Combined fallback added for ${needsCombined.join(", ")} (no breakout). Optional; never filled together with the detailed lines.`);
    }

    // Alternates: one row per distinct alternate, shared across bidders who priced the same thing.
    const alternates: AlternateRow[] = [];
    const altKeys = new Map<string, string>();
    for (const r of records) {
      for (const a of r.alternates) {
        const key = `${a.direction}|${alternateKey(a.label)}`;
        if (altKeys.has(key)) continue;
        const id = `alt-${alternates.length + 1}`;
        altKeys.set(key, id);
        const text = a.label.replace(/^(add|deduct|credit)\b\s*(?:-|–|for)?\s*/i, "");
        alternates.push({ id, section: "alternate", label: `${a.direction === "add" ? "ADD" : "DEDUCT"} - ${text.charAt(0).toUpperCase()}${text.slice(1)}`, direction: a.direction });
      }
    }

    // Yes/No: commercial items anyone mentioned, scope items where bidders differ, and the user's own.
    const inclusions: InclusionRow[] = [];
    for (const t of topics) {
      const answers = records.map((r) => topicAnswer(r, t));
      const mentioned = answers.some((a) => a !== "not-stated");
      const differ = new Set(answers).size > 1;
      const asked = (o.extraQuestions ?? []).includes(t);
      if (asked || (t.commercial && mentioned) || (!t.commercial && differ && mentioned)) {
        inclusions.push({ id: t.id, section: "inclusion", label: t.question, scope: !t.commercial });
      }
    }
    form = { project: o.project, round: o.round, pkg: o.pkg, rows: [...lines, ...alternates, ...inclusions] };
  }

  // Each bidder's mapping onto the final form.
  const rowIds = new Set(form.rows.map((r) => r.id));
  const combinedRow = form.rows.find((r): r is LineRow => r.section === "line" && r.kind === "combined");
  const altRows = form.rows.filter((r): r is AlternateRow => r.section === "alternate");
  const incRows = form.rows.filter((r): r is InclusionRow => r.section === "inclusion");
  const mappings: Record<string, FormMapping> = {};
  for (const r of records) {
    const lines = Object.fromEntries(Object.entries(lineMaps.get(r.vendor) ?? {}).filter(([, row]) => rowIds.has(row)));
    const alternates: Record<string, string> = {};
    for (const a of r.alternates) {
      const row = altRows.find((x) => x.direction === a.direction && alternateKey(x.label) === alternateKey(a.label));
      if (row) alternates[a.label] = row.id;
    }
    const inclusions: Record<string, InclusionAnswer> = {};
    for (const row of incRows) {
      const topic = topics.find((t) => t.id === row.id) ?? { id: row.id, question: row.label, keywords: [words(row.label).replace(/ included.*$/, "").trim()] };
      inclusions[row.id] = topicAnswer(r, topic);
    }
    mappings[r.vendor] = {
      lines,
      baseRow: !r.breakouts.length && combinedRow ? combinedRow.id : undefined,
      alternates,
      inclusions,
    };
  }
  return { form, mappings, notes };
}

// ---- Proving the fit ---------------------------------------------------------------------

export interface FitLine {
  vendor: string;
  fits: boolean;
  usesCombined: boolean;
  unmapped: number;
  errors: string[];
}

/** Every bidder through the leveling engine: a form fits when no bidder needs a fake breakout or hits an error. */
export function fitReport(built: BuiltForm, records: ProposalRecord[]): FitLine[] {
  return records.map((r) => {
    const p = toProposal(r, built.form, built.mappings[r.vendor] ?? {});
    const result = levelBidder(built.form, p);
    return {
      vendor: r.vendor,
      fits: result.errors.length === 0,
      usesCombined: Boolean(built.mappings[r.vendor]?.baseRow),
      unmapped: result.unmapped,
      errors: result.errors,
    };
  });
}

// ---- Shown inline, ready to type into BuildingConnected ----------------------------------

export function formMarkdown(form: BidForm): string {
  const line = (r: FormRow) => {
    if (r.section === "line") {
      const optional = r.kind === "combined" || r.kind === "misc";
      return `| ${r.label} | Lump sum | ${optional ? "Optional" : "Required"} |${r.kind === "combined" ? " Use this OR the lines above, never both |" : " |"}`;
    }
    if (r.section === "alternate") return `| ${r.label} | ${r.direction === "add" ? "Add" : "Deduct"} amount | Optional | |`;
    return `| ${r.label} | Yes / No | Required | |`;
  };
  const section = (title: string, rows: FormRow[]) =>
    rows.length ? [`**${title}**`, "", "| Item | Response | Required | Note |", "|---|---|---|---|", ...rows.map(line), ""] : [];
  return [
    `### ${form.pkg} · ${form.project} · ${form.round}`,
    "",
    ...section("Line Items", form.rows.filter((r) => r.section === "line")),
    ...section("Alternates", form.rows.filter((r) => r.section === "alternate")),
    ...section("Inclusions", form.rows.filter((r) => r.section === "inclusion")),
  ].join("\n");
}
