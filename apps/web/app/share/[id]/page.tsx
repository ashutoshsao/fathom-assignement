import { notFound } from "next/navigation";
import { ShareView } from "@/components/ShareView";
import { getCall, getCallIndex } from "@/lib/seed";

export async function generateStaticParams() {
  const index = await getCallIndex();
  return index.map((c) => ({ id: c.id }));
}

export async function generateMetadata(props: PageProps<"/share/[id]">) {
  const { id } = await props.params;
  const call = await getCall(id);
  if (!call) return { title: "Call not found" };
  return {
    title: `${call.title} — shared from Fathom`,
    description: call.blurb,
  };
}

export default async function SharePage(props: PageProps<"/share/[id]">) {
  const { id } = await props.params;
  const { clip: clipParam } = await props.searchParams;
  const call = await getCall(id);
  if (!call) notFound();

  // ?clip=<start>-<end>, in seconds. Anything malformed falls back to the whole call rather than
  // showing an empty window.
  const raw = Array.isArray(clipParam) ? clipParam[0] : clipParam;
  let clip: { startSec: number; endSec: number } | undefined;
  if (raw) {
    const [a, b] = raw.split("-").map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b! > a! && a! >= 0) {
      clip = { startSec: a!, endSec: Math.min(b!, call.durationSec) };
    }
  }

  return <ShareView call={call} clip={clip} />;
}
