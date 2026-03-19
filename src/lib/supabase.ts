/**
 * supabase.ts — Standard Supabase client initialisation for Elparaiso Garden.
 *
 * Required environment variables (add to your .env file):
 *
 *   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
 *
 * These are the PUBLIC anon keys — safe to include in frontend code.
 * NEVER put your service_role key here.
 *
 * @see https://supabase.com/docs/reference/javascript/initializing
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Whether a real Supabase connection is configured in the current environment.
 * All services that use Supabase MUST check this before making requests.
 */
export const isSupabaseConfigured: boolean =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey);

/**
 * The configured Supabase client, or null if env vars are not set.
 * Services should check `isSupabaseConfigured` before using this.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.info(
    "[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. " +
      "Chatbot will run in local-fallback mode. " +
      "Add both variables to .env to enable Supabase features."
  );
}
