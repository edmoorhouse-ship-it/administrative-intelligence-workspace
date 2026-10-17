import type { AdminRoleId } from "./roles";
import type { ToolId } from "./tools";

export type MessageStatus = "streaming" | "done" | "stopped" | "error";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  status?: MessageStatus;
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  forkedFrom?: string;
  /** School section the chat was started from, if any. */
  sectionId?: string;
  /** Set when the chat came from Inbox triage, so follow-ups keep the triage rules. */
  mode?: "inbox";
  /** Tool page the chat was started from, if any. */
  toolId?: string;
  /** Snapshot of that page when the chat started, so follow-ups keep the same facts. */
  toolContext?: string;
}

export type ThemePreference = "system" | "light" | "dark";

export interface WorkspaceSettings {
  model: string;
  role: AdminRoleId;
  customInstructions: string;
  theme: ThemePreference;
  sidebarCollapsed: boolean;
}

/** Body accepted by POST /api/chat. */
export interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  model: string;
  role: AdminRoleId;
  customInstructions?: string;
  sectionId?: string;
  mode?: "inbox";
  toolId?: ToolId;
  toolContext?: string;
}
