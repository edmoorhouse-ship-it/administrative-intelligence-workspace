/**
 * Proposal intake: turns a sub's proposal text (from `pdftotext -layout`, or pasted email) into a
 * source-locked record, audits its math, and maps it onto a bid form for the leveling engine.
 *
 * Rules from docs/construction/leveling-spec.md: every extracted fact keeps the line it came from;
 * anything the proposal does not say is NOT STATED, never guessed; the vendor's total is kept exactly,
 * and a total that does not tie is shown, not repaired.
 */

import { type BidForm, type Cell, type Cents, type InclusionAnswer, type Proposal, formatCents, toCents } from "./leveling.ts";

export const NOT_STATED = "NOT STATED";

/** A fact plus the line of the proposal it came from (1-based). */
export interface Sourced<T> {
  value: T;
  line: number;
  text: string;
}

export interface PricedLine {
  label: string;
  amount: Cents;
  line: number;
}

export interface ProposalRecord {
  source: string;
  vendor: string;
  project: string;
  trade: string;
  date: string;
  revision: number | null;
  drawingBasis: string;
  contact: string;
  /** The vendor's stated base total, or null when the proposal never states one. */
  vendorBase: Sourced<Cents> | null;
  breakouts: PricedLine[];
  /** Sum of the breakouts, when there are any. */
  calculatedBase: Cents | null;
  /** vendorBase - calculatedBase. Zero ties; anything else is a math issue to clear with the vendor. */
  mathVariance: Cents | null;
  alternates: (PricedLine & { direction: "add" | "deduct" })[];
  allowances: (PricedLine & { inBase: boolean | null })[];
  unitPrices: PricedLine[];
  inclusions: Sourced<string>[];
  exclusions: Sourced<string>[];
  terms: Sourced<string>[];
  /** Commercial and scope red flags, each with the line that raised it. */
  redFlags: Sourced<string>[];
}

// ---- Reading the text ------------------------------------------------------------------

type Section = "header" | "pricing" | "alternates" | "allowances" | "unit-prices" | "inclusions" | "exclusions" | "terms";

const HEADINGS: [RegExp, Section][] = [
  [/^(base bid( breakdown)?|pricing|breakdown|price breakdown|bid breakdown|scope pricing)\s*:?$/i, "pricing"],
  [/^alternates?\s*:?$/i, "alternates"],
  [/^allowances?\s*:?$/i, "allowances"],
  [/^unit (prices|pricing|rates)\s*:?$/i, "unit-prices"],
  [/^(inclusions?|includes|scope included)\s*:?$/i, "inclusions"],
  [/^(exclusions?|excludes|not included)\s*:?$/i, "exclusions"],
  [/^(terms|terms and conditions|qualifications|notes|clarifications)\s*:?$/i, "terms"],
];

/** "Label ....  $1,234.56" or "Label - credit of $41,000". The amount must end the line. */
const MONEY_AT_END = /^(.*?)[\s.:\-–]*\(?-?\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)\)?\s*$/;
const TOTAL_LABEL = /\b(total|base bid|lump sum|grand total|contract sum)\b/i;
const BULLET = /^\s*(?:[-*•–]|\d+[.)])\s+/;

const HEADER_FIELDS: [keyof Pick<ProposalRecord, "vendor" | "project" | "trade" | "date" | "drawingBasis" | "contact">, RegExp][] = [
  ["vendor", /^(?:vendor|company|subcontractor|bidder)\s*:\s*(.+)$/i],
  ["project", /^(?:project|job|project name)\s*:\s*(.+)$/i],
  ["trade", /^(?:trade|package|scope|division)\s*:\s*(.+)$/i],
  ["date", /^(?:proposal date|date|bid date)\s*:\s*(.+)$/i],
  ["drawingBasis", /^(?:drawings?|plans|drawing set|documents|based on|plan set)\s*:\s*(.+)$/i],
  ["contact", /^(?:contact|estimator|prepared by)\s*:\s*(.+)$/i],
];

function headingOf(line: string): Section | null {
  const t = line.trim();
  for (const [re, section] of HEADINGS) if (re.test(t)) return section;
  return null;
}

function moneyLine(text: string): { label: string; amount: Cents; negative: boolean } | null {
  const m = MONEY_AT_END.exec(text.trim());
  if (!m) return null;
  const label = m[1].replace(BULLET, "").replace(/[\s.:\-–]+$/, "").trim();
  const negative = /\(\s*\$|-\s*\$/.test(text);
  return { label, amount: toCents(m[2]), negative };
}

/** The first line of a sender block or letterhead, as a fallback vendor name. */
function vendorFallback(lines: string[]): string | null {
  const from = lines.find((l) => /^from\s*:/i.test(l));
  if (from) {
    const name = from.replace(/^from\s*:\s*/i, "").replace(/<.*>/, "").trim();
    if (name) return name;
  }
  const first = lines.find((l) => l.trim());
  return first && /\b(inc|llc|co|corp|company|systems|contractors?)\b\.?/i.test(first) ? first.trim() : null;
}

/**
 * Reads a proposal. `source` is the file name or "pasted email", kept for the evidence trail.
 * Pure: give it text, get a record. Use `pdfToText` first for a PDF.
 */
export function parseProposal(text: string, source: string): ProposalRecord {
  const lines = text.replace(/\r/g, "").split("\n");
  const header: Record<string, string> = {};
  let revision: number | null = null;
  let section: Section = "header";
  let vendorBase: Sourced<Cents> | null = null;

  const breakouts: PricedLine[] = [];
  const alternates: ProposalRecord["alternates"] = [];
  const allowances: ProposalRecord["allowances"] = [];
  const unitPrices: PricedLine[] = [];
  const inclusions: Sourced<string>[] = [];
  const exclusions: Sourced<string>[] = [];
  const terms: Sourced<string>[] = [];

  lines.forEach((raw, i) => {
    const line = i + 1;
    const t = raw.trim();
    if (!t) return;

    // An email sign-off ends the proposal body.
    if (/^(thanks|thank you|regards|best regards|sincerely|respectfully)\b/i.test(t)) {
      section = "header";
      return;
    }
    const heading = headingOf(t);
    if (heading) {
      section = heading;
      return;
    }

    // One-line lists: "Includes: labor, material, tax." / "Exclusions: bond, permits".
    const inlineList = /^(includes?|inclusions?|excludes?|exclusions?)\s*:\s*(.+)$/i.exec(t);
    if (inlineList) {
      const into = /^inc/i.test(inlineList[1]) ? inclusions : exclusions;
      for (const item of inlineList[2].replace(/\.$/, "").split(/,\s*/)) if (item.trim()) into.push({ value: item.trim(), line, text: t });
      return;
    }

    for (const [field, re] of HEADER_FIELDS) {
      const m = re.exec(t);
      if (m && !header[field]) {
        header[field] = m[1].trim();
        return;
      }
    }
    const rev = /^(?:revision|rev\.?)\s*:?\s*(\d+)\s*$/i.exec(t);
    if (rev) {
      revision = Number(rev[1]);
      return;
    }

    const money = moneyLine(t);
    const isAlternate = section !== "unit-prices" && /^(?:alternate\s*:?\s*)?(add|deduct|credit|alt(?:ernate)?)\b/i.test(t.replace(BULLET, ""));

    if (money && (section === "alternates" || isAlternate)) {
      const deduct = /deduct|credit/i.test(t) || money.negative;
      const label = money.label.replace(/^alternate\s*:\s*/i, "").replace(/[\s\-–]*(?:credit|add|deduct) of$/i, "");
      alternates.push({ label, amount: money.amount, line, direction: deduct ? "deduct" : "add" });
      return;
    }
    if (money && section === "allowances") {
      const inBase = /included in (the )?base|in base/i.test(t) ? true : /not included|in addition|excluded/i.test(t) ? false : null;
      allowances.push({ label: money.label, amount: money.amount, line, inBase });
      return;
    }
    if (money && section === "unit-prices") {
      unitPrices.push({ label: money.label, amount: money.amount, line });
      return;
    }
    if (money && (section === "pricing" || section === "header")) {
      if (TOTAL_LABEL.test(money.label) && !vendorBase) {
        // The total (or a single lump-sum line) is the vendor base, not a breakout.
        vendorBase = { value: money.amount, line, text: t };
        return;
      }
      breakouts.push({ label: money.label, amount: money.amount, line });
      return;
    }
    if (section === "inclusions" || section === "exclusions") {
      const item = t.replace(BULLET, "").trim();
      (section === "inclusions" ? inclusions : exclusions).push({ value: item, line, text: t });
      return;
    }
    // Commercial terms count wherever they appear, not only under a Terms heading.
    if (section === "terms" || /\b(valid|escalat|deposit|mobilization|retainage|payment terms)/i.test(t)) terms.push({ value: t, line, text: t });
  });

  const calculatedBase = breakouts.length ? breakouts.reduce((a, b) => a + b.amount, 0) : null;
  const base = vendorBase as Sourced<Cents> | null;
  const mathVariance = base && calculatedBase !== null ? base.value - calculatedBase : null;

  const record: ProposalRecord = {
    source,
    vendor: header.vendor ?? vendorFallback(lines) ?? NOT_STATED,
    project: header.project ?? NOT_STATED,
    trade: header.trade ?? NOT_STATED,
    date: header.date ?? NOT_STATED,
    revision,
    drawingBasis: header.drawingBasis ?? NOT_STATED,
    contact: header.contact ?? NOT_STATED,
    vendorBase: base,
    breakouts,
    calculatedBase,
    mathVariance,
    alternates,
    allowances,
    unitPrices,
    inclusions,
    exclusions,
    terms,
    redFlags: [],
  };
  record.redFlags = findRedFlags(record, lines);
  return record;
}

// ---- Red flags ---------------------------------------------------------------------------

/** The spec's commercial and scope red flags that can be read straight off the text. */
function findRedFlags(r: ProposalRecord, lines: string[]): Sourced<string>[] {
  const flags: Sourced<string>[] = [];
  const at = (re: RegExp) => lines.findIndex((l) => re.test(l));
  const flag = (i: number, value: string) => i >= 0 && flags.push({ value, line: i + 1, text: lines[i].trim() });

  const validity = lines.findIndex((l) => /(valid|good) (for )?(\d+) days|valid (\d+) days/i.test(l));
  if (validity >= 0) {
    const days = Number(/(\d+) days/i.exec(lines[validity])![1]);
    if (days < 30) flag(validity, `Short validity: ${days} days`);
  }
  flag(at(/escalat/i), "Material escalation clause");
  const deposit = lines.findIndex((l) => /(\d+)\s*%\s*(mobilization|deposit|down)/i.test(l));
  if (deposit >= 0) {
    const pct = Number(/(\d+)\s*%/.exec(lines[deposit])![1]);
    if (pct >= 10) flag(deposit, `Large deposit / mobilization: ${pct}%`);
  }
  flag(at(/\bbudget\b/i), "Budget pricing, not a firm proposal");
  const bond = r.exclusions.find((e) => /\bbond/i.test(e.value));
  if (bond) flags.push({ value: "Bond excluded", line: bond.line, text: bond.text });
  for (const b of r.breakouts) {
    if (/\b(option|optional|upgrade|alternate)\b/i.test(b.label)) {
      flags.push({ value: `Option inside the base total: ${b.label} (${formatCents(b.amount)})`, line: b.line, text: lines[b.line - 1].trim() });
    }
  }
  if (r.drawingBasis === NOT_STATED) flags.push({ value: "No drawing set or date stated", line: 0, text: "" });
  if (r.mathVariance) {
    flags.push({
      value: `Math does not tie: breakouts ${formatCents(r.calculatedBase!)} vs stated total ${formatCents(r.vendorBase!.value)} (variance ${formatCents(r.mathVariance)})`,
      line: r.vendorBase!.line,
      text: r.vendorBase!.text,
    });
  }
  if (!r.vendorBase) flags.push({ value: "No base total stated", line: 0, text: "" });
  return flags;
}

// ---- Revisions ---------------------------------------------------------------------------

/** Groups records by vendor and keeps the latest revision; earlier ones are history, never leveled. */
export function currentRecords(records: ProposalRecord[]): { current: ProposalRecord; superseded: ProposalRecord[] }[] {
  const groups = new Map<string, ProposalRecord[]>();
  for (const r of records) {
    const key = `${r.vendor.toLowerCase()}|${r.trade.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()].map((list) => {
    const sorted = [...list].sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0) || Date.parse(b.date) - Date.parse(a.date));
    return { current: sorted[0], superseded: sorted.slice(1) };
  });
}

// ---- Onto the bid form -------------------------------------------------------------------

export interface FormMapping {
  /** Proposal breakout label -> form row id. Breakouts with no entry stay unmapped (visible). */
  lines?: Record<string, string>;
  /** Where a proposal with no breakouts puts its base, usually the combined fallback row. */
  baseRow?: string;
  /** Proposal alternate label -> form alternate row id. */
  alternates?: Record<string, string>;
  /** Form inclusion row id -> answer, only where the proposal actually says so. */
  inclusions?: Record<string, InclusionAnswer>;
}

/**
 * The engine's Proposal for this record. Only mappings you give are applied: unmapped breakouts stay
 * in `unmapped`, unanswered inclusions stay not-stated, and red flags and source issues carry over.
 */
export function toProposal(r: ProposalRecord, form: BidForm, map: FormMapping, id = r.source): Proposal {
  const rowIds = new Set(form.rows.map((x) => x.id));
  const cells: Record<string, Cell> = {};
  let unmapped = 0;

  for (const b of r.breakouts) {
    const row = map.lines?.[b.label];
    if (row && rowIds.has(row)) {
      const prev = cells[row];
      const amount = (prev?.kind === "price" ? prev.amount : 0) + b.amount;
      cells[row] = { kind: "price", amount, evidence: "VENDOR CONFIRMED" };
    } else unmapped += b.amount;
  }
  if (!r.breakouts.length && r.vendorBase && map.baseRow) {
    cells[map.baseRow] = { kind: "price", amount: r.vendorBase.value, evidence: "VENDOR CONFIRMED" };
  }

  const alternates: Record<string, Cents> = {};
  for (const a of r.alternates) {
    const row = map.alternates?.[a.label];
    if (row) alternates[row] = a.amount;
  }

  const sourceIssues: string[] = [];
  if (r.drawingBasis === NOT_STATED) sourceIssues.push("No drawing set or date stated");
  if (!r.vendorBase) sourceIssues.push("No base total stated");

  return {
    id,
    bidder: r.vendor,
    date: r.date,
    revision: r.revision ?? 0,
    // Keep the vendor's own total. When it is missing, the breakouts stand in, and the source issue says so.
    vendorBase: r.vendorBase?.value ?? r.calculatedBase ?? 0,
    cells,
    unmapped: unmapped || undefined,
    alternates,
    inclusions: map.inclusions,
    sourceIssues,
    redFlags: r.redFlags.filter((f) => !/^Math does not tie|^No drawing|^No base/.test(f.value)).map((f) => f.value),
  };
}

// ---- Plain-text summary ------------------------------------------------------------------

/** The proposal record as a short Markdown block: what was found, where, and what is NOT STATED. */
export function recordMarkdown(r: ProposalRecord): string {
  const ref = (line: number) => (line ? String(line) : "");
  const priced = (xs: PricedLine[]) => (xs.length ? xs.map((x) => `| ${x.label} | ${formatCents(x.amount)} | ${ref(x.line)} |`).join("\n") : `| ${NOT_STATED} | | |`);
  const list = (xs: Sourced<string>[]) => (xs.length ? xs.map((x) => `- ${x.value}${x.line ? ` _(line ${x.line})_` : ""}`).join("\n") : `- ${NOT_STATED}`);
  const tie =
    r.mathVariance === null
      ? r.vendorBase
        ? "No breakouts to check against."
        : "No base total stated."
      : r.mathVariance === 0
        ? "Breakouts tie to the stated total."
        : `Does not tie: variance ${formatCents(r.mathVariance)}.`;
  const altLabel = (label: string) => label.replace(/^(add|deduct|credit)\b\s*(?:-|–|for)?\s*/i, "");

  return [
    `## ${r.vendor} · ${r.trade} · Rev ${r.revision ?? NOT_STATED}`,
    "",
    "| Field | Value |",
    "|---|---|",
    `| Project | ${r.project} |`,
    `| Proposal date | ${r.date} |`,
    `| Drawing basis | ${r.drawingBasis} |`,
    `| Contact | ${r.contact} |`,
    `| Base bid | ${r.vendorBase ? formatCents(r.vendorBase.value) : NOT_STATED} |`,
    `| Math check | ${tie} |`,
    `| Source | ${r.source} |`,
    "",
    "**Breakouts**",
    "",
    "| Line | Amount | Source line |",
    "|---|---:|---:|",
    priced(r.breakouts),
    "",
    "**Alternates**",
    "",
    "| Alternate | Amount | Source line |",
    "|---|---:|---:|",
    r.alternates.length ? r.alternates.map((a) => `| ${a.direction.toUpperCase()} - ${altLabel(a.label)} | ${formatCents(a.amount)} | ${ref(a.line)} |`).join("\n") : `| ${NOT_STATED} | | |`,
    "",
    "**Allowances**",
    "",
    r.allowances.length
      ? r.allowances.map((a) => `- ${a.label}: ${formatCents(a.amount)} (${a.inBase === null ? "in base: NOT STATED" : a.inBase ? "in base" : "not in base"}) _(line ${a.line})_`).join("\n")
      : `- ${NOT_STATED}`,
    "",
    "**Unit prices**",
    "",
    r.unitPrices.length ? r.unitPrices.map((u) => `- ${u.label}: ${formatCents(u.amount)} _(line ${u.line})_`).join("\n") : `- ${NOT_STATED}`,
    "",
    "**Inclusions**",
    "",
    list(r.inclusions),
    "",
    "**Exclusions**",
    "",
    list(r.exclusions),
    "",
    "**Terms**",
    "",
    list(r.terms),
    "",
    "**Red flags**",
    "",
    r.redFlags.length ? list(r.redFlags) : "- None found",
  ].join("\n");
}
