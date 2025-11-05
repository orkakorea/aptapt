// src/pages/AdminGeocode.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useKakaoLoader } from "@/hooks/useKakaoLoader";

/**
 * AdminGeocode (안전강화판)
 * - REST 키 하드코딩 금지(오직 Kakao JS SDK)
 * - useKakaoLoader 가 반드시 libraries=services 를 포함해야 함
 * - 주소/좌표 1차 검증(프론트) + DB 업데이트 시 보수적 WHERE 조건으로 레이스 방지
 */

declare global {
  interface Window {
    kakao: any;
  }
}

/* ===== 결과 타입 ===== */
type GeocodeResultOk = { lat: number; lng: number; raw?: any; error?: undefined };
type GeocodeResultNone = { lat: null; lng: null; error?: undefined };
type GeocodeResultFail = { lat: undefined; lng: undefined; error: string };
type GeocodeResult = GeocodeResultOk | GeocodeResultNone | GeocodeResultFail;

/* ===== 설정 ===== */
const PER_REQ_DELAY_MS = 300; // 개별 요청 간 최소 지연
const MAX_RETRIES = 3; // 지오코딩 재시도 횟수
const BASE_BACKOFF_MS = 500; // 지수 백오프 시작값(ms)

/* ===== 입력/값 검증 유틸 ===== */
function isFiniteNumber(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isValidLat(lat: any): lat is number {
  return isFiniteNumber(lat) && lat >= -90 && lat <= 90;
}
function isValidLng(lng: any): lng is number {
  return isFiniteNumber(lng) && lng >= -180 && lng <= 180;
}
function isValidAddress(addr: any): addr is string {
  if (typeof addr !== "string") return false;
  const t = addr.trim();
  return t.length > 0 && t.length <= 200;
}

/* ===== 공통 유틸 ===== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureKakaoReady(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = !!window.kakao?.maps?.services;
    if (ok) return true;
    await sleep(100);
  }
  return false;
}

/* ===== JS SDK 지오코딩 (단건) ===== */
async function geocodeOneViaJsSdk(addr: string): Promise<GeocodeResult> {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      const geocoder = new window.kakao.maps.services.Geocoder();

      const result: GeocodeResult = await new Promise((resolve) => {
        geocoder.addressSearch(addr, (data: any[], status: string) => {
          const S = window.kakao.maps.services.Status;
          if (status === S.OK && data?.[0]) {
            const lat = parseFloat(data[0].y);
            const lng = parseFloat(data[0].x);
            resolve({ lat, lng, raw: data[0] });
          } else if (status === S.ZERO_RESULT) {
            resolve({ lat: null, lng: null });
          } else {
            // ERROR 등 기타 상태 → 재시도
            resolve({ lat: undefined as unknown as undefined, lng: undefined as unknown as undefined, error: "error" });
          }
        });
      });

      // 정상/없음/오류 처리 분기
      if ("error" in result) {
        // 재시도
      } else if (result.lat === null && result.lng === null) {
        return result; // ZERO_RESULT
      } else if (typeof result.lat === "number" && typeof result.lng === "number") {
        return result; // 성공
      }

      // 재시도
      attempt += 1;
      if (attempt > MAX_RETRIES) {
        return {
          lat: undefined as unknown as undefined,
          lng: undefined as unknown as undefined,
          error: "retry_exhausted",
        };
      }
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(wait);
    } catch {
      attempt += 1;
      if (attempt > MAX_RETRIES)
        return { lat: undefined as unknown as undefined, lng: undefined as unknown as undefined, error: "exception" };
      const wait = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
      await sleep(wait);
    }
  }

  return { lat: undefined as unknown as undefined, lng: undefined as unknown as undefined, error: "unexpected" };
}

/* ===== 페이지 컴포넌트 ===== */
export default function AdminGeocode() {
  useKakaoLoader(); // 도메인 등록된 JavaScript 키로 SDK 로드(libraries=services 필수)
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

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

  async function runBatch(batchSize = 12) {
    if (!sdkReady) {
      setLog((l) => ["⚠️ SDK가 아직 준비되지 않았습니다.", ...l]);
      return;
    }

    setRunning(true);
    try {
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

      // 주소 1차 검증(공백/길이)
      const rawTargets = (data ?? []).map((r) => r.address ?? "");
      const targets = rawTargets
        .map((addr) => addr.trim())
        .filter((addr) => {
          const valid = isValidAddress(addr);
          if (!valid) setLog((l) => [`⚠️ 무효 주소 스킵(공백/200자 초과): ${addr}`, ...l]);
          return valid;
        });

      let ok = 0;
      let fail = 0;

      for (const addr of targets) {
        const r = await geocodeOneViaJsSdk(addr);

        if ("error" in r) {
          // 완전 실패(예외/재시도 초과)
          await supabase
            .from("places")
            .update({ geocode_status: "fail" })
            .eq("address", addr)
            .eq("geocode_status", "pending")
            .is("lat", null)
            .is("lng", null);
          fail++;
          setLog((l) => [`요청 실패: ${addr} (${r.error})`, ...l]);
        } else if (r.lat === null && r.lng === null) {
          // 결과 없음
          await supabase
            .from("places")
            .update({ geocode_status: "fail" })
            .eq("address", addr)
            .eq("geocode_status", "pending")
            .is("lat", null)
            .is("lng", null);
          fail++;
        } else {
          // ✅ 좌표 검증: 범위 벗어나면 업데이트하지 않음
          if (!isValidLat(r.lat) || !isValidLng(r.lng)) {
            await supabase
              .from("places")
              .update({ geocode_status: "fail" })
              .eq("address", addr)
              .eq("geocode_status", "pending")
              .is("lat", null)
              .is("lng", null);
            fail++;
            setLog((l) => [`⚠️ 좌표 범위 위반으로 실패: ${addr} (lat=${r.lat}, lng=${r.lng})`, ...l]);
          } else {
            // 성공 업데이트 (보수적 WHERE로 레이스 방지)
            const { error: uerr } = await supabase
              .from("places")
              .update({ lat: r.lat, lng: r.lng, geocode_status: "ok" })
              .eq("address", addr)
              .eq("geocode_status", "pending")
              .is("lat", null)
              .is("lng", null);

            if (uerr) {
              fail++;
              setLog((l) => [`업데이트 실패: ${addr} (${uerr.message})`, ...l]);
            } else {
              ok++;
            }
          }
        }

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
      <p>남은 pending: {left ?? "…"} 건</p>

      <div style={{ display: "flex", gap: 12, margin: "8px 0 16px" }}>
        <button
          disabled={running || !sdkReady}
          onClick={() => runBatch(12)}
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
