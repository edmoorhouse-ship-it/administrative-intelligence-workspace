// Clarification emails: one per bidder with gaps, only that bidder's gaps, drafts that never claim to be sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { businessDaysAfter, clarificationEmail, emailText, groupQuestions, trackKey } from "./clarification-email.ts";
import { runLeveling } from "./run-leveling.ts";

const samples = new URL("./samples/", import.meta.url);
const read = (f: string) => ({ name: f, text: readFileSync(new URL(f, samples), "utf8") });
const run = runLeveling(["summit-drywall-rev1.txt", "summit-drywall-rev2.txt", "coastal-interiors-email.txt", "bayline-walls-lump-sum.txt"].map(read), "09: Drywall", "GMP");
const emails = run.clarifications.map((c) => clarificationEmail(c, "2026-10-20"));
const byBidder = (re: RegExp) => emails.find((e) => e && re.test(e.bidder));

test("business days skip weekends", () => {
  assert.equal(businessDaysAfter("2026-10-16", 2), "2026-10-20"); // Fri -> Tue
  assert.equal(businessDaysAfter("2026-10-14", 2), "2026-10-16"); // Wed -> Fri
  assert.equal(businessDaysAfter("2026-10-17", 1), "2026-10-19"); // Sat -> Mon
});

test("a clean bid gets no email; bidders with gaps get one each", () => {
  const summit = run.clarifications.find((c) => /summit/i.test(c.bidder))!;
  assert.equal(summit.questions.length, 0);
  assert.equal(clarificationEmail(summit, "2026-10-20"), null);
  assert.equal(emails.filter(Boolean).length, 2);
});

test("every question in the leveling package lands in that bidder's email, numbered once", () => {
  for (const c of run.clarifications.filter((x) => x.questions.length)) {
    const e = clarificationEmail(c, "2026-10-20")!;
    assert.equal(e.questionCount, c.questions.length);
    for (const q of c.questions) assert.ok(e.body.includes(q), `${c.bidder}: ${q}`);
    const numbers = [...e.body.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
    assert.deepEqual(numbers, c.questions.map((_, i) => i + 1));
  }
});

test("emails are bidder-specific: no bidder is asked another bidder's question", () => {
  const coastal = byBidder(/coastal/i)!;
  const bayline = byBidder(/bayline/i)!;
  assert.match(coastal.body, /You exclude this: Exterior soffits/);
  assert.doesNotMatch(bayline.body, /You exclude this/, "Bayline is silent, not excluding");
  assert.match(bayline.body, /Please confirm: Exterior soffits/);
  assert.doesNotMatch(bayline.body, /\$2,473,500\.00|escalation/, "Coastal's math and terms stay out of Bayline's email");
});

test("asks for a revised total, gives the reply-by date, and never claims to be sent", () => {
  for (const e of emails.filter(Boolean)) {
    const text = emailText(e!);
    assert.match(text, /revised total/);
    assert.match(text, /reply by Tuesday, October 20/);
    assert.match(e!.subject, /\(reply by Tue, Oct 20\)$/);
    assert.doesNotMatch(text, /\bhas been sent\b|\bwe sent\b|\bENTERED\b|\bawarded\b/i);
    assert.match(text, /\[Your name\]$/);
  }
  const noDate = clarificationEmail(run.clarifications.find((c) => c.questions.length)!, null)!;
  assert.match(noDate.body, /as soon as you can/);
  assert.doesNotMatch(noDate.subject, /reply by/);
});

test("greets a named contact by first name, otherwise leaves a placeholder", () => {
  const base = { bidder: "Sample Co", project: "NOT STATED", pkg: "09: Drywall", proposalDate: "NOT STATED", revision: null, questions: ["Please confirm X?"] };
  assert.match(clarificationEmail({ ...base, contact: "Dana Example, Estimator" }, null)!.body, /^Hi Dana,/);
  assert.match(clarificationEmail({ ...base, contact: "NOT STATED" }, null)!.body, /^Hi \[Name\],/);
  assert.match(clarificationEmail({ ...base, contact: "estimating@sample.test" }, null)!.body, /^Hi \[Name\],/);
});

test("questions group into scope, price and math, drawings, and terms", () => {
  const groups = groupQuestions(byBidder(/coastal/i)!.body.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, "")));
  assert.deepEqual(groups.map((g) => g.title), ["Scope", "Price and math", "Drawings", "Terms"]);
});

test("tracking keys ignore case and spacing so one bidder maps to one entry", () => {
  assert.equal(trackKey(" 09: Drywall ", "GMP", "Coastal Interiors LLC"), trackKey("09: drywall", "gmp", "coastal interiors llc"));
});
