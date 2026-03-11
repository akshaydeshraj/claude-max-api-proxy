const MODEL_MAP: Record<string, string> = {
  // Direct Claude model IDs
  "claude-opus-4-6": "claude-opus-4-6",
  "claude-sonnet-4-6": "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001": "claude-haiku-4-5-20251001",
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",

  // Short aliases
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",

  // OpenAI model names → Claude equivalents
  "gpt-4": "claude-sonnet-4-6",
  "gpt-4o": "claude-sonnet-4-6",
  "gpt-4-turbo": "claude-sonnet-4-6",
  "gpt-4o-mini": "claude-haiku-4-5-20251001",
  "gpt-3.5-turbo": "claude-haiku-4-5-20251001",
  o1: "claude-opus-4-6",
  "o1-mini": "claude-sonnet-4-6",
  o3: "claude-opus-4-6",
  "o3-mini": "claude-sonnet-4-6",
};

const DEFAULT_MODEL = "claude-sonnet-4-6";

export function mapModel(requestedModel: string): string {
  // Exact match
  if (MODEL_MAP[requestedModel]) {
    return MODEL_MAP[requestedModel];
  }

  // Pass through any valid claude-* model ID as-is
  if (requestedModel.startsWith("claude-")) {
    return requestedModel;
  }

  return DEFAULT_MODEL;
}

export function getAvailableModels() {
  return [
    {
      id: "claude-opus-4-6",
      object: "model" as const,
      created: 1700000000,
      owned_by: "anthropic",
    },
    {
      id: "claude-sonnet-4-6",
      object: "model" as const,
      created: 1700000000,
      owned_by: "anthropic",
    },
    {
      id: "claude-haiku-4-5-20251001",
      object: "model" as const,
      created: 1700000000,
      owned_by: "anthropic",
    },
  ];
}

export const EFFORT_MAP: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
};

export function mapEffort(
  reasoningEffort?: string,
): "low" | "medium" | "high" | undefined {
  if (!reasoningEffort) return undefined;
  const mapped = EFFORT_MAP[reasoningEffort];
  return mapped as "low" | "medium" | "high" | undefined;
}
