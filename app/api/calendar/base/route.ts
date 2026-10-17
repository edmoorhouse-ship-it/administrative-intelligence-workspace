import { connection } from "next/server";
import { eventsFor } from "@/lib/calendar";
import { constructionEvents } from "@/lib/construction/calendar";
import { requireUser } from "@/lib/server/session";
import { profile } from "@/profiles";

/**
 * The calendar's built-in events for the signed-in person's role (construction). The shared events
 * people add come from the shared store as before. MACS builds its events in the page.
 */
export async function GET() {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (profile.id !== "construction") return Response.json({ error: "This workspace builds its calendar in the page." }, { status: 404 });
  return Response.json({ events: eventsFor(user.role, constructionEvents()) }, { headers: { "Cache-Control": "no-store" } });
}
