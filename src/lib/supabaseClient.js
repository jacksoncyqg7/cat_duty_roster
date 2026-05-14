import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
console.log("Supabase key:", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);