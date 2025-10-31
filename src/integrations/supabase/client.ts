// Single source of truth for Supabase client (HMR-safe)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ────────────────────────────────────────────────────────────────
// .env 에 반드시 3개가 있어야 합니다.
// VITE_SUPABASE_URL="https://<project>.supabase.co"
// VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
// VITE_SUPABASE_ANON_KEY="eyJ..."   // ← 익명 JWT(로그아웃 상태 REST 용도 등)
// ────────────────────────────────────────────────────────────────
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined; // sb_publishable_...
const anonJwt = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined; // eyJ...

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

// ⚠️ 핵심: Authorization 전역 강제 금지! (로그인 실패 원인)
// SDK가 /auth 요청에는 Publishable 키, REST에는 세션 액세스 토큰을 자동으로 넣습니다.
export const supabase: SupabaseClient<Database> =
  globalThis.__SB_CLIENT__ ??
  (globalThis.__SB_CLIENT__ = createClient<Database>(url, publishable!, {
    global: {
      headers: {
        apikey: publishable!, // 새 Publishable 키만 고정
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
