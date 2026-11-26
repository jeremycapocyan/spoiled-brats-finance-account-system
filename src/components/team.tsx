"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Clock3, Plus, Download, Pencil, QrCode, KeyRound, Mail, RotateCcw, UserRound, LogIn, LogOut } from "lucide-react";
import { type Attendance, type Employee, type Profile, today, uid } from "@/lib/model";
import { attendanceDays, hours, manilaDate, manilaTime, workedMinutes, type Schedule } from "@/lib/attendance";
import { validDate } from "@/lib/finance";
import { Card, Empty, Field, Modal, Stat, Table } from "./ui";
type TeamData = { employees: Employee[]; attendance: Attendance[]; schedules: Schedule[]; qr: string };
const blankTeam = (): TeamData => ({ employees: [], attendance: [], schedules: [], qr: uid() });
function sampleTeam(): TeamData {
  const d = today(); const start = d.slice(0, 7) + "-01";
  const employees: Employee[] = [{ id: "b2a3cd01-89ab-4cde-8abc-123456789001", name: "Alex (sample)", email: "alex@example.com", code: "SAMPLE0001", active: true, start_date: start, schedule_start: "08:00", schedule_end: "16:00", workdays: [1, 2, 3, 4, 5, 6] }, { id: "b2a3cd01-89ab-4cde-8abc-123456789002", name: "Sam (sample)", email: "sam@example.com", code: "SAMPLE0002", active: true, start_date: start, schedule_start: "10:00", schedule_end: "18:00", workdays: [1, 2, 3, 4, 5, 6] }];
  const attendance: Attendance[] = [];
  const yesterday = new Date(d + "T12:00:00Z"); yesterday.setUTCDate(yesterday.getUTCDate() - 1); const date = yesterday.toISOString().slice(0, 10);
  if (date >= start) employees.forEach((e, i) => attendance.push({ id: uid(), employee_id: e.id, clock_in: date + `T${i ? "10:04" : "08:00"}:00+08:00`, clock_out: date + `T${i ? "18:00" : "16:00"}:00+08:00`, break_minutes: 0, voided: false, reason: "Fictional sample attendance" }));
  return { employees, attendance, schedules: employees.map(e => ({ employee_id: e.id, effective: start, schedule_start: e.schedule_start, schedule_end: e.schedule_end, workdays: e.workdays })), qr: "b2a3cd01-89ab-4cde-8abc-123456789099" };
}
export function Team({ demo, profile, api, notify, error }: { demo: boolean; profile: Profile | null; api: (url: string, body?: unknown) => Promise<Response>; notify: (s: string) => void; error: (s: string) => void }) {
  const [data, setData] = useState<TeamData>(blankTeam); const [view, setView] = useState("attendance"); const [start, setStart] = useState(today().slice(0, 7) + "-01"); const [end, setEnd] = useState(today()); const [employeeId, setEmployeeId] = useState("");
  const [modal, setModal] = useState<{ kind: string; record?: any } | null>(null); const [qrImage, setQrImage] = useState(""); const [busy, setBusy] = useState(false); const [formError, setFormError] = useState("");
  const clockRetry = useRef<{ action: string; nonce: string } | null>(null); const admin = demo || profile?.role === "admin";
  async function refresh() { if (!demo && profile) setData(await (await api(`/api/team?start=${start}&end=${end}`)).json()); }
  useEffect(() => {
    if (demo) { try { const saved = localStorage.getItem("spoiled-brats-sample-team-v1"); setData(saved ? JSON.parse(saved) : sampleTeam()); } catch { setData(sampleTeam()); } }
    else if (profile) refresh().catch(e => error(e.message)); else setData(blankTeam());
  }, [demo, profile?.id, start, end]);
  const selected = data.employees.filter(e => !employeeId || e.id === employeeId);
  const rows = data.attendance.filter(a => !a.voided && (!employeeId || a.employee_id === employeeId) && manilaDate(a.clock_in) >= start && manilaDate(a.clock_in) <= end);
  const open = data.attendance.filter(a => !a.voided && !a.clock_out);
  function show(kind: string, record?: any) { setFormError(""); setModal({ kind, record }); }
  async function action(kind: string, record?: any, effective?: string) {
    if (demo) {
      const next = structuredClone(data);
      if (kind === "employee") {
        const index = next.employees.findIndex(e => e.id === record.id);
        if (next.employees.some(e => e.email === record.email && e.id !== record.id)) throw new Error("An employee with this email already exists.");
        if (index >= 0) next.employees[index] = { ...next.employees[index], ...record }; else next.employees.push({ ...record, code: "EX" + uid().replaceAll("-", "").slice(0, 8).toUpperCase() });
        next.schedules = next.schedules.filter(s => !(s.employee_id === record.id && s.effective === effective)); next.schedules.push({ employee_id: record.id, effective: effective!, schedule_start: record.schedule_start, schedule_end: record.schedule_end, workdays: record.workdays });
      } else if (kind === "attendance") {
        if (!record.reason?.trim()) throw new Error("A correction reason is required.");
        if (!Number.isFinite(Date.parse(record.clock_in)) || Date.parse(record.clock_in) > Date.now() || record.clock_out && (Date.parse(record.clock_out) < Date.parse(record.clock_in) || Date.parse(record.clock_out) > Date.now())) throw new Error("Enter valid past attendance times.");
        if (record.break_minutes < 0 || record.clock_out && record.break_minutes > (Date.parse(record.clock_out) - Date.parse(record.clock_in)) / 60000) throw new Error("Break minutes must fit inside the shift.");
        if (!record.voided && next.attendance.some(a => a.id !== record.id && a.employee_id === record.employee_id && !a.voided && (manilaDate(a.clock_in) === manilaDate(record.clock_in) || Date.parse(a.clock_in) < (record.clock_out ? Date.parse(record.clock_out) : Infinity) && (a.clock_out ? Date.parse(a.clock_out) : Infinity) > Date.parse(record.clock_in)))) throw new Error("Another attendance record overlaps this shift or uses the same work date.");
        const index = next.attendance.findIndex(a => a.id === record.id); if (index >= 0) next.attendance[index] = record; else next.attendance.push(record);
      } else if (kind === "rotate-qr") next.qr = uid();
      else if (["invite", "revoke-pin"].includes(kind)) { notify("Sample only. No invitation was sent or live PIN changed."); return; }
      setData(next); localStorage.setItem("spoiled-brats-sample-team-v1", JSON.stringify(next));
    } else { await api("/api/team", { action: kind, record, effective }); await refresh(); }
    notify(demo ? "Sample team record saved." : "Team record saved.");
  }
  async function clock(action: string) {
    setBusy(true);
    try {
      if (clockRetry.current?.action !== action) clockRetry.current = { action, nonce: uid() };
      const result = await (await api("/api/attendance/clock", { action, nonce: clockRetry.current.nonce, qr: data.qr })).json();
      clockRetry.current = null; notify(`${result.name}: ${action === "clock_in" ? "Time In" : "Time Out"} recorded at ${manilaTime(result.time)} Manila time.`); await refresh();
    } catch (e) { error((e as Error).message); } finally { setBusy(false); }
  }
  async function exportTimesheet() {
    setBusy(true);
    try {
      const response = await api("/api/reports", { kind: "timesheet", start, end, employeeId, sample: demo, employees: demo ? selected : undefined, attendance: demo ? data.attendance : undefined, schedules: demo ? data.schedules : undefined });
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${demo ? "sample-" : ""}timesheets-${start}-${end}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { error((e as Error).message); } finally { setBusy(false); }
  }
  async function openQr() {
    const url = window.location.origin + "/clock?qr=" + data.qr + (demo ? "&sample=1" : "");
    setQrImage(await QRCode.toDataURL(url, { width: 600, margin: 3, errorCorrectionLevel: "M" })); show("qr");
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setFormError(""); const f = new FormData(e.currentTarget); const r = modal?.record || {};
    const str = (k: string) => String(f.get(k) || "").trim();
    try {
      if (modal?.kind === "employee") {
        const record = { id: r.id || uid(), name: str("name"), email: str("email").toLowerCase(), active: f.get("active") === "on", start_date: str("start_date"), schedule_start: str("schedule_start"), schedule_end: str("schedule_end"), workdays: f.getAll("workday").map(Number) };
        if (!validDate(record.start_date) || record.schedule_start === record.schedule_end) throw new Error("Enter valid employment dates and different start/finish times.");
        await action("employee", record, str("effective"));
      } else if (modal?.kind === "attendance") {
        const record = { id: r.id || uid(), employee_id: str("employee_id"), clock_in: str("clock_in") + ":00+08:00", clock_out: str("clock_out") ? str("clock_out") + ":00+08:00" : null, break_minutes: Number(f.get("break_minutes")), reason: str("reason"), voided: f.get("voided") === "on" };
        await action("attendance", record);
      } else if (modal?.kind === "pin") {
        if (demo) notify("Sample only. No live PIN was saved."); else { await api("/api/attendance/pin", { pin: str("pin"), confirmation: str("confirmation") }); notify("Your private attendance PIN has been saved."); }
      }
      setModal(null);
    } catch (e) { setFormError((e as Error).message); } finally { setBusy(false); }
  }
  const localStamp = (s?: string) => s ? manilaDate(s) + "T" + new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(s)) : "";
  const m = modal?.record || {};
  return <>
    {!profile && !demo ? <Card><Empty title="Your team's hours belong here" description="Sign in after database setup to add employees, generate a kiosk QR, and track attendance. Explore the sample workspace to preview it." /></Card> : <>
    <div className="stats-grid three"><Stat label="Team members" value={String(data.employees.filter(e => e.active).length)} note="Active employee records" icon={<UserRound size={18} />} /><Stat label="Recorded hours" value={hours(rows.reduce((n, a) => n + workedMinutes(a), 0))} note="Completed shifts less recorded unpaid breaks" icon={<Clock3 size={18} />} /><Stat label="Open shifts" value={String(open.length)} note="Waiting for Time Out" icon={<LogIn size={18} />} /></div>
    {!admin && <Card title="Your attendance clock" detail="Official time is recorded by the server in Manila time."><div className="toolbar-buttons"><button className="button primary" disabled={busy || !data.employees[0]?.active} onClick={() => clock("clock_in")}><LogIn size={17} />Time In</button><button className="button" disabled={busy || !data.employees[0]?.active} onClick={() => clock("clock_out")}><LogOut size={17} />Time Out</button><button className="button" onClick={() => show("pin")}><KeyRound size={17} />Set / change PIN</button></div><p className="form-note">Employee code: <strong>{data.employees[0]?.code || "Not linked"}</strong>. Use this code and your PIN at the kiosk QR. Scanning the QR alone does not record a punch.</p></Card>}
    <div className="inventory-toolbar"><div className="segmented">{["attendance", "timesheets", ...(admin ? ["employees"] : [])].map(v => <button key={v} className={view === v ? "selected capitalize" : "capitalize"} onClick={() => setView(v)}>{v}</button>)}</div>{admin && <div className="toolbar-buttons"><button className="button" onClick={() => openQr().catch(e => error(e.message))}><QrCode size={16} />Kiosk QR</button><button className="button primary" onClick={() => show("employee")}><Plus size={16} />Add employee</button></div>}</div>
    {view !== "employees" && <div className="team-filters"><label>Employee<select value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">All available employees</option>{data.employees.map(e => <option key={e.id} value={e.id}>{e.name}{!e.active ? " (inactive)" : ""}</option>)}</select></label><label>From<input type="date" value={start} onChange={e => { if (validDate(e.target.value) && e.target.value <= end && Date.parse(end) - Date.parse(e.target.value) <= 30 * 86400000) setStart(e.target.value); else error("Choose a start date within 31 days of the end date."); }} /></label><label>Through<input type="date" value={end} onChange={e => { if (validDate(e.target.value) && e.target.value >= start && Date.parse(e.target.value) - Date.parse(start) <= 30 * 86400000) setEnd(e.target.value); else error("Choose an end date within 31 days of the start date."); }} /></label><button className="button" disabled={busy} onClick={exportTimesheet}><Download size={16} />Timesheet PDF</button></div>}
    {view === "employees" && <Card title="Employee register" detail="Employee accounts have access only to their own attendance.">{!data.employees.length ? <Empty title="Add your first team member" description="Enter their name, email, workdays, and shift hours. Send their account invitation when ready." action="Add employee" onClick={() => show("employee")} /> : <Table headers={["Employee", "Code", "Shift (Manila)", "Status", "Actions"]}>{data.employees.map(e => <tr key={e.id}><td><strong>{e.name}</strong><small>{e.email}</small></td><td><code>{e.code}</code></td><td>{e.schedule_start.slice(0, 5)} – {e.schedule_end.slice(0, 5)}</td><td><span className={`badge ${e.active ? "green" : ""}`}>{e.active ? "Active" : "Inactive"}</span></td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit ${e.name}`} onClick={() => show("employee", e)}><Pencil size={15} /></button><button className="icon-button" aria-label={`Invite ${e.name}`} title="Send account invitation" disabled={!!e.user_id} onClick={() => show("invite", e)}><Mail size={15} /></button><button className="icon-button" aria-label={`Revoke PIN for ${e.name}`} title="Revoke attendance PIN" onClick={() => show("revoke-pin", e)}><KeyRound size={15} /></button></div></td></tr>)}</Table>}</Card>}
    {view === "attendance" && <Card title="Attendance log" detail="One shift per employee per Manila start date. Overnight clock-out remains linked to the original shift." action={admin && <button className="button" onClick={() => show("attendance")}><Plus size={15} />Add / correct attendance</button>}>
      {open.length > 0 && <div className="notice">{open.length} open shift(s): {open.map(a => data.employees.find(e => e.id === a.employee_id)?.name).join(", ")}. {admin ? "Review missing Time Out punches before exporting." : "Remember to time out after your shift."}</div>}
      {!rows.length ? <Empty title="No attendance in this range" description="Employees can use the kiosk QR with their code and PIN, or sign in to record Time In and Time Out." /> : <Table headers={["Employee", "Work date", "Time In", "Time Out", "Break", "Worked", ...(admin ? ["Actions"] : [])]}>{rows.map(a => <tr key={a.id}><td><strong>{data.employees.find(e => e.id === a.employee_id)?.name}</strong><small>{a.reason}</small></td><td>{manilaDate(a.clock_in)}</td><td>{manilaTime(a.clock_in)}</td><td>{a.clock_out ? `${manilaTime(a.clock_out)}${manilaDate(a.clock_out) !== manilaDate(a.clock_in) ? " · " + manilaDate(a.clock_out) : ""}` : <span className="badge amber">Open shift</span>}</td><td>{a.break_minutes}m</td><td>{hours(workedMinutes(a))}</td>{admin && <td><button className="icon-button" aria-label="Correct attendance" onClick={() => show("attendance", a)}><Pencil size={15} /></button></td>}</tr>)}</Table>}
    </Card>}
    {view === "timesheets" && <>{!selected.length ? <Card><Empty title="No employees to report" description="Add employees to preview and export timesheets." /></Card> : selected.map(e => { const days = attendanceDays(e, data.attendance, data.schedules, start, end); return <Card key={e.id} title={e.name} detail={`Code ${e.code} · ${hours(days.reduce((n, d) => n + d.minutes, 0))} worked`}><Table headers={["Date", "Scheduled", "Time In", "Time Out", "Worked", "Late / undertime", "Status"]}>{days.map(d => <tr key={d.date}><td>{d.date}</td><td>{d.schedule}</td><td>{d.clockIn ? manilaTime(d.clockIn) : "—"}</td><td>{d.clockOut ? manilaTime(d.clockOut) : "—"}</td><td>{hours(d.minutes)}</td><td>{d.late}m / {d.under}m</td><td><span className={`badge ${d.status === "Complete" ? "green" : ""}`}>{d.status}</span></td></tr>)}</Table></Card>; })}</>}
    </>}
    {modal && <Modal title={modal.kind === "employee" ? `${m.id ? "Edit" : "Add"} employee` : modal.kind === "attendance" ? "Attendance correction" : modal.kind === "qr" ? "Kiosk attendance QR" : modal.kind === "pin" ? "Your private attendance PIN" : modal.kind === "invite" ? "Send employee invitation?" : "Revoke attendance PIN?"} close={() => setModal(null)}>
      {["employee", "attendance", "pin"].includes(modal.kind) && <form className="editor-form" onSubmit={submit}>{formError && <div className="notice error" role="alert">{formError}</div>}
      {modal.kind === "employee" && <><div className="form-grid"><Field label="Employee name"><input required name="name" defaultValue={m.name} maxLength={150} placeholder="Full name" /></Field><Field label="Email address"><input required name="email" type="email" readOnly={!!m.user_id} defaultValue={m.email} placeholder="employee@example.com" /></Field><Field label="Employment start date"><input required type="date" name="start_date" defaultValue={m.start_date || today()} /></Field><Field label="Schedule effective date"><input required type="date" name="effective" min={m.id ? today() : undefined} defaultValue={m.id ? today() : m.start_date || today()} /></Field><Field label="Shift starts (Manila)"><input required type="time" name="schedule_start" defaultValue={m.schedule_start?.slice(0, 5) || ""} /></Field><Field label="Shift ends (Manila)"><input required type="time" name="schedule_end" defaultValue={m.schedule_end?.slice(0, 5) || ""} /></Field></div><p className="form-note">Finish earlier than start means an overnight shift. Leave pay rates blank: this version tracks hours only.</p><fieldset><legend>Recurring workdays</legend><div className="workday-checks">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => <label key={day}><input type="checkbox" name="workday" value={i} defaultChecked={(m.workdays || [1, 2, 3, 4, 5, 6]).includes(i)} />{day}</label>)}</div></fieldset><label className="check"><input name="active" type="checkbox" defaultChecked={m.active ?? true} />Active employee (can clock in/out)</label><p className="form-note">Saving does not send an email. Use the invitation button in the employee register when ready.</p></>}
      {modal.kind === "attendance" && <><Field label="Employee"><select required name="employee_id" defaultValue={m.employee_id || employeeId || ""}><option value="">Choose employee</option>{data.employees.filter(e => !m.id || e.id === m.employee_id).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field><div className="form-grid"><Field label="Time In (Manila)"><input required name="clock_in" type="datetime-local" defaultValue={localStamp(m.clock_in)} /></Field><Field label="Time Out (Manila)"><input name="clock_out" type="datetime-local" defaultValue={localStamp(m.clock_out)} /></Field><Field label="Unpaid break (minutes)"><input required name="break_minutes" type="number" min="0" step="1" defaultValue={m.break_minutes || 0} /></Field></div><Field label="Correction reason"><textarea required name="reason" defaultValue={m.reason || ""} placeholder="Explain the missing punch or correction." /></Field>{m.id && <label className="check"><input name="voided" type="checkbox" defaultChecked={m.voided} />Void accidental attendance</label>}</>}
      {modal.kind === "pin" && <><p className="form-note">Choose a private six-digit PIN. Admins cannot retrieve it. Use this page to replace a forgotten PIN.</p><Field label="New PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} name="pin" autoComplete="new-password" /></Field><Field label="Confirm PIN"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} name="confirmation" autoComplete="new-password" /></Field></>}
      <footer className="modal-footer"><button type="button" className="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button></footer></form>}
      {modal.kind === "qr" && <div className="editor-form qr-panel"><p>Scan at the kiosk, enter your employee code and private PIN, then select Time In or Time Out.</p>{demo && <div className="notice">Sample QR opens a demonstration clock. No real punches are recorded.</div>}{qrImage && <img src={qrImage} alt="Kiosk attendance QR code" width={280} height={280} />}<strong>Official attendance time: Asia/Manila</strong><small>The QR identifies this kiosk; it does not verify physical location.</small><div className="toolbar-buttons"><a className="button primary" href={qrImage} download={`${demo ? "sample-" : ""}kiosk-attendance-qr.png`}><Download size={16} />Download QR</a><a className="button" href={`/clock?qr=${data.qr}${demo ? "&sample=1" : ""}`} target="_blank" rel="noreferrer">Open clock</a><button className="button" onClick={async () => { try { await action("rotate-qr"); setModal(null); } catch (e) { error((e as Error).message); } }}><RotateCcw size={15} />Replace QR</button></div><p className="form-note">Replacing the QR invalidates previous printouts. Download the new one afterward.</p></div>}
      {["invite", "revoke-pin"].includes(modal.kind) && <div className="editor-form"><p>{modal.kind === "invite" ? `Send an account invitation to ${m.name} at ${m.email}? They will choose their own password and PIN.` : `Revoke ${m.name}'s code/PIN clock access? They must sign in and set a new PIN. Their attendance history is preserved.`}</p><button className="button primary" disabled={busy} onClick={async () => { setBusy(true); try { await action(modal.kind, m); setModal(null); } catch (e) { setFormError((e as Error).message); } finally { setBusy(false); } }}>{modal.kind === "invite" ? "Send invitation" : "Revoke PIN"}</button>{formError && <div className="notice error">{formError}</div>}</div>}
    </Modal>}
  </>;
}
