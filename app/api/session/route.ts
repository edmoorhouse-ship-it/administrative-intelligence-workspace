import { connection } from "next/server";
import { cookies } from "next/headers";
import { createSession, createUser, endSession, ensureLocalDirector, hasAnyUser, setupCodeMatches, verifyLogin } from "@/lib/server/accounts";
import { logActivity } from "@/lib/server/activity-log";
import { cookieOptions, currentUser, isLocalHost, leave, noSigninHere, SESSION_COOKIE, sessionToken } from "@/lib/server/session";

/**
 * Sign-in. GET says who is signed in and whether the workspace still needs its first account.
 * POST signs in, or creates the first (Director) account with the setup code. DELETE signs out.
 */

const setupAllowedWithoutCode = (request: Request) => !process.env.MACS_SETUP_CODE?.trim() && isLocalHost(request.headers.get("host"));

export async function GET(request: Request) {
  await connection();
  // No-passcode mode on this computer: sign the Director in straight away.
  if (noSigninHere(request) && !(await currentUser())) {
    const user = await ensureLocalDirector(process.env.MACS_LOCAL_NAME?.trim() || "Director");
    const { token, maxAge } = await createSession(user.id);
    (await cookies()).set(SESSION_COOKIE, token, cookieOptions(request, maxAge));
    return Response.json({ user, setupNeeded: false, setupNeedsCode: false, setupBlocked: false, noSignin: true });
  }
  const setupNeeded = !(await hasAnyUser());
  return Response.json({
    user: await currentUser(),
    setupNeeded,
    // Off this computer, the first account needs MACS_SETUP_CODE, so a stranger can't claim the school.
    setupNeedsCode: setupNeeded && !setupAllowedWithoutCode(request),
    setupBlocked: setupNeeded && !process.env.MACS_SETUP_CODE?.trim() && !isLocalHost(request.headers.get("host")),
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const passcode = typeof body.passcode === "string" ? body.passcode : "";

  let user;
  if (body.mode === "setup") {
    if (await hasAnyUser()) return Response.json({ error: "The workspace is already set up. Sign in instead." }, { status: 409 });
    if (!setupAllowedWithoutCode(request) && !setupCodeMatches(typeof body.setupCode === "string" ? body.setupCode : "")) {
      return Response.json(
        { error: process.env.MACS_SETUP_CODE?.trim() ? "That setup code isn't right." : "Set MACS_SETUP_CODE on the server before setting up from another device." },
        { status: 403 },
      );
    }
    const created = await createUser({ name, role: "principal", passcode }, "setup");
    if (!created.ok) return Response.json({ error: created.error }, { status: 400 });
    user = created.value;
    await logActivity(user, "set up the shared workspace", "general");
  } else {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const checked = await verifyLogin(name, passcode, `${name.trim().toLowerCase()}|${ip}`);
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 401 });
    user = checked.value;
  }

  const { token, maxAge } = await createSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(request, maxAge));
  return Response.json({ user });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (user) leave(user.id);
  await endSession(await sessionToken());
  (await cookies()).set(SESSION_COOKIE, "", cookieOptions(request, 0));
  return Response.json({ ok: true });
}
