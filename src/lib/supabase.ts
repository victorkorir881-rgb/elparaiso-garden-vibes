/**
 * supabase.ts — Standard Supabase client for Elparaiso Garden.
 *
 * Environment variables (injected automatically by Lovable Cloud):
 *   VITE_SUPABASE_URL              — your Supabase project URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY  — the anon/publishable key (safe for browser)
 *
 * NEVER put your service_role key here.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Support both the new PUBLISHABLE_KEY name and the legacy ANON_KEY
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY
) as string | undefined;

export const isSupabaseConfigured: boolean =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.info(
    "[supabase] VITE_SUPABASE_URL or publishable key not set. " +
      "Chatbot will run in local-fallback mode."
  );
}
