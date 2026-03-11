import { describe, it, expect } from "vitest";
import { mapModel, mapEffort, getAvailableModels } from "./model-map.js";

describe("mapModel", () => {
  it("maps short aliases", () => {
    expect(mapModel("opus")).toBe("claude-opus-4-6");
    expect(mapModel("sonnet")).toBe("claude-sonnet-4-6");
    expect(mapModel("haiku")).toBe("claude-haiku-4-5-20251001");
  });

  it("maps full Claude model IDs", () => {
    expect(mapModel("claude-opus-4-6")).toBe("claude-opus-4-6");
    expect(mapModel("claude-sonnet-4-6")).toBe("claude-sonnet-4-6");
    expect(mapModel("claude-haiku-4-5-20251001")).toBe("claude-haiku-4-5-20251001");
    expect(mapModel("claude-haiku-4-5")).toBe("claude-haiku-4-5-20251001");
  });

  it("maps OpenAI model names to Claude equivalents", () => {
    expect(mapModel("gpt-4")).toBe("claude-sonnet-4-6");
    expect(mapModel("gpt-4o")).toBe("claude-sonnet-4-6");
    expect(mapModel("gpt-4-turbo")).toBe("claude-sonnet-4-6");
    expect(mapModel("gpt-4o-mini")).toBe("claude-haiku-4-5-20251001");
    expect(mapModel("gpt-3.5-turbo")).toBe("claude-haiku-4-5-20251001");
    expect(mapModel("o1")).toBe("claude-opus-4-6");
    expect(mapModel("o3")).toBe("claude-opus-4-6");
    expect(mapModel("o1-mini")).toBe("claude-sonnet-4-6");
    expect(mapModel("o3-mini")).toBe("claude-sonnet-4-6");
  });

  it("passes through unknown claude-* models", () => {
    expect(mapModel("claude-opus-4-1")).toBe("claude-opus-4-1");
    expect(mapModel("claude-sonnet-4-5")).toBe("claude-sonnet-4-5");
  });

  it("defaults to sonnet for unknown models", () => {
    expect(mapModel("unknown-model")).toBe("claude-sonnet-4-6");
    expect(mapModel("")).toBe("claude-sonnet-4-6");
  });
});

describe("mapEffort", () => {
  it("maps valid effort values", () => {
    expect(mapEffort("low")).toBe("low");
    expect(mapEffort("medium")).toBe("medium");
    expect(mapEffort("high")).toBe("high");
  });

  it("returns undefined for missing effort", () => {
    expect(mapEffort(undefined)).toBeUndefined();
    expect(mapEffort("")).toBeUndefined();
  });
});

describe("getAvailableModels", () => {
  it("returns all current models", () => {
    const models = getAvailableModels();
    expect(models).toHaveLength(3);
    expect(models.map((m) => m.id)).toEqual([
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5-20251001",
    ]);
    for (const model of models) {
      expect(model.object).toBe("model");
      expect(model.owned_by).toBe("anthropic");
    }
  });
});
