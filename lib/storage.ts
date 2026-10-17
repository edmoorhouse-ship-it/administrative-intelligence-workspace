import { DEFAULT_MODEL_ID, isKnownModel } from "./models";
import { DEFAULT_ROLE_ID, isKnownRole } from "./roles";
import type { Chat, ThemePreference, WorkspaceSettings } from "./types";

export const STORAGE_KEYS = {
  chats: "macs.chats.v1",
  activeChatId: "macs.activeChatId.v1",
  settings: "macs.settings.v1",
} as const;

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  model: DEFAULT_MODEL_ID,
  role: DEFAULT_ROLE_ID,
  customInstructions: "",
  theme: "light",
  sidebarCollapsed: false,
};

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — the workspace keeps working in memory.
  }
}

function isChat(value: unknown): value is Chat {
  const c = value as Chat;
  return Boolean(c && typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.messages));
}

export function loadChats(): Chat[] {
  const raw = read(STORAGE_KEYS.chats);
  if (!Array.isArray(raw)) return [];
  return raw.filter(isChat).map((chat) => ({
    ...chat,
    pinned: Boolean(chat.pinned),
    archived: Boolean(chat.archived),
    // A reload mid-stream leaves a partial reply behind; mark it as stopped.
    messages: chat.messages.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" as const } : m)),
  }));
}

export function saveChats(chats: Chat[]) {
  write(STORAGE_KEYS.chats, chats);
}

export function loadActiveChatId(): string | null {
  const raw = read(STORAGE_KEYS.activeChatId);
  return typeof raw === "string" ? raw : null;
}

export function saveActiveChatId(id: string | null) {
  write(STORAGE_KEYS.activeChatId, id);
}

const THEMES: ThemePreference[] = ["system", "light", "dark"];

export function loadSettings(): WorkspaceSettings {
  const raw = (read(STORAGE_KEYS.settings) ?? {}) as Partial<WorkspaceSettings>;
  return {
    model: isKnownModel(raw.model) ? raw.model : DEFAULT_SETTINGS.model,
    role: isKnownRole(raw.role) ? raw.role : DEFAULT_SETTINGS.role,
    customInstructions: typeof raw.customInstructions === "string" ? raw.customInstructions : "",
    theme: raw.theme && THEMES.includes(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    sidebarCollapsed: Boolean(raw.sidebarCollapsed),
  };
}

export function saveSettings(settings: WorkspaceSettings) {
  write(STORAGE_KEYS.settings, settings);
}
