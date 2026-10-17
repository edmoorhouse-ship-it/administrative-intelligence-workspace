import { canAccess, canApprove, isArea } from "@/lib/access";
import { type SharedEvent, SHARED_END, SHARED_START } from "@/lib/calendar";
import { newId } from "@/lib/chat-utils";
import { logActivity } from "@/lib/server/activity-log";
import { requireUser } from "@/lib/server/session";
import { getDoc, mutateDoc } from "@/lib/server/store";

/**
 * Changes to the shared calendar, checked on the server:
 *   propose   anyone, for an area their role covers (the calendar assistant proposes on a person's behalf)
 *   add       staff add an event; it's approved at once only if they may approve that area
 *   approve / reject / remove   the Director, or Finance for finance events
 */

const TITLE = /^[\s\S]{4,120}$/;
const TIME = /^[\w\s:.,–—-]{1,20}$/;

const visibleTo = (list: SharedEvent[], role: Parameters<typeof canAccess>[0]) =>
  list.filter((e) => e.status !== "rejected" && canAccess(role, e.area));

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof Response) return user;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const action = body.action;
  const now = new Date().toISOString();
  const me = user.name;
  const stored = await getDoc("events");
  const list = (Array.isArray(stored.value) ? stored.value : []) as SharedEvent[];

  if (action === "propose" || action === "add") {
    const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
    const date = typeof body.date === "string" ? body.date : "";
    const time = typeof body.time === "string" && body.time.trim() ? body.time.trim() : undefined;
    const area = isArea(body.area) ? body.area : "general";
    if (!TITLE.test(title)) return Response.json({ error: "Give the event a title of at least four letters." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < SHARED_START || date > SHARED_END) {
      return Response.json({ error: `Pick a date between ${SHARED_START} and ${SHARED_END}.` }, { status: 400 });
    }
    if (time && !TIME.test(time)) return Response.json({ error: "Time should look like 9:00 AM." }, { status: 400 });
    if (!canAccess(user.role, area)) return Response.json({ error: "Your role doesn't include that area." }, { status: 403 });

    const agent = action === "propose" && typeof body.agent === "string" && body.agent.trim() ? body.agent.trim().slice(0, 40) : null;
    const approved = action === "add" && canApprove(user.role, area);
    const event: SharedEvent = {
      id: newId(),
      date,
      time,
      title,
      area,
      detail: typeof body.detail === "string" ? body.detail.trim().slice(0, 300) || undefined : undefined,
      deadline: body.deadline === true || /deadline|due/i.test(title),
      status: approved ? "approved" : "proposed",
      author: agent ? { name: agent, role: "agent", via: me } : { name: me, role: user.role },
      createdAt: now,
      ...(approved ? { reviewedBy: me, reviewedAt: now } : {}),
    };
    await mutateDoc<SharedEvent[]>("events", [], (events) => [event, ...(Array.isArray(events) ? events : [])], me);
    await logActivity(user, `${approved ? "added to the calendar" : "proposed for the calendar"}: ${title} (${date})`, area, {
      page: "Calendar",
      agent: agent ?? undefined,
    });
  } else if (action === "approve" || action === "reject" || action === "remove") {
    const id = typeof body.id === "string" ? body.id : "";
    const event = list.find((e) => e.id === id);
    if (!event || !canAccess(user.role, event.area)) return Response.json({ error: "No such event." }, { status: 404 });
    if (!canApprove(user.role, event.area)) {
      return Response.json({ error: "Only the Director, or Finance for finance events, can do that. You can propose instead." }, { status: 403 });
    }
    if (action !== "remove" && event.status !== "proposed") return Response.json({ error: "That event isn't waiting for approval." }, { status: 409 });
    await mutateDoc<SharedEvent[]>(
      "events",
      [],
      (events) =>
        (Array.isArray(events) ? events : [])
          .filter((e) => !(action === "remove" && e.id === id))
          .map((e) => (e.id === id && action !== "remove" ? { ...e, status: action === "approve" ? "approved" : "rejected", reviewedBy: me, reviewedAt: now } : e)),
      me,
    );
    const verb = action === "approve" ? "approved on the calendar" : action === "reject" ? "turned down on the calendar" : "removed from the calendar";
    await logActivity(user, `${verb}: ${event.title} (${event.date})`, event.area, { page: "Calendar" });
  } else {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }

  const doc = await getDoc("events");
  return Response.json({ version: doc.version, value: visibleTo((doc.value as SharedEvent[] | null) ?? [], user.role) });
}
