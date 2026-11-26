import { validDate } from "./finance";
import type { Attendance, Employee } from "./model";
export type Schedule = { employee_id: string; effective: string; schedule_start: string; schedule_end: string; workdays: number[] };
export const manilaDate = (stamp: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(stamp));
export const manilaTime = (stamp: string) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" }).format(new Date(stamp));
export const workedMinutes = (a: Attendance) => a.clock_out && !a.voided ? Math.max(0, Math.floor((Date.parse(a.clock_out) - Date.parse(a.clock_in)) / 60000) - a.break_minutes) : 0;
export const hours = (m: number) => `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
export function attendanceDays(e: Employee, rows: Attendance[], schedules: Schedule[], start: string, end: string) {
  if (!validDate(start) || !validDate(end) || start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 30) throw new Error("Timesheets support a maximum of 31 days.");
  const result = [];
  for (let date = start; date <= end;) {
    if (date >= e.start_date) {
      const schedule = schedules.filter(s => s.employee_id === e.id && s.effective <= date).sort((a, b) => b.effective.localeCompare(a.effective))[0];
      const a = rows.find(a => a.employee_id === e.id && !a.voided && manilaDate(a.clock_in) === date);
      const workday = schedule?.workdays.includes(new Date(date + "T12:00:00Z").getUTCDay());
      const scheduledStart = schedule ? Date.parse(`${date}T${schedule.schedule_start.slice(0, 8)}+08:00`) : 0;
      let scheduledEnd = schedule ? Date.parse(`${date}T${schedule.schedule_end.slice(0, 8)}+08:00`) : 0;
      if (scheduledEnd <= scheduledStart) scheduledEnd += 86400000;
      const late = a && workday ? Math.max(0, Math.ceil((Date.parse(a.clock_in) - scheduledStart) / 60000)) : 0;
      const under = a?.clock_out && workday ? Math.max(0, Math.ceil((scheduledEnd - Date.parse(a.clock_out)) / 60000)) : 0;
      result.push({ date, status: a ? a.clock_out ? "Complete" : "Open shift" : workday ? "No attendance" : "Rest day", schedule: schedule ? `${schedule.schedule_start.slice(0, 5)} - ${schedule.schedule_end.slice(0, 5)}` : "Not scheduled", clockIn: a?.clock_in || "", clockOut: a?.clock_out || "", breakMinutes: a?.break_minutes || 0, minutes: a ? workedMinutes(a) : 0, late, under, reason: a?.reason || "" });
    }
    const next = new Date(date + "T12:00:00Z"); next.setUTCDate(next.getUTCDate() + 1); date = next.toISOString().slice(0, 10);
  }
  return result;
}
