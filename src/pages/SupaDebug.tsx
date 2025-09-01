// src/pages/SupaDebug.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type Row = { 단지명?: string; 주소?: string; lat?: number | null; lng?: number | null };

function mask(s: string, head = 8, tail = 4) {
  if (!s) return ""; if (s.length <= head + tail) return s;
  return s.slice(0, head) + "..." + s.slice(-tail);
}

function deriveFunctionsBase(supaUrl: string) {
  try {
    const host = new URL(supaUrl).hostname;             // qislrfbqilfqzkvkuknn.supabase.co
    const ref = host.split(".")[0];                     // qislrfbqilfqzkvkuknn
    return `https://${ref}.functions.supabase.co`;
  } catch { return ""; }
}

export default function SupaDebugPage() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
  const envOk  = Boolean(envUrl && envKey);
  const funcBase = deriveFunctionsBase(envUrl);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<any>(null);

  const [counts, setCounts] = useState<{ok:number; pending:number; notfound:number; errors:number; total:number}>({
    ok:0, pending:0, notfound:0, errors:0, total:0
  });
  const [lastRun, setLastRun] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const supaRef = useRef<SupabaseClient | null>(null);
  useEffect(() => {
    if (!envOk) return;
    supaRef.current = createClient(envUrl, envKey);
    refreshCounts();
    // 샘플 5행
    (async () => {
      const { data } = await supaRef.current!
        .from("raw_places").select('"단지명","주소",lat,lng,geocode_status').limit(5);
      setRows(data || []);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envOk]);

  async function refreshCounts() {
    if (!supaRef.current) return;
    const sb = supaRef.current;
    const get = (filter?: (q:any)=>any) =>
      filter ? filter(sb.from("raw_places").select("geocode_status", { count: "exact", head: true })) 
             : sb.from("raw_places").select("geocode_status", { count: "exact", head: true });

    const [{ count: total }, { count: ok }, { count: notfound }, { count: errors }, { count: pending }] =
      await Promise.all([
        get(),
        get(q => q.eq("geocode_status","ok")),
        get(q => q.eq("geocode_status","notfound")),
        get(q => q.like("geocode_status","error_%")),
        get(q => q.or("geocode_status.is.null,geocode_status.eq.pending")),
      ]);

    setCounts({
      ok: ok ?? 0,
      notfound: notfound ?? 0,
      errors: errors ?? 0,
      pending: pending ?? 0,
      total: total ?? 0
    });
  }

  async function runOnce(limit=25) {
    setError(null);
    if (!funcBase) { setError({ message: "functions base URL 파싱 실패" }); return; }
    const r = await fetch(`${funcBase}/geocode_pending?limit=${limit}`);
    const j = await r.json();
    setLastRun(j);
    await refreshCounts();
    return j;
  }

  async function runAuto({limit=25, rounds=20, intervalMs=2000}: {limit:number; rounds:number; intervalMs:number}) {
    if (running) return;
    setRunning(true);
    try {
      for (let i=0; i<rounds; i++) {
        const j = await runOnce(limit);
        // 남은게 없으면 조기 종료
        if ((counts.pending ?? 0) === 0) break;
        await new Promise(res => setTimeout(res, intervalMs));
      }
    } finally {
      setRunning(false);
    }
  }

  const statusText = useMemo(() => envOk ? "OK" : "누락됨", [envOk]);

  return (
    <div style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui", maxWidth: 980, margin: "0

