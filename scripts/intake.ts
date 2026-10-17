// Read one or more proposals and print their records.
//   npm run intake -- lib/construction/samples/summit-drywall-rev1.pdf lib/construction/samples/coastal-interiors-email.txt
// PDFs need Poppler's pdftotext (Mac: brew install poppler). .txt and .eml files are read as text.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { currentRecords, parseProposal, recordMarkdown } from "../lib/construction/intake.ts";
import { hasPdfToText, pdfToText } from "../lib/construction/pdf.ts";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: npm run intake -- <proposal.pdf|.txt> [more files...]");
  process.exit(1);
}

const records = files.map((file) => {
  if (/\.pdf$/i.test(file)) {
    if (!hasPdfToText()) {
      console.error("pdftotext is not installed. On a Mac: brew install poppler");
      process.exit(1);
    }
    return parseProposal(pdfToText(file), basename(file));
  }
  return parseProposal(readFileSync(file, "utf8"), basename(file));
});

for (const { current, superseded } of currentRecords(records)) {
  console.log(recordMarkdown(current));
  if (superseded.length) console.log(`\n_Supersedes: ${superseded.map((s) => `${s.source} (rev ${s.revision ?? "NOT STATED"})`).join(", ")}. Only the latest revision is leveled._`);
  console.log("\n---\n");
}
