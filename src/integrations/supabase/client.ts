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

// HMR-safe 전역 가드(+ 환경 변경 시 재생성)
declare global {
  // eslint-disable-next-line no-var
  var __SB__: { client: SupabaseClient<Database>; stamp: string } | undefined;
}

const AUTH_STORAGE_KEY = "aptapt-auth";
const STAMP = `${url}|${publishable}|${anonJwt}`;

function makeClient() {
  // ✔ createClient의 key는 "anon JWT"를 넣는다.
  //  - 이렇게 해야 Authorization이 세션(access token)로 자동 교체됨
  //  - apikey는 아래 global.headers에 publishable을 강제 부착
  return createClient<Database>(url!, anonJwt!, {
    global: {
      headers: {
        // 항상 apikey가 붙도록 강제 (프리뷰/번들 이슈 방지)
        apikey: publishable!,
      },
    },
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  });
}

export const supabase: SupabaseClient<Database> =
  globalThis.__SB__?.client && globalThis.__SB__?.stamp === STAMP
    ? globalThis.__SB__!.client
    : (() => {
        const client = makeClient();
        globalThis.__SB__ = { client, stamp: STAMP };
        return client;
      })();

// ✅ 프로덕션 노출 방지: 디버그 전용 window.supabase는 개발 모드에서만
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).supabase = supabase;
}

export default supabase;
