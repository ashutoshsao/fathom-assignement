import { notFound } from "next/navigation";
import { CallView } from "@/components/CallView";
import { getCall, getCallIndex } from "@/lib/seed";

export async function generateStaticParams() {
  const index = await getCallIndex();
  return index.map((c) => ({ id: c.id }));
}

export async function generateMetadata(props: PageProps<"/calls/[id]">) {
  const { id } = await props.params;
  const call = await getCall(id);
  return { title: call ? `${call.title} — Fathom` : "Call not found" };
}

export default async function CallPage(props: PageProps<"/calls/[id]">) {
  const { id } = await props.params;
  const { t } = await props.searchParams;
  const call = await getCall(id);
  if (!call) notFound();

  // ?t=<seconds> — how a cross-call citation lands on the moment it cited.
  const raw = Array.isArray(t) ? t[0] : t;
  const parsed = raw ? Number(raw) : NaN;
  const startAt =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, call.durationSec) : undefined;

  return <CallView call={call} startAt={startAt} />;
}
