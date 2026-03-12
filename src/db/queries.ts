import { v4 as uuidv4 } from "uuid";
import { getDb } from "./index.js";

export interface RequestLog {
  model: string;
  stream: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  durationMs: number;
  openaiModel?: string;
  status?: "success" | "error";
  errorMessage?: string;
  userEmail?: string;
}

export function logRequest(entry: RequestLog): string {
  const id = uuidv4();
  const db = getDb();

  db.prepare(
    `INSERT INTO requests (id, created_at, model, stream, input_tokens, output_tokens,
     cache_creation_tokens, cache_read_tokens, cost_usd, duration_ms,
     openai_model, status, error_message, user_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    Date.now(),
    entry.model,
    entry.stream ? 1 : 0,
    entry.inputTokens,
    entry.outputTokens,
    entry.cacheCreationTokens,
    entry.cacheReadTokens,
    entry.costUsd,
    entry.durationMs,
    entry.openaiModel ?? null,
    entry.status ?? "success",
    entry.errorMessage ?? null,
    entry.userEmail ?? null,
  );

  return id;
}

export interface AggregateStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
}

export function getStats(sinceMs?: number): AggregateStats {
  const db = getDb();
  const cutoff = sinceMs ?? 0;

  const row = db
    .prepare(
      `SELECT
        COUNT(*) as totalRequests,
        COALESCE(SUM(input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
        COALESCE(SUM(cache_creation_tokens), 0) as totalCacheCreationTokens,
        COALESCE(SUM(cache_read_tokens), 0) as totalCacheReadTokens,
        COALESCE(SUM(cost_usd), 0) as totalCostUsd,
        COALESCE(AVG(duration_ms), 0) as avgDurationMs
      FROM requests
      WHERE created_at >= ? AND status = 'success'`,
    )
    .get(cutoff) as AggregateStats;

  return row;
}

export interface ModelBreakdown {
  model: string;
  requestCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

export function getStatsByModel(sinceMs?: number): ModelBreakdown[] {
  const db = getDb();
  const cutoff = sinceMs ?? 0;

  return db
    .prepare(
      `SELECT
        COALESCE(openai_model, model) as model,
        COUNT(*) as requestCount,
        COALESCE(SUM(input_tokens), 0) as totalInputTokens,
        COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
        COALESCE(SUM(cost_usd), 0) as totalCostUsd
      FROM requests
      WHERE created_at >= ? AND status = 'success'
      GROUP BY COALESCE(openai_model, model)
      ORDER BY requestCount DESC`,
    )
    .all(cutoff) as ModelBreakdown[];
}

export interface HourlyBucket {
  hour: string;
  requestCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export function getHourlyStats(sinceMs?: number): HourlyBucket[] {
  const db = getDb();
  const cutoff = sinceMs ?? Date.now() - 24 * 60 * 60 * 1000;

  return db
    .prepare(
      `SELECT
        strftime('%Y-%m-%d %H:00', created_at / 1000, 'unixepoch') as hour,
        COUNT(*) as requestCount,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COALESCE(SUM(cost_usd), 0) as totalCostUsd
      FROM requests
      WHERE created_at >= ? AND status = 'success'
      GROUP BY hour
      ORDER BY hour`,
    )
    .all(cutoff) as HourlyBucket[];
}

export function getRecentRequests(limit = 50): Array<Record<string, unknown>> {
  const db = getDb();
  return db
    .prepare(
      `SELECT *, COALESCE(openai_model, model) as display_model FROM requests ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as Array<Record<string, unknown>>;
}
