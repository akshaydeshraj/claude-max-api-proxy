# Commits Log

## Phase 1: Core Proxy (non-streaming, single-turn)

### Commit 1 — Project scaffold + conversion layer + tests

**Files created:**
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- `src/config.ts` — environment configuration
- `src/types/openai.ts` — full OpenAI API type definitions
- `src/conversion/model-map.ts` — model name mapping (OpenAI → Claude)
- `src/conversion/openai-to-sdk.ts` — request conversion (messages → prompt)
- `src/conversion/sdk-to-openai.ts` — response conversion (SDK → OpenAI format)
- `src/sdk/semaphore.ts` — concurrency limiter
- `src/sdk/service.ts` — SDK query() wrapper (non-streaming)
- `src/middleware/error-handler.ts` — OpenAI-format error responses
- `src/routes/chat-completions.ts` — POST /v1/chat/completions
- `src/routes/models.ts` — GET /v1/models
- `src/routes/health.ts` — GET /health
- `src/index.ts` — Hono app entry point

**Tests:** 53 passing (7 test files)
**Coverage:**
- Statements: 56.06%
- Branches: 64.17%
- Functions: 78.04%
- Lines: 54.26%
- Pure logic files (conversion/, model-map, semaphore): 100%
- SDK service & route handlers: 0% (require SDK mocking or integration tests)
