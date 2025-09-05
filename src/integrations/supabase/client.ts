// src/integrations/supabase/client.ts
// Single source of truth for Supabase client (HMR-safe, no duplicate GoTrueClient)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// ---- Fallbacks (env 우선, 없으면 하드코딩 값 사용) ----
const SUPABASE_URL_FALLBACK = "https://qislrfbqilfqzkvkuknn.supabase.co";
const SUPABASE_ANON_FALLBACK =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpc2xyZmJxaWxmcXprdmt1a25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNTczMDUsImV4cCI6MjA3MTgzMzMwNX0.JGOsDmD6yak6fMVw8MszVtjM4y2KxNtfMkJoH7PUQKo";

const url =
  (import.meta as any).env?.VITE_SUPABASE_URL ?? SUPABASE_URL_FALLBACK;
const key =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ?? SUPABASE_ANON_FALLBACK;

// ---- HMR(개발/미리보기)에서 중복 생성을 막기 위한 전역 가드 ----
declare global {
  // eslint-disable-next-line no-var
  var __SB_CLIENT__: SupabaseClient<Database> | undefined;
}

// storageKey 를 프로젝트 전용으로 지정 (같은 도메인의 다른 앱과 충돌 방지)
const AUTH_STORAGE_KEY = 'aptapt-auth'; // 원하는 이름으로 바꿔도 됨

export const supabase: SupabaseClient<Database> =
  globalThis.__SB_CLIENT__ ??
  (globalThis.__SB_CLIENT__ = createClient<Database>(url, key, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  }));
