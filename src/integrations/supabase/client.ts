// src/integrations/supabase/client.ts
// Single source of truth for Supabase client (HMR-safe)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// ────────────────────────────────────────────────────────────────
// .env 에 반드시 아래 3개가 있어야 합니다.
// VITE_SUPABASE_URL="https://<project>.supabase.co"
// VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
// VITE_SUPABASE_ANON_KEY="eyJ..."   ← 익명 JWT
// ────────────────────────────────────────────────────────────────
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
const publishable = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "";
const anonJwt = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";

// ❗ 빌드/분석기에서 터지지 않도록 "예외를 던지지" 말고 경고만 남깁니다.
const hasEnv = !!(url && publishable && anonJwt);
if (!hasEnv) {
  // 이 경고는 콘솔에만 남고, 런타임에서는 동작(네트워크 호출 시 실패)하도록 둡니다.
  // 빌더는 이 파일을 임포트만 해도 지나가야 하므로 throw 금지!
  // eslint-disable-next-line no-console
  console.warn("[supabase/client] Missing env. Build will continue with placeholders.");
}

// HMR-safe 전역 가드
declare global {
  // eslint-disable-next-line no-var
  var __SB_CLIENT__: SupabaseClient<Database> | undefined;
}

const AUTH_STORAGE_KEY = "aptapt-auth";

// Node(분석기)에서 localStorage/window가 없어도 안전하도록 가드
const safeStorage = typeof window !== "undefined" && "localStorage" in window ? window.localStorage : undefined;

// 공통 fetch 래퍼: 헤더를 안전하게 세팅
function withAuthHeaders(input: RequestInfo | URL, init?: RequestInit) {
  const reqUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

  const h = new Headers(init?.headers ?? {});
  // 항상 최신 Publishable 키 설정
  if (publishable) h.set("apikey", publishable);

  // Auth 엔드포인트는 Publishable 키를 Authorization에 사용해야 함
  if (reqUrl.includes("/auth/v1/")) {
    if (publishable) h.set("Authorization", `Bearer ${publishable}`);
  } else {
    // 그 외 REST 호출은 세션 토큰이 없을 때만 익명 JWT로 보정
    if (!h.has("Authorization") && anonJwt) {
      h.set("Authorization", `Bearer ${anonJwt}`);
    }
  }

  return { ...init, headers: h };
}

export const supabase: SupabaseClient<Database> =
  globalThis.__SB_CLIENT__ ??
  (globalThis.__SB_CLIENT__ = createClient<Database>(
    // 빌더가 넘어가도록 placeholder도 허용
    hasEnv ? url : "https://placeholder.supabase.co",
    hasEnv ? publishable : "sb_publishable_placeholder",
    {
      global: {
        headers: {
          // 기본 apikey (Authorization은 fetch 래퍼에서 분기)
          apikey: publishable || "sb_publishable_placeholder",
        },
        // Authorization 헤더 분기( /auth/v1/* vs 그 외 )를 일괄 적용
        fetch: (input, init) => fetch(input as any, withAuthHeaders(input, init)),
      },
      auth: {
        storage: safeStorage, // Node에서도 안전
        persistSession: true,
        autoRefreshToken: true,
        storageKey: AUTH_STORAGE_KEY,
      },
    },
  ));

// 디버깅 편의 (Node 분석기에서 window가 없어 터지지 않도록 가드)
if (typeof window !== "undefined") {
  (window as any).supabase = supabase;
}

export default supabase;
