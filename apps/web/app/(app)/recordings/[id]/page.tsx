"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CallView } from "@/components/CallView";
import { loadRecording } from "@/lib/recordings-store";
import type { Call } from "@/lib/types";

/**
 * A recorded call renders through exactly the same CallView as a seeded one.
 *
 * That is the point: a recording is not a lesser preview of the product, it is the product. The
 * only difference is where the audio comes from — a blob URL out of IndexedDB rather than a file
 * on the server.
 */
export default function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [call, setCall] = useState<Call | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let url: string | undefined;
    loadRecording(id).then((c) => {
      if (!c) return setState("missing");
      url = c.audioUrl;
      setCall(c);
      setState("ready");
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

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

  return <CallView call={call} />;
}
