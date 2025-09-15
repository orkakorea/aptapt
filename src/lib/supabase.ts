// src/lib/supabase.ts
export { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);
