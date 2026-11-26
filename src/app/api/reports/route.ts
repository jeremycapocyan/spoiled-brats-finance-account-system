import { authorize, fail, jsonBody, loadFinance } from "@/lib/server";
import { ledger, validDate, validateState } from "@/lib/finance";
import { financialPdf, timesheetPdf } from "@/lib/pdf";
import type { Attendance, Employee } from "@/lib/model";
import type { Schedule } from "@/lib/attendance";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request); const { start, end } = body;
    if (!validDate(start) || !validDate(end) || start > end) throw new Error("Choose a valid date range.");
    let bytes: Uint8Array;
    if (body.kind === "timesheet") {
      if (Date.parse(end) - Date.parse(start) > 30 * 86400000) throw new Error("Timesheets support up to 31 days.");
      let employees: Employee[]; let rows: Attendance[]; let schedules: Schedule[];
      if (body.sample === true) {
        employees = body.employees; rows = body.attendance; schedules = body.schedules;
        if (!Array.isArray(employees) || employees.length > 20 || !Array.isArray(rows) || rows.length > 2000 || !Array.isArray(schedules) || schedules.length > 1000) throw new Error("Invalid sample timesheet.");
      } else {
        const { db, profile } = await authorize(request);
        let query = db.from("shop_employees").select("*");
        if (profile.role !== "admin") query = query.eq("user_id", profile.id);
        else if (body.employeeId) query = query.eq("id", body.employeeId);
        const result = await query; if (result.error) throw result.error; employees = result.data;
        const ids = employees.map(e => e.id);
        if (ids.length) {
          const records = await db.from("shop_attendance").select("*").in("employee_id", ids).gte("clock_in", start + "T00:00:00+08:00").lte("clock_in", end + "T23:59:59+08:00").limit(10000); if (records.error) throw records.error; rows = records.data;
          const versions = await db.from("shop_employee_schedule_history").select("*").in("employee_id", ids).lte("effective", end).limit(10000); if (versions.error) throw versions.error; schedules = versions.data;
        } else { rows = []; schedules = []; }
      }
      bytes = await timesheetPdf(employees, rows, schedules, start, end, body.sample === true);
    } else {
      let state;
      if (body.sample === true) { state = body.state; validateState(state); ledger(state); }
      else { const { db } = await authorize(request, true); state = (await loadFinance(db)).state; }
      bytes = await financialPdf(state, start, end, body.sample === true);
    }
    return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${body.sample ? "sample-" : ""}${body.kind === "timesheet" ? "timesheet" : "financial-report"}-${start}-${end}.pdf"`, "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}
