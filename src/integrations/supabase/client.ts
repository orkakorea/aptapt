// src/integrations/supabase/client.ts
// Single source of truth for Supabase client (HMR-safe)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ────────────────────────────────────────────────────────────────
// 반드시 .env에 아래 3개가 있어야 합니다.
// VITE_SUPABASE_URL="https://<project>.supabase.co"
// VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
// VITE_SUPABASE_ANON_KEY="eyJ..."   ← 익명 JWT(길고 점 2개 포함)
// ────────────────────────────────────────────────────────────────
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined; // sb_publishable_...
const anonJwt = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined; // eyJ... (JWT)

if (!url || !publishable || !anonJwt) {
  const missing = [
    !url ? "VITE_SUPABASE_URL" : null,
    !publishable ? "VITE_SUPABASE_PUBLISHABLE_KEY" : null,
    !anonJwt ? "VITE_SUPABASE_ANON_KEY" : null,
  ]
    .filter(Boolean)
    .join(", ");
  throw new Error(`[supabase/client] Missing required env: ${missing}`);
}

// HMR-safe 전역 가드
declare global {
  // eslint-disable-next-line no-var
  var __SB_CLIENT__: SupabaseClient<Database> | undefined;
}

const AUTH_STORAGE_KEY = "aptapt-auth";

export const supabase: SupabaseClient<Database> =
  globalThis.__SB_CLIENT__ ??
  (globalThis.__SB_CLIENT__ = createClient<Database>(url, publishable!, {
    // ⚠️ 핵심: Authorization에는 익명 JWT(eyJ...)를 강제
    global: {
      headers: {
        apikey: publishable!, // Publishable 키(신규)
        Authorization: `Bearer ${anonJwt!}`, // JWT(익명). 이게 있어야 RLS가 정상 동작
      },
    },
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  }));

// 디버깅 편의
(window as any).supabase = supabase;

export default supabase;
