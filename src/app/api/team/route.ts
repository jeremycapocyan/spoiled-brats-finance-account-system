import { authorize, fail, jsonBody } from "@/lib/server";
import { validDate } from "@/lib/finance";
import { today } from "@/lib/model";
import { requireOwner } from "@/lib/permissions";
export async function GET(request: Request) {
  try {
    const { db, profile } = await authorize(request); const query = new URL(request.url).searchParams;
    const start = query.get("start") || today().slice(0, 7) + "-01"; const end = query.get("end") || today();
    if (!validDate(start) || !validDate(end) || start > end || Date.parse(end) - Date.parse(start) > 31 * 86400000) throw new Error("Select a range of up to 31 days.");
    let employeesQuery = db.from("shop_employees").select("*").order("name");
    if (profile.role !== "admin") employeesQuery = employeesQuery.eq("user_id", profile.id);
    const employees = await employeesQuery; if (employees.error) throw new Error(employees.error.message);
    const ids = employees.data.map(e => e.id);
    const attendance = ids.length ? await db.from("shop_attendance").select("*").in("employee_id", ids).or(`and(clock_in.gte.${start}T00:00:00+08:00,clock_in.lte.${end}T23:59:59+08:00),clock_out.is.null`).order("clock_in", { ascending: false }).limit(10000) : { data: [], error: null };
    if (attendance.error) throw new Error(attendance.error.message);
    const schedules = ids.length ? await db.from("shop_employee_schedule_history").select("*").in("employee_id", ids).lte("effective", end).order("effective").limit(10000) : { data: [], error: null };
    if (schedules.error) throw new Error(schedules.error.message);
    const { data: config } = await db.from("shop_clock_config").select("qr").single();
    return Response.json({ employees: employees.data, attendance: attendance.data, schedules: schedules.data, qr: config?.qr }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
export async function POST(request: Request) {
  try {
    const { db, profile } = await authorize(request, true); const { action, record, effective } = await jsonBody(request);
    if (action === "employee") {
      if (!record || !/^[0-9a-f-]{36}$/i.test(record.id) || typeof record.name !== "string" || !record.name.trim() || record.name.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email) || !validDate(record.start_date) || !validDate(effective) || !/^\d{2}:\d{2}(:\d{2})?$/.test(record.schedule_start) || !/^\d{2}:\d{2}(:\d{2})?$/.test(record.schedule_end) || !Array.isArray(record.workdays) || !record.workdays.every((n: number) => Number.isInteger(n) && n >= 0 && n <= 6)) throw new Error("Complete employee details, workdays, and shift hours.");
      const { data: existing } = await db.from("shop_employees").select("email,user_id").eq("id", record.id).maybeSingle();
      if (existing?.user_id && existing.email !== record.email.toLowerCase()) throw new Error("An invited employee's email cannot be changed here.");
      const result = await db.rpc("shop_save_employee", { p_actor: profile.id, p_employee: record, p_effective: effective }); if (result.error) throw new Error(result.error.message);
    } else if (action === "attendance") {
      if (!record || !record.reason?.trim() || !Number.isInteger(record.break_minutes) || record.break_minutes < 0) throw new Error("A reason and valid break minutes are required.");
      const result = await db.rpc("shop_correct_attendance", { p_actor: profile.id, p_record: record }); if (result.error) throw new Error(result.error.message);
    } else if (action === "rotate-qr") {
      const { error } = await db.from("shop_clock_config").update({ qr: crypto.randomUUID() }).eq("id", true); if (error) throw error;
      await db.from("shop_audit").insert({ actor: profile.id, action: "attendance:rotate-qr" });
    } else if (action === "revoke-pin") {
      const { error } = await db.from("shop_attendance_pins").delete().eq("employee_id", record.id); if (error) throw error;
      await db.from("shop_audit").insert({ actor: profile.id, action: "attendance:revoke-pin", after_data: { employee_id: record.id } });
    } else if (action === "invite") {
      requireOwner(profile);
      const { data: employee } = await db.from("shop_employees").select("*").eq("id", record.id).single();
      if (!employee?.active) throw new Error("Select an active employee.");
      if (employee.user_id) throw new Error("This employee already has an account. They can use Forgot password on the sign-in screen.");
      const origin = process.env.APP_URL; if (!origin) throw new Error("Set APP_URL before inviting employees.");
      const invitation = await db.auth.admin.inviteUserByEmail(employee.email, { redirectTo: origin + "/account" });
      if (invitation.error || !invitation.data.user) throw new Error(invitation.error?.message || "Invitation failed.");
      const userId = invitation.data.user.id;
      const existing = await db.from("shop_profiles").select("role").eq("id", userId).maybeSingle();
      if (existing.data) throw new Error("This person already has a user account. Link it in the employee form without changing its role.");
      const result = await db.rpc("shop_manage_account", { p_actor: profile.id, p_target: userId, p_name: employee.name, p_role: "employee", p_active: true, p_email: employee.email }); if (result.error) throw result.error;
      const linked = await db.from("shop_employees").update({ user_id: userId }).eq("id", employee.id); if (linked.error) throw linked.error;
      await db.from("shop_audit").insert({ actor: profile.id, action: "employee:invite", after_data: { employee_id: employee.id } });
    } else throw new Error("Unknown team action.");
    return Response.json({ ok: true });
  } catch (e) { return fail(e); }
}
