import { connection } from "next/server";
import { canAccess } from "@/lib/access";
import type { ActivityEntry } from "@/lib/activity";
import { BRAIN_SEED, canSeeFact, type Fact } from "@/lib/brain";
import type { SharedEvent } from "@/lib/calendar";
import { getRole } from "@/lib/roles";
import type { User } from "@/lib/server/accounts";
import { requireUser } from "@/lib/server/session";
import { COLLECTION_AREA, getDoc, isCollection, putDoc, type Collection, type Doc } from "@/lib/server/store";

/** What this person may read of a collection: whole, filtered item by item, or nothing. */
function readable(name: Collection, doc: Doc, user: User): Doc | null {
  const area = COLLECTION_AREA[name];
  if (name === "brain") {
    const facts = (doc.version === 0 ? BRAIN_SEED : (doc.value as Fact[])) ?? [];
    return { ...doc, value: facts.filter((f) => canSeeFact(f, user.role)) };
  }
  if (name === "events") {
    // Proposed and approved calendar events in the areas this role covers; turned-down ones stay out.
    const list = (Array.isArray(doc.value) ? doc.value : []) as SharedEvent[];
    return { ...doc, value: list.filter((e) => e.status !== "rejected" && canAccess(user.role, e.area)) };
  }
  if (name === "activity") {
    const feed = (Array.isArray(doc.value) ? doc.value : []) as ActivityEntry[];
    return { ...doc, value: feed.filter((e) => canAccess(user.role, e.area)) };
  }
  return area !== "per-item" && canAccess(user.role, area) ? doc : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { name } = await params;
  if (!isCollection(name)) return Response.json({ error: "Unknown collection." }, { status: 404 });
  const doc = readable(name, await getDoc(name), user);
  return doc ? Response.json(doc) : Response.json({ error: "Your role doesn't include this." }, { status: 403 });
}

/** Replace a collection the person's role covers, starting from the version they last saw. */
export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const user = await requireUser();
  if (user instanceof Response) return user;
  const { name } = await params;
  if (!isCollection(name)) return Response.json({ error: "Unknown collection." }, { status: 404 });
  const area = COLLECTION_AREA[name];
  if (area === "per-item") {
    const route = { brain: "/api/brain", activity: "/api/activity", events: "/api/calendar" }[name as "brain" | "activity" | "events"];
    return Response.json({ error: `Change the ${name} through ${route}.` }, { status: 405 });
  }
  if (!canAccess(user.role, area)) return Response.json({ error: "Your role doesn't include this." }, { status: 403 });

  let body: { baseVersion?: unknown; value?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (typeof body.baseVersion !== "number" || body.value === undefined) {
    return Response.json({ error: "Send baseVersion and value." }, { status: 400 });
  }
  const result = await putDoc(name, body.value, body.baseVersion, `${user.name} (${getRole(user.role).label})`);
  if (result.ok) return Response.json(result.doc);
  return Response.json({ ...result.doc, error: result.reason }, { status: result.reason === "conflict" ? 409 : 413 });
}
