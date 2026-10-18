import { connection } from "next/server";
import { canAccess } from "@/lib/access";
import { coverageBoard } from "@/lib/construction/coverage";
import { requireUser } from "@/lib/server/session";
import { profile } from "@/profiles";

/** The coverage board, for roles that cover pricing & budget (owner's choice). Read-only. */
export async function GET() {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;
  if (!profile.features.coverage) return Response.json({ error: "This workspace has no coverage board." }, { status: 404 });
  if (!canAccess(user.role, "finance")) return Response.json({ error: "The coverage board is for pricing roles. The Preconstruction Director can share what you need." }, { status: 403 });
  return Response.json(coverageBoard(), { headers: { "Cache-Control": "no-store" } });
}
