// The one-call chain behind the Bid leveling page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runLeveling } from "./run-leveling.ts";

const dir = join(import.meta.dirname, "samples");
const files = ["summit-drywall-rev1.txt", "summit-drywall-rev2.txt", "coastal-interiors-email.txt", "bayline-walls-lump-sum.txt"];
const run = runLeveling(files.map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") })), "09: Drywall", "GMP");

test("one call from proposal texts to the A-I package", () => {
  assert.equal(run.project, "Sample Commons Apartments");
  assert.deepEqual(run.bidders.map((b) => b.bidder), ["SUMMIT DRYWALL & ACOUSTICS, INC.", "Coastal Interiors LLC", "BAYLINE WALL SYSTEMS"]);
  assert.deepEqual(run.ranking, ["SUMMIT DRYWALL & ACOUSTICS, INC."]);
  assert.match(run.superseded[0], /summit-drywall-rev1\.txt \(rev 1\) is superseded by summit-drywall-rev2\.txt/);
  assert.ok(run.fit.every((f) => f.fits));
  assert.match(run.packageMarkdown, /## I\. Development bottom line/);
  assert.match(run.csv, /^Section,Bid form line,/);
  assert.equal(run.bidders.find((b) => b.bidder === "Coastal Interiors LLC")!.questions, 12);
});
