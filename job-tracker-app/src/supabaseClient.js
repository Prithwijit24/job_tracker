import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Missing Supabase env vars. Create a .env file from .env.example and fill in your project's URL and anon key, then restart the dev server."
  );
}

// Use placeholders when env vars are missing so createClient() doesn't
// throw ("supabaseUrl is required") and crash the whole app on load.
// Requests will fail until real creds are provided, but the UI still renders.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: {
      // Keep the user logged in across reloads / restarts.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
