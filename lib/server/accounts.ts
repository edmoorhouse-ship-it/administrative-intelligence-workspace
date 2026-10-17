import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { newId } from "@/lib/chat-utils";
import { isKnownRole, type AdminRoleId } from "@/lib/roles";
import { DATA_DIR } from "./store";

/**
 * Staff accounts: one per person, each with a role and their own passcode. Passcodes are stored
 * only as scrypt hashes. Sign-ins are server-side sessions (a random token in an httpOnly cookie,
 * stored here only as a hash), so turning an account off or signing out ends them at once.
 * Kept in data/accounts.json, apart from the shared store, and never sent to a browser whole.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const FILE = path.join(DATA_DIR, "accounts.json");
const SESSION_DAYS = 14;
export const MIN_PASSCODE = 8;

interface StoredUser {
  id: string;
  name: string;
  role: AdminRoleId;
  salt: string;
  hash: string;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

interface StoredSession {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

interface AccountsState {
  users: StoredUser[];
  sessions: StoredSession[];
  queue: Promise<void>;
}

/** What the browser may know about a person. */
export interface User {
  id: string;
  name: string;
  role: AdminRoleId;
  active: boolean;
  createdAt: string;
  createdBy: string;
}

const publicUser = ({ id, name, role, active, createdAt, createdBy }: StoredUser): User => ({ id, name, role, active, createdAt, createdBy });

const holder = globalThis as unknown as { __macsAccounts?: Promise<AccountsState> };

function accounts(): Promise<AccountsState> {
  holder.__macsAccounts ??= (async () => {
    try {
      const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<AccountsState>;
      return { users: parsed.users ?? [], sessions: parsed.sessions ?? [], queue: Promise.resolve() };
    } catch {
      return { users: [], sessions: [], queue: Promise.resolve() };
    }
  })();
  return holder.__macsAccounts;
}

function persist(s: AccountsState) {
  s.queue = s.queue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
      const tmp = `${FILE}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ users: s.users, sessions: s.sessions }), { encoding: "utf8", mode: 0o600 });
      await fs.rename(tmp, FILE);
    })
    .catch((err) => console.error("Accounts write failed:", err));
  return s.queue;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normalName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

async function hashPasscode(passcode: string, salt = randomBytes(16)) {
  const hash = await scrypt(passcode, salt, 64);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export async function hasAnyUser() {
  return (await accounts()).users.length > 0;
}

export async function listUsers(): Promise<User[]> {
  return (await accounts()).users.map(publicUser);
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export async function createUser(input: { name: string; role: unknown; passcode: string }, createdBy: string): Promise<Result<User>> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name) return { ok: false, error: "Enter a name." };
  if (!isKnownRole(input.role)) return { ok: false, error: "Pick a role." };
  if (input.passcode.length < MIN_PASSCODE) return { ok: false, error: `Passcodes need at least ${MIN_PASSCODE} characters.` };
  const s = await accounts();
  if (s.users.some((u) => normalName(u.name) === normalName(name))) return { ok: false, error: "Someone already has that name. Add a last initial." };
  const user: StoredUser = { id: newId(), name, role: input.role, ...(await hashPasscode(input.passcode)), active: true, createdAt: new Date().toISOString(), createdBy };
  s.users.push(user);
  await persist(s);
  return { ok: true, value: publicUser(user) };
}

export async function updateUser(id: string, patch: { role?: unknown; active?: boolean; passcode?: string }, actorId: string): Promise<Result<User>> {
  const s = await accounts();
  const user = s.users.find((u) => u.id === id);
  if (!user) return { ok: false, error: "No such account." };
  if (id === actorId && (patch.active === false || (patch.role !== undefined && patch.role !== "principal"))) {
    return { ok: false, error: "You can't turn off or demote your own account." };
  }
  if (patch.role !== undefined) {
    if (!isKnownRole(patch.role)) return { ok: false, error: "Pick a role." };
    user.role = patch.role;
  }
  if (patch.passcode !== undefined) {
    if (patch.passcode.length < MIN_PASSCODE) return { ok: false, error: `Passcodes need at least ${MIN_PASSCODE} characters.` };
    Object.assign(user, await hashPasscode(patch.passcode));
  }
  if (patch.active !== undefined) user.active = patch.active;
  // A role change, new passcode, or turned-off account ends that person's sign-ins.
  s.sessions = s.sessions.filter((x) => x.userId !== id);
  await persist(s);
  return { ok: true, value: publicUser(user) };
}

/**
 * The Director's account for no-passcode mode on this computer. Its passcode is random and never
 * shown, so it can't be used to sign in from anywhere else.
 */
export async function ensureLocalDirector(name: string): Promise<User> {
  const s = await accounts();
  const existing = s.users.find((u) => normalName(u.name) === normalName(name) && u.role === "principal" && u.active);
  if (existing) return publicUser(existing);
  const created = await createUser({ name, role: "principal", passcode: randomBytes(24).toString("hex") }, "this computer");
  if (created.ok) return created.value;
  // The name is taken by a non-Director account: use a distinct one.
  const fallback = await createUser({ name: `${name} (this computer)`, role: "principal", passcode: randomBytes(24).toString("hex") }, "this computer");
  if (!fallback.ok) throw new Error(fallback.error);
  return fallback.value;
}

// ---- Sign-in, with a brake on guessing ---------------------------------------------------

const failures = new Map<string, { count: number; until: number }>();
const LOCK_AFTER = 5;
const LOCK_MS = 10 * 60_000;

export function lockedOut(key: string) {
  const f = failures.get(key);
  return Boolean(f && f.count >= LOCK_AFTER && Date.now() < f.until);
}

function noteFailure(key: string) {
  const f = failures.get(key);
  const count = f && Date.now() < f.until ? f.count + 1 : 1;
  failures.set(key, { count, until: Date.now() + LOCK_MS });
}

/** Checks a name and passcode. `key` (name plus address) limits guessing to five tries per ten minutes. */
export async function verifyLogin(name: string, passcode: string, key: string): Promise<Result<User>> {
  if (lockedOut(key)) return { ok: false, error: "Too many tries. Wait ten minutes, or ask the Director to reset your passcode." };
  const user = (await accounts()).users.find((u) => normalName(u.name) === normalName(name));
  // Hash even when the name is unknown, so a wrong name and a wrong passcode take the same time.
  const salt = user ? Buffer.from(user.salt, "hex") : randomBytes(16);
  const given = await scrypt(passcode, salt, 64);
  const ok = Boolean(user && timingSafeEqual(given, Buffer.from(user.hash, "hex")));
  if (!ok || !user) {
    noteFailure(key);
    return { ok: false, error: "That name and passcode don't match." };
  }
  if (!user.active) return { ok: false, error: "This account is turned off. Ask the Director." };
  failures.delete(key);
  return { ok: true, value: publicUser(user) };
}

export async function createSession(userId: string): Promise<{ token: string; maxAge: number }> {
  const s = await accounts();
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  s.sessions = s.sessions.filter((x) => x.expiresAt > now);
  s.sessions.push({ tokenHash: sha256(token), userId, expiresAt: now + SESSION_DAYS * 86_400_000 });
  await persist(s);
  return { token, maxAge: SESSION_DAYS * 86_400 };
}

export async function userForToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const s = await accounts();
  const hash = sha256(token);
  const session = s.sessions.find((x) => x.tokenHash === hash && x.expiresAt > Date.now());
  const user = session && s.users.find((u) => u.id === session.userId && u.active);
  return user ? publicUser(user) : null;
}

export async function endSession(token: string | undefined) {
  if (!token) return;
  const s = await accounts();
  const hash = sha256(token);
  s.sessions = s.sessions.filter((x) => x.tokenHash !== hash);
  await persist(s);
}

/** The one-time code for creating the first (Director) account, compared in constant time. */
export function setupCodeMatches(given: string): boolean {
  const want = process.env.MACS_SETUP_CODE?.trim() ?? "";
  const a = createHash("sha256").update(given.trim()).digest();
  const b = createHash("sha256").update(want).digest();
  return want.length > 0 && timingSafeEqual(a, b);
}
