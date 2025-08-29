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
    // Check environment variables from the Supabase client
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    setEnvView({ url, key });
    setEnvOk(Boolean(url && key));

    // Test database connection
    (async () => {
      try {
        const { data, error } = await supabase
          .from("raw_places")
          .select('"단지명","주소",lat,lng')
          .limit(5);
        
        if (error) {
          setError(error);
        } else {
          setRows(data || []);
        }
      } catch (err) {
        setError(err);
      }
    })();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Supabase 연결 체크</h1>

      <section className="p-4 border rounded-lg mb-6 bg-card">
        <div className="font-semibold mb-3">환경변수</div>
        <div className="space-y-2 text-sm">
          <div>URL: {envView.url || "(빈 값)"}</div>
          <div>ANON: {envView.key ? mask(envView.key) : "(빈 값)"}</div>
          <div className="mt-3">
            상태: <span className={`font-semibold ${envOk ? "text-green-600" : "text-red-600"}`}>
              {envOk ? "OK" : "누락됨"}
            </span>
          </div>
        </div>
      </section>

      <section className="p-4 border rounded-lg bg-card">
        <div className="font-semibold mb-3">DB 읽기 테스트</div>
        {error ? (
          <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap overflow-auto">
            {JSON.stringify(error, null, 2)}
          </pre>
        ) : rows.length ? (
          <pre className="bg-muted p-3 rounded text-sm whitespace-pre-wrap overflow-auto">
            {JSON.stringify(rows, null, 2)}
          </pre>
        ) : (
          <div className="text-muted-foreground">불러온 행 없음 (정상일 수 있음)</div>
        )}
        <div className="text-xs text-muted-foreground mt-3">
          * 403 → 정책 문제, 401 → 키 문제, 200 + 빈 배열 → 컬럼/조건 문제
        </div>
      </section>
    </div>
  );
}