// The A-I leveling package against the made-up samples and the spec's worked example.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildBidForm } from "./bid-form.ts";
import { parseProposal, toProposal } from "./intake.ts";
import { type BidForm, type Proposal, toCents } from "./leveling.ts";
import { levelingPackage, plugTableCsv } from "./leveling-sheet.ts";

const $ = toCents;
const dir = join(import.meta.dirname, "samples");
const records = ["summit-drywall-rev2.txt", "coastal-interiors-email.txt", "bayline-walls-lump-sum.txt"].map((f) => parseProposal(readFileSync(join(dir, f), "utf8"), f));
const built = buildBidForm({ project: "Sample Commons Apartments", round: "GMP", pkg: "09: Drywall", records });
const proposals = records.map((r) => toProposal(r, built.form, built.mappings[r.vendor]));
const pkg = levelingPackage(built.form, proposals);
const md = pkg.markdown;

test("all nine deliverables, A to I, in order", () => {
  const order = ["## A. Bid form", "## B. Bidders plugged", "## C. Alternates", "## D. Scope matrix", "## E. Tie-out", "## F. Adjusted / normalized", "## G. Statuses", "## H. Bidder-specific", "## I. Development bottom line"];
  const at = order.map((h) => md.indexOf(h));
  assert.ok(at.every((i) => i >= 0), `missing: ${order.filter((_, i) => at[i] < 0).join(", ")}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at);
});

test("companies across, form lines down, cents kept", () => {
  assert.match(md, /\| Bid form line \| SUMMIT DRYWALL & ACOUSTICS, INC\. \| Coastal Interiors LLC \| BAYLINE WALL SYSTEMS \|/);
  assert.match(md, /\| Residential \| \$2,388,000\.00 \| \$2,150,000\.00 \|  \|/);
  assert.match(md, /BuildingConnected status: .*READY TO PLUG/);
  assert.doesNotMatch(md, /ENTERED/);
});

test("tie-out shows the gap instead of fixing it", () => {
  assert.match(md, /\| Variance \| \$0\.00 ties \| \*\*-\$10,000\.00\*\* \| \$0\.00 ties \|/);
  assert.match(md, /\| Unmapped \(visible\) \| \$0\.00 \| \$64,000\.00 \| \$0\.00 \|/);
});

test("clarifications are bidder-specific and skip what each bidder already answered", () => {
  const q = (name: string) => pkg.clarifications.find((c) => c.bidder === name)!.questions.join("\n");
  // Summit confirmed soffits and the unbalanced wall: it is not asked about them.
  assert.doesNotMatch(q("SUMMIT DRYWALL & ACOUSTICS, INC."), /soffits|unbalanced/i);
  // Coastal is asked about its own problems, not anyone else's.
  for (const re of [/stated base is \$2,463,500\.00/, /\$64,000\.00 of your price/, /drawing set/, /60 days/, /escalation/, /mobilization/, /option/]) assert.match(q("Coastal Interiors LLC"), re);
  // Bayline never mentioned soffits, so it is asked; it already said tax is included, so it is not.
  assert.match(q("BAYLINE WALL SYSTEMS"), /Exterior soffits/);
  assert.doesNotMatch(q("BAYLINE WALL SYSTEMS"), /Sales tax/);
  assert.match(md, /## H\. Bidder-specific clarifications \(drafts, not sent\)/);
});

test("a bidder silent on scope others included is not ranked, however low its number", () => {
  // Bayline never says whether soffits, unbalanced walls, or deflection track are in; Summit includes them.
  assert.deepEqual(pkg.ranking.map((b) => b.bidder), ["SUMMIT DRYWALL & ACOUSTICS, INC."]);
  const bay = pkg.trade.bidders.find((b) => b.bidder === "BAYLINE WALL SYSTEMS")!;
  assert.equal(bay.normalized, null);
  assert.match(md, /Lowest eligible normalized: SUMMIT DRYWALL & ACOUSTICS, INC\. at \$2,685,400\.00\./);
  // Coastal excludes soffits outright: it is asked to price them; Summit, which includes them, is not.
  const coastalQs = pkg.clarifications.find((c) => c.bidder === "Coastal Interiors LLC")!.questions.join("\n");
  assert.match(coastalQs, /You exclude this: Exterior soffits and ceilings\. Please provide the add/);
});

test("bottom line ranks only eligible bidders and leaves the carry to the user", () => {
  assert.ok(pkg.ranking.every((b) => b.rankingEligible));
  assert.ok(!pkg.ranking.some((b) => b.bidder === "Coastal Interiors LLC"));
  assert.match(md, /Not eligible to rank yet: .*Coastal Interiors LLC/);
  assert.match(md, /The carry is your call\./);
  assert.doesNotMatch(md, /CARRY RECOMMENDED/);
});

test("the spec's worked example: headline low is not the normalized low", () => {
  const form: BidForm = {
    project: "Sample", round: "GMP", pkg: "09: Stucco",
    rows: [
      { id: "res", section: "line", label: "Residential / Amenities", kind: "base" },
      { id: "site", section: "line", label: "Site", kind: "base" },
      { id: "all", section: "line", label: "Combined", kind: "combined", covers: ["res", "site"] },
      { id: "q", section: "inclusion", label: "Exterior ceilings included?", scope: true },
    ],
  };
  const deduct = { type: "confirmed-deduct" as const, amount: $("20,000"), reason: "Feature deleted" };
  const p = (id: string, cells: Proposal["cells"], base: string, inc: "yes" | "no", adj: Proposal["adjustments"]): Proposal => ({
    id, bidder: id, date: "2026-10-01", revision: 1, vendorBase: $(base), cells, inclusions: { q: inc }, adjustments: adj,
  });
  const price = (a: string) => ({ kind: "price" as const, amount: $(a), evidence: "VENDOR CONFIRMED" as const });
  const result = levelingPackage(form, [
    p("Sub A", { res: price("900,000"), site: price("100,000") }, "1,000,000", "no", [
      { type: "scope-plug", amount: $("60,000"), reason: "Ceilings", covers: "q" },
      { type: "allowance-adjustment", amount: $("20,000"), reason: "Allowance to $50,000" },
      deduct,
      { type: "voluntary-deduct", amount: $("25,000"), reason: "VE offered" },
    ]),
    p("Sub B", { res: price("930,000"), site: price("100,000") }, "1,030,000", "yes", [deduct, { type: "voluntary-deduct", amount: $("15,000"), reason: "VE offered" }]),
    p("Sub C", { all: price("1,070,000") }, "1,070,000", "yes", [deduct, { type: "voluntary-deduct", amount: $("40,000"), reason: "VE offered" }]),
  ]);
  assert.deepEqual(result.ranking.map((b) => [b.bidder, b.normalized]), [["Sub B", $("1,010,000")], ["Sub C", $("1,050,000")], ["Sub A", $("1,060,000")]]);
  assert.match(result.markdown, /Lowest eligible normalized: Sub B at \$1,010,000\.00\./);
  assert.match(result.markdown, /Lowest headline is Sub A at \$1,000,000\.00, but it is not the lowest complete number/);
  assert.match(result.markdown, /Offered VE not accepted .*Sub B \$15,000\.00/);
  assert.match(result.markdown, /\| Sub A \| scope plug \| \$60,000\.00 \| Estimating plug, not a vendor quote \|/);
});

test("plug table CSV opens in Excel with cents and statuses", () => {
  const csv = plugTableCsv(built.form, proposals).split("\n");
  assert.equal(csv[0], "Section,Bid form line,\"SUMMIT DRYWALL & ACOUSTICS, INC.\",Coastal Interiors LLC,BAYLINE WALL SYSTEMS");
  assert.ok(csv.includes('Line Items,Residential,"$2,388,000.00","$2,150,000.00",'));
  assert.ok(csv.some((l) => l.startsWith("Status,BuildingConnected,READY TO PLUG")));
});
