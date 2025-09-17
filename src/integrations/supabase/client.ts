// src/integrations/supabase/client.ts
// Single source of truth for Supabase client (HMR-safe, no duplicate GoTrueClient)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ⚠️ 보안: 하드코딩된 키/URL 절대 금지. 환경변수에서만 읽습니다.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  // 개발/배포 환경변수 누락 시 바로 원인 파악 가능하게 에러 처리
  const missing = [
    !url ? 'VITE_SUPABASE_URL' : null,
    !anon ? 'VITE_SUPABASE_ANON_KEY' : null,
  ].filter(Boolean).join(', ');
  throw new Error(`[supabase/client] Missing required env: ${missing}`);
}

// ---- HMR(개발/미리보기)에서 중복 생성을 막기 위한 전역 가드 ----
declare global {
  // eslint-disable-next-line no-var
  var __SB_CLIENT__: SupabaseClient<Database> | undefined;
}

// storageKey 를 프로젝트 전용으로 지정 (같은 도메인의 다른 앱과 충돌 방지)
const AUTH_STORAGE_KEY = 'aptapt-auth';

export const supabase: SupabaseClient<Database> =
  globalThis.__SB_CLIENT__ ??
  (globalThis.__SB_CLIENT__ = createClient<Database>(url, anon, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  }));

// 디버그/점검 편의를 위해 전역에 노출(운영 문제 없으면 유지)
;(window as any).supabase = supabase;
