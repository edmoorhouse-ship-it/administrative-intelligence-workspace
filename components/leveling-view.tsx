"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, ClipboardPaste, Copy, Download, FileText, FlaskConical, LoaderCircle, Scale, TriangleAlert, Upload, X } from "lucide-react";
import type { LevelingRun } from "@/lib/construction/run-leveling";
import { Markdown } from "./markdown";
import { profile } from "@/profiles";

type Tab = "package" | "form" | "records";

const ROUNDS = ["SD", "DD", "Permit", "GMP"];

// Display only; the engine works in whole cents and does its own formatting.
const money = (c: number | null) =>
  c === null ? "Unknown" : `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const chip = "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] shadow-[0_0_0_1px_var(--line)]";
const button =
  "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** One trade's bid leveling: drop in proposals, get the A-I package and the BuildingConnected plug table. */
export function LevelingView() {
  const [pkg, setPkg] = useState("09: Drywall");
  const [round, setRound] = useState("GMP");
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [pasting, setPasting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [run, setRun] = useState<LevelingRun | null>(null);
  const [tab, setTab] = useState<Tab>("package");
  const [copied, setCopied] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  // The workspace session: in local no-passcode mode this call is what signs you in.
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((s) => setSignedIn(Boolean(s?.user)))
      .catch(() => setSignedIn(false));
  }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const keep = [...list].filter((f) => /\.(pdf|txt|eml|md)$/i.test(f.name) || f.type.startsWith("text/") || f.type === "application/pdf");
    setFiles((prev) => [...prev, ...keep.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const level = async (sample = false) => {
    setBusy(true);
    setError(null);
    setWarnings([]);
    const body = new FormData();
    body.set("pkg", pkg);
    body.set("round", round);
    if (sample) body.set("sample", "1");
    else {
      for (const f of files) body.append("files", f);
      for (const p of pasted) body.append("pasted", p);
    }
    try {
      const res = await fetch("/api/leveling", { method: "POST", body });
      const data = await res.json();
      setWarnings(data.errors ?? []);
      if (!res.ok) {
        setError(data.signIn ? "Open the workspace and sign in first, then come back to this page." : (data.error ?? "Leveling failed."));
        return;
      }
      setRun(data.run);
      setTab("package");
    } catch {
      setError("Could not reach the workspace server. Is it still running in Terminal?");
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    if (!run) return;
    const url = URL.createObjectURL(new Blob([run.csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${run.pkg.replace(/[^\w-]+/g, " ").trim()} plug table.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copyPackage = async () => {
    if (!run) return;
    await navigator.clipboard.writeText(run.packageMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const count = files.length + pasted.length;

  return (
    <div className="h-full overflow-y-auto bg-page">
      <div className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> {profile.workspaceName}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Scale className="size-7 text-brand" strokeWidth={1.5} />
          <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Bid leveling</h1>
        </div>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-secondary">
          Drop in one trade&apos;s proposals. You get the bid form, the tie-out, the normalized comparison, bidder-specific questions, and the
          BuildingConnected plug table. Proposals are read on this computer and are not sent to an AI model or saved.
        </p>
        {signedIn === false && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-danger">
            <TriangleAlert className="size-4" /> Not signed in. <Link href="/" className="underline">Open the workspace</Link> and sign in, then reload this page.
          </p>
        )}

        {/* Inputs */}
        <section className="mt-6 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
          <div className="flex flex-wrap gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12px] text-muted">
              Trade package (as named in BuildingConnected)
              <input value={pkg} onChange={(e) => setPkg(e.target.value)} className="h-9 rounded-lg bg-page px-3 text-[14px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] focus:shadow-[0_0_0_2px_var(--brand)]" />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-muted">
              Pricing round
              <select value={round} onChange={(e) => setRound(e.target.value)} className="h-9 rounded-lg bg-page px-3 text-[14px] text-fg outline-none shadow-[0_0_0_1px_var(--line)]">
                {ROUNDS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => picker.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${dragging ? "border-brand bg-hover" : "border-line-strong hover:bg-hover"}`}
          >
            <Upload className="size-6 text-muted" />
            <p className="text-[14px] text-fg">Drop proposal PDFs or text files here, or click to choose</p>
            <p className="text-[12px] text-muted">PDF, .txt, or .eml. Revisions from the same vendor are recognized; only the latest is leveled.</p>
            <input ref={picker} type="file" multiple accept=".pdf,.txt,.eml,.md,application/pdf,text/plain" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </div>

          {pasting ? (
            <div className="mt-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste a proposal email or the text of a quote"
                rows={7}
                className="w-full rounded-lg bg-page p-3 font-mono text-[12.5px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] focus:shadow-[0_0_0_2px_var(--brand)]"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!draft.trim()}
                  onClick={() => {
                    setPasted((p) => [...p, draft]);
                    setDraft("");
                    setPasting(false);
                  }}
                  className={`${button} bg-brand text-white hover:opacity-90`}
                >
                  Add this proposal
                </button>
                <button type="button" onClick={() => setPasting(false)} className={`${button} text-secondary hover:bg-hover`}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setPasting(true)} className={`${button} mt-3 text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover`}>
              <ClipboardPaste className="size-4" /> Paste an emailed proposal
            </button>
          )}

          {count > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={`f-${f.name}-${i}`} className={`${chip} text-secondary`}>
                  <FileText className="size-3.5" /> {f.name}
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-muted hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
              {pasted.map((p, i) => (
                <li key={`p-${i}`} className={`${chip} text-secondary`}>
                  <ClipboardPaste className="size-3.5" /> Pasted proposal {i + 1}
                  <button type="button" aria-label={`Remove pasted proposal ${i + 1}`} onClick={() => setPasted((x) => x.filter((_, j) => j !== i))} className="text-muted hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button type="button" disabled={busy || count === 0} onClick={() => level(false)} className={`${button} bg-brand text-white hover:opacity-90`}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Scale className="size-4" />} Level {count || ""} {count === 1 ? "proposal" : "proposals"}
            </button>
            <button type="button" disabled={busy} onClick={() => level(true)} className={`${button} text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover`}>
              <FlaskConical className="size-4 text-brand" /> Try the sample proposals
            </button>
            {(count > 0 || run) && (
              <button
                type="button"
                onClick={() => {
                  setFiles([]);
                  setPasted([]);
                  setRun(null);
                  setError(null);
                  setWarnings([]);
                }}
                className={`${button} ml-auto text-muted hover:bg-hover`}
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {error && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-surface p-3 text-[14px] text-danger shadow-[0_0_0_1px_var(--line)]">
            <TriangleAlert className="size-4 shrink-0" /> {error}
          </p>
        )}
        {warnings.length > 0 && (
          <ul className="mt-3 space-y-1 text-[13px] text-secondary">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-gold" /> {w}
              </li>
            ))}
          </ul>
        )}

        {run && (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted">
                  {run.project} · {run.round}
                </p>
                <h2 className="font-serif text-[24px] text-fg">{run.pkg}</h2>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={downloadCsv} className={`${button} text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover`}>
                  <Download className="size-4" /> Plug table (CSV for Excel)
                </button>
                <button type="button" onClick={copyPackage} className={`${button} text-secondary shadow-[0_0_0_1px_var(--line)] hover:bg-hover`}>
                  {copied ? <CircleCheck className="size-4 text-brand" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy package"}
                </button>
              </div>
            </div>

            {/* One card per bidder: the numbers and statuses that decide what happens next. */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[...run.bidders]
                // Eligible bidders first, lowest normalized first; the rest keep their order.
                .sort((a, b) => (run.ranking.indexOf(a.bidder) + 1 || 999) - (run.ranking.indexOf(b.bidder) + 1 || 999))
                .map((b) => {
                const rank = run.ranking.indexOf(b.bidder);
                return (
                  <article key={b.bidder} className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)]">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[14px] font-semibold leading-5 text-fg">{b.bidder}</h3>
                      {rank >= 0 ? (
                        <span className={`${chip} shrink-0 text-brand`}>#{rank + 1} eligible</span>
                      ) : (
                        <span className={`${chip} shrink-0 text-muted`}>Not eligible yet</span>
                      )}
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[13px]">
                      <dt className="text-muted">Headline</dt>
                      <dd className="text-right tabular-nums text-fg">{money(b.headline)}</dd>
                      <dt className="text-muted">Normalized</dt>
                      <dd className={`text-right tabular-nums ${b.normalized === null ? "text-gold" : "text-fg"}`}>{money(b.normalized)}</dd>
                      <dt className="text-muted">Tie-out</dt>
                      <dd className={`text-right tabular-nums ${b.variance ? "font-semibold text-danger" : "text-fg"}`}>{b.variance ? money(b.variance) : "Ties"}</dd>
                      {b.unmapped > 0 && (
                        <>
                          <dt className="text-muted">Unmapped</dt>
                          <dd className="text-right tabular-nums text-gold">{money(b.unmapped)}</dd>
                        </>
                      )}
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className={`${chip} ${b.plug === "HOLD" ? "text-danger" : "text-secondary"}`}>{b.plug}</span>
                      <span className={`${chip} ${b.sourceIntegrity === "VERIFIED" ? "text-secondary" : "text-danger"}`}>{b.sourceIntegrity}</span>
                      <span className={`${chip} text-secondary`}>{b.completeness}</span>
                      {b.questions > 0 && <span className={`${chip} text-gold`}>{b.questions} questions</span>}
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-3 text-[12px] text-muted">The carry stays NOT EVALUATED until you decide. Nothing here is entered in BuildingConnected or sent to anyone.</p>
            {run.superseded.length > 0 && (
              <ul className="mt-2 space-y-1 text-[12px] text-muted">
                {run.superseded.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex gap-1 border-b border-line" role="tablist">
              {(
                [
                  ["package", "Leveling package (A–I)"],
                  ["form", "Bid form"],
                  ["records", `Proposal records (${run.records.length})`],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${tab === id ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto text-[14px]">
              {tab === "package" && <Markdown text={run.packageMarkdown} />}
              {tab === "form" && (
                <>
                  <Markdown text={run.formMarkdown} />
                  {run.notes.length > 0 && <Markdown text={`**Notes**\n\n${run.notes.map((n) => `- ${n}`).join("\n")}`} />}
                </>
              )}
              {tab === "records" && run.records.map((r, i) => <Markdown key={i} text={r} className="mb-8" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
