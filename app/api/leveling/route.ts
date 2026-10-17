import { randomUUID } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connection } from "next/server";
import { hasPdfToText, pdfToText } from "@/lib/construction/pdf";
import { runLeveling, type ProposalText } from "@/lib/construction/run-leveling";
import { requireUser } from "@/lib/server/session";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const SAMPLES = join(process.cwd(), "lib", "construction", "samples");

/**
 * Levels one trade's proposals. Takes multipart form data: `pkg`, `round`, any number of `files`
 * (PDF, .txt, .eml) and `pasted` texts, or `sample=1` for the made-up sample proposals. Everything is
 * read on this computer; nothing is sent to an AI model or stored.
 */
export async function POST(request: Request) {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;

  const form = await request.formData();
  const pkg = String(form.get("pkg") ?? "").trim().slice(0, 80) || "Trade package";
  const round = String(form.get("round") ?? "GMP").trim().slice(0, 20) || "GMP";
  const inputs: ProposalText[] = [];
  const errors: string[] = [];

  if (form.get("sample") === "1") {
    for (const name of (await readdir(SAMPLES)).filter((n) => n.endsWith(".txt")).sort()) {
      inputs.push({ name, text: await readFile(join(SAMPLES, name), "utf8") });
    }
  }

  for (const entry of form.getAll("files")) {
    if (typeof entry === "string") continue;
    const name = entry.name || "proposal";
    if (entry.size > MAX_FILE_BYTES) {
      errors.push(`${name}: larger than 20 MB, skipped.`);
      continue;
    }
    if (/\.pdf$/i.test(name) || entry.type === "application/pdf") {
      if (!hasPdfToText()) {
        errors.push(`${name}: reading PDFs needs pdftotext on this computer (Mac: brew install poppler). Paste the text instead for now.`);
        continue;
      }
      const tmp = join(tmpdir(), `proposal-${randomUUID()}.pdf`);
      try {
        await writeFile(tmp, Buffer.from(await entry.arrayBuffer()), { mode: 0o600 });
        inputs.push({ name, text: pdfToText(tmp) });
      } catch (e) {
        errors.push(`${name}: ${e instanceof Error ? e.message : "could not be read"}`);
      } finally {
        await rm(tmp, { force: true });
      }
      continue;
    }
    inputs.push({ name, text: await entry.text() });
  }

  form.getAll("pasted").forEach((text, i) => {
    if (typeof text === "string" && text.trim()) inputs.push({ name: `Pasted proposal ${i + 1}`, text });
  });

  if (!inputs.length) return Response.json({ error: "Add at least one proposal.", errors }, { status: 400 });
  try {
    return Response.json({ run: runLeveling(inputs, pkg, round), errors });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Leveling failed.", errors }, { status: 422 });
  }
}
