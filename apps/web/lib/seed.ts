import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Call, CallSummaryCard } from "./types";

/**
 * Reads the built seed data.
 *
 * Server-only and file-backed rather than a database: nothing in this product needs durable
 * multi-user writes, and seed JSON deploys atomically with the code, so the library can never be
 * in a half-migrated state when someone opens the link.
 *
 * The index is kept separate from the call records deliberately — the library page renders cards
 * for every call, and one of our transcripts alone is 2,326 segments. Loading those to draw a
 * list would be the single worst performance decision available.
 */

const CONTENT = path.join(process.cwd(), "content");

// Cached for the life of the server process. The files are immutable build output.
let indexCache: CallSummaryCard[] | null = null;
const callCache = new Map<string, Call>();

export async function getCallIndex(): Promise<CallSummaryCard[]> {
  if (indexCache) return indexCache;
  try {
    const raw = await readFile(path.join(CONTENT, "index.json"), "utf8");
    indexCache = JSON.parse(raw) as CallSummaryCard[];
  } catch {
    // An empty library is a valid state before the seed pipeline has run; it should render an
    // empty state, not crash the page.
    indexCache = [];
  }
  return indexCache;
}

export async function getCall(id: string): Promise<Call | null> {
  const cached = callCache.get(id);
  if (cached) return cached;

  // Guard the path: `id` arrives from the URL, and a crafted one must not read outside content/.
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;

  try {
    const raw = await readFile(path.join(CONTENT, "calls", `${id}.json`), "utf8");
    const call = JSON.parse(raw) as Call;
    callCache.set(id, call);
    return call;
  } catch {
    return null;
  }
}

/** Every call, fully loaded. Used by cross-call Ask, which reads whole transcripts by design. */
export async function getAllCalls(): Promise<Call[]> {
  const index = await getCallIndex();
  const calls = await Promise.all(index.map((c) => getCall(c.id)));
  return calls.filter((c): c is Call => c !== null);
}
