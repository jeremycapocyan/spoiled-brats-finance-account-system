import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { FinanceState, Profile } from "./model";
export function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Shared database is not configured. Use the sample workspace or complete DEPLOYMENT.md.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function authorize(request: Request, admin = false) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Sign in to continue.");
  const db = serviceDb(); const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error("Your session has expired. Sign in again.");
  const result = await db.from("shop_profiles").select("*").eq("id", data.user.id).maybeSingle();
  const profile = result.data as Profile | null;
  if (!profile?.active || (admin && profile.role !== "admin")) throw new Error("You do not have access to this action.");
  return { db, profile, user: data.user };
}
export async function loadFinance(db: ReturnType<typeof serviceDb>) {
  const { data, error } = await db.from("shop_finance").select("state,revision").eq("id", true).single();
  if (error) throw new Error("Database setup is incomplete. Apply the coffee shop migration first.");
  return data as { state: FinanceState; revision: number };
}
export const fail = (e: unknown, status = 400) => Response.json({ error: e instanceof Error ? e.message : "The request could not be completed." }, { status, headers: { "Cache-Control": "no-store" } });
export async function jsonBody(request: Request, limit = 5_000_000) {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new Error("Request is too large.");
  const text = await request.text(); if (text.length > limit) throw new Error("Request is too large.");
  return JSON.parse(text);
}
