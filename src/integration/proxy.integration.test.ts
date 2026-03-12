/**
 * Integration tests for the Claude Max Proxy.
 *
 * These tests make real HTTP requests against a running proxy instance
 * and validate both the OpenAI-compatible response format AND the
 * analytics data stored in the database.
 *
 * Prerequisites:
 *   1. `claude setup-token` (Claude Max auth)
 *   2. Proxy running: `npm run dev` or `npm start`
 *   3. Run: `npm run test:integration`
 */
import { describe, it, expect } from "vitest";

const BASE_URL = process.env.PROXY_URL || "http://localhost:3456";
const API_KEY = process.env.API_KEY || "";

// Tiny 1x1 red PNG for image tests
const RED_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const WEATHER_TOOL = {
  type: "function" as const,
  function: {
    name: "get_weather",
    description: "Get the current weather in a given location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name" },
        unit: { type: "string", enum: ["celsius", "fahrenheit"] },
      },
      required: ["location"],
    },
  },
};

// ─── Helpers ───

async function makeRequest(
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (API_KEY) {
    headers["Authorization"] = `Bearer ${API_KEY}`;
  }
  return fetch(`${BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function parseSSE(text: string): Array<Record<string, unknown> | "[DONE]"> {
  const chunks: Array<Record<string, unknown> | "[DONE]"> = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") {
      chunks.push("[DONE]");
    } else {
      try {
        chunks.push(JSON.parse(data));
      } catch {
        // skip malformed
      }
    }
  }
  return chunks;
}

async function pollRecentRequests(
  predicate: (row: Record<string, unknown>) => boolean,
  timeoutMs = 8000,
): Promise<Record<string, unknown> | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/api/stats/recent?limit=5`);
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    const match = rows.find(predicate);
    if (match) return match;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

// ─── Tests ───

describe("Integration: Claude Max Proxy", () => {
  // Verify proxy is reachable before running tests
  it("proxy is reachable", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  // ── 1. Basic chat completion (non-streaming) ──
  describe("basic chat completion", () => {
    let response: Response;
    let body: Record<string, unknown>;

    it("returns valid OpenAI response", async () => {
      response = await makeRequest({
        model: "haiku",
        messages: [{ role: "user", content: "Say 'pong'. Nothing else." }],
      });

      expect(response.status).toBe(200);
      body = (await response.json()) as Record<string, unknown>;

      // OpenAI shape
      expect(body.id).toMatch(/^chatcmpl-/);
      expect(body.object).toBe("chat.completion");

      const choices = body.choices as Array<Record<string, unknown>>;
      expect(choices).toHaveLength(1);

      const message = choices[0].message as Record<string, unknown>;
      expect(typeof message.content).toBe("string");
      expect((message.content as string).length).toBeGreaterThan(0);
      expect(message.role).toBe("assistant");

      expect(choices[0].finish_reason).toBe("stop");

      // Usage
      const usage = body.usage as Record<string, number>;
      expect(usage.prompt_tokens).toBeGreaterThan(0);
      expect(usage.completion_tokens).toBeGreaterThan(0);
      expect(usage.total_tokens).toBe(
        usage.prompt_tokens + usage.completion_tokens,
      );
    });

    it("logs to analytics DB", async () => {
      const row = await pollRecentRequests(
        (r) => r.stream === 0 && r.status === "success" && (r.output_tokens as number) > 0,
      );
      expect(row).not.toBeNull();
      expect(
        (row!.input_tokens as number) + (row!.cache_read_tokens as number),
      ).toBeGreaterThan(0);
    });
  });

  // ── 2. Streaming chat completion ──
  describe("streaming chat completion", () => {
    let chunks: Array<Record<string, unknown> | "[DONE]">;

    it("returns valid SSE stream", async () => {
      const response = await makeRequest({
        model: "haiku",
        stream: true,
        messages: [{ role: "user", content: "Say 'pong'. Nothing else." }],
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      const text = await response.text();
      chunks = parseSSE(text);

      // Must have at least: one content chunk + finish chunk + [DONE]
      expect(chunks.length).toBeGreaterThanOrEqual(3);

      // First data chunk should have role
      const firstData = chunks.find((c) => c !== "[DONE]") as Record<string, unknown>;
      const firstChoices = (firstData.choices as Array<Record<string, unknown>>);
      const firstDelta = firstChoices[0].delta as Record<string, unknown>;
      expect(firstDelta.role).toBe("assistant");

      // At least one chunk with content
      const contentChunks = chunks.filter((c) => {
        if (c === "[DONE]") return false;
        const ch = c as Record<string, unknown>;
        const choices = ch.choices as Array<Record<string, unknown>>;
        const delta = choices?.[0]?.delta as Record<string, unknown>;
        return delta?.content && (delta.content as string).length > 0;
      });
      expect(contentChunks.length).toBeGreaterThan(0);

      // Finish chunk
      const finishChunk = chunks.find((c) => {
        if (c === "[DONE]") return false;
        const ch = c as Record<string, unknown>;
        const choices = ch.choices as Array<Record<string, unknown>>;
        return choices?.[0]?.finish_reason === "stop";
      });
      expect(finishChunk).toBeDefined();

      // Ends with [DONE]
      expect(chunks[chunks.length - 1]).toBe("[DONE]");
    });

    it("logs streaming request to DB", async () => {
      const row = await pollRecentRequests(
        (r) => r.stream === 1 && r.status === "success" && (r.output_tokens as number) > 0,
      );
      expect(row).not.toBeNull();
      expect(
        (row!.input_tokens as number) + (row!.cache_read_tokens as number),
      ).toBeGreaterThan(0);
    });
  });

  // ── 3. Streaming with usage ──
  describe("streaming with usage", () => {
    it("emits usage chunk before [DONE]", async () => {
      const response = await makeRequest({
        model: "haiku",
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: "user", content: "Say 'pong'. Nothing else." }],
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      const chunks = parseSSE(text);

      // Find usage chunk (has usage field with prompt_tokens)
      const usageChunk = chunks.find((c) => {
        if (c === "[DONE]") return false;
        const ch = c as Record<string, unknown>;
        const choices = ch.choices as Array<Record<string, unknown>>;
        return ch.usage && (ch.usage as Record<string, number>).prompt_tokens > 0
          && choices?.[0]?.delta !== undefined;
      });
      expect(usageChunk).toBeDefined();

      const usage = (usageChunk as Record<string, unknown>).usage as Record<string, number>;
      expect(usage.prompt_tokens).toBeGreaterThan(0);
      expect(usage.completion_tokens).toBeGreaterThan(0);

      // [DONE] should be after usage
      const usageIdx = chunks.indexOf(usageChunk!);
      const doneIdx = chunks.indexOf("[DONE]");
      expect(doneIdx).toBeGreaterThan(usageIdx);
    });
  });

  // ── 4. Function calling (non-streaming) ──
  describe("function calling (non-streaming)", () => {
    it("returns tool_calls in response", async () => {
      const response = await makeRequest({
        model: "haiku",
        messages: [
          {
            role: "user",
            content:
              "You MUST call the get_weather tool for San Francisco. Do not respond with text.",
          },
        ],
        tools: [WEATHER_TOOL],
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;

      const choices = body.choices as Array<Record<string, unknown>>;
      expect(choices).toHaveLength(1);

      const message = choices[0].message as Record<string, unknown>;

      // Should have tool_calls
      if (choices[0].finish_reason === "tool_calls") {
        expect(message.content).toBeNull();

        const toolCalls = message.tool_calls as Array<Record<string, unknown>>;
        expect(toolCalls.length).toBeGreaterThanOrEqual(1);

        const tc = toolCalls[0];
        expect(tc.type).toBe("function");

        const fn = tc.function as Record<string, string>;
        expect(fn.name).toBe("get_weather");
        expect(fn.name).not.toContain("mcp__");

        // Arguments should be valid JSON with location
        const args = JSON.parse(fn.arguments);
        expect(args).toHaveProperty("location");
      } else {
        // Model didn't call tool — non-deterministic, warn but don't fail hard
        console.warn(
          "WARN: Model did not call tool (non-deterministic). finish_reason:",
          choices[0].finish_reason,
        );
      }
    });
  });

  // ── 5. Function calling (streaming) ──
  describe("function calling (streaming)", () => {
    it("streams tool_calls with correct name", async () => {
      const response = await makeRequest({
        model: "haiku",
        stream: true,
        messages: [
          {
            role: "user",
            content:
              "You MUST call the get_weather tool for San Francisco. Do not respond with text.",
          },
        ],
        tools: [WEATHER_TOOL],
      });

      expect(response.status).toBe(200);
      const text = await response.text();
      const chunks = parseSSE(text);

      // Find chunks with tool_calls
      const toolChunks = chunks.filter((c) => {
        if (c === "[DONE]") return false;
        const ch = c as Record<string, unknown>;
        const choices = ch.choices as Array<Record<string, unknown>>;
        const delta = choices?.[0]?.delta as Record<string, unknown>;
        return delta?.tool_calls;
      });

      if (toolChunks.length > 0) {
        // First tool chunk should have function name
        const firstTool = toolChunks[0] as Record<string, unknown>;
        const choices = firstTool.choices as Array<Record<string, unknown>>;
        const delta = choices[0].delta as Record<string, unknown>;
        const toolCalls = delta.tool_calls as Array<Record<string, unknown>>;
        const fn = toolCalls[0].function as Record<string, string>;

        expect(fn.name).toBe("get_weather");
        expect(fn.name).not.toContain("mcp__");

        // Accumulate arguments from all tool chunks
        let argsJson = "";
        for (const tc of toolChunks) {
          const ch = tc as Record<string, unknown>;
          const chChoices = ch.choices as Array<Record<string, unknown>>;
          const chDelta = chChoices[0].delta as Record<string, unknown>;
          const chToolCalls = chDelta.tool_calls as Array<Record<string, unknown>>;
          const chFn = chToolCalls[0].function as Record<string, string> | undefined;
          if (chFn?.arguments) {
            argsJson += chFn.arguments;
          }
        }

        if (argsJson) {
          const args = JSON.parse(argsJson);
          expect(args).toHaveProperty("location");
        }

        // finish_reason should be tool_calls
        const finishChunk = chunks.find((c) => {
          if (c === "[DONE]") return false;
          const ch = c as Record<string, unknown>;
          const chChoices = ch.choices as Array<Record<string, unknown>>;
          return chChoices?.[0]?.finish_reason === "tool_calls";
        });
        expect(finishChunk).toBeDefined();

        // No text content after tool call detected
        const firstToolIdx = chunks.indexOf(toolChunks[0]);
        const textAfterTool = chunks.slice(firstToolIdx).filter((c) => {
          if (c === "[DONE]") return false;
          const ch = c as Record<string, unknown>;
          const chChoices = ch.choices as Array<Record<string, unknown>>;
          const chDelta = chChoices?.[0]?.delta as Record<string, unknown>;
          return chDelta?.content && (chDelta.content as string).length > 0;
        });
        expect(textAfterTool).toHaveLength(0);
      } else {
        console.warn("WARN: Model did not call tool in streaming mode (non-deterministic).");
      }

      expect(chunks[chunks.length - 1]).toBe("[DONE]");
    });
  });

  // ── 6. Image input (base64) ──
  describe("image input", () => {
    it("accepts base64 image and responds", async () => {
      const response = await makeRequest({
        model: "haiku",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What color is this image? Reply with just the color." },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${RED_PIXEL_PNG}`,
                },
              },
            ],
          },
        ],
      });

      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;

      const choices = body.choices as Array<Record<string, unknown>>;
      const message = choices[0].message as Record<string, unknown>;
      expect(typeof message.content).toBe("string");
      expect((message.content as string).length).toBeGreaterThan(0);
    });

    it("logs image request to DB", async () => {
      const row = await pollRecentRequests(
        (r) => r.status === "success" && (r.output_tokens as number) > 0,
      );
      expect(row).not.toBeNull();
    });
  });

  // ── 7. Multi-turn conversation ──
  describe("multi-turn conversation", () => {
    it("maintains context across turns via message history", async () => {
      // Turn 1
      const res1 = await makeRequest({
        model: "haiku",
        messages: [{ role: "user", content: "My name is Zephyr. Just acknowledge." }],
      });

      expect(res1.status).toBe(200);

      const body1 = (await res1.json()) as Record<string, unknown>;
      const choices1 = body1.choices as Array<Record<string, unknown>>;
      const firstContent = (choices1[0].message as Record<string, unknown>).content as string;
      expect(firstContent).toBeTruthy();

      // Turn 2 — include full message history (OpenAI convention) and ask for the name
      const res2 = await makeRequest({
        model: "haiku",
        messages: [
          { role: "user", content: "My name is Zephyr. Just acknowledge." },
          { role: "assistant", content: firstContent },
          { role: "user", content: "What is my name? Reply with just the name." },
        ],
      });

      expect(res2.status).toBe(200);

      const body2 = (await res2.json()) as Record<string, unknown>;
      const choices2 = body2.choices as Array<Record<string, unknown>>;
      const content2 = (
        (choices2[0].message as Record<string, unknown>).content as string
      ).toLowerCase();

      expect(content2).toContain("zephyr");
    });
  });

  // ── 8. Analytics validation ──
  describe("analytics", () => {
    it("summary stats are consistent", async () => {
      // Wait for any async DB writes to settle
      await new Promise((r) => setTimeout(r, 2000));

      const res = await fetch(`${BASE_URL}/api/stats/summary?period=1h`);
      expect(res.status).toBe(200);
      const stats = (await res.json()) as Record<string, number>;

      expect(stats.totalRequests).toBeGreaterThanOrEqual(7);
      expect(stats.totalInputTokens + stats.totalCacheReadTokens).toBeGreaterThan(0);
      expect(stats.totalOutputTokens).toBeGreaterThan(0);
      expect(stats.totalCostUsd).toBeGreaterThan(0);
    });

    it("model breakdown exists", async () => {
      const res = await fetch(`${BASE_URL}/api/stats/models?period=1h`);
      expect(res.status).toBe(200);
      const models = (await res.json()) as Array<Record<string, unknown>>;

      expect(models.length).toBeGreaterThanOrEqual(1);
      expect(models[0]).toHaveProperty("model");
      expect(models[0]).toHaveProperty("requestCount");
    });

    it("recent requests are populated", async () => {
      const res = await fetch(`${BASE_URL}/api/stats/recent?limit=10`);
      expect(res.status).toBe(200);
      const recent = (await res.json()) as Array<Record<string, unknown>>;

      expect(recent.length).toBeGreaterThanOrEqual(1);
      expect(recent[0]).toHaveProperty("id");
      expect(recent[0]).toHaveProperty("model");
      expect(recent[0]).toHaveProperty("input_tokens");
      expect(recent[0]).toHaveProperty("output_tokens");
    });
  });

  // ── 9. Error cases ──
  describe("error handling", () => {
    it("returns 400 for missing messages", async () => {
      const response = await makeRequest({ model: "haiku" });
      expect(response.status).toBe(400);
      const body = (await response.json()) as Record<string, unknown>;
      const error = body.error as Record<string, unknown>;
      expect(error.type).toBe("invalid_request_error");
    });

    it("returns 400 for invalid JSON", async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

      const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: "not json {{{",
      });
      expect(response.status).toBe(400);
    });

    it("returns 401 for wrong API key", async () => {
      const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer wrong-key-12345",
        },
        body: JSON.stringify({
          model: "haiku",
          messages: [{ role: "user", content: "test" }],
        }),
      });
      expect(response.status).toBe(401);
      const body = (await response.json()) as Record<string, unknown>;
      const error = body.error as Record<string, unknown>;
      expect(error.type).toBe("authentication_error");
    });
  });
});
