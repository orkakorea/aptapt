// src/pages/SupaDebug.tsx
import React, { useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Row = { 단지명?: string; 주소?: string; lat?: number | null; lng?: number | null };

function mask(s: string, head = 8, tail = 4) {
  if (!s) return ""; if (s.length <= head + tail) return s;
  return s.slice(0, head) + "..." + s.slice(-tail);
}

export default function SupaDebugPage() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
  const urlOk = /^https?:\/\/.+\.supabase\.co/.test(envUrl);
  const keyOk = /^eyJ/.test(envKey); // Supabase JWT는 보통 eyJ… 로 시작

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [error, setError] = useState<any>(null);

  async function runTest() {
    setRows([]); setCount(null); setMs(null); setError(null);

    if (!urlOk || !keyOk) {
      setError({ message: "환경변수 형식이 올바르지 않습니다. (.env에 VITE_ 접두사/값 확인)" });
      return;
    }

    let supabase: SupabaseClient;
    try { supabase = createClient(envUrl, envKey); }
    catch (e: any) { setError({ message: `createClient 실패: ${e?.message || e}` }); return; }

    const t0 = performance.now();
    const { data, error, count } = await supabase
      .from("raw_places")
      .select("*", { count: "exact", head: false })
      .limit(5);
    const t1 = performance.now();
    setMs(Math.round(t1 - t0));
    if (error) setError(error); else { setRows(data || []); setCount(count ?? (data?.length ?? 0)); }
  }

  return (
    <div style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui", maxWidth: 920, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Supabase 연결 체크</h1>

      <section style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>환경변수</div>
        <div>URL: {envUrl || "(빈 값)"} </div>
        <div>ANON: {envKey ? mask(envKey) : "(빈 값)"} </div>
        <div style={{ marginTop: 6 }}>
          상태: <b style={{ color: urlOk && keyOk ? "#16a34a" : "#dc2626" }}>
            {urlOk && keyOk ? "OK" : "누락/형식 오류"}
          </b>
        </div>
        <button onClick={runTest}
          style={{ marginTop: 10, padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}>
          다시 테스트
        </button>
      </section>

      <section style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <div style={{ color: "#475569", fontSize: 14, marginBottom: 6 }}>
          총 행 수: {count === null ? "-" : count} / 응답: {ms === null ? "-" : `${ms}ms`}
        </div>
        {error ? (
          <pre style={{ background: "#f1f5f9", padding: 10, borderRadius: 6, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : rows.length ? (
          <pre style={{ background: "#f1f5f9", padding: 10, borderRadius: 6, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(rows, null, 2)}
          </pre>
        ) : (
          <div style={{ color: "#64748b" }}>결과가 비어 있습니다.</div>
        )}
      </section>
    </div>
  );
}

