import { describe, it, expect } from "vitest";
import { config } from "./config.js";

describe("config", () => {
  it("has sensible defaults", () => {
    expect(config.port).toBe(3456);
    expect(config.maxConcurrentRequests).toBe(3);
    expect(config.maxBudgetPerRequest).toBe(0.5);
    expect(config.requestTimeoutMs).toBe(300000);
    expect(config.sessionTtlHours).toBe(24);
  });
});
