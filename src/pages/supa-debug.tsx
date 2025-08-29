// src/pages/supa-debug.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

function mask(s: string, head = 8, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail) return s;
  return s.slice(0, head) + "..." + s.slice(-tail);
}

type Row = { 단지명?: string; 주소?: string; lat?: number | null; lng?: number | null };

function SupaDebugPage() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
  const envOk = Boolean(envUrl && envKey);

  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [error, setError] = useState<any>(null);

  async function runTest() {
    setRows([]); setCount(null); setMs(null); setError(null);
    const t0 = performance.now();

    // ← 여기 쿼리만 바꿔가며 테스트하세요
    const { data, error, count } = await supabase
      .from("raw_places")
      .select("*", { count: "exact", head: false })
      .limit(5);

    const t1 = performance.now();
    setMs(Math.round(t1 - t0));

    if (error) setError(error);
    else { setRows(data || []); setCount(count ?? (data?.length ?? 0)); }
  }

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
        현재 연결: {envUrl || "(env 누락)"}
      </div>

      {/* ENV */}
      <section style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>환경변수</div>
        <div>URL: {envUrl || "(빈 값)"} </div>
        <div>ANON: {envKey ? mask(envKey) : "(빈 값)"} </div>
        <div style={{ marginTop: 6 }}>
          상태: <span style={{ fontWeight: 700, color: envOk ? "#16a34a" : "#dc2626" }}>
            {envOk ? "OK" : "누락됨"}
          </span>
        </div>
      </section>

      {/* RESULT */}
      <section style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>상태: {statusText}</div>
          <button
            onClick={runTest}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
          >
            다시 테스트
          </button>
        </div>
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
          <div style={{ color: "#64748b" }}>결과가 비어 있습니다. (정상일 수 있음)</div>
        )}

        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
          • 403 → RLS/Policy 문제, 401 → 키 문제 <br />
          • 200 + 빈 배열 → 컬럼/조건 문제 또는 다른 프로젝트에 연결됨 <br />
