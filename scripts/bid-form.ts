// Build a BuildingConnected bid form from a trade's proposals and show how every bidder fits.
//   npm run bid-form -- "09: Drywall" lib/construction/samples/summit-drywall-rev2.txt lib/construction/samples/coastal-interiors-email.txt lib/construction/samples/bayline-walls-lump-sum.txt
// PDFs need Poppler's pdftotext (Mac: brew install poppler).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { buildBidForm, fitReport, formMarkdown } from "../lib/construction/bid-form.ts";
import { currentRecords, parseProposal } from "../lib/construction/intake.ts";
import { formatCents } from "../lib/construction/leveling.ts";
import { hasPdfToText, pdfToText } from "../lib/construction/pdf.ts";

const [pkg, ...files] = process.argv.slice(2);
if (!pkg || !files.length) {
  console.error('Usage: npm run bid-form -- "09: Drywall" <proposal files...>');
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

console.log(formMarkdown(built.form));
console.log("**Fit check**\n\n| Bidder | Fits | Uses combined row | Unmapped |\n|---|---|---|---:|");
for (const f of fitReport(built, records)) {
  console.log(`| ${f.vendor} | ${f.fits ? "Yes" : `No: ${f.errors.join("; ")}`} | ${f.usesCombined ? "Yes" : "No"} | ${f.unmapped ? formatCents(f.unmapped) : ""} |`);
}
if (built.notes.length) console.log(`\n**Notes**\n\n${built.notes.map((n) => `- ${n}`).join("\n")}`);
