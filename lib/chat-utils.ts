import type { Chat } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function deriveTitle(text: string, max = 56): string {
  const clean = text
    .replace(/[#*_`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean || "New chat";
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 24 ? lastSpace : max)}…`;
}

export interface ChatGroup {
  label: string;
  chats: Chat[];
}

const DAY = 86_400_000;

/** Sidebar grouping: Pinned, Today, Previous 7 Days, Previous 30 Days, Older; archived separately. */
export function groupChats(chats: Chat[], now = Date.now()): { groups: ChatGroup[]; archived: Chat[] } {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const byRecent = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const buckets: Record<string, Chat[]> = {
    Pinned: [],
    Today: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };
  const archived: Chat[] = [];

  for (const chat of byRecent) {
    if (chat.archived) archived.push(chat);
    else if (chat.pinned) buckets.Pinned.push(chat);
    else if (chat.updatedAt >= startOfToday) buckets.Today.push(chat);
    else if (chat.updatedAt >= startOfToday - 7 * DAY) buckets["Previous 7 Days"].push(chat);
    else if (chat.updatedAt >= startOfToday - 30 * DAY) buckets["Previous 30 Days"].push(chat);
    else buckets.Older.push(chat);
  }

  const groups = Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, chats: list }));
  return { groups, archived };
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
