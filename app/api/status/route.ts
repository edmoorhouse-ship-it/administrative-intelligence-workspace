import { connection } from "next/server";

export async function GET() {
  // Read the env at request time so adding a key only needs a restart, not a rebuild.
  await connection();
  return Response.json({ openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()) });
}
