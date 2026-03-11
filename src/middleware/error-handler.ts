import type { Context } from "hono";
import type { OpenAIErrorResponse } from "../types/openai.js";

export function createErrorResponse(
  message: string,
  type: string,
  code: string | null = null,
  param: string | null = null,
): OpenAIErrorResponse {
  return {
    error: {
      message,
      type,
      param,
      code,
    },
  };
}

export function badRequest(c: Context, message: string, param?: string) {
  return c.json(
    createErrorResponse(message, "invalid_request_error", null, param ?? null),
    400,
  );
}

export function unauthorized(c: Context, message = "Invalid API key") {
  return c.json(
    createErrorResponse(message, "authentication_error", "invalid_api_key"),
    401,
  );
}

export function rateLimited(c: Context, retryAfter?: number) {
  if (retryAfter) {
    c.header("Retry-After", String(retryAfter));
  }
  return c.json(
    createErrorResponse(
      "Rate limit exceeded. Please try again later.",
      "rate_limit_error",
      "rate_limit_exceeded",
    ),
    429,
  );
}

export function serverError(c: Context, message = "Internal server error") {
  return c.json(createErrorResponse(message, "server_error"), 500);
}
