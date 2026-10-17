import { canAccess, canApprove, isArea } from "@/lib/access";
import { BRAIN_SEED, canSeeFact, factSummary, MAX_FACT, type Fact } from "@/lib/brain";
import { newId } from "@/lib/chat-utils";
import { logActivity } from "@/lib/server/activity-log";
import { requireUser } from "@/lib/server/session";
import { getDoc, mutateDoc } from "@/lib/server/store";

/**
 * Changes to the shared brain, checked on the server so they hold whatever the page sends:
 *   propose   anyone, for an area their role covers (agents propose on a person's behalf)
 *   add       staff add a fact; it's approved at once only if they may approve that area
 *   approve / reject / remove   the Director, or Finance for finance facts
 */
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
  const me = { name: user.name, role: user.role };

  if (action === "propose" || action === "add") {
    const text = typeof body.text === "string" ? body.text.trim().replace(/\s+/g, " ").slice(0, MAX_FACT) : "";
    const area = isArea(body.area) ? body.area : "general";
    if (text.length < 8) return Response.json({ error: "Write the fact as a full sentence." }, { status: 400 });
    if (!canAccess(user.role, area)) return Response.json({ error: "Your role doesn't include that area." }, { status: 403 });
    const agent = action === "propose" && typeof body.agent === "string" && body.agent.trim() ? body.agent.trim().slice(0, 40) : null;
    const approved = action === "add" && canApprove(user.role, area);
    const fact: Fact = {
      id: newId(),
      text,
      area,
      source: agent ? "agent" : "staff",
      origin: typeof body.origin === "string" ? body.origin.slice(0, 120) : undefined,
      status: approved ? "approved" : "proposed",
      author: agent ? { name: agent, role: "agent", via: user.name } : me,
      createdAt: now,
      ...(approved ? { reviewedBy: me, reviewedAt: now } : {}),
    };
    await mutateDoc<Fact[]>("brain", BRAIN_SEED, (facts) => [fact, ...facts], user.name);
    await logActivity(user, `${approved ? "added to the brain" : "proposed for the brain"}: ${factSummary(fact)}`, area, {
      page: fact.origin,
      agent: agent ?? undefined,
    });
  } else if (action === "approve" || action === "reject" || action === "remove") {
    const id = typeof body.id === "string" ? body.id : "";
    const stored = await getDoc("brain");
    const current = stored.version === 0 ? BRAIN_SEED : (stored.value as Fact[]);
    const fact = current.find((f) => f.id === id);
    if (!fact || !canSeeFact(fact, user.role)) return Response.json({ error: "No such fact." }, { status: 404 });
    if (!canApprove(user.role, fact.area)) {
      return Response.json({ error: "Only the Director, or Finance for finance facts, can do that. You can propose instead." }, { status: 403 });
    }
    if (action !== "remove" && fact.status !== "proposed") return Response.json({ error: "That fact isn't waiting for approval." }, { status: 409 });
    await mutateDoc<Fact[]>(
      "brain",
      BRAIN_SEED,
      (facts) =>
        action === "remove"
          ? facts.filter((f) => f.id !== id)
          : facts.map((f) => (f.id === id ? { ...f, status: action === "approve" ? "approved" : "rejected", reviewedBy: me, reviewedAt: now } : f)),
      user.name,
    );
    const verb = action === "approve" ? "approved for the brain" : action === "reject" ? "turned down" : "removed from the brain";
    await logActivity(user, `${verb}: ${factSummary(fact)}`, fact.area, { page: "Brain" });
  } else {
    return Response.json({ error: "Unknown action." }, { status: 400 });
  }

  const doc = await getDoc("brain");
  return Response.json({ ...doc, value: (doc.value as Fact[]).filter((f) => canSeeFact(f, user.role)) });
}
