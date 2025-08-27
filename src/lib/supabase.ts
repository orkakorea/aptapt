// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// ✅ 본인 프로젝트 값으로 교체
const supabaseUrl = "https://qislrfbqilfqzkvkuknn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpc2xyZmJxaWxmcXprdmt1a25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNTczMDUsImV4cCI6MjA3MTgzMzMwNX0.JGOsDmD6yak6fMVw8MszVtjM4y2KxNtfMkJoH7PUQKo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);