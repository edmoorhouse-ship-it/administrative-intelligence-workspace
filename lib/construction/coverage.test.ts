// The coverage board: open means "owes a proposal", the call list is in the right order, and nothing carries amounts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageBoard, STALE_DAYS } from "./coverage.ts";
import { portfolio } from "./portfolio.ts";

const board = coverageBoard();
const trades = board.projects.flatMap((p) => p.trades);

test("every bid package is on the board once, under its project", () => {
  assert.equal(trades.length, portfolio.coverage.length);
  for (const p of board.projects) for (const t of p.trades) assert.equal(t.project, p.id);
  assert.equal(board.projects[0].name, "Saltmarsh Commons", "the project with the soonest open due date leads");
});

test("open means bidding or no response; submitted and declined are not open", () => {
  for (const t of trades)
    for (const b of t.bidders) assert.equal(b.open, b.status === "Bidding" || b.status === "No response", `${t.package} ${b.name}`);
});

test("chase: silent bidders always, bidding ones only after the quiet period, and never on closed packages", () => {
  for (const t of trades)
    for (const b of t.bidders) {
      if (t.closed) assert.equal(b.chase, false, `${t.package} ${b.name}`);
      else if (b.status === "No response") assert.equal(b.chase, true);
      else if (b.status === "Bidding") assert.equal(b.chase, b.daysSinceContact >= STALE_DAYS);
      else assert.equal(b.chase, false);
    }
  assert.equal(board.summary.toChase, board.callList.length);
  assert.equal(board.chaseEmails.length, board.callList.length);
});

test("call list: at-risk trades first, then soonest due, then longest silence", () => {
  const order = (s: string) => (s === "AT RISK" ? 0 : s === "WATCH" ? 1 : 2);
  for (let i = 1; i < board.callList.length; i++) {
    const [a, b] = [board.callList[i - 1], board.callList[i]];
    const key = (c: typeof a) => [order(c.coverageStatus), c.daysUntilDue, -c.daysSinceContact];
    const [ka, kb] = [key(a), key(b)];
    const cmp = ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    assert.ok(cmp <= 0, `${a.bidder} before ${b.bidder}`);
  }
  assert.match(board.callList[0].trade, /Precast/);
});

test("find more bidders: only open trades that can't reach the target, with the right count", () => {
  for (const f of board.findMore) {
    const t = trades.find((x) => x.package === f.package)!;
    assert.ok(!t.closed);
    assert.equal(f.needMore, board.target - (t.submitted + t.stillBidding));
    assert.ok(f.needMore > 0);
  }
  const precast = board.findMore.find((f) => f.package === "P-102 03-4000")!;
  assert.equal(precast.needMore, 2);
  assert.ok(!board.findMore.some((f) => f.package === "P-102 06-1000"), "covered framing needs nobody");
});

test("chase emails are bidder-specific drafts: their package, due date, and the latest addendum", () => {
  const email = board.chaseEmails.find((e) => e.bidder === "Palmline Drywall (sample)")!;
  assert.match(email.body, /Saltmarsh Commons, Drywall \(P-102 09-2100\)/);
  assert.match(email.body, /Thursday, October 22/);
  assert.match(email.body, /Addendum 3/);
  assert.match(email.body, /Are you planning to bid\?/);
  const quiet = board.chaseEmails.find((e) => e.bidder === "Ridgeway Interiors (sample)")!;
  assert.match(quiet.body, /still on track/);
  const heron = board.chaseEmails.find((e) => e.package.startsWith("P-101"))!;
  assert.doesNotMatch(heron.body, /Addendum/, "no addendum on that project");
  for (const e of board.chaseEmails) assert.doesNotMatch(e.body, /\b(has been|was) sent\b|awarded/i);
});

test("no amounts anywhere on the board", () => {
  assert.doesNotMatch(JSON.stringify(board), /\$\d|"base"|headline/i);
});

test("after bids close, open bidders on that package are no longer chased or listed", () => {
  const later = coverageBoard("2026-10-23");
  const drywall = later.projects.flatMap((p) => p.trades).find((t) => t.package === "P-102 09-2100")!;
  assert.ok(drywall.closed && drywall.bidders.some((b) => b.open), "the case this test needs");
  assert.ok(drywall.bidders.every((b) => !b.chase));
  assert.equal(drywall.coverageStatus, "CLOSED WITH 0 BIDS");
  assert.ok(!later.callList.some((c) => c.package === "P-102 09-2100"));
  assert.ok(!later.findMore.some((f) => f.package === "P-102 09-2100"));
});
