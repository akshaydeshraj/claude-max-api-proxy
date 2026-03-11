import { describe, it, expect } from "vitest";
import {
  extractTextFromContent,
  extractSystemPrompt,
  extractLastUserMessage,
  hasImageContent,
  convertRequest,
  validateRequest,
} from "./openai-to-sdk.js";
import type { OpenAIChatRequest, OpenAIMessage } from "../types/openai.js";

describe("extractTextFromContent", () => {
  it("handles string content", () => {
    expect(extractTextFromContent("hello")).toBe("hello");
  });

  it("handles null content", () => {
    expect(extractTextFromContent(null)).toBe("");
  });

  it("handles content parts array", () => {
    expect(
      extractTextFromContent([
        { type: "text", text: "hello" },
        { type: "text", text: " world" },
      ]),
    ).toBe("hello\n world");
  });

  it("filters out non-text parts", () => {
    expect(
      extractTextFromContent([
        { type: "text", text: "hello" },
        { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
      ]),
    ).toBe("hello");
  });
});

describe("extractSystemPrompt", () => {
  it("extracts system messages", () => {
    const messages: OpenAIMessage[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hi" },
    ];
    expect(extractSystemPrompt(messages)).toBe("You are helpful.");
  });

  it("combines multiple system messages", () => {
    const messages: OpenAIMessage[] = [
      { role: "system", content: "Rule 1" },
      { role: "developer", content: "Rule 2" },
      { role: "user", content: "Hi" },
    ];
    expect(extractSystemPrompt(messages)).toBe("Rule 1\n\nRule 2");
  });

  it("returns undefined when no system messages", () => {
    const messages: OpenAIMessage[] = [{ role: "user", content: "Hi" }];
    expect(extractSystemPrompt(messages)).toBeUndefined();
  });
});

describe("extractLastUserMessage", () => {
  it("extracts the last user message", () => {
    const messages: OpenAIMessage[] = [
      { role: "user", content: "First" },
      { role: "assistant", content: "Reply" },
      { role: "user", content: "Second" },
    ];
    expect(extractLastUserMessage(messages)).toBe("Second");
  });

  it("returns empty string when no user messages", () => {
    const messages: OpenAIMessage[] = [
      { role: "system", content: "System" },
    ];
    expect(extractLastUserMessage(messages)).toBe("");
  });
});

describe("hasImageContent", () => {
  it("returns false for text-only messages", () => {
    const messages: OpenAIMessage[] = [
      { role: "user", content: "Hello" },
      { role: "user", content: [{ type: "text", text: "Hi" }] },
    ];
    expect(hasImageContent(messages)).toBe(false);
  });

  it("returns true when images present", () => {
    const messages: OpenAIMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "What's this?" },
          { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
        ],
      },
    ];
    expect(hasImageContent(messages)).toBe(true);
  });

  it("handles null content", () => {
    const messages: OpenAIMessage[] = [
      { role: "assistant", content: null },
    ];
    expect(hasImageContent(messages)).toBe(false);
  });
});

describe("convertRequest", () => {
  it("converts a basic request", () => {
    const req: OpenAIChatRequest = {
      model: "sonnet",
      messages: [
        { role: "system", content: "Be concise" },
        { role: "user", content: "Hello" },
      ],
    };

    const result = convertRequest(req);
    expect(result.model).toBe("claude-sonnet-4-6");
    expect(result.prompt).toBe("Hello");
    expect(result.systemPrompt).toBe("Be concise");
    expect(result.stream).toBe(false);
    expect(result.includeUsageInStream).toBe(false);
  });

  it("handles streaming with usage", () => {
    const req: OpenAIChatRequest = {
      model: "opus",
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
      stream_options: { include_usage: true },
    };

    const result = convertRequest(req);
    expect(result.stream).toBe(true);
    expect(result.includeUsageInStream).toBe(true);
  });

  it("maps reasoning_effort to effort", () => {
    const req: OpenAIChatRequest = {
      model: "sonnet",
      messages: [{ role: "user", content: "Hi" }],
      reasoning_effort: "low",
    };

    const result = convertRequest(req);
    expect(result.effort).toBe("low");
  });
});

describe("validateRequest", () => {
  it("returns null for valid request", () => {
    expect(
      validateRequest({
        model: "sonnet",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).toBeNull();
  });

  it("rejects empty messages", () => {
    expect(validateRequest({ model: "sonnet", messages: [] })).toBe(
      "messages is required and must be a non-empty array",
    );
  });

  it("rejects missing model", () => {
    expect(
      validateRequest({
        model: "",
        messages: [{ role: "user", content: "Hi" }],
      }),
    ).toBe("model is required");
  });

  it("rejects n > 1", () => {
    expect(
      validateRequest({
        model: "sonnet",
        messages: [{ role: "user", content: "Hi" }],
        n: 2,
      }),
    ).toBe("n > 1 is not supported");
  });

  it("rejects tool_choice required", () => {
    expect(
      validateRequest({
        model: "sonnet",
        messages: [{ role: "user", content: "Hi" }],
        tool_choice: "required",
      }),
    ).toBe("tool use is not supported by this proxy");
  });

  it("allows tool_choice auto (ignored)", () => {
    expect(
      validateRequest({
        model: "sonnet",
        messages: [{ role: "user", content: "Hi" }],
        tool_choice: "auto",
      }),
    ).toBeNull();
  });
});
