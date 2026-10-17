import { connection } from "next/server";
import { requireUser, touch, whoIsHere } from "@/lib/server/session";
import { versions } from "@/lib/server/store";

/** The poll: every collection's version and who's here. Each call also marks the caller as here. */
export async function GET() {
  await connection();
  const user = await requireUser();
  if (user instanceof Response) return user;
  touch(user);
  return Response.json({ versions: await versions(), here: whoIsHere(), user });
}
