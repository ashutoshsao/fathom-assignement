import { searchCalls } from "@/lib/search";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const hits = await searchCalls(q);
  return Response.json({ query: q, hits }, { headers: { "Cache-Control": "no-store" } });
}
