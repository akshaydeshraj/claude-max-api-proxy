import { describe, it, expect } from "vitest";
import {
  parseDataURI,
  convertImagePart,
  convertContentParts,
} from "./image-handler.js";

describe("parseDataURI", () => {
  it("parses a valid base64 data URI", () => {
    const result = parseDataURI("data:image/jpeg;base64,/9j/4AAQSkZJRg==");
    expect(result).toEqual({
      mediaType: "image/jpeg",
      data: "/9j/4AAQSkZJRg==",
    });
  });

  it("parses PNG data URI", () => {
    const result = parseDataURI("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA");
    expect(result).toEqual({
      mediaType: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAA",
    });
  });

  it("parses webp data URI", () => {
    const result = parseDataURI("data:image/webp;base64,UklGRg==");
    expect(result).toEqual({
      mediaType: "image/webp",
      data: "UklGRg==",
    });
  });

  it("returns null for regular URL", () => {
    expect(parseDataURI("https://example.com/image.jpg")).toBeNull();
  });

  it("returns null for malformed data URI", () => {
    expect(parseDataURI("data:image/jpeg;notbase64,abc")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDataURI("")).toBeNull();
  });
});

describe("convertImagePart", () => {
  it("converts base64 data URI to Anthropic base64 image", () => {
    const result = convertImagePart({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,/9j/4AAQ" },
    });
    expect(result).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: "/9j/4AAQ",
      },
    });
  });

  it("converts URL to Anthropic URL image", () => {
    const result = convertImagePart({
      type: "image_url",
      image_url: { url: "https://example.com/cat.png" },
    });
    expect(result).toEqual({
      type: "image",
      source: {
        type: "url",
        url: "https://example.com/cat.png",
      },
    });
  });

  it("ignores detail parameter", () => {
    const result = convertImagePart({
      type: "image_url",
      image_url: { url: "https://example.com/cat.png", detail: "high" },
    });
    expect(result.source.type).toBe("url");
  });
});

describe("convertContentParts", () => {
  it("converts mixed text and image parts", () => {
    const parts = [
      { type: "text" as const, text: "What is this?" },
      {
        type: "image_url" as const,
        image_url: { url: "https://example.com/photo.jpg" },
      },
      { type: "text" as const, text: "Describe it." },
    ];

    const result = convertContentParts(parts);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: "text", text: "What is this?" });
    expect(result[1]).toEqual({
      type: "image",
      source: { type: "url", url: "https://example.com/photo.jpg" },
    });
    expect(result[2]).toEqual({ type: "text", text: "Describe it." });
  });

  it("converts text-only parts", () => {
    const parts = [{ type: "text" as const, text: "Hello" }];
    const result = convertContentParts(parts);
    expect(result).toEqual([{ type: "text", text: "Hello" }]);
  });

  it("converts multiple images", () => {
    const parts = [
      {
        type: "image_url" as const,
        image_url: { url: "data:image/png;base64,abc123" },
      },
      {
        type: "image_url" as const,
        image_url: { url: "https://example.com/img2.jpg" },
      },
    ];

    const result = convertContentParts(parts);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "abc123" },
    });
    expect(result[1]).toEqual({
      type: "image",
      source: { type: "url", url: "https://example.com/img2.jpg" },
    });
  });

  it("handles empty array", () => {
    expect(convertContentParts([])).toEqual([]);
  });
});
