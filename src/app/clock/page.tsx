"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Coffee, LogIn, LogOut, ShieldCheck, Clock3 } from "lucide-react";
import { manilaTime } from "@/lib/attendance";
import { uid } from "@/lib/model";
import { Field } from "@/components/ui";
export default function ClockPage() {
  const [qr, setQr] = useState(""); const [sample, setSample] = useState(false); const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [now, setNow] = useState("");
  const retry = useRef<{ payload: string; nonce: string } | null>(null);
  useEffect(() => { const q = new URLSearchParams(window.location.search); setQr(q.get("qr") || ""); setSample(q.get("sample") === "1"); const update = () => setNow(new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, []);
  async function punch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const action = (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    setBusy(true); setError(""); setNotice("");
    try {
      if (sample) { setNotice(`Sample ${action === "clock_in" ? "Time In" : "Time Out"} preview. No attendance was saved.`); form.reset(); return; }
      const body = { code: String(f.get("code") || "").trim().toUpperCase(), pin: String(f.get("pin") || ""), action, qr };
      const payload = JSON.stringify(body); if (retry.current?.payload !== payload) retry.current = { payload, nonce: uid() };
      const response = await fetch("/api/attendance/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, nonce: retry.current.nonce }) }); const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      retry.current = null; setNotice(`${result.name} · ${result.action === "clock_in" ? "Time In" : "Time Out"} recorded at ${manilaTime(result.time)} Manila time.`); form.reset();
    } catch (e) { setError((e as Error).message || "Connection failed. Retry the same action before making another punch."); } finally { setBusy(false); }
  }
  return <main className="clock-page"><div className="clock-brand"><Coffee size={32} /><strong>Spoiled Brats</strong><span>TEAM ATTENDANCE</span></div><section className="clock-card"><span className="clock-icon"><Clock3 size={25} /></span><h1>A good shift starts here.</h1><p>Enter your employee code and PIN.</p><div className="clock-time">{now || "—"}<small>Asia/Manila · server records official time</small></div>{sample && <div className="notice">Fictional sample clock — no live punches.</div>}{notice && <div className="notice success" role="status">{notice}</div>}{error && <div className="notice error" role="alert">{error}</div>}{!qr && <div className="notice">Scan the current kiosk QR to enable attendance.</div>}<form className="editor-form" onSubmit={punch}><Field label="Employee code"><input required name="code" autoComplete="off" maxLength={10} minLength={10} placeholder="Your 10-character code" /></Field><Field label="Private PIN"><input required name="pin" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{6}" maxLength={6} minLength={6} placeholder="6 digits" /></Field><div className="form-grid"><button className="button primary" name="action" value="clock_in" disabled={busy || !qr}><LogIn size={17} />Time In</button><button className="button" name="action" value="clock_out" disabled={busy || !qr}><LogOut size={17} />Time Out</button></div></form><p className="clock-security"><ShieldCheck size={15} />Scanning alone never records attendance.</p><a href="/">Sign in to view your hours or reset your PIN</a></section></main>;
}
