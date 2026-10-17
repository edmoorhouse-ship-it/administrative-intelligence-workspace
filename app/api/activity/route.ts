import { canAccess, isArea } from "@/lib/access";
import type { ActivityEntry } from "@/lib/activity";
import { logActivity } from "@/lib/server/activity-log";
import { requireUser } from "@/lib/server/session";

/** Adds a line to the shared activity feed. The actor comes from the signed-in person, not the request. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action.trim() : "";
  const area = isArea(body.area) ? body.area : "general";
  if (!action) return Response.json({ error: "Send an action." }, { status: 400 });
  if (!canAccess(user.role, area)) return Response.json({ error: "Your role doesn't include this." }, { status: 403 });

  const doc = await logActivity(user, action, area, {
    page: typeof body.page === "string" ? body.page : undefined,
    agent: typeof body.agent === "string" && body.agent.trim() ? body.agent.trim().slice(0, 40) : undefined,
  });
  const feed = (doc.value as ActivityEntry[]).filter((e) => canAccess(user.role, e.area));
  return Response.json({ ...doc, value: feed });
}
