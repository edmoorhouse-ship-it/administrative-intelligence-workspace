/**
 * The trade leveling package, deliverables A-I from docs/construction/leveling-spec.md, assembled from the
 * bid form, the mapped proposals, and the leveling engine. Companies across, form lines down.
 *
 * It reports; it does not decide. The carry stays NOT EVALUATED until the user sets it, nothing is called
 * normalized while scope is unpriced, and the plug table is READY TO PLUG, never ENTERED, unless the user
 * confirmed the entry.
 */

import { formMarkdown } from "./bid-form.ts";
import {
  type BidForm,
  type BidderResult,
  type Proposal,
  type TradeResult,
  formatCents,
  levelTrade,
  plugTable,
  UNKNOWN_NORMALIZED,
} from "./leveling.ts";

export interface Clarification {
  bidder: string;
  questions: string[];
}

export interface LevelingPackage {
  trade: TradeResult;
  /** Bidder-specific questions: only that bidder's own gaps, nothing it already answered. */
  clarifications: Clarification[];
  /** Eligible bidders ordered by normalized total, lowest first. */
  ranking: BidderResult[];
  markdown: string;
}

const table = (head: string[], rows: string[][], align: ("l" | "r")[] = []) =>
  [
    `| ${head.join(" | ")} |`,
    `|${head.map((_, i) => (align[i] === "r" ? "---:" : "---")).join("|")}|`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");

const money = (c: number | null) => (c === null ? "Unknown" : formatCents(c));

// ---- H: bidder-specific clarifications --------------------------------------------------

function clarificationsFor(form: BidForm, p: Proposal, r: BidderResult): string[] {
  const q: string[] = [];
  for (const row of form.rows) {
    if (row.section !== "inclusion") continue;
    const answer = p.inclusions?.[row.id] ?? "not-stated";
    const item = row.label.replace(/\?$/, "");
    if (answer === "not-stated") q.push(`Please confirm: ${item}? If not, provide the add.`);
    const plugged = (p.adjustments ?? []).some((a) => a.covers === row.id);
    if (answer === "no" && row.scope && !plugged) q.push(`You exclude this: ${item.replace(/ included in base bid$/i, "")}. Please provide the add to include it.`);
    if (answer === "conflicting") q.push(`Your proposal both includes and excludes this: ${item}. Which is it, and what is the price effect?`);
  }
  for (const s of p.openScope ?? []) q.push(`Please price ${s}, or confirm it is included in your base.`);
  if (r.variance !== 0) {
    q.push(`Your line items total ${formatCents(r.mapped + r.unmapped)} but your stated base is ${formatCents(r.vendorBase)}. Please confirm the correct base.`);
  }
  if (r.unmapped) q.push(`${formatCents(r.unmapped)} of your price is not tied to a bid form line. Please say which scope it covers, or whether it is optional.`);
  for (const issue of p.sourceIssues ?? []) {
    if (/drawing/i.test(issue)) q.push("Please confirm the drawing set and date your price is based on.");
    else q.push(`Please clarify: ${issue}.`);
  }
  for (const flag of p.redFlags ?? []) {
    if (/validity/i.test(flag)) q.push("Can you hold pricing for at least 60 days?");
    else if (/escalation/i.test(flag)) q.push("Please firm your price or define the escalation basis and cap.");
    else if (/deposit|mobilization/i.test(flag)) q.push("Please confirm whether you can reduce the mobilization/deposit requirement.");
    else if (/budget/i.test(flag)) q.push("Please confirm whether this is a firm proposal or budget pricing.");
    else if (/option inside/i.test(flag)) q.push("Your total appears to include an option. Please confirm your base without it and price the option as an alternate.");
    else if (/bond/i.test(flag) && !(form.rows.some((x) => x.id === "inc-bond") && p.inclusions?.["inc-bond"])) q.push("Please provide your bond rate or add.");
  }
  return [...new Set(q)];
}

// ---- The package -------------------------------------------------------------------------

export function levelingPackage(form: BidForm, proposals: Proposal[]): LevelingPackage {
  const trade = levelTrade(form, proposals);
  const byId = new Map(proposals.map((p) => [p.id, p]));
  const leveled = trade.bidders.map((b) => byId.get(b.proposalId)!);
  const names = trade.bidders.map((b) => b.bidder);
  const plug = plugTable(trade, proposals);

  const clarifications = trade.bidders.map((b, i) => ({ bidder: b.bidder, questions: clarificationsFor(form, leveled[i], b) }));
  const ranking = trade.bidders.filter((b) => b.rankingEligible && b.normalized !== null).sort((a, b) => a.normalized! - b.normalized!);

  // C: alternates and adjustments, per bidder.
  const altRows = form.rows.filter((r) => r.section === "alternate");
  const adjustmentLines = leveled.flatMap((p) =>
    (p.adjustments ?? []).map((a) => [
      p.bidder,
      a.type.replace(/-/g, " "),
      formatCents(a.amount),
      a.type === "voluntary-deduct" && !a.accepted ? "Memo only, not accepted" : a.type === "scope-plug" ? "Estimating plug, not a vendor quote" : "Applied",
      a.reason,
    ]),
  );

  // D: scope matrix from line cells and inclusion answers.
  const scopeRows = form.rows.flatMap((row) => {
    if (row.section === "alternate") return [];
    return [
      [
        row.label,
        ...leveled.map((p) => {
          if (row.section === "inclusion") {
            const a = p.inclusions?.[row.id] ?? "not-stated";
            return a === "yes" ? "Included" : a === "no" ? "Excluded" : a === "conflicting" ? "Conflicting" : "Not stated";
          }
          const c = p.cells[row.id];
          if (!c || c.kind === "blank") return "";
          if (c.kind === "price") return "Priced";
          if (c.kind === "zero") return "Included, $0";
          if (c.kind === "excluded") return "Excluded";
          return `In ${form.rows.find((x) => x.id === c.inRow)?.label ?? c.inRow}`;
        }),
      ],
    ];
  });

  // F: comparison against the lowest eligible normalized number.
  const low = ranking[0];
  const deltaText = (b: BidderResult) => {
    if (b.normalized === null || !low) return UNKNOWN_NORMALIZED;
    if (!b.rankingEligible) return "Not eligible to rank yet";
    const d = b.normalized - low.normalized!;
    return d === 0 ? "Lowest eligible" : `+${formatCents(d)}`;
  };

  // I: the bottom line, in plain words.
  const headlineLow = [...trade.bidders].sort((a, b) => a.headline - b.headline)[0];
  const bottom: string[] = [];
  if (low) {
    bottom.push(`Lowest eligible normalized: ${low.bidder} at ${formatCents(low.normalized!)}.`);
    if (headlineLow && headlineLow.bidder !== low.bidder) {
      bottom.push(`Lowest headline is ${headlineLow.bidder} at ${formatCents(headlineLow.headline)}, but it is not the lowest complete number: see C, D, and G.`);
    }
  } else {
    bottom.push("No bidder is eligible to rank yet. Clear the clarifications in H first.");
  }
  const notEligible = trade.bidders.filter((b) => !b.rankingEligible).map((b) => b.bidder);
  if (notEligible.length) bottom.push(`Not eligible to rank yet: ${notEligible.join(", ")}.`);
  const memo = trade.bidders.filter((b) => b.memoVoluntaryDeducts > 0);
  if (memo.length) bottom.push(`Offered VE not accepted (not in any number above): ${memo.map((b) => `${b.bidder} ${formatCents(b.memoVoluntaryDeducts)}`).join(", ")}.`);
  bottom.push(`Carry: ${trade.bidders.map((b) => `${b.bidder} ${b.carry}`).join("; ")}. The carry is your call.`);

  const md = [
    `# ${form.pkg} leveling · ${form.project} · ${form.round}`,
    "",
    "## A. Bid form",
    "",
    formMarkdown(form).replace(/^### .*\n\n/, ""),
    "## B. Bidders plugged into the form",
    "",
    table(["Bid form line", ...names], plug.rows.map((r) => [r.label, ...r.cells]), ["l", ...names.map(() => "r" as const)]),
    "",
    `BuildingConnected status: ${names.map((n) => `${n}: **${plug.status[n]}**`).join(" · ")}`,
    "",
    "## C. Alternates / VE / adders",
    "",
    altRows.length
      ? table(["Alternate", ...names], altRows.map((row) => [row.label, ...leveled.map((p) => (p.alternates?.[row.id] === undefined ? "" : formatCents(p.alternates[row.id])))]))
      : "No alternates on the form.",
    "",
    adjustmentLines.length ? table(["Bidder", "Adjustment", "Amount", "Treatment", "Reason"], adjustmentLines) : "No leveling adjustments entered yet.",
    "",
    "## D. Scope matrix",
    "",
    table(["Scope", ...names], scopeRows),
    "",
    "## E. Tie-out to source proposals",
    "",
    table(
      ["", ...names],
      [
        ["Mapped to form lines", ...trade.bidders.map((b) => formatCents(b.mapped))],
        ["Unmapped (visible)", ...trade.bidders.map((b) => formatCents(b.unmapped))],
        ["Vendor stated base", ...trade.bidders.map((b) => formatCents(b.vendorBase))],
        ["Variance", ...trade.bidders.map((b) => (b.variance === 0 ? "$0.00 ties" : `**${formatCents(b.variance)}**`))],
      ],
      ["l", ...names.map(() => "r" as const)],
    ),
    "",
    "## F. Adjusted / normalized comparison",
    "",
    table(
      ["", ...names],
      [
        ["Headline (vendor base)", ...trade.bidders.map((b) => formatCents(b.headline))],
        ["Adjusted (required adds and accepted deducts)", ...trade.bidders.map((b) => formatCents(b.adjusted))],
        ["Normalized (plus plugs and allowance adjustments)", ...trade.bidders.map((b) => money(b.normalized))],
        ["Offered VE, memo only", ...trade.bidders.map((b) => (b.memoVoluntaryDeducts ? formatCents(b.memoVoluntaryDeducts) : ""))],
        ["Versus lowest eligible", ...trade.bidders.map(deltaText)],
      ],
      ["l", ...names.map(() => "r" as const)],
    ),
    "",
    "## G. Statuses and unresolved issues",
    "",
    table(
      ["", ...names],
      [
        ["Source integrity", ...trade.bidders.map((b) => b.sourceIntegrity)],
        ["BuildingConnected", ...trade.bidders.map((b) => b.plug)],
        ["Completeness", ...trade.bidders.map((b) => b.completeness)],
        ["Ranking", ...trade.bidders.map((b) => (b.rankingEligible ? "ELIGIBLE" : "NOT ELIGIBLE"))],
        ["Estimate carry", ...trade.bidders.map((b) => b.carry)],
      ],
    ),
    "",
    ...trade.bidders.flatMap((b) => (b.errors.length || b.flags.length ? [`**${b.bidder}**`, "", ...[...b.errors.map((e) => `- HOLD: ${e}`), ...b.flags.map((f) => `- ${f}`)], ""] : [])),
    "## H. Bidder-specific clarifications (drafts, not sent)",
    "",
    ...clarifications.flatMap((c) => [`**${c.bidder}**`, "", ...(c.questions.length ? c.questions.map((q, i) => `${i + 1}. ${q}`) : ["Nothing to clarify."]), ""]),
    "## I. Development bottom line",
    "",
    ...bottom.map((b) => `- ${b}`),
    "",
  ].join("\n");

  return { trade, clarifications, ranking, markdown: md };
}

// ---- Plug table as CSV, for Excel ---------------------------------------------------------

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** The B table as CSV: opens in Excel as a clean Bid Leveling tab. Amounts keep their cents. */
export function plugTableCsv(form: BidForm, proposals: Proposal[]): string {
  const trade = levelTrade(form, proposals);
  const plug = plugTable(trade, proposals);
  const lines = [
    ["Section", "Bid form line", ...plug.columns],
    ...plug.rows.map((r) => [r.section === "line" ? "Line Items" : r.section === "alternate" ? "Alternates" : "Inclusions", r.label, ...r.cells]),
    ["Status", "BuildingConnected", ...plug.columns.map((c) => plug.status[c])],
  ];
  return lines.map((l) => l.map(csvCell).join(",")).join("\n") + "\n";
}
