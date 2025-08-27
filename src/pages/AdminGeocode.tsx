// src/pages/AdminGeocode.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; // 경로 별칭(@) 안 쓰는 버전

// ✅ Kakao Developers 에서 발급받은 REST API 키 (도메인 등록 필수)
const KAKAO_REST_KEY = "011e2458d92062bcccfc5a5af333df56"; // 예: 01e2458d9...

// 카카오 주소 검색 엔드포인트
const KAKAO_ADDR_URL =
  "https://dapi.kakao.com/v2/local/search/address.json?query=";

// --------- 레이트 리밋 대응 유틸 ---------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PER_REQ_DELAY_MS = 350; // 각 요청 사이 기본 지연 (429 회피)
const MAX_RETRIES = 4;        // 429 발생 시 재시도 횟수
const BASE_BACKOFF_MS = 800;  // 지수 백오프 시작값(ms)

// 1건 지오코딩 + 429 재시도 로직
async function geocodeOne(addr: string, kakaoKey: string) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(KAKAO_ADDR_URL + encodeURIComponent(addr), {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      });

      // 정상 응답
      if (res.ok) {
        const body = await res.json();
        const doc = body?.documents?.[0];
        if (doc?.x && doc?.y) {
          return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
        }
        // 결과 없음
        return { lat: null, lng: null };
      }

      // 429: Too Many Requests -> 백오프 후 재시도
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const wait = retryAfter
          ? Math.min(8000, Math.max(1000, Number(retryAfter) * 1000))
          : BASE_BACKOFF_MS * Math.pow(2, attempt); // 0.8s → 1.6s → 3.2s → 6.4s
        await sleep(wait + Math.floor(Math.random() * 200)); // 지터
        continue;
      }

      // 그 외 상태코드는 실패 취급
      return { lat: undefined, lng: undefined, error: `HTTP ${res.status}` };
    } catch (e) {
      // 네트워크/중단 등 -> 짧게 쉬고 재시도
      await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
    }
  }

  return { lat: undefined, lng: undefined, error: "retry_exhausted" };
}

// ---------- 페이지 컴포넌트 ----------
export default function AdminGeocode() {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [left, setLeft] = useState<number | null>(null);

  // 남은 pending 집계
  async function getPendingCount() {
    const { count, error } = await supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "pending")
      .is("lat", null)
      .is("lng", null);

    if (!error) setLeft(count ?? 0);
  }

  // ✅ 배치 실행 (레이트리밋/재시도 포함)
  async function runBatch(batchSize = 12) {
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

      let ok = 0;
      let fail = 0;

      // 2) 각 주소 순차 처리(속도 조절)
      for (const addr of targets) {
        const r = await geocodeOne(addr, KAKAO_REST_KEY);

        if (r.lat === undefined && r.lng === undefined) {
          // 완전 실패(네트워크/HTTP 오류/재시도 초과)
          await supabase
            .from("places")
            .update({ geocode_status: "fail" })
            .eq("address", addr);
          fail++;
          setLog((l) => [`요청 실패: ${addr} (${r.error ?? "unknown"})`, ...l]);
        } else if (r.lat === null && r.lng === null) {
          // 결과 없음
          await supabase
            .from("places")
            .update({ geocode_status: "fail" })
            .eq("address", addr);
          fail++;
        } else {
          // 성공: 좌표 업데이트
          const { error: uerr } = await supabase
            .from("places")
            .update({ lat: r.lat, lng: r.lng, geocode_status: "ok" })
            .eq("address", addr);

          if (uerr) {
            fail++;
            setLog((l) => [`업데이트 실패: ${addr} (${uerr.message})`, ...l]);
          } else {
            ok++;
          }
        }

        // 카카오 레이트리밋 보호
        await sleep(PER_REQ_DELAY_MS + Math.floor(Math.random() * 100));
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
    <div style={{ padding: 16, maxWidth: 720 }}>
      <h2>지오코딩 배치 실행기</h2>
      <p>남은 pending: {left ?? "…"}</p>

      <div style={{ display: "flex", gap: 12, margin: "8px 0 16px" }}>
        <button
          disabled={running}
          onClick={() => runBatch(12)} // 권장: 10~15
          style={{ padding: "8px 12px", borderRadius: 8 }}
        >
          {running ? "실행 중…" : "배치 실행(12건)"}
        </button>
        <button
          disabled={running}
          onClick={() => runBatch(5)}
          style={{ padding: "8px 12px", borderRadius: 8 }}
        >
          {running ? "실행 중…" : "소량 실행(5건)"}
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fafafa",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          whiteSpace: "pre-wrap",
        }}
      >
        {log.length === 0 ? "여기에 실행 로그가 표시됩니다." : log.map((ln, i) => <div key={i}>{ln}</div>)}
      </div>
    </div>
  );
}
