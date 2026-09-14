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
  const call = await getCall(id);
  if (!call) notFound();
  return <CallView call={call} />;
}
