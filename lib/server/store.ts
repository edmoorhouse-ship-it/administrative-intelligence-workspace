import { promises as fs } from "node:fs";
import path from "node:path";
import type { Area } from "@/lib/access";
import { profile } from "@/profiles";

/**
 * The shared store: one JSON file on the server that runs the app (the school's VPS), so every
 * signed-in device reads and writes the same data. Each collection carries a version; a write
 * that starts from an old version is refused, and the client re-applies its change and tries
 * again. Kept behind getDoc / putDoc / appendTo so a hosted database can replace the file later.
 * Adapted from the Venetian workspace's shared store.
 */

export const COLLECTIONS = ["decisions", "reimbursements", "restock", "onboarding", "brain", "activity", "events"] as const;
export type Collection = (typeof COLLECTIONS)[number];

/** Who may read and write each collection. Brain and activity are filtered item by item instead. */
export const COLLECTION_AREA: Record<Collection, Area | "per-item"> = {
  decisions: "general",
  reimbursements: "finance",
  restock: "finance",
  onboarding: "general",
  brain: "per-item",
  activity: "per-item",
  events: "per-item",
};

export const isCollection = (name: unknown): name is Collection =>
  typeof name === "string" && (COLLECTIONS as readonly string[]).includes(name);

export interface Doc {
  version: number;
  value: unknown;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const DATA_DIR = process.env.MACS_DATA_DIR || path.join(process.cwd(), "data");
// Each profile keeps its own shared data, so switching profiles never mixes one business's brain into another's.
const FILE = path.join(DATA_DIR, profile.id === "macs" ? "shared.json" : `shared-${profile.id}.json`);
const MAX_CHARS = 2_000_000;

interface StoreState {
  docs: Partial<Record<Collection, Doc>>;
  queue: Promise<void>;
}

// One store per server process, kept across hot reloads in development.
const holder = globalThis as unknown as { __macsStore?: Promise<StoreState> };

function store(): Promise<StoreState> {
  holder.__macsStore ??= (async () => {
    try {
      const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as { docs?: StoreState["docs"] };
      return { docs: parsed.docs ?? {}, queue: Promise.resolve() };
    } catch {
      return { docs: {}, queue: Promise.resolve() };
    }
  })();
  return holder.__macsStore;
}

/** Writes are queued and land atomically, so a crash never leaves a half-written file. */
function persist(s: StoreState) {
  s.queue = s.queue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
      const tmp = `${FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ savedAt: new Date().toISOString(), docs: s.docs }), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tmp, FILE);
    })
    .catch((err) => console.error("Shared store write failed:", err));
  return s.queue;
}

const empty = (): Doc => ({ version: 0, value: null, updatedAt: null, updatedBy: null });

export async function getDoc(name: Collection): Promise<Doc> {
  return (await store()).docs[name] ?? empty();
}

export async function versions(): Promise<Record<Collection, number>> {
  const s = await store();
  return Object.fromEntries(COLLECTIONS.map((c) => [c, s.docs[c]?.version ?? 0])) as Record<Collection, number>;
}

export type PutResult = { ok: true; doc: Doc } | { ok: false; doc: Doc; reason: "conflict" | "too-large" };

/** Replaces a collection if the caller started from the current version. */
export async function putDoc(name: Collection, value: unknown, baseVersion: number, actor: string): Promise<PutResult> {
  const s = await store();
  const current = s.docs[name] ?? empty();
  if (baseVersion !== current.version) return { ok: false, doc: current, reason: "conflict" };
  if (JSON.stringify(value).length > MAX_CHARS) return { ok: false, doc: current, reason: "too-large" };
  const doc: Doc = { version: current.version + 1, value, updatedAt: new Date().toISOString(), updatedBy: actor };
  s.docs[name] = doc;
  await persist(s);
  return { ok: true, doc };
}

/** Changes a collection on the server in one step, so concurrent writers never conflict. */
export async function mutateDoc<T>(name: Collection, initial: T, change: (value: T) => T, actor: string | null): Promise<Doc> {
  const s = await store();
  const current = s.docs[name] ?? empty();
  const value = change((current.version === 0 ? initial : current.value) as T);
  const doc: Doc = { version: current.version + 1, value, updatedAt: new Date().toISOString(), updatedBy: actor };
  s.docs[name] = doc;
  await persist(s);
  return doc;
}
