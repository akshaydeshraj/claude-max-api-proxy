import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKQueryParams } from "../conversion/openai-to-sdk.js";
import {
  buildChatResponse,
  buildUsage,
  mapStopReason,
  mapResultSubtype,
} from "../conversion/sdk-to-openai.js";
import { Semaphore } from "./semaphore.js";
import { config } from "../config.js";
import type { OpenAIChatResponse } from "../types/openai.js";

const semaphore = new Semaphore(config.maxConcurrentRequests);

const DISALLOWED_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebSearch",
  "WebFetch",
  "Agent",
  "TodoWrite",
  "NotebookEdit",
];

export interface SDKCompletionResult {
  response: OpenAIChatResponse;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  durationMs: number;
}

export async function completeNonStreaming(
  params: SDKQueryParams,
  abortSignal?: AbortSignal,
): Promise<SDKCompletionResult> {
  await semaphore.acquire();
  const startTime = Date.now();

  try {
    const abortController = new AbortController();

    // Link external abort signal
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => abortController.abort());
    }

    // Timeout
    const timeout = setTimeout(
      () => abortController.abort(),
      config.requestTimeoutMs,
    );

    const options: Record<string, unknown> = {
      model: params.model,
      allowedTools: [],
      disallowedTools: DISALLOWED_TOOLS,
      permissionMode: "dontAsk",
      persistSession: false,
      includePartialMessages: false,
      maxBudgetUsd: config.maxBudgetPerRequest,
      abortController,
    };

    if (params.systemPrompt) {
      options.systemPrompt = params.systemPrompt;
    }
    if (params.effort) {
      options.effort = params.effort;
    }

    let content = "";
    let finishReason = "stop";
    let costUsd = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;

    const q = query({
      prompt: params.prompt,
      options: options as never,
    });

    for await (const message of q) {
      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if ("text" in block) {
            content += block.text;
          }
        }
      } else if (message.type === "result") {
        costUsd = message.total_cost_usd ?? 0;
        finishReason = message.subtype
          ? mapResultSubtype(message.subtype)
          : "stop";

        if (message.usage) {
          const usage = message.usage as Record<string, number>;
          inputTokens = usage.input_tokens ?? 0;
          outputTokens = usage.output_tokens ?? 0;
          cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
          cacheReadTokens = usage.cache_read_input_tokens ?? 0;
        }
      }
    }

    clearTimeout(timeout);

    const durationMs = Date.now() - startTime;
    const usage = buildUsage(inputTokens, outputTokens);
    const response = buildChatResponse({
      content,
      model: params.model,
      finishReason,
      usage,
    });

    return {
      response,
      costUsd,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      durationMs,
    };
  } finally {
    semaphore.release();
  }
}
