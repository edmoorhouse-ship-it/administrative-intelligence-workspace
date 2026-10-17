// Run with: npm test
// One test per acceptance rule in docs/construction/leveling-spec.md, plus the worked example.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type BidForm,
  type Proposal,
  duplicateScope,
  formatCents,
  levelBidder,
  levelTrade,
  normalizedDelta,
  plugTable,
  toCents,
  UNKNOWN_NORMALIZED,
} from "./leveling.ts";

const $ = toCents;

const form: BidForm = {
  project: "Sample Project",
  round: "GMP",
  pkg: "09: Drywall",
  rows: [
    { id: "res", section: "line", label: "Residential", kind: "base" },
    { id: "site", section: "line", label: "Site", kind: "base" },
    { id: "all", section: "line", label: "Complete Scope - Combined", kind: "combined", covers: ["res", "site"] },
    { id: "alt-ve", section: "alternate", label: "DEDUCT - VE Board Type", direction: "deduct" },
    { id: "inc-ceilings", section: "inclusion", label: "Exterior ceilings included in base bid?" },
  ],
};

// The handoff's illustrative sheet: basis includes exterior ceilings and a $50,000 allowance, and
// one decorative feature is removed by a confirmed $20,000 deduct.
const subA: Proposal = {
  id: "a1", bidder: "Sub A", date: "2026-10-01", revision: 1, vendorBase: $("1,000,000"),
  cells: { res: { kind: "price", amount: $("900,000"), evidence: "VENDOR CONFIRMED" }, site: { kind: "price", amount: $("100,000"), evidence: "VENDOR CONFIRMED" } },
  inclusions: { "inc-ceilings": "no" },
  adjustments: [
    { type: "scope-plug", amount: $("60,000"), reason: "Exterior ceilings excluded; estimated" },
    { type: "allowance-adjustment", amount: $("20,000"), reason: "Allowance $30,000 to $50,000" },
    { type: "confirmed-deduct", amount: $("20,000"), reason: "Decorative feature deleted" },
    { type: "voluntary-deduct", amount: $("25,000"), reason: "VE offered, not accepted" },
  ],
};
const subB: Proposal = {
  id: "b1", bidder: "Sub B", date: "2026-10-01", revision: 1, vendorBase: $("1,030,000"),
  cells: { res: { kind: "price", amount: $("930,000"), evidence: "VENDOR CONFIRMED" }, site: { kind: "price", amount: $("100,000"), evidence: "VENDOR CONFIRMED" } },
  inclusions: { "inc-ceilings": "yes" },
  adjustments: [
    { type: "confirmed-deduct", amount: $("20,000"), reason: "Decorative feature deleted" },
    { type: "voluntary-deduct", amount: $("15,000"), reason: "VE offered, not accepted" },
  ],
};
const subC: Proposal = {
  id: "c1", bidder: "Sub C", date: "2026-10-01", revision: 1, vendorBase: $("1,070,000"),
  cells: { all: { kind: "price", amount: $("1,070,000"), evidence: "VENDOR CONFIRMED" } },
  inclusions: { "inc-ceilings": "yes" },
  adjustments: [
    { type: "confirmed-deduct", amount: $("20,000"), reason: "Decorative feature deleted" },
    { type: "voluntary-deduct", amount: $("40,000"), reason: "VE offered, not accepted" },
  ],
};

test("worked example: lowest headline is not lowest normalized", () => {
  const trade = levelTrade(form, [subA, subB, subC]);
  const [a, b, c] = trade.bidders;
  assert.deepEqual([a.headline, b.headline, c.headline], [$("1,000,000"), $("1,030,000"), $("1,070,000")]);
  assert.deepEqual([a.normalized, b.normalized, c.normalized], [$("1,060,000"), $("1,010,000"), $("1,050,000")]);
  // B's carry basis is $1,010,000, not $995,000: the unaccepted $15,000 VE credit is memo only.
  assert.equal(b.memoVoluntaryDeducts, $("15,000"));
  assert.equal(normalizedDelta(a, b), "Sub B is $50,000.00 lower than Sub A after normalizing.");
  for (const x of trade.bidders) {
    assert.equal(x.variance, 0);
    assert.equal(x.plug, "READY TO PLUG");
    assert.equal(x.carry, "NOT EVALUATED");
  }
});

test("1. a bundled amount is never counted twice", () => {
  const both: Proposal = {
    ...subC, id: "c-bad",
    cells: { ...subC.cells, res: { kind: "price", amount: $("1,070,000"), evidence: "VENDOR CONFIRMED" } },
  };
  const r = levelBidder(form, both);
  assert.equal(r.plug, "HOLD");
  assert.match(r.errors.join(" "), /both priced/);
  assert.equal(r.variance, -$("1,070,000"));
  // Included elsewhere must point at a row that actually holds the money.
  const elsewhere: Proposal = { ...subC, id: "c-ok", cells: { ...subC.cells, site: { kind: "included-elsewhere", inRow: "all" } } };
  assert.deepEqual(levelBidder(form, elsewhere).errors, []);
});

test("2. an unpriced item never becomes a confirmed $0", () => {
  const blankSite: Proposal = { ...subA, id: "a-blank", vendorBase: $("900,000"), cells: { res: subA.cells.res }, adjustments: [] };
  const r = levelBidder(form, blankSite);
  const table = plugTable(levelTrade(form, [blankSite]), [blankSite]);
  assert.equal(table.rows.find((x) => x.label === "Site")!.cells[0], "");
  assert.equal(r.mapped, $("900,000"));
  // Inclusions nobody answered stay unanswered, not "No".
  const noAnswer = levelBidder(form, { ...subB, id: "b-na", inclusions: {} });
  assert.equal(noAnswer.completeness, "CLARIFICATION REQUIRED");
  assert.match(noAnswer.flags.join(" "), /Not stated: Exterior ceilings/);
});

test("3. a source vs mapped mismatch stays open, to the cent", () => {
  const p: Proposal = {
    id: "w1", bidder: "Sub W", date: "2026-10-01", revision: 1, vendorBase: $("3,974,248.60"),
    cells: { all: { kind: "price", amount: $("3,794,921"), evidence: "VENDOR CONFIRMED" } },
    inclusions: { "inc-ceilings": "yes" },
  };
  const r = levelBidder(form, p);
  assert.equal(r.sourceIntegrity, "MATH ISSUE");
  assert.equal(r.variance, $("179,327.60"));
  assert.equal(r.rankingEligible, false);
  assert.equal(r.plug, "READY TO PLUG"); // still plug-able, not rankable
  assert.match(r.flags.join(" "), /\$179,327\.60/);
});

test("4. a voluntary deduct never lowers the carry until accepted", () => {
  const offered = levelBidder(form, subB);
  const accepted = levelBidder(form, {
    ...subB, id: "b-acc",
    adjustments: subB.adjustments!.map((a) => (a.type === "voluntary-deduct" ? { ...a, accepted: true } : a)),
  });
  assert.equal(offered.normalized, $("1,010,000"));
  assert.equal(accepted.normalized, $("995,000"));
  assert.equal(accepted.memoVoluntaryDeducts, 0);
});

test("5. a revised proposal never erases its predecessor; only the latest is leveled", () => {
  const rev2: Proposal = { ...subB, id: "b2", revision: 2, vendorBase: $("1,020,000"), cells: { ...subB.cells, res: { kind: "price", amount: $("920,000"), evidence: "VENDOR CONFIRMED" } } };
  const [b] = levelTrade(form, [subB, rev2]).bidders;
  assert.equal(b.proposalId, "b2");
  assert.deepEqual(b.history, ["b1"]);
  assert.equal(b.headline, $("1,020,000"));
});

test("6. scope moved between packages is never priced in both", () => {
  const dupes = duplicateScope([
    { pkg: "06: Framing", pricedScope: ["Rough framing", "Building wrap"] },
    { pkg: "09: Stucco", pricedScope: ["Stucco", "building wrap "] },
  ]);
  assert.deepEqual(dupes, [{ scope: "building wrap", packages: ["06: Framing", "09: Stucco"] }]);
});

test("7. nothing is reported as entered unless the user confirmed it", () => {
  assert.equal(levelBidder(form, subA).plug, "READY TO PLUG");
  assert.equal(levelBidder(form, { ...subA, enteredInBc: true }).plug, "ENTERED");
  const table = plugTable(levelTrade(form, [subA, subB]), [subA, subB]);
  assert.deepEqual(Object.values(table.status), ["READY TO PLUG", "READY TO PLUG"]);
});

test("8. mapped + unmapped ties to the vendor base, and unmapped dollars stay visible", () => {
  const p: Proposal = { ...subA, id: "a-un", vendorBase: $("1,020,000"), unmapped: $("20,000") };
  const r = levelBidder(form, p);
  assert.equal(r.variance, 0);
  assert.equal(r.unmapped, $("20,000"));
  assert.match(r.flags.join(" "), /\$20,000\.00 of vendor dollars are not mapped/);
});

test("9. unpriced material scope is never labeled normalized", () => {
  const open = levelBidder(form, { ...subC, id: "c-open", openScope: ["Garage ceilings"] });
  assert.equal(open.normalized, null);
  assert.equal(open.rankingEligible, false);
  assert.equal(open.completeness, "CLARIFICATION REQUIRED");
  assert.equal(normalizedDelta(levelBidder(form, subB), open), UNKNOWN_NORMALIZED);
});

test("money keeps its cents", () => {
  assert.equal(toCents("$3,974,248.60"), 397424860);
  assert.equal(formatCents(397424860), "$3,974,248.60");
  assert.equal(formatCents(-2000000), "-$20,000.00");
  assert.throws(() => toCents("about 5k"));
  // Deducts are magnitudes: a negative line or adjustment is refused.
  const neg = levelBidder(form, { ...subA, id: "neg", adjustments: [{ type: "confirmed-deduct", amount: -100, reason: "wrong sign" }] });
  assert.equal(neg.plug, "HOLD");
});
