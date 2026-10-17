import { profile } from "@/profiles";

export interface PromptStarter {
  id: string;
  title: string;
  /** Short label for the home suggestion chips; the full title names the chat. */
  chip: string;
  subtitle: string;
  icon: "sunrise" | "landmark" | "chart" | "clipboard" | "newspaper" | "mail" | "scale" | "help" | "file";
  prompt: string;
}

/** The active profile's suggestion chips. */
export const PROMPT_STARTERS: PromptStarter[] = profile.starters;
