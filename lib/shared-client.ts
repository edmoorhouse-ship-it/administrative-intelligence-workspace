import { useSyncExternalStore } from "react";
import type { Area } from "./access";
import type { ActivityEntry } from "./activity";
import type { Fact } from "./brain";
import type { AdminRoleId } from "./roles";

/**
 * Client side of the shared store. Each collection is fetched once, kept in memory, and checked
 * every few seconds for changes from other devices. A change shows at once, then saves; if
 * someone else saved first, the change is re-applied on top of theirs and saved again.
 * Adapted from the Venetian workspace's shared client.
 */

export type Collection = "decisions" | "reimbursements" | "restock" | "onboarding" | "brain" | "activity" | "events";

export interface Person {
  id: string;
  name: string;
  role: AdminRoleId;
}

interface Entry {
  version: number;
  /** Undefined until someone saves; the page's starting value stands in until then. */
  value: unknown;
  loaded: boolean;
  pending: number;
}

const POLL_MS = 3000;
const SERVER_ENTRY: Entry = { version: 0, value: undefined, loaded: false, pending: 0 };

const entries = new Map<Collection, Entry>();
const listeners = new Map<Collection, Set<() => void>>();
let signedOut: (() => void) | null = null;

function entry(name: Collection): Entry {
  let e = entries.get(name);
  if (!e) {
    e = { version: 0, value: undefined, loaded: false, pending: 0 };
    entries.set(name, e);
  }
  return e;
}

function setEntry(name: Collection, patch: Partial<Entry>) {
  entries.set(name, { ...entry(name), ...patch });
  listeners.get(name)?.forEach((l) => l());
}

const docValue = (doc: { value?: unknown }) => (doc.value === null ? undefined : doc.value);

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (res.status === 401) {
    resetShared();
    signedOut?.();
  }
  return res;
}

/** Forgets everything fetched for the last person and stops checking, so the next person starts clean. */
function resetShared() {
  if (timer) clearInterval(timer);
  timer = null;
  entries.clear();
  lastLogged.clear();
  team = { me: null, here: [] };
  teamListeners.forEach((l) => l());
  listeners.forEach((set) => set.forEach((l) => l()));
}

async function refresh(name: Collection) {
  try {
    const res = await api(`/api/shared/${name}`);
    if (!res.ok) return;
    const doc = (await res.json()) as { version: number; value: unknown };
    if (entry(name).pending > 0) return; // a save is in flight; its answer wins
    setEntry(name, { version: doc.version, value: docValue(doc), loaded: true });
  } catch {
    // Offline for a moment; the next poll tries again.
  }
}

export function subscribeShared(name: Collection, listener: () => void) {
  const set = listeners.get(name) ?? new Set();
  listeners.set(name, set);
  set.add(listener);
  if (!entry(name).loaded) void refresh(name);
  startPolling();
  return () => {
    set.delete(listener);
  };
}

export const getShared = (name: Collection): unknown => entry(name).value;
export const getSharedEntry = (name: Collection) => entry(name);

/** Change a collection: shown at once, saved, and rebased once if someone else saved first. */
export async function updateShared<T>(name: Collection, initial: T, change: (value: T) => T): Promise<void> {
  const current = entry(name);
  const next = change((current.value === undefined ? initial : current.value) as T);
  setEntry(name, { value: next, pending: current.pending + 1 });
  try {
    let res = await api(`/api/shared/${name}`, { method: "PUT", body: JSON.stringify({ baseVersion: current.version, value: next }) });
    if (res.status === 409) {
      const latest = (await res.json()) as { version: number; value: unknown };
      const rebased = change((latest.version === 0 || latest.value === null ? initial : latest.value) as T);
      res = await api(`/api/shared/${name}`, { method: "PUT", body: JSON.stringify({ baseVersion: latest.version, value: rebased }) });
    }
    const doc = (await res.json()) as { version?: number; value?: unknown };
    if (typeof doc.version !== "number") {
      // Signed out or refused without a copy of the latest: drop the change and re-read.
      setEntry(name, { pending: entry(name).pending - 1 });
      void refresh(name);
      return;
    }
    setEntry(name, { version: doc.version, value: docValue(doc), loaded: true, pending: entry(name).pending - 1 });
  } catch {
    setEntry(name, { pending: entry(name).pending - 1 });
  }
}

/** A shared collection as React state. `initial` should be a constant: it stands in until the first save. */
export function useShared<T>(name: Collection, initial: T): [T, (change: (value: T) => T) => void, boolean] {
  const snap = useSyncExternalStore(
    (l) => subscribeShared(name, l),
    () => entry(name),
    () => SERVER_ENTRY,
  );
  const value = (snap.value === undefined ? initial : snap.value) as T;
  return [value, (change) => void updateShared(name, initial, change), snap.loaded];
}

// ---- Who's here, and staying current ------------------------------------------------------

interface Team {
  me: Person | null;
  here: Person[];
}

let team: Team = { me: null, here: [] };
const teamListeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  if (typeof document !== "undefined" && document.hidden) return;
  try {
    const res = await api("/api/shared");
    if (!res.ok) return;
    const data = (await res.json()) as { versions: Record<Collection, number>; here: Person[]; user: Person };
    const me = { id: data.user.id, name: data.user.name, role: data.user.role };
    const nextTeam = { me, here: data.here };
    if (JSON.stringify(nextTeam) !== JSON.stringify(team)) {
      team = nextTeam;
      teamListeners.forEach((l) => l());
    }
    for (const [name, set] of listeners) {
      const e = entry(name);
      if (set.size > 0 && e.pending === 0 && data.versions[name] !== e.version) void refresh(name);
    }
  } catch {
    // Offline for a moment; the next poll tries again.
  }
}

export function startPolling() {
  if (timer || typeof window === "undefined") return;
  void poll();
  timer = setInterval(poll, POLL_MS);
}

/** The signed-in person, once the first check-in has answered. */
export const currentPerson = () => team.me;

export function useTeam(): Team {
  return useSyncExternalStore(
    (l) => {
      teamListeners.add(l);
      startPolling();
      return () => teamListeners.delete(l);
    },
    () => team,
    () => team,
  );
}

// ---- Activity feed ----------------------------------------------------------------

/** Adds a line to the shared feed. `agent` names the agent acting for the signed-in person. */
export async function logActivity(action: string, area: Area = "general", page?: string, agent?: string) {
  try {
    const res = await api("/api/activity", { method: "POST", body: JSON.stringify({ action, area, page, agent }) });
    if (!res.ok) return;
    const doc = (await res.json()) as { version: number; value: ActivityEntry[] };
    setEntry("activity", { version: doc.version, value: doc.value, loaded: true });
  } catch {
    // The feed is a record, not a gate; a missed line doesn't block the action.
  }
}

const lastLogged = new Map<string, number>();

/** Logs at most once a minute per key, for edits that come in bursts, like typing in a sheet. */
export function logActivityOnce(key: string, action: string, area: Area, page?: string, ms = 60_000) {
  const now = Date.now();
  if (now - (lastLogged.get(key) ?? 0) < ms) return;
  lastLogged.set(key, now);
  void logActivity(action, area, page);
}

// ---- Brain ------------------------------------------------------------------------

export type BrainAction =
  | { action: "propose"; text: string; area: Area; origin?: string; agent?: string }
  | { action: "add"; text: string; area: Area; origin?: string }
  | { action: "approve" | "reject" | "remove"; id: string };

/** Sends a change to the brain; the server decides whether it's allowed. Returns an error to show, if any. */
export async function brainAction(change: BrainAction): Promise<string | null> {
  try {
    const res = await api("/api/brain", { method: "POST", body: JSON.stringify(change) });
    const doc = (await res.json()) as { version?: number; value?: Fact[]; error?: string };
    if (!res.ok || typeof doc.version !== "number") return doc.error ?? "That didn't save. Try again.";
    setEntry("brain", { version: doc.version, value: doc.value, loaded: true });
    void refresh("activity");
    return null;
  } catch {
    return "Couldn't reach the server. Try again.";
  }
}

// ---- Calendar -----------------------------------------------------------------------

export type CalendarAction =
  | { action: "propose"; date: string; time?: string; title: string; area: Area; detail?: string; agent?: string }
  | { action: "add"; date: string; time?: string; title: string; area: Area; detail?: string }
  | { action: "approve" | "reject" | "remove"; id: string };

/** Sends a calendar change; the server decides whether it's allowed. Returns an error to show, if any. */
export async function calendarAction(change: CalendarAction): Promise<string | null> {
  try {
    const res = await api("/api/calendar", { method: "POST", body: JSON.stringify(change) });
    const doc = (await res.json()) as { version?: number; value?: unknown; error?: string };
    if (!res.ok || typeof doc.version !== "number") return doc.error ?? "That didn't save. Try again.";
    setEntry("events", { version: doc.version, value: doc.value, loaded: true });
    void refresh("activity");
    return null;
  } catch {
    return "Couldn't reach the server. Try again.";
  }
}

// ---- Session and team ---------------------------------------------------------------

export interface SessionInfo {
  user: Person | null;
  setupNeeded: boolean;
  setupNeedsCode: boolean;
  setupBlocked: boolean;
}

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch("/api/session");
  return (await res.json()) as SessionInfo;
}

export async function signIn(body: { mode: "signin" | "setup"; name: string; passcode: string; setupCode?: string }): Promise<{ user?: Person; error?: string }> {
  const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()) as { user?: Person; error?: string };
}

export async function signOut() {
  await fetch("/api/session", { method: "DELETE" });
  resetShared();
  signedOut?.();
}

/** Called whenever the server says this browser isn't signed in. */
export function onSignedOut(fn: () => void) {
  signedOut = fn;
}

export interface Account extends Person {
  active?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export async function fetchTeam(): Promise<Account[]> {
  const res = await api("/api/team");
  if (!res.ok) return [];
  return ((await res.json()) as { users: Account[] }).users;
}

export async function changeTeam(body: Record<string, unknown>): Promise<{ users?: Account[]; error?: string }> {
  const res = await api("/api/team", { method: "POST", body: JSON.stringify(body) });
  const out = (await res.json()) as { users?: Account[]; error?: string };
  if (res.ok) void refresh("activity");
  return out;
}
