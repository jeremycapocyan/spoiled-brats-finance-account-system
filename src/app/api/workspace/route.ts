import { authorize, fail, jsonBody, loadFinance } from "@/lib/server";
import { mutate } from "@/lib/finance";
export async function GET(request: Request) {
  try {
    const { db, profile } = await authorize(request);
    const finance = profile.role === "admin" ? await loadFinance(db) : null;
    return Response.json({ profile, ...finance }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e, 401); }
}
export async function POST(request: Request) {
  try {
    const { db, profile } = await authorize(request, true); const body = await jsonBody(request);
    if (typeof body.operationId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.operationId)) throw new Error("Invalid operation identifier.");
    const { data: previous } = await db.from("shop_finance_operations").select("revision").eq("id", body.operationId).maybeSingle();
    if (previous) return Response.json(await loadFinance(db));
    const current = await loadFinance(db);
    if (current.revision !== body.revision) return fail(new Error("Another session changed these records. Refresh the workspace and retry."), 409);
    const next = mutate(current.state, body.action);
    const result = await db.rpc("shop_commit_finance", { p_actor: profile.id, p_revision: current.revision, p_state: next, p_operation: body.operationId, p_action: body.action.collection });
    if (result.error) return fail(new Error(result.error.code === "40001" ? "Another session saved first. Refresh the workspace and retry." : result.error.message), 409);
    return Response.json({ state: next, revision: result.data });
  } catch (e) { return fail(e); }
}
