import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const configured = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
let browserClient: SupabaseClient | null = null;
export function browserDb() {
  if (!configured()) return null;
  browserClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  return browserClient;
}
