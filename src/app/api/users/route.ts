import { authorize, fail, jsonBody } from "@/lib/server";
import { requireOwner, roleNames, validateAccountChange } from "@/lib/permissions";
export async function GET(request: Request) {
  try { const { db, profile } = await authorize(request); requireOwner(profile);
    const { data, error } = await db.from("shop_profiles").select("id,name,email,role,active,is_owner").order("name"); if (error) throw error;
    return Response.json({ users: data }, { headers: { "Cache-Control": "no-store" } });
  } catch(e) { return fail(e,403); }
}
export async function POST(request: Request) {
  try {
    const { db, profile } = await authorize(request); requireOwner(profile); const b = await jsonBody(request,10000);
    if (typeof b.name !== "string" || !b.name.trim() || b.name.length>150 || typeof b.role !== "string" || !Object.hasOwn(roleNames,b.role)) throw new Error("Enter a name and select a role.");
    let target=b.id; let email: string | null=null;
    if (b.action === "invite") {
      if (typeof b.email!=="string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || b.email.length>254) throw new Error("Enter a valid email address.");
      email=b.email.trim().toLowerCase();
      const existing=await db.from("shop_profiles").select("id").eq("email",email).maybeSingle();
      if(existing.error) throw existing.error;
      if(existing.data) throw new Error("This user already has an account. Update their role in the list.");
      if (!process.env.APP_URL) throw new Error("APP_URL must be configured before sending invitations.");
      const invite=await db.auth.admin.inviteUserByEmail(email!,{ redirectTo:process.env.APP_URL+"/account",data:{name:b.name.trim()} });
      if(invite.error || !invite.data.user) throw new Error(invite.error?.message || "Invitation failed.");
      target=invite.data.user.id;
    } else if(b.action === "update") {
      const result=await db.from("shop_profiles").select("*").eq("id",target).single(); if(result.error) throw result.error;
      validateAccountChange(profile,result.data,b.role,b.active);
    } else throw new Error("Unknown user action.");
    const result=await db.rpc("shop_manage_account",{p_actor:profile.id,p_target:target,p_name:b.name.trim(),p_role:b.role,p_active:b.action==="invite"?true:b.active,p_email:email});
    if(result.error) throw new Error("Account access could not be saved: "+result.error.message);
    return Response.json({ok:true});
  } catch(e) {return fail(e);}
}
