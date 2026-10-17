/**
 * PDF to text with `pdftotext -layout` (Poppler), the extraction the leveling spec calls for. Server or
 * command-line only. Image-only (scanned) pages come back empty: those need OCR and a spot check.
 * Install on a Mac with `brew install poppler`.
 */
import { execFileSync } from "node:child_process";

export function hasPdfToText(): boolean {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function pdfToText(path: string): string {
  const text = execFileSync("pdftotext", ["-layout", path, "-"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  if (!text.replace(/\f/g, "").trim()) throw new Error(`${path} has no text layer (scanned image). Run OCR first and spot-check the result.`);
  return text.replace(/\f/g, "\n");
}
