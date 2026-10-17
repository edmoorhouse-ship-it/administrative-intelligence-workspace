/**
 * The bid leveling engine for the construction profile. Pure functions, no UI and no I/O, so every
 * rule in docs/construction/leveling-spec.md can be tested. Money is whole cents throughout, so a
 * vendor's $3,974,248.60 stays exactly that.
 *
 * What it does: ties each bidder's mapped prices to the vendor base, catches double counting,
 * keeps blanks blank, builds the headline / adjusted / normalized comparison, assigns the status
 * model, and produces the BuildingConnected plug table. It never picks the carry; that is the
 * user's call.
 */

export type Cents = number;

// ---- The bid form ------------------------------------------------------------------------

export type RowKind =
  | "base" // core vendor scope
  | "additional-base" // separately priced but carried in base
  | "combined" // fallback: the whole scope (or a group) in one number
  | "misc"; // real vendor dollars that cannot be mapped yet

export interface LineRow {
  id: string;
  section: "line";
  label: string;
  kind: RowKind;
  /** For a combined row: the detailed rows it stands in for. Combined OR detailed, never both. */
  covers?: string[];
}

export interface AlternateRow {
  id: string;
  section: "alternate";
  label: string;
  direction: "add" | "deduct";
}

export interface InclusionRow {
  id: string;
  section: "inclusion";
  label: string;
}

export type FormRow = LineRow | AlternateRow | InclusionRow;

export interface BidForm {
  project: string;
  round: string;
  /** The exact package number and name, e.g. "09: Drywall". */
  pkg: string;
  rows: FormRow[];
}

// ---- A proposal, mapped onto the form ---------------------------------------------------

export type Evidence = "VENDOR CONFIRMED" | "DOCUMENT INFERRED" | "ESTIMATOR ALLOCATION" | "UNRESOLVED";

/**
 * What one bidder's proposal says about one form row. A missing cell is the same as "blank": no
 * breakout, unknown, or unresolved. Blank is never $0.
 */
export type Cell =
  | { kind: "price"; amount: Cents; evidence: Evidence }
  | { kind: "blank" }
  /** Explicitly included at no separate cost. Needs the vendor's words, not an assumption. */
  | { kind: "zero"; source: string }
  | { kind: "excluded"; source: string }
  /** In the vendor base with no breakout. Names the row that holds the money. */
  | { kind: "included-elsewhere"; inRow: string };

export type InclusionAnswer = "yes" | "no" | "not-stated" | "conflicting";

export type AdjustmentType =
  | "required-add" // known required adder (adjusted and normalized)
  | "confirmed-deduct" // accepted deduct (adjusted and normalized)
  | "scope-plug" // missing scope priced by the estimator (normalized only)
  | "allowance-adjustment" // difference to the target allowance (normalized only)
  | "voluntary-deduct"; // VE credit offered by the vendor: memo only until accepted

export interface Adjustment {
  type: AdjustmentType;
  /** Always a positive magnitude; the type says whether it adds or subtracts. */
  amount: Cents;
  reason: string;
  /** Voluntary deducts only count once accepted. Everything else counts when present. */
  accepted?: boolean;
}

export interface Proposal {
  id: string;
  bidder: string;
  date: string;
  revision: number;
  /** The vendor's stated base total, exactly as written. */
  vendorBase: Cents;
  cells: Record<string, Cell>;
  /** Vendor dollars that cannot be mapped to a row yet. Kept visible, never hidden in a line. */
  unmapped?: Cents;
  /** Prices for alternate rows, as positive magnitudes. Never part of the base. */
  alternates?: Record<string, Cents>;
  inclusions?: Record<string, InclusionAnswer>;
  adjustments?: Adjustment[];
  /** Material scope this bidder has not priced yet. Any entry keeps the comparison from being normalized. */
  openScope?: string[];
  /** Wrong project, stale drawing set, missing pages, etc. */
  sourceIssues?: string[];
  /** Commercial red flags: short validity, escalation, large deposit, no bond, etc. */
  redFlags?: string[];
  /** Set only by the user. The engine never recommends a carry on its own. */
  carry?: CarryStatus;
  /** Set only when the user confirms the numbers were typed into BuildingConnected. */
  enteredInBc?: boolean;
}

// ---- Results -----------------------------------------------------------------------------

export type SourceIntegrity = "VERIFIED" | "SOURCE ISSUE" | "MATH ISSUE";
export type PlugStatus = "READY TO PLUG" | "HOLD" | "ENTERED";
export type Completeness = "COMPLETE" | "READY WITH FLAGS" | "CLARIFICATION REQUIRED" | "INCOMPLETE";
export type CarryStatus = "CARRY RECOMMENDED" | "CARRY WITH ALLOWANCE" | "CARRY CANDIDATE" | "DO NOT CARRY" | "NOT EVALUATED";

export const UNKNOWN_NORMALIZED = "TRUE NORMALIZED DELTA: UNKNOWN PENDING CLARIFICATION";

export interface BidderResult {
  bidder: string;
  proposalId: string;
  revision: number;
  /** Superseded revisions of this bidder's proposal: kept for history, never leveled. */
  history: string[];
  mapped: Cents;
  unmapped: Cents;
  vendorBase: Cents;
  /** vendorBase - (mapped + unmapped). Zero means it ties to the cent. */
  variance: Cents;
  headline: Cents;
  adjusted: Cents;
  /** Null while material scope is unpriced: the comparison is not normalized. */
  normalized: Cents | null;
  /** Offered VE credits not yet accepted. Shown, never subtracted. */
  memoVoluntaryDeducts: Cents;
  sourceIntegrity: SourceIntegrity;
  plug: PlugStatus;
  completeness: Completeness;
  rankingEligible: boolean;
  carry: CarryStatus;
  /** Structural problems that stop the plug: double counting, unknown rows, bad references. */
  errors: string[];
  /** Things to clear before ranking: open scope, unanswered inclusions, red flags, math variance. */
  flags: string[];
}

export interface TradeResult {
  form: BidForm;
  bidders: BidderResult[];
}

// ---- Money -------------------------------------------------------------------------------

/** "$1,234.56", or "-$20.00". Cents are always shown so nothing is silently rounded. */
export function formatCents(c: Cents): string {
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, "0")}`;
}

/** "$3,974,248.60" or "3974248.6" to cents. Throws on anything that is not a clean amount. */
export function toCents(text: string): Cents {
  const clean = text.replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) throw new Error(`Not a dollar amount: "${text}"`);
  const [whole, frac = ""] = clean.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return clean.startsWith("-") ? -cents : cents;
}

const sum = (xs: Cents[]) => xs.reduce((a, b) => a + b, 0);

// ---- Leveling ----------------------------------------------------------------------------

/** One bidder's latest revision; earlier ones go to history. */
export function latestRevisions(proposals: Proposal[]): { latest: Proposal; history: Proposal[] }[] {
  const byBidder = new Map<string, Proposal[]>();
  for (const p of proposals) byBidder.set(p.bidder, [...(byBidder.get(p.bidder) ?? []), p]);
  return [...byBidder.values()].map((list) => {
    const sorted = [...list].sort((a, b) => b.revision - a.revision || b.date.localeCompare(a.date));
    return { latest: sorted[0], history: sorted.slice(1) };
  });
}

function checkStructure(form: BidForm, p: Proposal): string[] {
  const errors: string[] = [];
  const rows = new Map(form.rows.map((r) => [r.id, r]));
  const priced = (id: string) => p.cells[id]?.kind === "price";

  for (const [id, cell] of Object.entries(p.cells)) {
    const row = rows.get(id);
    if (!row) errors.push(`"${id}" is not a row on the ${form.pkg} form.`);
    else if (row.section !== "line") errors.push(`"${row.label}" is not a price line; alternates and inclusions are entered separately.`);
    if (cell.kind === "price" && cell.amount < 0) errors.push(`"${row?.label ?? id}" is negative. Use a deduct row with a positive amount.`);
    if (cell.kind === "included-elsewhere") {
      const host = p.cells[cell.inRow];
      if (!rows.has(cell.inRow)) errors.push(`"${row?.label ?? id}" points to "${cell.inRow}", which is not on the form.`);
      else if (host?.kind !== "price") errors.push(`"${row?.label ?? id}" is included in "${cell.inRow}", but that row has no price.`);
    }
  }
  // Combined OR detailed, never both: the same dollars would be counted twice.
  for (const row of form.rows) {
    if (row.section !== "line" || row.kind !== "combined" || !priced(row.id)) continue;
    const doubled = (row.covers ?? []).filter(priced);
    if (doubled.length) errors.push(`"${row.label}" and its detailed lines (${doubled.join(", ")}) are both priced. Use one or the other.`);
  }
  for (const id of Object.keys(p.alternates ?? {})) {
    const row = rows.get(id);
    if (row?.section !== "alternate") errors.push(`Alternate "${id}" is not an alternate on the form.`);
  }
  return errors;
}

export function levelBidder(form: BidForm, p: Proposal, history: Proposal[] = []): BidderResult {
  const errors = checkStructure(form, p);
  const flags: string[] = [];

  const mapped = sum(Object.values(p.cells).flatMap((c) => (c.kind === "price" ? [c.amount] : [])));
  const unmapped = p.unmapped ?? 0;
  const variance = p.vendorBase - (mapped + unmapped);
  if (unmapped) flags.push(`${formatCents(unmapped)} of vendor dollars are not mapped to a line yet.`);
  if (variance !== 0) flags.push(`Mapped ${formatCents(mapped + unmapped)} vs vendor base ${formatCents(p.vendorBase)}: variance ${formatCents(variance)}.`);

  const adj = p.adjustments ?? [];
  const total = (type: AdjustmentType, acceptedOnly = false) =>
    sum(adj.filter((a) => a.type === type && (!acceptedOnly || a.accepted)).map((a) => a.amount));
  for (const a of adj) if (a.amount < 0) errors.push(`Adjustment "${a.reason}" is negative. Amounts are magnitudes; the type sets the sign.`);

  const headline = p.vendorBase;
  const acceptedVoluntary = total("voluntary-deduct", true);
  const adjusted = headline + total("required-add") - total("confirmed-deduct") - acceptedVoluntary;
  const openScope = p.openScope ?? [];
  const normalized = openScope.length ? null : adjusted + total("scope-plug") + total("allowance-adjustment");
  const memoVoluntaryDeducts = total("voluntary-deduct") - acceptedVoluntary;

  for (const s of openScope) flags.push(`Unpriced scope: ${s}.`);
  for (const row of form.rows) {
    if (row.section !== "inclusion") continue;
    const answer = p.inclusions?.[row.id] ?? "not-stated";
    if (answer === "not-stated") flags.push(`Not stated: ${row.label}`);
    if (answer === "conflicting") flags.push(`Conflicting language: ${row.label}`);
  }
  for (const f of p.redFlags ?? []) flags.push(`Red flag: ${f}`);

  const sourceIntegrity: SourceIntegrity = p.sourceIssues?.length ? "SOURCE ISSUE" : variance !== 0 ? "MATH ISSUE" : "VERIFIED";
  for (const s of p.sourceIssues ?? []) flags.push(`Source issue: ${s}`);

  const needsAnswers = openScope.length > 0 || flags.some((f) => f.startsWith("Not stated") || f.startsWith("Conflicting"));
  const completeness: Completeness = errors.length
    ? "INCOMPLETE"
    : needsAnswers
      ? "CLARIFICATION REQUIRED"
      : flags.length
        ? "READY WITH FLAGS"
        : "COMPLETE";

  // A bid can be ready to plug while not eligible to rank. Only structural errors stop the plug.
  const plug: PlugStatus = errors.length ? "HOLD" : p.enteredInBc ? "ENTERED" : "READY TO PLUG";
  const rankingEligible = !errors.length && normalized !== null && sourceIntegrity === "VERIFIED";

  return {
    bidder: p.bidder,
    proposalId: p.id,
    revision: p.revision,
    history: history.map((h) => h.id),
    mapped,
    unmapped,
    vendorBase: p.vendorBase,
    variance,
    headline,
    adjusted,
    normalized,
    memoVoluntaryDeducts,
    sourceIntegrity,
    plug,
    completeness,
    rankingEligible,
    carry: p.carry ?? "NOT EVALUATED",
    errors,
    flags,
  };
}

/** Level every bidder's latest revision against one form. */
export function levelTrade(form: BidForm, proposals: Proposal[]): TradeResult {
  return { form, bidders: latestRevisions(proposals).map(({ latest, history }) => levelBidder(form, latest, history)) };
}

/** "Bidder B is $40,000.00 lower than Bidder A", or the unknown label when either is not normalized. */
export function normalizedDelta(a: BidderResult, b: BidderResult): string {
  if (a.normalized === null || b.normalized === null) return UNKNOWN_NORMALIZED;
  const d = b.normalized - a.normalized;
  if (d === 0) return `${b.bidder} and ${a.bidder} are equal after normalizing.`;
  return `${b.bidder} is ${formatCents(Math.abs(d))} ${d < 0 ? "lower" : "higher"} than ${a.bidder} after normalizing.`;
}

// ---- Cross-package ownership --------------------------------------------------------------

/** Scope priced in more than one package. Moving scope between trades must not leave it in both. */
export function duplicateScope(packages: { pkg: string; pricedScope: string[] }[]): { scope: string; packages: string[] }[] {
  const owners = new Map<string, string[]>();
  for (const { pkg, pricedScope } of packages) {
    for (const s of pricedScope) {
      const key = s.trim().toLowerCase();
      owners.set(key, [...(owners.get(key) ?? []), pkg]);
    }
  }
  return [...owners.entries()].filter(([, pkgs]) => pkgs.length > 1).map(([scope, pkgs]) => ({ scope, packages: pkgs }));
}

// ---- BuildingConnected plug table --------------------------------------------------------

export interface PlugTable {
  /** Companies across. */
  columns: string[];
  /** Form lines down. Each cell is what to type: an amount, "" for blank, or a word. */
  rows: { section: FormRow["section"]; label: string; cells: string[] }[];
  status: Record<string, PlugStatus>;
}

function cellText(cell: Cell | undefined, rows: Map<string, FormRow>): string {
  if (!cell || cell.kind === "blank") return "";
  if (cell.kind === "price") return formatCents(cell.amount);
  if (cell.kind === "zero") return "$0.00";
  if (cell.kind === "excluded") return "Excluded";
  return `Included in ${rows.get(cell.inRow)?.label ?? cell.inRow}`;
}

/**
 * What to type into BuildingConnected, bidder by bidder. Bidders on HOLD are still shown so the
 * problem is visible, but their status says not to enter them. Nothing here claims an entry
 * happened unless the user confirmed it.
 */
export function plugTable(trade: TradeResult, proposals: Proposal[]): PlugTable {
  const rowMap = new Map(trade.form.rows.map((r) => [r.id, r]));
  const byId = new Map(proposals.map((p) => [p.id, p]));
  const leveled = trade.bidders.map((b) => byId.get(b.proposalId)!);
  const answerText: Record<InclusionAnswer, string> = { yes: "Yes", no: "No", "not-stated": "", conflicting: "" };

  const rows: PlugTable["rows"] = trade.form.rows.map((row) => ({
    section: row.section,
    label: row.label,
    cells: leveled.map((p) => {
      if (row.section === "line") return cellText(p.cells[row.id], rowMap);
      if (row.section === "alternate") {
        const amt = p.alternates?.[row.id];
        return amt === undefined ? "" : formatCents(amt);
      }
      return answerText[p.inclusions?.[row.id] ?? "not-stated"];
    }),
  }));
  rows.push({ section: "line", label: "Vendor base (must match BC base)", cells: trade.bidders.map((b) => formatCents(b.vendorBase)) });

  return {
    columns: trade.bidders.map((b) => b.bidder),
    rows,
    status: Object.fromEntries(trade.bidders.map((b) => [b.bidder, b.plug])),
  };
}
