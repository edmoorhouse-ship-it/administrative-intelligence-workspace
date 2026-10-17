"use client";

import { useState } from "react";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { signIn, type Person, type SessionInfo } from "@/lib/shared-client";
import { Mark } from "./mark";

const LAST_NAME_KEY = "macs.lastName.v1";
const MIN = 8;

function rememberedName() {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

const FIELD =
  "h-11 w-full rounded-xl bg-surface px-3.5 text-[15px] text-fg outline-none shadow-[0_0_0_1px_var(--line)] placeholder:text-muted focus:shadow-[0_0_0_1px_var(--line-strong)]";

/** Sign in with your own name and passcode, or set up the workspace's first (Director) account. */
export function SignInScreen({ info, onSignedIn }: { info: SessionInfo; onSignedIn: (p: Person) => void }) {
  const setup = info.setupNeeded;
  const [name, setName] = useState(() => (setup ? "" : rememberedName()));
  const [passcode, setPasscode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready = setup
    ? name.trim() && passcode.length >= MIN && passcode === confirm && (!info.setupNeedsCode || setupCode.trim())
    : name.trim() && passcode.length > 0;

  if (info.setupBlocked) {
    return (
      <div className="flex h-dvh items-center justify-center bg-page px-4 text-fg">
        <div className="anim-page-in w-full max-w-md text-center">
          <Mark size={72} className="mx-auto rounded-full" />
          <h1 className="mt-5 font-serif text-[26px]">Almost ready</h1>
          <p className="mt-3 text-[15px] leading-6 text-secondary">
            This workspace has no accounts yet. Set <code className="rounded bg-active px-1.5 py-0.5 text-[13px]">MACS_SETUP_CODE</code> on the server, restart it, and reload this page. The Director then uses that code once to create the first account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh items-center justify-center overflow-y-auto bg-page px-4 py-10 text-fg">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready || busy) return;
          setBusy(true);
          setError(null);
          const result = await signIn({ mode: setup ? "setup" : "signin", name, passcode, setupCode });
          setBusy(false);
          if (result.user) {
            try {
              localStorage.setItem(LAST_NAME_KEY, result.user.name);
            } catch {
              // Remembering the name is a convenience only.
            }
            onSignedIn(result.user);
          } else setError(result.error ?? "Couldn't sign in. Try again.");
        }}
        className="anim-page-in w-full max-w-md"
      >
        <div className="flex flex-col items-center text-center">
          <Mark size={72} className="rounded-full shadow-[0_10px_30px_-10px_rgb(50_76_154/0.55)]" />
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">Micanopy Area Cooperative School</p>
          <h1 className="mt-1.5 font-serif text-[28px] leading-tight">{setup ? "Set up the shared workspace" : "Sign in"}</h1>
          <p className="mt-2 text-[14px] leading-6 text-secondary">
            {setup
              ? "Create the Director's account. You'll add the rest of the team from the Brain page, each with their own passcode and role."
              : "Use your own name and passcode. What you see depends on your role."}
          </p>
        </div>

        <div className="mt-7 space-y-3">
          <label className="block">
            <span className="text-[13px] font-medium text-fg">{setup ? "Your name" : "Name"}</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" placeholder="e.g. Dana Whitfield" className={`mt-1.5 ${FIELD}`} />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-fg">Passcode</span>
            {setup && <span className="ml-1.5 text-[12px] text-muted">at least {MIN} characters</span>}
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete={setup ? "new-password" : "current-password"}
              className={`mt-1.5 ${FIELD}`}
            />
          </label>
          {setup && (
            <label className="block">
              <span className="text-[13px] font-medium text-fg">Passcode again</span>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={`mt-1.5 ${FIELD}`} />
              {confirm && confirm !== passcode && <span className="mt-1 block text-[12px] text-danger">The two passcodes don&apos;t match.</span>}
            </label>
          )}
          {setup && info.setupNeedsCode && (
            <label className="block">
              <span className="text-[13px] font-medium text-fg">Setup code</span>
              <span className="ml-1.5 text-[12px] text-muted">from the server&apos;s MACS_SETUP_CODE</span>
              <input value={setupCode} onChange={(e) => setSetupCode(e.target.value)} autoComplete="off" className={`mt-1.5 ${FIELD}`} />
            </label>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-danger/10 px-3.5 py-2.5 text-[14px] text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!ready || busy}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-fg text-[15px] text-page transition-[opacity,transform] duration-100 hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
        >
          {setup ? <ShieldCheck className="size-4" /> : <Lock className="size-4" />}
          {busy ? "One moment…" : setup ? "Create the Director's account" : "Sign in"}
          {!busy && <ArrowRight className="size-4" />}
        </button>

        <p className="mt-5 text-center text-[12px] leading-5 text-muted">
          Passcodes are stored only as one-way hashes. Forgot yours? The Director can reset it.
        </p>
      </form>
    </div>
  );
}
