import { authorize, fail } from "@/lib/server";
export async function GET(request: Request) {
  try {
    const { db } = await authorize(request, true);
    const { data, error } = await db.from("shop_audit").select("id,actor,action,created_at").order("id", { ascending: false }).limit(100); if (error) throw error;
    return Response.json({ rows: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
