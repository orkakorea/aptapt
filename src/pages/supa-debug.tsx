import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function mask(s: string, head = 8, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail) return s;
  return s.slice(0, head) + "..." + s.slice(-tail);
}

type Row = { 단지명?: string; 주소?: string; lat?: number|null; lng?: number|null; };

export default function SupaDebugPage() {
  const [envOk, setEnvOk] = useState<null|boolean>(null);
  const [envView, setEnvView] = useState<{ url?: string; key?: string }>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    const url = "https://qislrfbqilfqzkvkuknn.supabase.co";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpc2xyZmJxaWxmcXprdmt1a25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNTczMDUsImV4cCI6MjA3MTgzMzMwNX0.JGOsDmD6yak6fMVw8MszVtjM4y2KxNtfMkJoH7PUQKo";
    setEnvView({ url, key });
    setEnvOk(Boolean(url && key));

    (async () => {
      const { data, error } = await supabase
        .from("raw_places")
        .select('"단지명","주소",lat,lng')
        .limit(5);
      if (error) setError(error);
      else setRows(data || []);
    })();
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Supabase 연결 체크</h1>

      <section style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>환경변수</div>
        <div>URL: {envView.url || "(빈 값)"} </div>
        <div>ANON: {envView.key ? mask(envView.key) : "(빈 값)"} </div>
        <div style={{ marginTop: 6 }}>
          상태: <span style={{ fontWeight: 600, color: envOk ? "#16a34a" : "#dc2626" }}>
            {envOk ? "OK" : "누락됨"}
          </span>
        </div>
      </section>

      <section style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>DB 읽기 테스트</div>
        {error ? (
          <pre style={{ background: "#f1f5f9", padding: 10, borderRadius: 6, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : rows.length ? (
          <pre style={{ background: "#f1f5f9", padding: 10, borderRadius: 6, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(rows, null, 2)}
          </pre>
        ) : (
          <div style={{ color: "#64748b" }}>불러온 행 없음 (정상일 수 있음)</div>
        )}
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
          * 403 → 정책 문제, 401 → 키 문제, 200 + 빈 배열 → 컬럼/조건 문제
        </div>
      </section>
    </div>
  );
}

