// The construction Pulse and calendar: right bands, right counts, and only the role's share.
import { test } from "node:test";
import assert from "node:assert/strict";
import { constructionPulse, budgetStatus } from "./pulse.ts";
import { constructionEvents } from "./calendar.ts";
import { portfolio, daysUntil } from "./portfolio.ts";

const everyone = () => true;
const coordinator = (a: string) => a === "general" || a === "students";
const pm = (a: string) => a !== "finance";

test("budget bands: under is on track, 0-3% over is watch, more than 3% over is act now", () => {
  assert.equal(budgetStatus(-1.2), "good");
  assert.equal(budgetStatus(0), "good");
  assert.equal(budgetStatus(0.2), "warn");
  assert.equal(budgetStatus(3), "warn");
  assert.equal(budgetStatus(3.1), "critical");
  const p = constructionPulse(everyone);
  const lines = p.sections.find((s) => s.title === "Estimate vs budget")!.lines;
  for (const e of portfolio.pricing.estimates) {
    const line = lines.find((l) => l.text.startsWith(e.name))!;
    assert.equal(line.status, budgetStatus(e.overUnderPct), e.name);
  }
});

test("tiles and TL;DR agree with the portfolio", () => {
  const p = constructionPulse(everyone);
  const due7 = portfolio.coverage.filter((c) => c.daysUntilDue >= 0 && c.daysUntilDue <= 7);
  assert.equal(p.tiles[0].value, String(due7.length));
  assert.match(p.tiles[0].context, new RegExp(`^${due7.filter((c) => c.coverageStatus === "AT RISK").length} at risk`));
  const bidPackages = portfolio.coverage.filter((c) => c.leveling !== "Budget pricing only");
  assert.equal(p.tiles[1].value, `${bidPackages.filter((c) => c.leveling === "Leveled").length} of ${bidPackages.length}`);
  assert.equal(p.overall, "critical");
  assert.match(p.priority, /Precast parking garage/);
  for (const w of p.thisWeek) assert.ok(daysUntil(w.iso) >= 0 && daysUntil(w.iso) <= 10, w.text);
});

test("roles without pricing see no dollars, no estimate section, and no decisions", () => {
  for (const can of [coordinator, pm]) {
    const p = constructionPulse(can);
    assert.doesNotMatch(JSON.stringify(p), /\$\d/);
    assert.ok(!p.sections.some((s) => s.title === "Estimate vs budget"));
    assert.doesNotMatch(p.context, /Decision by/);
  }
  assert.doesNotMatch(JSON.stringify(constructionPulse(coordinator)), /R-0\d/, "the Coordinator sees no risks");
  assert.match(JSON.stringify(constructionPulse(pm)), /R-03/, "the PM sees risks");
});

test("the pulse never reports entered, sent, or awarded, and never picks the low bid", () => {
  const text = JSON.stringify(constructionPulse(everyone));
  assert.doesNotMatch(text, /\bENTERED\b|\bsent\b|\bawarded\b|lowest bid/i);
  assert.match(text, /The carry is the Director's call/);
});

test("calendar: every bid date is there, nothing carries a dollar amount, and nothing is listed twice", () => {
  const events = constructionEvents();
  for (const c of portfolio.coverage) assert.ok(events.some((e) => e.date === c.bidDue && e.title.includes(c.trade) && e.deadline), c.package);
  assert.doesNotMatch(JSON.stringify(events), /\$\d/);
  const keys = events.map((e) => `${e.date}|${e.title}`);
  assert.equal(new Set(keys).size, keys.length);
  const ve = events.filter((e) => e.title.includes("VE-103-01"));
  assert.equal(ve.length, 1);
});

test("calendar: areas keep pricing and records away from roles that don't cover them", () => {
  const events = constructionEvents();
  assert.ok(events.every((e) => ["general", "finance", "students", "supports"].includes(e.area)));
  assert.ok(events.filter((e) => e.title.startsWith("Decision") || e.title.startsWith("Proposal validity")).every((e) => e.area === "finance"));
  assert.ok(events.filter((e) => e.title.startsWith("RFI-")).every((e) => e.area === "students"));
  assert.ok(events.filter((e) => e.title === "Development cost review").every((e) => e.area === "finance"));
});

test("calendar: standing meetings land on the right days", () => {
  const events = constructionEvents();
  const weekly = events.filter((e) => e.title === "Weekly precon meeting");
  assert.ok(weekly.length > 40 && weekly.every((e) => new Date(`${e.date}T12:00:00Z`).getUTCDay() === 1));
  const review = events.filter((e) => e.title === "Development cost review").map((e) => e.date);
  assert.ok(review.includes("2026-10-22") && !review.includes("2026-10-15"));
});
