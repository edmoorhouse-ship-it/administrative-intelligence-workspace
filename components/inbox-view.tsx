"use client";

import { useState } from "react";
import { Inbox, ShieldAlert } from "lucide-react";
import { buildInboxMessage } from "@/lib/inbox";
import { profile } from "@/profiles";

const MAX_PASTE = 19_000;

/** Paste-in inbox triage. No mailbox is connected, so the owner pastes messages; nothing is sent. */
export function InboxView({ disabled, onTriage }: { disabled: boolean; onTriage: (message: string) => void }) {
  const [paste, setPaste] = useState("");
  const [promises, setPromises] = useState("");
  const ready = paste.trim().length > 0 && !disabled;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">
          <Inbox className="size-6" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[13px] text-muted">{profile.org}</p>
          <h1 className="font-serif text-[32px] font-[400] leading-tight tracking-[-0.01em] text-fg">Inbox triage</h1>
        </div>
      </div>

      <p className="mt-5 font-serif text-[17px] leading-7 text-fg">
        Paste the messages you haven&apos;t answered. You&apos;ll get the few that need a decision, drafts for the rest, a count of what can be filed, and who on the team owns each handoff. Nothing is sent.
      </p>

      <div className="mt-5 flex gap-2.5 rounded-xl bg-bubble px-4 py-3 text-[13px] leading-5 text-secondary">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.75} />
        <p>
          <span className="font-medium text-fg">Before you paste: </span>
          remove student names and IDs where you can, and leave out IEP, health, or discipline details you don&apos;t need answered. Pasted text goes to the model provider. There is no mailbox connection, so you paste everything yourself.
        </p>
      </div>

      <label htmlFor="inbox-paste" className="mt-6 block text-sm font-medium text-fg">
        Messages
      </label>
      <textarea
        id="inbox-paste"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        maxLength={MAX_PASTE}
        rows={12}
        placeholder="Paste emails, threads, or DMs. Put a line with three dashes (---) between messages."
        className="mt-2 w-full resize-y rounded-xl bg-surface px-4 py-3 text-[14px] leading-6 text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]"
      />
      <p className="mt-1 text-right text-[11px] text-muted">
        {paste.length.toLocaleString("en-US")} / {MAX_PASTE.toLocaleString("en-US")}
      </p>

      <label htmlFor="inbox-promises" className="mt-5 block text-sm font-medium text-fg">
        Promises you&apos;ve already made <span className="font-normal text-muted">(optional)</span>
      </label>
      <p className="mt-0.5 text-[13px] text-muted">Commitments from older threads that aren&apos;t in the paste. These are the ones most likely to be forgotten.</p>
      <textarea
        id="inbox-promises"
        value={promises}
        onChange={(e) => setPromises(e.target.value)}
        rows={3}
        placeholder="e.g. Told a family I would call back by Friday."
        className="mt-2 w-full resize-y rounded-xl bg-surface px-4 py-3 text-[14px] leading-6 text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]"
      />

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={!ready}
          onClick={() => onTriage(buildInboxMessage(paste, promises))}
          className="h-9 rounded-lg bg-fg px-4 text-sm text-page hover:opacity-90 disabled:opacity-40"
        >
          Triage inbox
        </button>
      </div>
    </div>
  );
}
