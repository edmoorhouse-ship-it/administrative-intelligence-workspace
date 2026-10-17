"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { DATA_AS_OF, SAMPLE_DATA_NOTICE } from "@/lib/data-notice";
import type { WorkspaceSettings } from "@/lib/types";

interface SettingsDialogProps {
  settings: WorkspaceSettings;
  apiMode: "unknown" | "live" | "demo";
  chatCount: number;
  onSave: (patch: Partial<WorkspaceSettings>) => void;
  onDeleteAllChats: () => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, apiMode, chatCount, onSave, onDeleteAllChats, onClose }: SettingsDialogProps) {
  const [instructions, setInstructions] = useState(settings.customInstructions);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <button type="button" aria-label="Close settings" onClick={onClose} className="anim-page-in absolute inset-0 bg-black/20 dark:bg-black/50" />
      <div
        className="anim-pop-in relative flex max-h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-surface text-fg sm:rounded-2xl"
        style={{ boxShadow: "var(--menu-shadow)" }}
      >
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2 id="settings-title" className="text-base font-medium">
            Settings
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-lg text-secondary hover:bg-hover hover:text-fg">
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-2">
          <section className="border-b border-line py-4">
            <label htmlFor="custom-instructions" className="text-sm font-medium">
              Custom instructions
            </label>
            <p className="mt-0.5 text-[13px] text-muted">Added to the system prompt for every chat, after the role lens and before the dataset.</p>
            <textarea
              id="custom-instructions"
              autoFocus
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="e.g. Always end board summaries with a one-paragraph note for the Chair. Use 'families' rather than 'parents'."
              className="mt-3 w-full resize-y rounded-xl bg-page px-3 py-2.5 text-sm leading-relaxed outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]"
            />
            <p className="mt-1 text-right text-[11px] text-muted">{instructions.length} / 4000</p>
          </section>

          <section className="border-b border-line py-4">
            <p className="text-sm font-medium">Data source</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              Sample dataset as of {DATA_AS_OF}. {SAMPLE_DATA_NOTICE} Edit or replace it in <code className="font-mono text-secondary">lib/macs-data.ts</code>.
            </p>
            <p className="mt-3 flex items-center justify-between text-sm">
              <span className="text-secondary">Model access</span>
              <span className="text-fg">
                {apiMode === "live" ? "OpenRouter connected" : apiMode === "demo" ? "Demo mode — set OPENROUTER_API_KEY" : "Checking…"}
              </span>
            </p>
          </section>

          <section className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete all chats</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {chatCount} chat{chatCount === 1 ? "" : "s"} stored in this browser only. Nothing is saved on a server.
                </p>
              </div>
              <button
                type="button"
                disabled={chatCount === 0}
                onClick={() => {
                  if (!confirmWipe) {
                    setConfirmWipe(true);
                    return;
                  }
                  onDeleteAllChats();
                  setConfirmWipe(false);
                }}
                className="h-8 shrink-0 rounded-lg px-3 text-sm text-danger shadow-[0_0_0_1px_var(--line)] hover:bg-danger/5 disabled:opacity-40"
              >
                {confirmWipe ? "Click again to delete" : "Delete all"}
              </button>
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5 pt-2">
          <button type="button" onClick={onClose} className="h-8 rounded-lg px-3 text-sm text-fg shadow-[0_0_0_1px_var(--line)] hover:bg-hover">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({ customInstructions: instructions });
              onClose();
            }}
            className="h-8 rounded-lg bg-fg px-3 text-sm text-page hover:opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
