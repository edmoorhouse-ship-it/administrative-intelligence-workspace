/**
 * The whole chain in one call, shared by the Bid leveling page and `npm run level`: proposal texts ->
 * records -> bid form -> mapped proposals -> the A-I package. Pure: give it text, get results.
 * Nothing leaves the computer and no AI model is involved.
 */

import { buildBidForm, fitReport, formMarkdown, type FitLine } from "./bid-form.ts";
import { currentRecords, NOT_STATED, parseProposal, recordMarkdown, toProposal } from "./intake.ts";
import type { Cents, Completeness, PlugStatus, SourceIntegrity, CarryStatus } from "./leveling.ts";
import { levelingPackage, plugTableCsv } from "./leveling-sheet.ts";

export interface ProposalText {
  /** File name, or "Pasted proposal 1". Kept as the evidence source. */
  name: string;
  text: string;
}

export interface BidderSummary {
  bidder: string;
  headline: Cents;
  normalized: Cents | null;
  variance: Cents;
  unmapped: Cents;
  sourceIntegrity: SourceIntegrity;
  plug: PlugStatus;
  completeness: Completeness;
  rankingEligible: boolean;
  carry: CarryStatus;
  questions: number;
}

export interface LevelingRun {
  project: string;
  pkg: string;
  round: string;
  bidders: BidderSummary[];
  /** Eligible bidders, lowest normalized first. */
  ranking: string[];
  superseded: string[];
  records: string[];
  formMarkdown: string;
  fit: FitLine[];
  notes: string[];
  packageMarkdown: string;
  csv: string;
}

export function runLeveling(inputs: ProposalText[], pkg: string, round: string): LevelingRun {
  const groups = currentRecords(inputs.map((i) => parseProposal(i.text, i.name)));
  const records = groups.map((g) => g.current);
  const project = records.find((r) => r.project !== NOT_STATED)?.project ?? NOT_STATED;
  const built = buildBidForm({ project, round, pkg, records });
  const proposals = records.map((r) => toProposal(r, built.form, built.mappings[r.vendor] ?? {}));
  const pack = levelingPackage(built.form, proposals);

  return {
    project,
    pkg,
    round,
    bidders: pack.trade.bidders.map((b) => ({
      bidder: b.bidder,
      headline: b.headline,
      normalized: b.normalized,
      variance: b.variance,
      unmapped: b.unmapped,
      sourceIntegrity: b.sourceIntegrity,
      plug: b.plug,
      completeness: b.completeness,
      rankingEligible: b.rankingEligible,
      carry: b.carry,
      questions: pack.clarifications.find((c) => c.bidder === b.bidder)?.questions.length ?? 0,
    })),
    ranking: pack.ranking.map((b) => b.bidder),
    superseded: groups.flatMap((g) => g.superseded.map((s) => `${s.source} (rev ${s.revision ?? NOT_STATED}) is superseded by ${g.current.source}; only the latest is leveled.`)),
    records: records.map(recordMarkdown),
    formMarkdown: formMarkdown(built.form),
    fit: fitReport(built, records),
    notes: built.notes,
    packageMarkdown: pack.markdown,
    csv: plugTableCsv(built.form, proposals),
  };
}
