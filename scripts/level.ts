// Level a trade end to end: proposals -> records -> bid form -> leveling package (A-I).
//   npm run level -- "09: Drywall" lib/construction/samples/summit-drywall-rev2.txt lib/construction/samples/coastal-interiors-email.txt lib/construction/samples/bayline-walls-lump-sum.txt
// Add --csv <file.csv> to also write the plug table for Excel. PDFs need pdftotext (Mac: brew install poppler).
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { buildBidForm } from "../lib/construction/bid-form.ts";
import { currentRecords, parseProposal, toProposal } from "../lib/construction/intake.ts";
import { levelingPackage, plugTableCsv } from "../lib/construction/leveling-sheet.ts";
import { hasPdfToText, pdfToText } from "../lib/construction/pdf.ts";

const args = process.argv.slice(2);
const csvAt = args.indexOf("--csv");
const csvFile = csvAt >= 0 ? args.splice(csvAt, 2)[1] : null;
const [pkg, ...files] = args;
if (!pkg || !files.length) {
  console.error('Usage: npm run level -- "09: Drywall" <proposal files...> [--csv plug-table.csv]');
  process.exit(1);
}
const read = (file: string) => {
  if (!/\.pdf$/i.test(file)) return readFileSync(file, "utf8");
  if (!hasPdfToText()) {
    console.error("pdftotext is not installed. On a Mac: brew install poppler");
    process.exit(1);
  }
  return pdfToText(file);
};

const records = currentRecords(files.map((f) => parseProposal(read(f), basename(f)))).map((g) => g.current);
const project = records.find((r) => r.project !== "NOT STATED")?.project ?? "NOT STATED";
const built = buildBidForm({ project, round: "GMP", pkg, records });
const proposals = records.map((r) => toProposal(r, built.form, built.mappings[r.vendor] ?? {}));

console.log(levelingPackage(built.form, proposals).markdown);
if (built.notes.length) console.log(`**Form notes**\n\n${built.notes.map((n) => `- ${n}`).join("\n")}\n`);
if (csvFile) {
  writeFileSync(csvFile, plugTableCsv(built.form, proposals));
  console.log(`Plug table written to ${csvFile} (open it in Excel).`);
}
