// src/integrations/supabase/client.ts
// Single source of truth for Supabase client (HMR-safe)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ────────────────────────────────────────────────────────────────
// 반드시 .env에 아래 3개가 있어야 합니다.
// VITE_SUPABASE_URL="https://<project>.supabase.co"
// VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
// VITE_SUPABASE_ANON_KEY="eyJ..."   ← 익명 JWT(점 2개 포함)
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

// 현재 세션 액세스 토큰 캐시 (REST에만 사용)
let currentAccessToken: string | null = null;

// REST와 AUTH를 분리: /rest/v1 에만 Authorization 지정
function buildFetchWithHeaderBranch() {
  return async (input: RequestInfo, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    const isRest = urlStr.includes("/rest/v1/");

    const headers = new Headers(init?.headers || {});
    // 모든 요청에 퍼블리셔블 키는 포함
    headers.set("apikey", publishable!);

    if (isRest) {
      // REST에는 세션 토큰(로그인시) 또는 익명 JWT(비로그인시)를 보냄
      const token = currentAccessToken ?? anonJwt!;
      headers.set("Authorization", `Bearer ${token}`);
    }
    // AUTH(/auth/v1)는 건드리지 않음 → 라이브러리가 자체적으로 Bearer <publishable> 사용

    return fetch(input as any, { ...init, headers });
  };
}

export const supabase: SupabaseClient<Database> =
  globalThis.__SB_CLIENT__ ??
  (globalThis.__SB_CLIENT__ = createClient<Database>(url, publishable!, {
    global: {
      // ⚠️ 전역 Authorization은 절대 넣지 말 것!
      fetch: buildFetchWithHeaderBranch(),
    },
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  }));

// 최초 로드 시 세션 토큰 캐싱
supabase.auth.getSession().then(({ data: { session } }) => {
  currentAccessToken = session?.access_token ?? null;
});

// 로그인/로그아웃/리프레시 시 토큰 갱신
supabase.auth.onAuthStateChange((_e, session) => {
  currentAccessToken = session?.access_token ?? null;
});

// 디버깅 편의
(window as any).supabase = supabase;

export default supabase;
