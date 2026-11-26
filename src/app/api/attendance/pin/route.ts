import { authorize, fail, jsonBody } from "@/lib/server";
import { hashPin, validPin } from "@/lib/pin";
export async function POST(request: Request) {
  try {
    const { db, profile } = await authorize(request); const { pin, confirmation } = await jsonBody(request, 1024);
    if (!validPin(pin) || confirmation !== pin) throw new Error("Enter and confirm the same six-digit PIN.");
    const { data: employee } = await db.from("shop_employees").select("id,active").eq("user_id", profile.id).single();
    if (!employee?.active) throw new Error("An active employee account is required.");
    const credential = await hashPin(pin);
    const { error } = await db.from("shop_attendance_pins").upsert({ employee_id: employee.id, ...credential, version: crypto.randomUUID() }); if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) { return fail(e); }
}
