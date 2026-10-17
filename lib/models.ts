// OpenRouter model IDs, checked against https://openrouter.ai/api/v1/models on 2026-10-14.
export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  description: string;
}

export const MODELS: ModelOption[] = [
  { id: "anthropic/claude-sonnet-5.5", label: "Sonnet 5.5", provider: "Anthropic", description: "Balanced default for reports and analysis" },
  { id: "anthropic/claude-opus-5.5", label: "Opus 5.5", provider: "Anthropic", description: "Deepest reasoning for board and audit work" },
  { id: "anthropic/claude-haiku-5.5", label: "Haiku 5.5", provider: "Anthropic", description: "Fastest and lowest cost for quick lookups" },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", provider: "OpenAI", description: "OpenAI flagship for a second opinion" },
  { id: "google/gemini-4-argon", label: "Gemini 4 Argon", provider: "Google", description: "Google flagship for a second opinion" },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

export function getModel(id: string | undefined): ModelOption {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function isKnownModel(id: unknown): id is string {
  return typeof id === "string" && MODELS.some((m) => m.id === id);
}
