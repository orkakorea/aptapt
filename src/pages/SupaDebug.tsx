// src/pages/SupaDebug.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Row = {
  단지명?: string;
  주소?: string;
  lat?: number | null;
  lng?: number | null;
  geocode_status?: string;
};

function mask(s: string, head = 8, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail) return s;
  return s.slice(0, head) + "..." + s.slice(-tail);
}

function getFunctionsBase(supaUrl: string): string {
  try {
    const host = new URL(supaUrl).hostname; // qislrfbqilfqzkvkuknn.supabase.co
    const ref = host.split(".")[0];         // qislrfbqilfqzkvkuknn
    return "https://" + ref + ".functions.supabase.co";
  } catch {
    return "";
  }
}

export default function SupaDebugPage() {
  const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
  const envOk = Boolean(supaUrl && anonKey);
  const funcBase = getFunctionsBase(supaUrl);

  const [rows, setRows] = useState<Row[]>([]);
  const [lastRun, setLastRun] = useState<any>(null);
  const [counts, setCounts] = useState({
    ok: 0,
    pending: 0,
    notfound: 0,
    errors: 0,
    total: 0,
  });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<any>(null);

  const sbRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    if (!envOk) return;
    const sb = createClient(supaUrl, anonKey);
    sbRef.current = sb;

    (async () => {
      await refreshCounts();
      const { data } = await sb
        .from("raw_places")
        .select('"단지명","주소",lat,lng,geocode_status')
        .limit(5);
      setRows(data || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envOk]);

  async function refreshCounts() {
    if (!sbRef.current) return;
    const sb = sbRef.current;

    const base = sb
      .from("raw_places")
      .select("geocode_status", { count: "exact", head: true });

    const [total, ok, notfound, errors, pending] = await Promise.all([
      base,
      sb
        .from("raw_places")
        .select("geocode_status", { count: "exact", head: true })
        .eq("geocode_status", "ok"),
      sb
        .from("raw_places")
        .select("geocode_status", { count: "exact", head: true })
        .eq("geocode_status", "notfound"),
      sb
        .from("raw_places")
        .select("geocode_status", { count: "exact", head: true })
        .like("geocode_status", "error_%"),
      sb
        .from("raw_places")
        .select("geocode_status", { count: "exact", head: true })
        .or("geocode_status.is.null,geocode_status.eq.pending"),
    ]);

    setCounts({
      ok: ok.count || 0,
      notfound: notfound.count || 0,
      errors: errors.count || 0,
      pending: pending.count || 0,
      total: total.count || 0,
    });
  }

  async function runOnce(limit = 25) {
    setError(null);
    if (!funcBase) {
      setError({ message: "functions base URL 파싱 실패" });
      return;
    }
    const res = await fetch(funcBase + "/geocode_pending?limit=" + String(limit));
    const json = await res.json();
    setLastRun(json);
    await refreshCounts();
    return json;
  }

  async function runAuto(opts?: {
    limit?: number;
    rounds?: number;
    intervalMs?: number;
  }) {
    const limit = opts?.limit ?? 25;
    const rounds = opts?.rounds ?? 40;
    const intervalMs = opts?.intervalMs ?? 2000;

    if (running) return;
    setRunning(true);
    try {
      for (let i = 0; i < rounds; i++) {
        await runOnce(limit);
        if (counts.pending === 0) break;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    } finally {
      setRunning(false);
    }
  }

  const statusText = useMemo(() => (envOk ? "OK" : "누락됨"), [envOk]);

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "ui-sans-serif, system-ui",
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        Supabase 연결 체크
      </h1>

      <section
        style={{
          padding: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>환경변수</div>
        <div>URL: {supaUrl || "(빈 값)"}</div>
        <div>ANON: {anonKey ? mask(anonKey) : "(빈 값)"}</div>
        <div>Functions: {funcBase || "(파싱 실패)"}</div>
        <div style={{ marginTop: 6 }}>
          상태:{" "}
          <b style={{ color: envOk ? "#16a34a" : "#dc2626" }}>{statusText}</b>
        </div>
      </section>

      <section
        style={{
          padding: 12,
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>진행률</div>
          <div>
            ok: <b>{counts.ok}</b>
          </div>
          <div>
            pending: <b>{counts.pending}</b>
          </div>
          <div>
            notfound: <b>{counts.notfound}</b>
          </div>
          <div>
            errors: <b>{counts.errors}</b>
          </div>
          <div>
            total: <b>{counts.total}</b>
          </div>
          <button
            onClick={refreshCounts}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            새로고침
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => runOnce(25)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: "#6d28d9",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
            }}
          >
            지오코딩 25개 실행 (1회)
          </button>
          <button
            disabled={running}
            onClick={() =>
              runAuto({ limit: 25, rounds: 40, intervalMs: 2000 })
            }
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              background: running ? "#a78bfa" : "#4f46e5",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              cursor: running ? "default" : "pointer",
            }}
          >
            자동 실행 25개 × 40회
          </button>
        </div>

        {lastRun && (
          <pre
            style={{
              marginTop: 10,
              background: "#f1f5f9",
              padding: 10,
              borderRadius: 6,
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(lastRun, null, 2)}
          </pre>
        )}
      </section>

      <section
        style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>샘플(최대 5행)</div>
        {error ? (
          <pre
            style={{
              background: "#f1f5f9",
              padding: 10,
              borderRadius: 6,
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : rows.length ? (
          <pre
            style={{
              background: "#f1f5f9",
              padding: 10,
              borderRadius: 6,
              whiteSpace: "pre-wrap",
            }}
          >
            {JSON.stringify(rows, null, 2)}
          </pre>
        ) : (
          <div style={{ color: "#64748b" }}>불러온 행 없음</div>
        )}
      </section>
    </div>
  );
}

