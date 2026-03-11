import { describe, it, expect } from "vitest";
import { createErrorResponse } from "./error-handler.js";

describe("createErrorResponse", () => {
  it("creates a valid OpenAI error format", () => {
    const err = createErrorResponse(
      "Something went wrong",
      "server_error",
      "internal_error",
    );

    expect(err.error.message).toBe("Something went wrong");
    expect(err.error.type).toBe("server_error");
    expect(err.error.code).toBe("internal_error");
    expect(err.error.param).toBeNull();
  });

  it("defaults code and param to null", () => {
    const err = createErrorResponse("Bad request", "invalid_request_error");
    expect(err.error.code).toBeNull();
    expect(err.error.param).toBeNull();
  });
});
