/**
 * OpenRouter chat completions with images and structured output. Plain `fetch`, so it runs in
 * the default Convex runtime. The key lives in the `OPENROUTER_API_KEY` env var, never the client.
 */
import type { JsonSchema } from "../../shared/ingestion/schema";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/** A slow model on a big box score still answers well inside this; actions run up to 10 minutes. */
const TIMEOUT_MS = 180_000;

export type VisionRequest = {
  model: string;
  system: string;
  user: string;
  /** Image URLs the provider fetches, or `data:` URLs from a backend OpenRouter cannot reach. */
  images: string[];
  schemaName: string;
  schema: JsonSchema;
  temperature: number;
  maxTokens: number;
  /** Epoch ms the caller must be done by; the call is cut short to fit. */
  deadline: number;
};

export type VisionResult = {
  json: unknown;
  rawText: string;
  model: string;
  usage: { prompt: number; completion: number; total: number; costUsd?: number } | undefined;
  latencyMs: number;
};

export function openRouterKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY || undefined;
}

type Completion = {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };
  error?: { message?: string };
};

export async function callVisionModel(key: string, req: VisionRequest): Promise<VisionResult> {
  const started = Date.now();
  const timeoutMs = Math.min(TIMEOUT_MS, req.deadline - started);
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "FranchiseTracker",
    },
    body: JSON.stringify({
      model: req.model,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      usage: { include: true },
      response_format: {
        type: "json_schema",
        json_schema: { name: req.schemaName, strict: true, schema: req.schema },
      },
      messages: [
        { role: "system", content: req.system },
        {
          role: "user",
          content: [
            { type: "text", text: req.user },
            ...req.images.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
    }),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`${req.model}: no answer within ${Math.round(timeoutMs / 1000)} s`);
    }
    throw error;
  });
  const body = (await response.json().catch(() => ({}))) as Completion;
  if (!response.ok || body.error) {
    throw new Error(`${req.model}: ${body.error?.message ?? `HTTP ${response.status}`}`);
  }
  const rawText = body.choices?.[0]?.message?.content ?? "";
  let json: unknown;
  try {
    // Some models wrap JSON in a code fence even in structured mode.
    json = JSON.parse(rawText.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error(`${req.model}: the answer was not valid JSON`);
  }
  const u = body.usage;
  return {
    json,
    rawText,
    model: body.model ?? req.model,
    usage: u
      ? {
          prompt: u.prompt_tokens ?? 0,
          completion: u.completion_tokens ?? 0,
          total: u.total_tokens ?? 0,
          costUsd: u.cost,
        }
      : undefined,
    latencyMs: Date.now() - started,
  };
}

/** Base64 `data:` URL for an image blob, chunked so large photos do not overflow the call stack. */
export async function blobToDataUrl(blob: Blob, mime: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
