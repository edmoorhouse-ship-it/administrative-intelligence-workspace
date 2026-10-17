// Proposal intake against the made-up samples in ./samples, then straight into the leveling engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { currentRecords, NOT_STATED, parseProposal, recordMarkdown, toProposal } from "./intake.ts";
import { type BidForm, levelTrade, plugTable, toCents } from "./leveling.ts";
import { hasPdfToText, pdfToText } from "./pdf.ts";

const $ = toCents;
const dir = join(import.meta.dirname, "samples");
const read = (f: string) => parseProposal(readFileSync(join(dir, f), "utf8"), f);

const summit1 = read("summit-drywall-rev1.txt");
const summit2 = read("summit-drywall-rev2.txt");
const coastal = read("coastal-interiors-email.txt");
const bayline = read("bayline-walls-lump-sum.txt");

test("itemized proposal: every field, source-locked, ties to the cent", () => {
  assert.equal(summit1.vendor, "SUMMIT DRYWALL & ACOUSTICS, INC.");
  assert.equal(summit1.project, "Sample Commons Apartments");
  assert.equal(summit1.trade, "09 Drywall");
  assert.equal(summit1.revision, 1);
  assert.equal(summit1.drawingBasis, "GMP Set dated 08/15/2026, Sheets A0.01-A9.12");
  assert.equal(summit1.vendorBase?.value, $("2,707,900.00"));
  assert.deepEqual(summit1.breakouts.map((b) => [b.label, b.amount]), [
    ["Residential Buildings 1-4 (drywall, framing, insulation)", $("2,410,500")],
    ["Clubhouse", $("186,240")],
    ["Garages (6 EA)", $("92,760")],
    ["Site / Trash Enclosure", $("18,400")],
  ]);
  assert.equal(summit1.mathVariance, 0);
  assert.deepEqual(summit1.alternates.map((a) => [a.direction, a.amount]), [["add", $("14,200")], ["deduct", $("38,500")]]);
  assert.equal(summit1.allowances[0].inBase, true);
  // "Additional ... per SF" is a unit price, not an ADD alternate.
  assert.deepEqual(summit1.unitPrices.map((u) => u.amount), [$("2.85")]);
  assert.equal(summit1.inclusions.length, 4);
  assert.equal(summit1.exclusions.length, 4);
  assert.deepEqual(summit1.redFlags.map((f) => f.value), ["Bond excluded"]);
  // Source-locked: the base total points at its own line.
  assert.match(summit1.vendorBase!.text, /TOTAL BASE BID/);
});

test("problem email: math gap shown, not repaired; every red flag found; missing fields NOT STATED", () => {
  assert.equal(coastal.vendor, "Coastal Interiors LLC");
  assert.equal(coastal.drawingBasis, NOT_STATED);
  assert.equal(coastal.trade, NOT_STATED);
  assert.equal(coastal.revision, null);
  assert.equal(coastal.vendorBase?.value, $("2,463,500"));
  assert.equal(coastal.calculatedBase, $("2,473,500"));
  assert.equal(coastal.mathVariance, -$("10,000"));
  const flags = coastal.redFlags.map((f) => f.value).join(" | ");
  for (const expected of [/Short validity: 15 days/, /escalation/, /30%/, /Budget/, /Bond excluded/, /Option inside the base total/, /No drawing set/, /Math does not tie/]) {
    assert.match(flags, expected);
  }
  // Silence is not inclusion: no inclusions section means none are invented.
  assert.equal(coastal.inclusions.length, 0);
  assert.deepEqual(coastal.alternates.map((a) => [a.direction, a.amount]), [["deduct", $("41,000")]]);
});

test("lump-sum budget proposal: base kept, no fake breakouts", () => {
  assert.equal(bayline.vendorBase?.value, $("2,590,000"));
  assert.equal(bayline.breakouts.length, 0);
  assert.equal(bayline.calculatedBase, null);
  assert.equal(bayline.mathVariance, null);
  assert.deepEqual(bayline.exclusions.map((e) => e.value), ["bond", "permits", "after-hours work"]);
  assert.match(recordMarkdown(bayline), /\| NOT STATED \| \| \|/);
});

test("revisions: the latest is current, the earlier one is kept as superseded", () => {
  const [group] = currentRecords([summit1, summit2]);
  assert.equal(group.current.revision, 2);
  assert.deepEqual(group.superseded.map((s) => s.revision), [1]);
});

test("PDF in, same record out", { skip: !hasPdfToText() && "pdftotext not installed (brew install poppler)" }, () => {
  const fromPdf = parseProposal(pdfToText(join(dir, "summit-drywall-rev1.pdf")), "summit-drywall-rev1.pdf");
  assert.equal(fromPdf.vendorBase?.value, summit1.vendorBase?.value);
  assert.deepEqual(fromPdf.breakouts.map((b) => b.amount), summit1.breakouts.map((b) => b.amount));
  assert.equal(fromPdf.mathVariance, 0);
  assert.equal(fromPdf.revision, 1);
});

test("end to end: three proposals leveled on one form", () => {
  const form: BidForm = {
    project: "Sample Commons Apartments",
    round: "GMP",
    pkg: "09: Drywall",
    rows: [
      { id: "res", section: "line", label: "Residential", kind: "base" },
      { id: "club", section: "line", label: "Clubhouse", kind: "base" },
      { id: "garage", section: "line", label: "Garages", kind: "base" },
      { id: "site", section: "line", label: "Site / Trash Enclosure", kind: "base" },
      { id: "all", section: "line", label: "Complete Drywall Scope - Combined", kind: "combined", covers: ["res", "club", "garage", "site"] },
      { id: "alt-board", section: "alternate", label: "DEDUCT - 1/2\" board at unit ceilings", direction: "deduct" },
      { id: "inc-soffits", section: "inclusion", label: "Exterior soffits included in base bid?" },
    ],
  };
  const summit = toProposal(summit2, form, {
    lines: {
      "Residential Buildings 1-4 (drywall, framing, insulation)": "res",
      Clubhouse: "club",
      "Garages (6 EA)": "garage",
      "Site / Trash Enclosure": "site",
    },
    alternates: { 'DEDUCT - Substitute 1/2" board at unit ceilings': "alt-board" },
    inclusions: { "inc-soffits": "yes" },
  });
  // The $64,000 option is left unmapped on purpose: it stays visible instead of hiding in a line.
  const coast = toProposal(coastal, form, {
    lines: { "Units / corridors": "res", Clubhouse: "club", Garages: "garage" },
    inclusions: { "inc-soffits": "no" },
  });
  const bay = toProposal(bayline, form, { baseRow: "all" });

  const trade = levelTrade(form, [summit, coast, bay]);
  const [s, c, b] = trade.bidders;

  assert.equal(s.variance, 0);
  assert.equal(s.sourceIntegrity, "VERIFIED");
  assert.equal(s.plug, "READY TO PLUG");

  assert.equal(c.unmapped, $("64,000"));
  assert.equal(c.variance, -$("10,000"));
  assert.equal(c.sourceIntegrity, "SOURCE ISSUE"); // no drawing basis outranks the math gap
  assert.equal(c.rankingEligible, false);
  assert.match(c.flags.join(" "), /Red flag: Short validity/);

  assert.equal(b.variance, 0);
  assert.equal(b.completeness, "CLARIFICATION REQUIRED"); // soffits not stated
  assert.match(b.flags.join(" "), /Not stated: Exterior soffits/);

  const table = plugTable(trade, [summit, coast, bay]);
  assert.deepEqual(table.columns, ["SUMMIT DRYWALL & ACOUSTICS, INC.", "Coastal Interiors LLC", "BAYLINE WALL SYSTEMS"]);
  assert.deepEqual(table.rows.find((r) => r.label === "Residential")!.cells, ["$2,388,000.00", "$2,150,000.00", ""]);
  assert.deepEqual(table.rows.find((r) => r.label.startsWith("Complete"))!.cells, ["", "", "$2,590,000.00"]);
  assert.deepEqual(table.rows.find((r) => r.section === "inclusion")!.cells, ["Yes", "No", ""]);
});
