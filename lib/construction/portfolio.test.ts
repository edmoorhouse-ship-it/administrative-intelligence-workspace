// The sample portfolio stays internally consistent, labeled as sample, and filtered by role.
import { test } from "node:test";
import assert from "node:assert/strict";
import { portfolio, portfolioFor, daysUntil, PORTFOLIO_AS_OF } from "./portfolio.ts";

test("every estimate ties: lines + markups = total, and over/under = total - budget", () => {
  for (const e of portfolio.pricing.estimates) {
    assert.equal(e.directCost, e.lines.reduce((a, l) => a + l.amount, 0), e.project);
    const markups = Object.values(e.markups).reduce((a, m) => a + m.amount, 0);
    assert.equal(e.total, e.directCost + markups, e.project);
    assert.equal(e.overUnderBudget, e.total - e.developmentBudget, e.project);
  }
  const t = portfolio.pricing.portfolioTotals;
  assert.equal(t.estimate, portfolio.pricing.estimates.reduce((a, e) => a + e.total, 0));
});

test("four projects, one per stage and product type, all in Florida", () => {
  assert.deepEqual(portfolio.projects.map((p) => p.stage).sort(), ["DD", "GMP", "Permit", "SD"]);
  assert.equal(portfolio.meta.region, "Florida");
});

test("coverage: closed packages never read as at risk, and open ones follow the three-bid target", () => {
  for (const c of portfolio.coverage) {
    if (c.daysUntilDue < 0) assert.ok(c.coverageStatus === "COVERED" || c.coverageStatus.startsWith("CLOSED WITH"), c.package);
    else if (c.submitted >= 3) assert.equal(c.coverageStatus, "COVERED", c.package);
    else if (c.submitted + c.stillBidding < 3) assert.equal(c.coverageStatus, "AT RISK", c.package);
  }
  const precast = portfolio.coverage.find((c) => c.package === "P-102 03-4000");
  assert.equal(precast?.coverageStatus, "AT RISK");
  assert.equal(daysUntil("2026-10-21"), 5);
  assert.equal(PORTFOLIO_AS_OF, "2026-10-16");
});

test("the carry is not the headline low, and headline spreads say so", () => {
  const concrete = portfolio.pricing.bidResults.find((b) => b.package === "P-103 03-3000");
  assert.ok(concrete && "headlineLow" in concrete);
  const carried = portfolio.pricing.estimates.find((e) => e.project === "P-103")!.lines.find((l) => l.division.startsWith("03"))!;
  assert.notEqual(carried.amount, concrete.headlineLow, "headline low excludes PT; the estimate carries the normalized low");
  assert.match(String(concrete.caution), /not leveled/);
});

test("voluntary credits are memo only and never counted as accepted savings", () => {
  const credit = portfolio.pricing.veLog.find((v) => v.id === "VE-103-03")!;
  assert.equal(credit.status, "Memo only");
  assert.equal(portfolio.pricing.veSummary.find((s) => s.project === "P-103")!.accepted, 0);
});

test("role filtering hides whole parts", () => {
  const coordinator = portfolioFor((a) => a === "general" || a === "students");
  assert.equal(coordinator.pricing, "Not shared with this role.");
  assert.equal(coordinator.contractsAndRisk, "Not shared with this role.");
  assert.ok(typeof coordinator.projectRecords === "object");
  const text = JSON.stringify(coordinator);
  assert.doesNotMatch(text, /developmentBudget|"base":/);
  assert.doesNotMatch(JSON.stringify(portfolio.coverage), /"base"|\$\d/, "coverage carries no amounts");
});

test("sample only: every bidder is labeled, and no real employer, project, or person names", () => {
  for (const c of portfolio.coverage) for (const b of c.bidders) assert.match(b.name, /\(sample\)$/, b.name);
  assert.doesNotMatch(JSON.stringify(portfolio), /greystar|nona|doral|marlowe|sandlake|cypress|hawk|moorhouse/i);
});
