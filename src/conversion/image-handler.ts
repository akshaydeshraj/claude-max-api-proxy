import type { OpenAIContentPart } from "../types/openai.js";

export interface AnthropicBase64Image {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

export interface AnthropicURLImage {
  type: "image";
  source: {
    type: "url";
    url: string;
  };
}

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

export type AnthropicContentBlock =
  | AnthropicBase64Image
  | AnthropicURLImage
  | AnthropicTextBlock;

/**
 * Parse a data URI into media_type and base64 data.
 * Format: data:<media_type>;base64,<data>
 */
export function parseDataURI(uri: string): { mediaType: string; data: string } | null {
  const match = uri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}

/**
 * Convert an OpenAI image_url content part to an Anthropic image block.
 *
 * - data:image/...;base64,... → Anthropic base64 source
 * - https://... or http://... → Anthropic URL source
 */
export function convertImagePart(
  part: Extract<OpenAIContentPart, { type: "image_url" }>,
): AnthropicBase64Image | AnthropicURLImage {
  const url = part.image_url.url;

  const parsed = parseDataURI(url);
  if (parsed) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: parsed.mediaType,
        data: parsed.data,
      },
    };
  }

  return {
    type: "image",
    source: {
      type: "url",
      url,
    },
  };
}

/**
 * Convert an array of OpenAI content parts to Anthropic content blocks.
 * Text parts become text blocks, image_url parts become image blocks.
 */
export function convertContentParts(
  parts: OpenAIContentPart[],
): AnthropicContentBlock[] {
  return parts.map((part) => {
    if (part.type === "text") {
      return { type: "text" as const, text: part.text };
    }
    return convertImagePart(part);
  });
}
