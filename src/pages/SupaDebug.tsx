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
        현재 연결: {envUrl || "없음"}
      </div>
      <div style={{ marginBottom: 16, fontSize: 14 }}>
        상태: <span style={{ fontWeight: 600, color: error ? "#dc2626" : rows.length ? "#16a34a" : "#6b7280" }}>
          {statusText}
        </span>
        {ms !== null && <span style={{ color: "#6b7280", marginLeft: 8 }}>({ms}ms)</span>}
      </div>
      
      <button 
        onClick={runTest}
        style={{ 
          padding: "8px 16px", 
          backgroundColor: "#2563eb", 
          color: "white", 
          border: "none", 
          borderRadius: "6px",
          cursor: "pointer",
          marginBottom: "16px"
        }}
      >
        다시 테스트
      </button>

      {error && (
        <div style={{ 
          padding: 12, 
          backgroundColor: "#fef2f2", 
          border: "1px solid #fecaca", 
          borderRadius: 6, 
          marginBottom: 16,
          color: "#dc2626"
        }}>
          오류: {JSON.stringify(error, null, 2)}
        </div>
      )}

      {rows.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            데이터 (총 {count}건 중 최대 5건)
          </h3>
          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <th style={{ border: "1px solid #e2e8f0", padding: 8, textAlign: "left" }}>단지명</th>
                  <th style={{ border: "1px solid #e2e8f0", padding: 8, textAlign: "left" }}>주소</th>
                  <th style={{ border: "1px solid #e2e8f0", padding: 8, textAlign: "left" }}>좌표</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.단지명 || "-"}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.주소 || "-"}</td>
                    <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                      {row.lat && row.lng ? `${row.lat.toFixed(6)}, ${row.lng.toFixed(6)}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, backgroundColor: "#f8fafc", borderRadius: 6, fontSize: 12, color: "#64748b" }}>
        <div>URL: {mask(envUrl, 8, 4)}</div>
        <div>Key: {mask(envKey, 8, 4)}</div>
      </div>
    </div>
  );
}

export default SupaDebugPage;
