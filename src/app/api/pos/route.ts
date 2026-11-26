import { authorize, fail, jsonBody, loadFinance } from "@/lib/server";
import { canSell } from "@/lib/permissions";
import { catalog, checkout } from "@/lib/pos";
export async function GET(request: Request) {
  try {
    const {db,profile}=await authorize(request); if(!canSell(profile)) throw new Error("Administrator or cashier access is required.");
    const {state}=await loadFinance(db);
    const receipts=await db.from("shop_pos_receipts").select("receipt").eq("actor",profile.id).order("created_at",{ascending:false}).limit(20); if(receipts.error) throw receipts.error;
    return Response.json({profile,name:state.settings.name,products:catalog(state),receipts:receipts.data.map(r=>r.receipt)},{headers:{"Cache-Control":"no-store"}});
  }catch(e){return fail(e,403);}
}
export async function POST(request: Request) {
  try {
    const {db,profile}=await authorize(request); if(!canSell(profile)) throw new Error("Administrator or cashier access is required.");
    const b=await jsonBody(request,20000);
    if(typeof b.operationId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.operationId)) throw new Error("Invalid checkout identifier.");
    const previous=await db.from("shop_pos_receipts").select("receipt,actor").eq("id",b.operationId).maybeSingle(); if(previous.error) throw previous.error;
    if(previous.data) {if(previous.data.actor!==profile.id) throw new Error("Receipt belongs to another cashier."); return Response.json({receipt:previous.data.receipt});}
    const current=await loadFinance(db); const next=checkout(current.state,b.lines,b.payments,b.operationId);
    const result=await db.rpc("shop_commit_pos",{p_actor:profile.id,p_revision:current.revision,p_state:next.state,p_receipt:next.receipt,p_operation:b.operationId});
    if(result.error) throw new Error(result.error.code==="40001"?"Stock or records changed. Refresh the menu and retry payment once.":result.error.message);
    return Response.json({receipt:next.receipt});
  }catch(e){return fail(e);}
}
