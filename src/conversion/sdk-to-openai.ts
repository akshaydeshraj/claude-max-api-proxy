import { v4 as uuidv4 } from "uuid";
import type {
  OpenAIChatResponse,
  OpenAIChatChunk,
  OpenAIUsage,
} from "../types/openai.js";

export function mapStopReason(
  sdkReason: string | null | undefined,
): string {
  switch (sdkReason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "length";
    case "refusal":
      return "content_filter";
    default:
      return "stop";
  }
}

export function mapResultSubtype(subtype: string): string {
  switch (subtype) {
    case "success":
      return "stop";
    case "error_max_turns":
    case "error_max_budget_usd":
      return "length";
    default:
      return "stop";
  }
}

export function buildUsage(
  inputTokens: number,
  outputTokens: number,
): OpenAIUsage {
  return {
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
  };
}

export function buildChatResponse(params: {
  content: string;
  model: string;
  finishReason: string;
  usage: OpenAIUsage;
}): OpenAIChatResponse {
  return {
    id: `chatcmpl-${uuidv4()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: params.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: params.content,
        },
        finish_reason: params.finishReason,
      },
    ],
    usage: params.usage,
  };
}

export function buildStreamChunk(params: {
  id: string;
  model: string;
  content?: string;
  role?: "assistant";
  finishReason?: string | null;
  usage?: OpenAIUsage | null;
}): OpenAIChatChunk {
  const chunk: OpenAIChatChunk = {
    id: params.id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: params.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: params.finishReason ?? null,
      },
    ],
  };

  if (params.role) {
    chunk.choices[0].delta.role = params.role;
  }
  if (params.content !== undefined) {
    chunk.choices[0].delta.content = params.content;
  }
  if (params.usage !== undefined) {
    chunk.usage = params.usage;
  }

  return chunk;
}

export function formatSSE(chunk: OpenAIChatChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

export function formatSSEDone(): string {
  return `data: [DONE]\n\n`;
}
