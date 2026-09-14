import "server-only";

/**
 * Server-side Gemini client.
 *
 * Mirrors the seed pipeline's model rotation for the same reason: the free tier allows 20
 * generate requests per day PER MODEL, so a single-model client would stop answering questions
 * partway through a demo. Rotating across interchangeable flash models turns that into ~200/day.
 */

const API = "https://generativelanguage.googleapis.com";

const MODEL_POOL = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
];

// Exhausted models are remembered until the daily reset, so we stop paying the latency of a
// request we know will 429.
const exhausted = new Map<string, number>();
const DAY_MS = 24 * 60 * 60 * 1000;
let cursor = 0;

function liveModels(): string[] {
  const now = Date.now();
  return MODEL_POOL.filter((m) => {
    const at = exhausted.get(m);
    if (at === undefined) return true;
    if (now - at > DAY_MS) {
      exhausted.delete(m);
      return true;
    }
    return false;
  });
}

export function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

/** One-shot structured request (no streaming), with the same model rotation. */
export async function generateJson<T>(opts: {
  parts: unknown[];
  schema: unknown;
  thinking?: number;
  temperature?: number;
}): Promise<T> {
  const key = apiKey();
  const body = JSON.stringify({
    contents: [{ parts: opts.parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      temperature: opts.temperature ?? 0,
      thinkingConfig: { thinkingBudget: opts.thinking ?? 2048 },
    },
  });

  let lastError = "no models available";
  const models = liveModels();
  for (let i = 0; i < models.length; i++) {
    const model = models[(cursor + i) % models.length]!;
    const res = await fetch(`${API}/v1beta/models/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status === 429 || res.status === 404) {
      exhausted.set(model, Date.now());
      lastError = `${model}: ${res.status}`;
      continue;
    }
    if (!res.ok) {
      lastError = `${model}: ${res.status}`;
      continue;
    }
    cursor = (cursor + i + 1) % Math.max(1, models.length);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      lastError = `${model}: empty response`;
      continue;
    }
    return JSON.parse(text) as T;
  }
  throw new Error(`all models unavailable (${lastError})`);
}

/** Files API upload — needed for audio over the inline-request size limit. */
export async function uploadAudio(bytes: ArrayBuffer, mimeType: string): Promise<string> {
  const key = apiKey();
  const start = await fetch(`${API}/upload/v1beta/files?key=${key}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: `recording-${Date.now()}` } }),
  });
  const uploadUrl = start.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("could not start upload");

  const done = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  let info = (await done.json()).file;

  while (info?.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 1500));
    info = await (await fetch(`${API}/v1beta/${info.name}?key=${key}`)).json();
  }
  if (info?.state !== "ACTIVE") throw new Error(`upload failed: ${info?.state}`);
  return info.uri as string;
}

export interface StreamOptions {
  prompt: string;
  schema: unknown;
  thinking?: number;
  temperature?: number;
}

/**
 * Streams the model's raw JSON text.
 *
 * Structured output and streaming together mean the client receives a JSON document a piece at a
 * time. That is worth the awkwardness: it lets the answer appear as it is written (a question
 * against a 110-minute transcript is not instant), while citations still arrive as real data
 * rather than being regex'd back out of prose.
 */
export async function* streamJson(opts: StreamOptions): AsyncGenerator<string> {
  const key = apiKey();
  const body = JSON.stringify({
    contents: [{ parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      temperature: opts.temperature ?? 0.2,
      thinkingConfig: { thinkingBudget: opts.thinking ?? 1024 },
    },
  });

  let lastError = "no models available";
  const models = liveModels();
  for (let i = 0; i < models.length; i++) {
    const model = models[(cursor + i) % models.length]!;
    const res = await fetch(
      `${API}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body },
    );

    if (res.status === 429 || res.status === 404) {
      exhausted.set(model, Date.now());
      lastError = `${model}: ${res.status}`;
      continue;
    }
    if (!res.ok || !res.body) {
      lastError = `${model}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 200);
      continue;
    }

    cursor = (cursor + i + 1) % Math.max(1, models.length);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text === "string" && text) yield text;
        } catch {
          // A partial SSE frame; the next chunk completes it.
        }
      }
    }
    return;
  }
  throw new Error(`all models unavailable (${lastError})`);
}

/**
 * Pull the `answer` field out of a JSON document that is still being written.
 *
 * We cannot JSON.parse a half-finished document, but we can read the string value that is
 * currently being streamed into it — which is what lets the answer appear progressively instead
 * of the panel sitting blank until the whole response lands.
 */
export function partialAnswer(raw: string): string {
  const key = raw.indexOf('"answer"');
  if (key === -1) return "";
  const start = raw.indexOf('"', raw.indexOf(":", key) + 1);
  if (start === -1) return "";

  let out = "";
  for (let i = start + 1; i < raw.length; i++) {
    const ch = raw[i]!;
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === undefined) break;
      out += next === "n" ? "\n" : next === "t" ? "\t" : next === "u" ? "" : next;
      if (next === "u") i += 4;
      i++;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  return out;
}
