import { cookies } from "next/headers";
import { canAccess, type Area } from "@/lib/access";
import type { AdminRoleId } from "@/lib/roles";
import { profile } from "@/profiles";
import { userForToken, type User } from "./accounts";

/** The sign-in cookie, and who is signed in for a request. */

// One cookie per profile: browsers share cookies across ports, so two profiles running side by side
// on this computer would otherwise sign each other out.
export const SESSION_COOKIE = profile.id === "macs" ? "macs_session" : `${profile.id}_session`;

/** True when the request came to this computer's own address. */
export const isLocalHost = (host: string | null) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host ?? "");

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/**
 * No-passcode mode, for this computer only: MACS_NO_SIGNIN=1, a request addressed to this computer,
 * from this computer (Next.js records the caller in x-forwarded-for; a Tailscale or LAN visitor shows
 * their own address there). Meant for `next dev -H 127.0.0.1`; `npm run start:server` refuses it.
 */
export function noSigninHere(request: Request) {
  const from = request.headers.get("x-forwarded-for")?.split(",").map((x) => x.trim()) ?? [];
  return (
    process.env.MACS_NO_SIGNIN?.trim() === "1" &&
    isLocalHost(request.headers.get("host")) &&
    from.length > 0 &&
    from.every((ip) => LOOPBACK.has(ip))
  );
}

/** Secure cookies whenever the app is reached over HTTPS, including behind a proxy or `tailscale serve`. */
export function cookieOptions(request: Request, maxAge: number) {
  const https = request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
  return { httpOnly: true, sameSite: "lax" as const, secure: https, path: "/", maxAge };
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentUser(): Promise<User | null> {
  return userForToken(await sessionToken());
}

/** The signed-in person, or a 401 to send back. */
export async function requireUser(): Promise<User | Response> {
  const user = await currentUser();
  return user ?? Response.json({ error: "Sign in to the workspace first.", signIn: true }, { status: 401 });
}

/** The signed-in person if their role covers `area`, or a 401 or 403 to send back. */
export async function requireArea(area: Area): Promise<User | Response> {
  const user = await requireUser();
  if (user instanceof Response) return user;
  return canAccess(user.role, area) ? user : Response.json({ error: "Your role doesn't include this." }, { status: 403 });
}

// ---- Who's here now -----------------------------------------------------------------

export interface Here {
  id: string;
  name: string;
  role: AdminRoleId;
}

const holder = globalThis as unknown as { __macsPresence?: Map<string, Here & { at: number }> };
const presence = (holder.__macsPresence ??= new Map());

/** Records that someone just checked in; open workspaces poll every few seconds. */
export function touch(u: User) {
  presence.set(u.id, { id: u.id, name: u.name, role: u.role, at: Date.now() });
}

export function leave(id: string) {
  presence.delete(id);
}

export function whoIsHere(withinMs = 45_000): Here[] {
  const now = Date.now();
  return [...presence.values()].filter((p) => now - p.at < withinMs).map(({ id, name, role }) => ({ id, name, role }));
}
