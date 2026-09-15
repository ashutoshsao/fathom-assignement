import { buildPrompt, resolveCitations, ASK_SCHEMA } from "@/lib/ask";
import { partialAnswer, streamJson } from "@/lib/gemini";
import { getAllCalls, getCall } from "@/lib/seed";
import type { Call } from "@/lib/types";

/**
 * Streams an answer as newline-delimited JSON events:
 *
 *   {"type":"delta","text":"..."}      appended to the answer as it is written
 *   {"type":"done","citations":[...]}  resolved to real timestamps
 *   {"type":"error","message":"..."}
 *
 * NDJSON rather than raw model output so the client never has to parse half-written JSON, and so
 * citations arrive already resolved and validated against the transcript.
 */
export async function POST(request: Request) {
  let question = "";
  let callId: string | undefined;
  let inlineCall: Call | undefined;
  try {
    const body = await request.json();
    question = String(body.question ?? "").slice(0, 2000).trim();
    callId = body.callId ? String(body.callId) : undefined;
    // A browser recording exists only in the viewer's IndexedDB — the server has never seen it.
    // For those the client sends the call along with the question; there is nowhere else to get
    // it from, and without this Ask simply 404s on everything the user recorded themselves.
    if (body.call && typeof body.call === "object") inlineCall = body.call as Call;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  if (!question) return Response.json({ error: "question is required" }, { status: 400 });

  const calls = inlineCall
    ? [inlineCall]
    : callId
      ? [await getCall(callId)].filter((c) => c !== null)
      : await getAllCalls();

  if (calls.length === 0 || !calls[0]?.transcript?.length) {
    return Response.json(
      { error: "That call has no transcript to answer from yet." },
      { status: 404 },
    );
  }

  const prompt = buildPrompt(calls, question, Boolean(callId));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let raw = "";
      let sent = "";
      try {
        for await (const chunk of streamJson({ prompt, schema: ASK_SCHEMA, thinking: 1024 })) {
          raw += chunk;
          const answer = partialAnswer(raw);
          if (answer.length > sent.length) {
            send({ type: "delta", text: answer.slice(sent.length) });
            sent = answer;
          }
        }

        let citations: ReturnType<typeof resolveCitations> = [];
        let finalAnswer = sent;
        try {
          const parsed = JSON.parse(raw);
          finalAnswer = parsed.answer ?? sent;
          citations = resolveCitations(calls, parsed.citations);
        } catch {
          // The answer already streamed; losing citations is worth reporting but not fatal.
        }
        if (finalAnswer.length > sent.length) {
          send({ type: "delta", text: finalAnswer.slice(sent.length) });
        }
        send({ type: "done", citations });
      } catch (err) {
        const quota = err instanceof Error && err.name === "QuotaExhaustedError";
        send({
          type: "error",
          message: err instanceof Error ? err.message : "request failed",
          kind: quota ? "quota" : "failure",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
