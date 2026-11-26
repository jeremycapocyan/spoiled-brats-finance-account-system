import { authorize, fail, jsonBody, serviceDb } from "@/lib/server";
import { rateKey, validPin, verifyPin } from "@/lib/pin";
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request, 4096);
    if (!["clock_in", "clock_out"].includes(body.action) || !/^[0-9a-f-]{36}$/i.test(body.nonce) || !/^[0-9a-f-]{36}$/i.test(body.qr)) throw new Error("Scan the current QR and select Time In or Time Out.");
    let employeeId: string; let version: string | null = null; let db = serviceDb();
    if (request.headers.has("authorization")) {
      const ctx = await authorize(request); db = ctx.db;
      const { data: employee } = await db.from("shop_employees").select("id").eq("user_id", ctx.profile.id).single();
      if (!employee) throw new Error("No employee record is linked to this account."); employeeId = employee.id;
    } else {
      const secret = process.env.ATTENDANCE_RATE_LIMIT_SECRET;
      if (!secret || secret.length < 32) return fail(new Error("PIN clock is not configured. Use employee sign-in."), 503);
      if (!validPin(body.pin) || typeof body.code !== "string" || !/^[A-Z0-9]{10}$/.test(body.code.toUpperCase())) throw new Error("Enter your employee code and six-digit PIN.");
      const code = body.code.toUpperCase(); const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || "shared-unverified-network";
      const { data: reservation, error } = await db.rpc("shop_reserve_pin", { p_code: rateKey(secret, "code:" + code), p_ip: rateKey(secret, "ip:" + ip) });
      if (error) throw new Error("Clock is temporarily unavailable.");
      if (!reservation) return fail(new Error("Too many attempts. Wait 15 minutes or sign in to your employee account."), 429);
      const { data: employee } = await db.from("shop_employees").select("id,active").eq("code", code).maybeSingle();
      const { data: credential } = employee ? await db.from("shop_attendance_pins").select("*").eq("employee_id", employee.id).maybeSingle() : { data: null };
      const correct = await verifyPin(body.pin, credential?.salt || "0".repeat(64), credential?.hash || "0".repeat(128));
      if (!employee?.active || !credential || !correct) return fail(new Error("Employee code or PIN is incorrect, or clock access is unavailable."), 401);
      await db.from("shop_pin_attempts").update({ successful: true }).eq("id", reservation);
      employeeId = employee.id; version = credential.version;
    }
    const { data, error } = await db.rpc("shop_punch", { p_employee: employeeId, p_action: body.action, p_nonce: body.nonce, p_qr: body.qr, p_version: version });
    if (error) throw new Error(error.message);
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
