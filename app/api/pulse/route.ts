import { connection } from "next/server";
import { canAccess, canOpenTool } from "@/lib/access";
import type { ClarificationTrack } from "@/lib/construction/clarification-email";
import { constructionPulse } from "@/lib/construction/pulse";
import { getDoc } from "@/lib/server/store";
import { requireUser } from "@/lib/server/session";
import { profile } from "@/profiles";

/**
 * The construction Pulse for the signed-in person's role. Built on the server so pricing, records,
 * and risk only reach people whose role covers them. MACS builds its Pulse in the page instead.
 */
export async function GET() {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (profile.id !== "construction") return Response.json({ error: "This workspace builds its Pulse in the page." }, { status: 404 });
  if (!canOpenTool(user.role, "pulse")) return Response.json({ error: "Your role doesn't include this." }, { status: 403 });
  const doc = await getDoc("clarifications");
  const tracks = (Array.isArray(doc.value) ? doc.value : []) as ClarificationTrack[];
  const clarifications = {
    sent: tracks.filter((t) => t.status === "sent").map(({ bidder, pkg, updatedAt }) => ({ bidder, pkg, updatedAt })),
    answered: tracks.filter((t) => t.status === "answered").length,
  };
  return Response.json(constructionPulse((area) => canAccess(user.role, area), clarifications), { headers: { "Cache-Control": "no-store" } });
}
