"use client";
import { useState, type FormEvent } from "react";
import { browserDb, configured } from "@/lib/supabase";
import { Field, Modal } from "./ui";
export function Auth({ close, passwordOnly = false }: { close: () => void; passwordOnly?: boolean }) {
  const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false); const [reset, setReset] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setNotice(""); setBusy(true);
    try {
      const db = browserDb(); if (!db) throw new Error("Online access needs a new Supabase project. Follow DEPLOYMENT.md to configure it; the sample workspace is available now.");
      const f = new FormData(e.currentTarget); const email = String(f.get("email") || ""); const password = String(f.get("password") || "");
      if (passwordOnly) { const { error } = await db.auth.updateUser({ password }); if (error) throw error; window.location.assign("/"); }
      else if (reset) { const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/account" }); if (error) throw error; setNotice("If this account exists, a password setup link has been sent."); }
      else { const { error } = await db.auth.signInWithPassword({ email, password }); if (error) throw error; close(); }
    } catch (e) { setNotice(e instanceof Error ? e.message : "Sign-in failed."); } finally { setBusy(false); }
  }
  return <Modal title={passwordOnly ? "Set your account password" : reset ? "Reset your password" : "Welcome back"} close={close}><form className="editor-form" onSubmit={submit}><p className="form-note">{passwordOnly ? "Choose a password for your invited account." : "Sign in to your private coffee shop workspace."}</p>{!configured() && <div className="notice">Shared access is awaiting database setup. No live business records are stored in this browser.</div>}{notice && <div className="notice" role="status">{notice}</div>}{!passwordOnly && <Field label="Email address"><input required name="email" type="email" autoComplete="email" placeholder="you@example.com" /></Field>}{(!reset || passwordOnly) && <Field label="Password"><input required minLength={8} name="password" type="password" autoComplete={passwordOnly ? "new-password" : "current-password"} /></Field>}<button className="button primary full" disabled={busy}>{busy ? "Please wait…" : passwordOnly ? "Save password" : reset ? "Send reset link" : "Sign in"}</button>{!passwordOnly && <button type="button" className="text-button" onClick={() => { setReset(!reset); setNotice(""); }}>{reset ? "Return to sign in" : "Forgot password?"}</button>}</form></Modal>;
}
