// src/pages/SupaDebug.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function mask(s: string, head = 8, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail) return s;
  return s.slice(0, head) + "..." + s.slice(-tail);
}

type Row = { 단지명?: string; 주소?: string; lat?: number | null; lng?: number | null };

function SupaDebugPage() {
  // Vite 환경변수에서 읽기 (모듈 최상단에서 client 생성 금지!)
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
  const envOk = Boolean(envUrl && envKey);

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [error, setError] = useState<any>(null);

  async function runTest() {
    setRows([]); setCount(null); setMs(null); setError(null);

    if (!envOk) {
      setError({ message: "환경변수 누락: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY" });
      return;
    }

    let supabase: SupabaseClient;
    try {
      // ✅ 이제서야 생성 (모듈 로드시가 아니라 런타임에!)
      supabase = createClient(envUrl, envKey);
    } catch (e: any) {
      setError({ message: `createClient 실패: ${e?.message || e}` });
      return;
    }

    const t0 = performance.now();
    const { data, error, count } = await supabase
      .from("raw_places")
      .select("*", { count: "exact", head: false })
      .limit(5);
    const t1 = performance.now();
    setMs(Math.round(t1 - t0));

    if (error) setError(error);
    else { setRows(data || []); setCount(count ?? (data?.length ?? 0)); }
  }

  // 페이지 진입 시 1회 자동 실행
  useEffect(() => { if (envOk) runTest(); }, [envOk]);

  const statusText = useMemo(() => {
    if (!envOk) return "환경변수 누락";
    if (error) return `오류: ${error.status ?? ""} ${error.message ?? ""}`.trim();
    if (rows.length) return "연결 성공";
    if (count === 0) return "연결 성공(데이터 0건)";
    return "확인 중";
  }, [envOk, error, rows.length, count]);

  return (
    <div style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui", maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Supabase 연결 체크</h1>
      <div style={{ marginBottom: 8, color: "#475569" }}>
        현재 연결: {envUrl || "
