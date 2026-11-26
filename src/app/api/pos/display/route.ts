import { createHash, randomBytes } from "node:crypto";
import { authorize, fail, jsonBody, serviceDb } from "@/lib/server";
import { canSell } from "@/lib/permissions";
import { sanitizeDisplay } from "@/lib/pos";
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const headers={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
export async function GET(request:Request){
  try{
    const token=request.headers.get("x-display-token")||""; if(!/^[a-f0-9]{64}$/.test(token)) throw new Error("Pair this display from the POS.");
    const db=serviceDb(); const {data,error}=await db.from("shop_pos_displays").select("snapshot,updated_at,expires_at,actor").eq("token_hash",hash(token)).maybeSingle();
    if(error) throw error;
    if(!data || Date.parse(data.expires_at)<Date.now()) throw new Error("Pairing expired. Create a new display link from the POS.");
    const {data:actor}=await db.from("shop_profiles").select("active,role").eq("id",data.actor).single();
    if(!actor?.active || !["admin","cashier"].includes(actor.role)) throw new Error("Display disconnected.");
    return Response.json({snapshot:Date.now()-Date.parse(data.updated_at)<90000 && data.snapshot?sanitizeDisplay(data.snapshot):null}, {headers});
  }catch(e){return fail(e,404);}
}
export async function POST(request:Request){
  try{
    const {db,profile}=await authorize(request); if(!canSell(profile)) throw new Error("POS access required.");
    const b=await jsonBody(request,30000);
    if(b.action==="pair"){
      // A new link revokes the cashier's previous display capability.
      const removed=await db.from("shop_pos_displays").delete().eq("actor",profile.id); if(removed.error) throw removed.error;
      const token=randomBytes(32).toString("hex"),expires=new Date(Date.now()+8*3600000).toISOString();
      const result=await db.from("shop_pos_displays").insert({token_hash:hash(token),actor:profile.id,expires_at:expires}); if(result.error) throw result.error;
      return Response.json({token,expires},{headers});
    }
    if(typeof b.token!=="string" || !/^[a-f0-9]{64}$/.test(b.token)) throw new Error("Pair a display first.");
    const q=db.from("shop_pos_displays");
    const result=b.action==="close"?await q.delete().eq("token_hash",hash(b.token)).eq("actor",profile.id):await q.update({snapshot:sanitizeDisplay(b.snapshot),updated_at:new Date().toISOString()}).eq("token_hash",hash(b.token)).eq("actor",profile.id).gt("expires_at",new Date().toISOString()).select("token_hash");
    if(result.error) throw result.error; if(b.action!=="close" && !result.data?.length) throw new Error("Display link expired or was replaced. Pair it again.");
    return Response.json({ok:true},{headers});
  }catch(e){return fail(e);}
}
