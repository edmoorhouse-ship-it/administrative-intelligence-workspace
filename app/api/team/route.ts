import { connection } from "next/server";
import { canManageTeam } from "@/lib/access";
import { getRole } from "@/lib/roles";
import { createUser, listUsers, updateUser } from "@/lib/server/accounts";
import { logActivity } from "@/lib/server/activity-log";
import { requireUser } from "@/lib/server/session";

/** Staff accounts. Everyone sees who is on the team; only the Director adds or changes accounts. */

export async function GET() {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;
  const users = await listUsers();
  return Response.json({ users: canManageTeam(user.role) ? users : users.filter((u) => u.active).map(({ id, name, role }) => ({ id, name, role })) });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (!canManageTeam(user.role)) return Response.json({ error: "Only the Director can change staff accounts." }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const passcode = typeof body.passcode === "string" ? body.passcode : undefined;

  if (body.action === "add") {
    const created = await createUser({ name: typeof body.name === "string" ? body.name : "", role: body.role, passcode: passcode ?? "" }, user.name);
    if (!created.ok) return Response.json({ error: created.error }, { status: 400 });
    await logActivity(user, `added ${created.value.name} as ${getRole(created.value.role).label}`, "general", { page: "Brain" });
  } else if (body.action === "update" && typeof body.id === "string") {
    const updated = await updateUser(
      body.id,
      { role: body.role, active: typeof body.active === "boolean" ? body.active : undefined, passcode },
      user.id,
    );
    if (!updated.ok) return Response.json({ error: updated.error }, { status: 400 });
    const u = updated.value;
    const what =
      typeof body.active === "boolean"
        ? `${body.active ? "turned on" : "turned off"} ${u.name}'s account`
        : passcode !== undefined
          ? `reset ${u.name}'s passcode`
          : `made ${u.name} ${getRole(u.role).label}`;
    await logActivity(user, what, "general", { page: "Brain" });
  } else {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }
  return Response.json({ users: await listUsers() });
}
