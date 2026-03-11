import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, closeDb } from "./index.js";
import {
  logRequest,
  getStats,
  getStatsByModel,
  getHourlyStats,
  getRecentRequests,
} from "./queries.js";
import { config } from "../config.js";
import { unlinkSync, existsSync } from "node:fs";

const TEST_DB = "./data/test-analytics.db";

describe("database queries", () => {
  beforeEach(() => {
    // Use test database
    (config as { dbPath: string }).dbPath = TEST_DB;
    closeDb();
    // Clean slate
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(TEST_DB + "-wal")) unlinkSync(TEST_DB + "-wal");
    if (existsSync(TEST_DB + "-shm")) unlinkSync(TEST_DB + "-shm");
    // Init fresh DB
    getDb();
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(TEST_DB + "-wal")) unlinkSync(TEST_DB + "-wal");
    if (existsSync(TEST_DB + "-shm")) unlinkSync(TEST_DB + "-shm");
  });

  describe("logRequest", () => {
    it("inserts a request and returns an ID", () => {
      const id = logRequest({
        model: "claude-sonnet-4-6",
        stream: false,
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.001,
        durationMs: 500,
      });

      expect(id).toBeTypeOf("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("stores all fields correctly", () => {
      logRequest({
        model: "claude-opus-4-6",
        stream: true,
        inputTokens: 200,
        outputTokens: 100,
        cacheCreationTokens: 50,
        cacheReadTokens: 30,
        costUsd: 0.005,
        durationMs: 1200,
        openaiModel: "gpt-4",
        status: "success",
        userEmail: "test@example.com",
      });

      const rows = getRecentRequests(1);
      expect(rows).toHaveLength(1);
      expect(rows[0].model).toBe("claude-opus-4-6");
      expect(rows[0].stream).toBe(1);
      expect(rows[0].input_tokens).toBe(200);
      expect(rows[0].cache_creation_tokens).toBe(50);
      expect(rows[0].openai_model).toBe("gpt-4");
    });
  });

  describe("getStats", () => {
    it("returns zeros for empty DB", () => {
      const stats = getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalCostUsd).toBe(0);
    });

    it("aggregates multiple requests", () => {
      logRequest({
        model: "claude-sonnet-4-6",
        stream: false,
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 10,
        cacheReadTokens: 5,
        costUsd: 0.001,
        durationMs: 500,
      });
      logRequest({
        model: "claude-opus-4-6",
        stream: true,
        inputTokens: 200,
        outputTokens: 100,
        cacheCreationTokens: 20,
        cacheReadTokens: 10,
        costUsd: 0.005,
        durationMs: 1000,
      });

      const stats = getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalInputTokens).toBe(300);
      expect(stats.totalOutputTokens).toBe(150);
      expect(stats.totalCacheCreationTokens).toBe(30);
      expect(stats.totalCacheReadTokens).toBe(15);
      expect(stats.totalCostUsd).toBeCloseTo(0.006);
      expect(stats.avgDurationMs).toBe(750);
    });

    it("respects time filter", () => {
      logRequest({
        model: "claude-sonnet-4-6",
        stream: false,
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.001,
        durationMs: 500,
      });

      // Query from future — should find nothing
      const stats = getStats(Date.now() + 10000);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe("getStatsByModel", () => {
    it("groups by model", () => {
      logRequest({
        model: "claude-sonnet-4-6",
        stream: false,
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.001,
        durationMs: 500,
      });
      logRequest({
        model: "claude-sonnet-4-6",
        stream: false,
        inputTokens: 150,
        outputTokens: 75,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.002,
        durationMs: 600,
      });
      logRequest({
        model: "claude-opus-4-6",
        stream: true,
        inputTokens: 200,
        outputTokens: 100,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.005,
        durationMs: 1000,
      });

      const breakdown = getStatsByModel();
      expect(breakdown).toHaveLength(2);
      // Sonnet should be first (2 requests vs 1)
      expect(breakdown[0].model).toBe("claude-sonnet-4-6");
      expect(breakdown[0].requestCount).toBe(2);
      expect(breakdown[0].totalInputTokens).toBe(250);
      expect(breakdown[1].model).toBe("claude-opus-4-6");
      expect(breakdown[1].requestCount).toBe(1);
    });
  });

  describe("getHourlyStats", () => {
    it("returns buckets for current hour", () => {
      logRequest({
        model: "claude-sonnet-4-6",
        stream: false,
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0.001,
        durationMs: 500,
      });

      const hourly = getHourlyStats();
      expect(hourly.length).toBeGreaterThanOrEqual(1);
      expect(hourly[0].requestCount).toBe(1);
      expect(hourly[0].totalTokens).toBe(150);
    });
  });

  describe("getRecentRequests", () => {
    it("returns requests in reverse chronological order", () => {
      logRequest({
        model: "first",
        stream: false,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0,
        durationMs: 0,
      });
      logRequest({
        model: "second",
        stream: false,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        costUsd: 0,
        durationMs: 0,
      });

      const recent = getRecentRequests(10);
      expect(recent).toHaveLength(2);
      expect(recent[0].model).toBe("second");
      expect(recent[1].model).toBe("first");
    });

    it("respects limit", () => {
      for (let i = 0; i < 5; i++) {
        logRequest({
          model: "claude-sonnet-4-6",
          stream: false,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          costUsd: 0,
          durationMs: 0,
        });
      }

      const recent = getRecentRequests(3);
      expect(recent).toHaveLength(3);
    });
  });
});
