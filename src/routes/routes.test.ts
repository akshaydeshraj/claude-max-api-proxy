import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { models } from "./models.js";
import { health } from "./health.js";

describe("GET /health", () => {
  const app = new Hono();
  app.route("/", health);

  it("returns ok status", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("GET /v1/models", () => {
  const app = new Hono();
  app.route("/", models);

  it("returns model list", async () => {
    const res = await app.request("/v1/models");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe("list");
    expect(body.data).toHaveLength(3);
    expect(body.data[0].id).toBe("claude-opus-4-6");
    expect(body.data[0].object).toBe("model");
    expect(body.data[0].owned_by).toBe("anthropic");
  });
});
