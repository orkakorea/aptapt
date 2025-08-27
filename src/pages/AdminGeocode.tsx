// src/pages/AdminGeocode.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const KAKAO_REST_KEY = "YOUR_KAKAO_REST_KEY"; // Replace with actual key

const KAKAO_ADDR_URL =
  "https://dapi.kakao.com/v2/local/search/address.json?query=";

export default function AdminGeocode() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [left, setLeft] = useState<number | null>(null);

  async function getPendingCount() {
    const { count, error } = await supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "pending")
      .is("lat", null)
      .is("lng", null);
    if (!error) setLeft(count ?? 0);
  }

  async function runBatch(batchSize = 20) {
    setRunning(true);
    try {
      // 1) pending 일부 가져오기
      const { data, error } = await supabase
        .from("places")
        .select("address")
        .eq("geocode_status", "pending")
        .is("lat", null)
        .is("lng", null)
        .not("address", "is", null)
        .limit(batchSize);

      if (error) {
        setLog((l) => [`선택 오류: ${error.message}`, ...l]);
        return;
      }

      const targets = (data ?? [])
        .map((r) => (r.address ?? "").trim())
        .filter(Boolean);

      let ok = 0,
        fail = 0;

      // 2) 카카오 지오코딩 + 좌표 업데이트
      for (const addr of targets) {
        try {
          const res = await fetch(KAKAO_ADDR_URL + encodeURIComponent(addr), {
            headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
          });
          const body = await res.json();
          const doc = body?.documents?.[0];

          if (doc?.x && doc?.y) {
            const lat = parseFloat(doc.y);
            const lng = parseFloat(doc.x);
            const { error: uerr } = await supabase
              .from("places")
              .update({ lat, lng, geocode_status: "ok" })
              .eq("address", addr);
            if (uerr) {
              fail++;
              setLog((l) => [`업데이트 실패: ${addr} (${uerr.message})`, ...l]);
            } else {
              ok++;
            }
          } else {
            await supabase
              .from("places")
              .update({ geocode_status: "fail" })
              .eq("address", addr);
            fail++;
          }
        } catch (e: any) {
          await supabase
            .from("places")
            .update({ geocode_status: "fail" })
            .eq("address", addr);
          fail++;
        }
        // 레이트리밋 보호 (느리면 80→120~150ms로)
        await new Promise((r) => setTimeout(r, 80));
      }

      setLog((l) => [`Batch 완료: ok=${ok}, fail=${fail}`, ...l]);
      await getPendingCount();
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    getPendingCount();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2>지오코딩 배치 실행기</h2>
      <p>남은 pending: {left ?? "…"}</p>

      <button
        disabled={running}
        onClick={() => runBatch(20)}
        style={{ padding: "8px 12px", borderRadius: 8 }}
      >
        {running ? "실행 중…" : "배치 실행(20건)"}
      </button>

      <button
        disabled={running}
        onClick={() => runBatch(5)}
        style={{ padding: "8px 12px", marginLeft: 8, borderRadius: 8 }}
      >
        {running ? "실행 중…" : "소량 실행(5건)"}
      </button>

      <div
        style={{
          marginTop: 16,
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
        }}
      >
        {log.map((ln, i) => (
          <div key={i}>{ln}</div>
        ))}
      </div>
    </div>
  );
}