# claude-max-proxy

An OpenAI-compatible API proxy for Claude Max subscribers. Use your Claude Max subscription with any tool that supports the OpenAI API — Cursor, Continue, Open WebUI, and more.

**~400 lines of TypeScript. No hacks. No magic. Just format translation using Anthropic's official SDK.**

## Is This Allowed?

**Yes.** Here's why:

| Concern | Reality |
|---------|---------|
| "Bypassing restrictions" | No. We use Anthropic's official [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk), published by Anthropic |
| "Violating ToS" | No. The Agent SDK exists specifically for programmatic Claude access |
| "Unauthorized access" | No. You authenticate with `claude setup-token` using your own account |
| "Reverse engineering" | No. We call `query()` from their npm package — that's it |

Anthropic employees have explicitly confirmed personal use is fine:

> *"We want to encourage local development and experimentation with the Agent SDK and `claude -p`"*
> — Thariq Shihipar, Anthropic

> *"Personal use and local experimentation are fine. If you're building a business on the Agent SDK, use an API key."*

> *"Nothing changes around how customers have been using their account and Anthropic will not be canceling accounts."*
> — Official Anthropic statement

This proxy is a personal tool for personal use. It translates OpenAI request format to Claude Agent SDK calls. No credentials are stored, shared, or proxied — you authenticate directly with your own Claude Max account.

## Features

- **Full OpenAI API compatibility** — drop-in replacement for `/v1/chat/completions` and `/v1/models`
- **Streaming** — proper SSE with `data:` chunks and `[DONE]` terminator
- **Image support** — base64 data URIs and URL images
- **Multi-turn sessions** — automatic session management with prompt caching for cost savings
- **response_format** — `json_object` and `json_schema` support
- **Analytics dashboard** — real-time token usage, cost tracking, model breakdown
- **Auth** — API key for clients + Google OAuth for dashboard
- **Docker ready** — single `docker compose up` for Coolify or any Docker host

## Quick Start

### 1. Install & setup

```bash
git clone https://github.com/YOUR_USERNAME/claude-max-proxy.git
cd claude-max-proxy
npm install

# Authenticate with your Claude Max subscription
claude setup-token
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env` — at minimum set `API_KEY` to any secret string:

```env
API_KEY=your-secret-key-here
```

### 3. Run

```bash
npm run dev
```

The proxy is now running at `http://localhost:3456`.

### 4. Test

```bash
curl http://localhost:3456/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Using with Tools

### Cursor

Settings → Models → OpenAI API Base:
```
http://localhost:3456/v1
```
API Key: your `API_KEY` from `.env`

### Continue

`~/.continue/config.json`:
```json
{
  "models": [{
    "title": "Claude (Max)",
    "provider": "openai",
    "model": "sonnet",
    "apiBase": "http://localhost:3456/v1",
    "apiKey": "your-secret-key-here"
  }]
}
```

### Open WebUI

Settings → Connections → OpenAI API:
```
URL: http://localhost:3456/v1
Key: your-secret-key-here
```

## Model Mapping

You can use familiar model names — they map to Claude models automatically:

| You send | Claude uses |
|----------|-------------|
| `sonnet`, `gpt-4o`, `gpt-4`, `gpt-4-turbo` | `claude-sonnet-4-6` |
| `opus`, `o1`, `o3` | `claude-opus-4-6` |
| `haiku`, `gpt-4o-mini`, `gpt-3.5-turbo` | `claude-haiku-4-5-20251001` |

Any `claude-*` model ID is also passed through directly.

## Streaming

```bash
curl -N http://localhost:3456/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [{"role": "user", "content": "Count to 5"}],
    "stream": true
  }'
```

With usage stats in stream:
```json
{ "stream": true, "stream_options": { "include_usage": true } }
```

## Images

```bash
curl http://localhost:3456/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/photo.jpg"}}
      ]
    }]
  }'
```

Both URL and base64 data URIs (`data:image/jpeg;base64,...`) are supported.

## Multi-turn Conversations

The proxy automatically manages sessions. Send growing message arrays like you would with OpenAI — the proxy hashes the conversation prefix to reuse SDK sessions, enabling prompt caching across turns.

You can also pass `X-Conversation-Id` header for explicit session control.

## Dashboard

Set up Google OAuth credentials in `.env` for the analytics dashboard:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
ALLOWED_EMAILS=you@gmail.com
JWT_SECRET=random-secret-string
PUBLIC_URL=http://localhost:3456
```

Then visit `http://localhost:3456/dashboard`.

The dashboard shows:
- Total requests, input/output tokens, estimated cost
- Hourly request chart
- Per-model breakdown
- Recent request log with latency and cache stats

## Docker

### Build & run

```bash
docker compose up --build
```

### docker-compose.yml

The compose file mounts `~/.claude` (read-only) for Claude Max credentials and a volume for SQLite persistence.

### Coolify

Point Coolify at this repo. Set environment variables in the Coolify dashboard. Make sure to run `claude setup-token` on the host and mount `~/.claude` into the container.

## Configuration

All settings via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | *(empty)* | Bearer token for API auth. Empty = no auth (dev mode) |
| `PORT` | `3456` | Server port |
| `MAX_CONCURRENT_REQUESTS` | `3` | Max parallel SDK queries |
| `MAX_BUDGET_PER_REQUEST` | `0.50` | USD budget cap per request |
| `REQUEST_TIMEOUT_MS` | `300000` | 5 minute request timeout |
| `SESSION_TTL_HOURS` | `24` | Session expiry for multi-turn |
| `DB_PATH` | `./data/analytics.db` | SQLite database path |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions |
| `GET` | `/v1/models` | List available models |
| `GET` | `/health` | Health check |
| `GET` | `/dashboard` | Analytics dashboard |
| `GET` | `/api/stats/summary` | Aggregate stats (query: `?period=24h`) |
| `GET` | `/api/stats/models` | Per-model breakdown |
| `GET` | `/api/stats/hourly` | Hourly buckets |
| `GET` | `/api/stats/recent` | Recent requests |

## OpenAI Params

| Parameter | Support |
|-----------|---------|
| `model` | Mapped to Claude models |
| `messages` | Full support including system, user, assistant, developer roles |
| `stream` | Full SSE support |
| `stream_options.include_usage` | Supported |
| `reasoning_effort` | Mapped to SDK effort |
| `response_format` | `json_object` and `json_schema` via system prompt injection |
| `temperature`, `top_p`, `seed`, `stop` | Accepted, ignored (Claude handles these differently) |
| `n > 1` | Rejected with 400 |
| `tools` / `tool_choice` | Accepted, ignored (text-only responses) |
| `max_tokens` | Not supported by Agent SDK |

## Development

```bash
npm run dev          # Start with hot reload
npm test             # Run tests
npm run test:coverage # Run tests with coverage
npm run build        # TypeScript build
```

132 tests across 14 test files. Pure logic modules at 100% coverage.

## Architecture

```
Client (Cursor, Continue, etc.)
  │  OpenAI-compatible API
  ▼
Hono HTTP Server
  ├── Auth Middleware (API key)
  ├── POST /v1/chat/completions
  │     ├── Validate → Convert → Agent SDK query()
  │     ├── Session management (multi-turn)
  │     └── Log to SQLite
  ├── GET /v1/models
  ├── Dashboard (Alpine.js + Chart.js)
  └── Concurrency Semaphore
```

The Agent SDK spawns the Claude CLI under the hood, which handles Max subscription authentication. No API keys, no OAuth token manipulation — just the official SDK doing its thing.

## Known Limitations

- `max_tokens` / `max_completion_tokens` not supported (Agent SDK limitation)
- `n > 1` not supported (single completion per request)
- Tool/function calling not supported (text-only responses)
- Extended thinking + streaming not available simultaneously (SDK limitation)

## License

MIT — see [LICENSE](LICENSE).
