import type { Area } from "@/lib/access";
import type { ActivityEntry } from "@/lib/activity";
import { newId } from "@/lib/chat-utils";
import type { User } from "./accounts";
import { mutateDoc } from "./store";

const FEED_CAP = 1000;

/** Adds a line to the shared feed. The actor always comes from the signed-in person on the server. */
export async function logActivity(user: User, action: string, area: Area, opts: { page?: string; agent?: string } = {}) {
  const entry: ActivityEntry = {
    id: newId(),
    at: new Date().toISOString(),
    actor: opts.agent ? { name: opts.agent, role: "agent", kind: "agent", via: user.name } : { name: user.name, role: user.role, kind: "person" },
    action: action.slice(0, 240),
    area,
    page: opts.page?.slice(0, 40),
  };
  return mutateDoc<ActivityEntry[]>("activity", [], (list) => [entry, ...(Array.isArray(list) ? list : [])].slice(0, FEED_CAP), null);
}
