// Bid form builder against the made-up samples: the form rules from the leveling spec, and the fit proof.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildBidForm, fitReport, formMarkdown, MULTIFAMILY_AREAS } from "./bid-form.ts";
import { parseProposal, toProposal } from "./intake.ts";
import { type BidForm, levelTrade, plugTable, toCents } from "./leveling.ts";

const $ = toCents;
const dir = join(import.meta.dirname, "samples");
const read = (f: string) => parseProposal(readFileSync(join(dir, f), "utf8"), f);
const summit = read("summit-drywall-rev2.txt");
const coastal = read("coastal-interiors-email.txt");
const bayline = read("bayline-walls-lump-sum.txt");
const records = [summit, coastal, bayline];

const built = buildBidForm({ project: "Sample Commons Apartments", round: "GMP", pkg: "09: Drywall", records });
const labels = (section: string) => built.form.rows.filter((r) => r.section === section).map((r) => r.label);

test("line items follow the project's areas, not one bidder", () => {
  assert.deepEqual(labels("line"), ["Residential", "Clubhouse / Amenity", "Garages", "Site", "Complete Drywall Scope - Combined"]);
});

test("a row nobody priced is left off unless the estimate needs it", () => {
  const onlyCoastal = buildBidForm({ project: "P", round: "GMP", pkg: "09: Drywall", records: [coastal] });
  assert.ok(!onlyCoastal.form.rows.some((r) => r.label === "Site"));
  assert.match(onlyCoastal.notes.join(" "), /No bidder priced Site/);
  const required = buildBidForm({
    project: "P", round: "GMP", pkg: "09: Drywall", records: [coastal],
    areas: MULTIFAMILY_AREAS.map((a) => (a.id === "site" ? { ...a, required: true } : a)),
  });
  assert.ok(required.form.rows.some((r) => r.label === "Site"));
});

test("the combined row is an optional fallback, only for a bidder with no breakout", () => {
  const combined = built.form.rows.find((r) => r.section === "line" && r.kind === "combined");
  assert.ok(combined && combined.section === "line");
  assert.deepEqual(combined.covers, ["res", "amenity", "garage", "site"]);
  assert.equal(built.mappings["BAYLINE WALL SYSTEMS"].baseRow, "combined");
  assert.equal(built.mappings["Coastal Interiors LLC"].baseRow, undefined);
  const noFallback = buildBidForm({ project: "P", round: "GMP", pkg: "09: Drywall", records: [summit, coastal] });
  assert.ok(!noFallback.form.rows.some((r) => r.section === "line" && r.kind === "combined"));
  assert.match(formMarkdown(built.form), /Combined \| Lump sum \| Optional \| Use this OR the lines above, never both/);
});

test("the same alternate from two bidders is one row; different ones stay separate", () => {
  assert.deepEqual(labels("alternate"), ["ADD - Level 5 finish at clubhouse lobby", 'DEDUCT - Substitute 1/2" board at unit ceilings']);
  assert.equal(Object.values(built.mappings["Coastal Interiors LLC"].alternates!)[0], "alt-2");
  assert.equal(Object.values(built.mappings["SUMMIT DRYWALL & ACOUSTICS, INC."].alternates!).length, 2);
});

test("Yes/No questions only for real issues, answered from each bidder's own words", () => {
  const inc = labels("inclusion");
  assert.ok(inc.includes("Sales tax included in base bid?")); // commercial, mentioned
  assert.ok(inc.includes("Exterior soffits and ceilings included in base bid?")); // bidders differ
  assert.ok(!inc.some((q) => /access panels|patching|fire caulk/i.test(q))); // nobody raised them
  const answers = (vendor: string) => built.mappings[vendor].inclusions!;
  assert.equal(answers("SUMMIT DRYWALL & ACOUSTICS, INC.")["inc-soffits"], "yes");
  assert.equal(answers("Coastal Interiors LLC")["inc-soffits"], "no");
  assert.equal(answers("BAYLINE WALL SYSTEMS")["inc-soffits"], "not-stated"); // silence is not an answer
  assert.equal(answers("Coastal Interiors LLC")["inc-tax"], "no");
  assert.equal(answers("BAYLINE WALL SYSTEMS")["inc-tax"], "yes");
});

test("every bidder fits the form without a fake breakout", () => {
  const fit = fitReport(built, records);
  assert.deepEqual(fit.map((f) => [f.vendor, f.fits, f.usesCombined]), [
    ["SUMMIT DRYWALL & ACOUSTICS, INC.", true, false],
    ["Coastal Interiors LLC", true, false],
    ["BAYLINE WALL SYSTEMS", true, true],
  ]);
  assert.equal(fit[0].unmapped, 0);
  // Coastal's $64,000 option matches no area: it stays visible, not hidden in a line.
  assert.equal(fit[1].unmapped, $("64,000"));
  assert.match(built.notes.join(" "), /Option - upgraded sound board .* stay visible as unmapped/);
});

test("a form you already made is used as-is", () => {
  const mine: BidForm = {
    project: "P", round: "GMP", pkg: "09: Drywall",
    rows: [
      { id: "r1", section: "line", label: "Residential", kind: "base" },
      { id: "r2", section: "line", label: "Clubhouse", kind: "base" },
      { id: "r3", section: "line", label: "Garages", kind: "base" },
      { id: "r4", section: "line", label: "Complete Scope - Combined", kind: "combined", covers: ["r1", "r2", "r3"] },
      { id: "q1", section: "inclusion", label: "Exterior soffits included in base bid?" },
    ],
  };
  const result = buildBidForm({ project: "P", round: "GMP", pkg: "09: Drywall", records, existing: mine });
  assert.equal(result.form, mine);
  // Summit's site line has no row on this form, so it stays unmapped rather than forced into another line.
  const fit = fitReport(result, records);
  assert.ok(fit.every((f) => f.fits));
  assert.equal(fit[0].unmapped, $("18,400"));
  assert.equal(result.mappings["Coastal Interiors LLC"].inclusions!.q1, "no");
});

test("ambiguous breakouts are not guessed", () => {
  const odd = parseProposal("Vendor: Test Co\nBASE BID\nClubhouse garage level   $10,000.00\nTotal   $10,000.00\n", "odd.txt");
  const result = buildBidForm({ project: "P", round: "GMP", pkg: "09: Drywall", records: [odd] });
  assert.deepEqual(result.mappings["Test Co"].lines, {});
  assert.match(result.notes.join(" "), /could be Clubhouse \/ Amenity or Garages/);
});

test("form, mappings, engine, and plug table work end to end", () => {
  const proposals = records.map((r) => toProposal(r, built.form, built.mappings[r.vendor]));
  const trade = levelTrade(built.form, proposals);
  const table = plugTable(trade, proposals);
  assert.deepEqual(table.rows.find((r) => r.label === "Residential")!.cells, ["$2,388,000.00", "$2,150,000.00", ""]);
  assert.deepEqual(table.rows.find((r) => r.label.startsWith("Complete"))!.cells, ["", "", "$2,590,000.00"]);
  assert.deepEqual(table.rows.find((r) => r.label.startsWith("DEDUCT"))!.cells, ["$38,500.00", "$41,000.00", ""]);
  assert.deepEqual(trade.bidders.map((b) => b.plug), ["READY TO PLUG", "READY TO PLUG", "READY TO PLUG"]);
});
