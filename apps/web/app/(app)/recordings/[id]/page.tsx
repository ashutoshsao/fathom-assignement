"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CallView } from "@/components/CallView";
import { ProcessingCall } from "@/components/ProcessingCall";
import { onProcessingChange, resumeIfInterrupted } from "@/lib/processing";
import { loadRecording } from "@/lib/recordings-store";
import type { Call } from "@/lib/types";

/**
 * A recorded call renders through exactly the same CallView as a seeded one — a recording is not
 * a lesser preview of the product, it is the product. The only difference is where the audio
 * comes from.
 *
 * While the transcript is still being written the page shows a processing view that is still
 * genuinely useful: the audio is local, so it plays immediately.
 */
export default function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [call, setCall] = useState<Call | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  const refresh = useCallback(async () => {
    const c = await loadRecording(id);
    if (!c) return setState("missing");
    setCall((prev) => {
      if (prev?.audioUrl && prev.audioUrl !== c.audioUrl) URL.revokeObjectURL(prev.audioUrl);
      return c;
    });
    setState("ready");
  }, [id]);

  useEffect(() => {
    void refresh().then(() => {
      // A reload or closed tab kills the in-memory job but not the audio, so pick it back up.
      void resumeIfInterrupted(id);
    });
    // Re-read when the background job finishes, rather than polling on a timer.
    return onProcessingChange((changed) => {
      if (changed === id) void refresh();
    });
  }, [id, refresh]);

  if (state === "loading") {
    return <p className="px-6 py-16 text-center text-[13px] text-text-faint">Loading recording…</p>;
  }

  if (state === "missing" || !call) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-[14px] text-text">This recording is not in this browser.</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-text-faint">
          Recordings are stored locally rather than on a server, so they only exist in the browser
          that made them.
        </p>
        <Link href="/" className="mt-4 inline-block text-[13px] text-accent hover:underline">
          Back to My Calls
        </Link>
      </div>
    );
  }

  if (call.status === "processing" || call.status === "failed") {
    return <ProcessingCall call={call} />;
  }

  return <CallView call={call} />;
}
