import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useKakaoLoader } from "@/hooks/useKakaoLoader";

/**
 * 🔐 중요
 * - 이전 버전처럼 Kakao REST 키를 브라우저에 하드코딩하지 않습니다.
 * - Kakao JS SDK (자바스크립트 키, 도메인 제한) 의 Geocoder를 사용합니다.
 * - useKakaoLoader 가 sdk 로더를 담당해야 하며, 'libraries=services' 옵션이 포함되어야 합니다.
 */

declare global {
  interface Window {
    kakao: any;
  }
}

/* ====== 설정값(필요 시 조정) ====== */
const PER_REQ_DELAY_MS = 300; // 요청 간 기본 딜레이(서버 과부하/쿼터 보호)
const MAX_RETRIES = 3; // 일시 오류 재시도
const BASE_BACKOFF_MS = 500; // 지수 백오프 시작(ms)

/* 유틸: sleep */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Kakao SDK 준비 대기 */
async function ensureKakaoReady(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = !!window.kakao?.maps?.services;
    if (ok) return true;
    await sleep(100);
  }
  return false;
}

/* JS SDK Geocoder로 주소 1건 변환 */
async function geocodeOneViaJsSdk(addr: string) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const geocoder = new window.kakao.maps.services.Geocoder();

      const result = await new Promise<{ lat: number | null; lng: number | null; raw?: any }>((resolve) => {
        geocoder.addressSearch(addr, (data: any[], status: string) => {
          const S = window.kakao.maps.services.Status;
          if (status === S.OK && data?.[0]) {
            resolve({
              lat: parseFloat(data[0].y),
              lng: parseFloat(data[0].x),
              raw: data[0],
            });
          } else if (status === S.ZERO_RESULT) {
            resolve({ lat: null, lng: null });
          } else {
            // ERROR 등 기타 상태 → 재시도 대상
            resolve({ lat: undefined as any, lng: undefined as any });
          }
        });
      });

      // 정상/없음 처리
      if (result.lat === null && result.lng === null) return { lat: null, lng: null };
      if (typeof result.lat === "number" && typeof result.lng === "number") return result;

      // 재시도 (ERROR 등)
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        return { lat: undefined as any, lng: undefined as any, error: "retry_exhausted" };
      }
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(wait);
    } catch {
      attempt += 1;
      if (attempt > MAX_RETRIES) return { lat: undefined as any, lng: undefined as any, error: "exception" };
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(wait);
    }
  }

  return { lat: undefined as any, lng: undefined as any, error: "unexpected" };
}

/* ====== 페이지 컴포넌트 ====== */
export default function AdminGeocode() {
  useKakaoLoader(); // SDK 로더(도메인 등록된 JS 키 사용). 반환값 없이 side-effect일 수 있음.
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  /* SDK 준비 */
  useEffect(() => {
    (async () => {
      const ok = await ensureKakaoReady();
      setSdkReady(ok);
      if (!ok) {
        setLog((l) => [
          "⚠️ Kakao SDK가 준비되지 않았습니다. useKakaoLoader가 'libraries=services'를 포함하는지 확인하세요.",
          ...l,
        ]);
      }
    })();
  }, []);

  /* 남은 pending 집계 */
  async function getPendingCount() {
    const { count, error } = await supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("geocode_status", "pending")
      .is("lat", null)
      .is("lng", null);

    if (error) {
      setLog((l) => [`집계 오류: ${error.message}`, ...l]);
    } else {
      setLeft(count ?? 0);
    }
  }

  /* 배치 실행 */
  async function runBatch(batchSize = 12) {
    if (!sdkReady) {
      setLog((l) => ["⚠️ SDK가 아직 준비되지 않았습니다.", ...l]);
      return;
    }

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

      const targets = (data ?? []).map((r) => (r.address ?? "").trim()).filter(Boolean);

      let ok = 0;
      let fail = 0;

      for (const addr of targets) {
        const r = await geocodeOneViaJsSdk(addr);

        if (r.lat === undefined && r.lng === undefined) {
          // 완전 실패(예외/재시도 초과)
          await supabase.from("places").update({ geocode_status: "fail" }).eq("address", addr);
          fail++;
          setLog((l) => [`요청 실패: ${addr} (${r.error ?? "unknown"})`, ...l]);
        } else if (r.lat === null && r.lng === null) {
          // 결과 없음
          await supabase.from("places").update({ geocode_status: "fail" }).eq("address", addr);
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

        // 과도한 연속호출 방지
        await sleep(PER_REQ_DELAY_MS + Math.floor(Math.random() * 120));
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
      <h2>지오코딩 배치 실행기 (JS SDK 사용 / REST 키 미노출)</h2>
      <p>SDK 상태: {sdkReady ? "✅ Ready" : "⏳ Loading..."}</p>
      <p>남은 pending: {left ?? "…"}</p>

      <div style={{ display: "flex", gap: 12, margin: "8px 0 16px" }}>
        <button
          disabled={running || !sdkReady}
          onClick={() => runBatch(12)} // 권장: 10~15
          style={{ padding: "8px 12px", borderRadius: 8 }}
        >
          {running ? "실행 중…" : "배치 실행(12건)"}
        </button>
        <button
          disabled={running || !sdkReady}
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
