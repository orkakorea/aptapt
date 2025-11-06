import { useEffect, useMemo, useState } from "react";

/**
 * ✅ 변경 요약
 * - .env의 VITE_KAKAO_JS_KEY가 비어 있어도, index.html의 <script id="kakao-maps-sdk">에
 *   appkey가 있으면 경고를 출력하지 않습니다.
 * - 기존 <script>에 services 라이브러리가 없으면 자동 보정하여 재주입합니다.
 * - 기존 <script>가 없으면 .env(JS 키) → 없으면 fallback 키로 동적 주입합니다.
 */

type KakaoMapsNS = { maps: any };
type WindowWithKakao = Window & { kakao?: KakaoMapsNS };

const SCRIPT_ID = "kakao-maps-sdk";

/* -------------------- 유틸 -------------------- */
function parseQuery(url: string): Record<string, string> {
  try {
    const q = url.split("?")[1] || "";
    return Object.fromEntries(new URLSearchParams(q).entries());
  } catch {
    return {};
  }
}

function buildSdkUrl(appkey: string, libraries: string[]) {
  const libSet = new Set(libraries.map((s) => s.trim()).filter(Boolean));
  libSet.add("services"); // services는 반드시
  const libs = Array.from(libSet).join(",");
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
    appkey,
  )}&autoload=false&libraries=${encodeURIComponent(libs)}`;
}

function isMapsCoreReady(w: WindowWithKakao) {
  return !!w.kakao?.maps && typeof (w.kakao as any).maps.LatLng === "function";
}
function hasServicesLibraryLoaded(w: WindowWithKakao) {
  return !!w.kakao?.maps?.services;
}

function waitForMapsLoad(w: WindowWithKakao): Promise<KakaoMapsNS> {
  return new Promise((resolve, reject) => {
    try {
      (w.kakao as any).maps.load(() => {
        if (!isMapsCoreReady(w)) {
          reject(new Error("LatLng constructor not ready after maps.load()"));
          return;
        }
        resolve(w.kakao as KakaoMapsNS);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function injectScript(src: string) {
  return new Promise<HTMLScriptElement>((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = src;
    s.onload = () => resolve(s);
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

/* -------------------- 핵심 로더 -------------------- */
async function ensureSdk(libraries: string[]): Promise<KakaoMapsNS> {
  const w = window as WindowWithKakao;

  // 0) 이미 완전 준비
  if (isMapsCoreReady(w) && hasServicesLibraryLoaded(w)) {
    return w.kakao as KakaoMapsNS;
  }

  const ex = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  const q = ex ? parseQuery(ex.src || "") : {};
  const exAppKey = q["appkey"] || "";
  const exLibs = (q["libraries"] || "").split(",").map((s) => s.trim());
  const exHasServices = exLibs.includes("services");

  // .env의 JS 키
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ENV_JS_KEY = (import.meta as any)?.env?.VITE_KAKAO_JS_KEY as string | undefined;

  // ⚠️ 경고 조건: .env도 없고, 기존 <script>에도 appkey가 전혀 없을 때만
  const shouldWarnMissingEnv = (!ENV_JS_KEY || !ENV_JS_KEY.trim()) && (!exAppKey || !exAppKey.trim());

  // 1) 기존 스크립트가 있는 경우
  if (ex) {
    // a) 아직 window.kakao가 없거나, services가 누락된 경우 → 보정
    if (!w.kakao?.maps || !hasServicesLibraryLoaded(w)) {
      // 기존 appkey 또는 ENV 또는 fallback 중 우선순위로 사용
      const appkey = (exAppKey && exAppKey.trim()) || (ENV_JS_KEY && ENV_JS_KEY.trim()) || FALLBACK_KAKAO_JS_KEY;

      if (!exHasServices) {
        // 기존 스크립트가 services 없이 로드되었으면 보정: 재주입
        try {
          ex.remove();
        } catch {}
        const url = buildSdkUrl(appkey, libraries);
        await injectScript(url);
      }
      // maps.load 대기
      return waitForMapsLoad(w);
    }

    // b) 이미 준비됨
    return w.kakao as KakaoMapsNS;
  }

  // 2) 기존 스크립트가 없으면 동적 주입
  const appkey = (ENV_JS_KEY && ENV_JS_KEY.trim()) || FALLBACK_KAKAO_JS_KEY;

  // 경고는 이 타이밍에만 (정말 .env가 비어 있고, 기존 스크립트도 없을 때)
  if (shouldWarnMissingEnv) {
    console.warn(
      "[useKakaoLoader] VITE_KAKAO_JS_KEY가 비어 있어 임시 키(FALLBACK_KAKAO_JS_KEY)를 사용합니다. 운영 배포 전 반드시 교체하세요.",
    );
  }

  const url = buildSdkUrl(appkey, libraries);
  await injectScript(url);
  return waitForMapsLoad(w);
}

/* -------------------- React Hook -------------------- */
export function useKakaoLoader(opts?: { libraries?: string[] }) {
  const [kakao, setKakao] = useState<KakaoMapsNS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memoLibs = useMemo(
    () => (opts?.libraries && opts.libraries.length ? opts.libraries : ["services", "clusterer"]),
    [opts?.libraries],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const k = await ensureSdk(memoLibs);
        if (!cancelled) setKakao(k);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [memoLibs]);

  return { kakao, loading, error, reload: () => location.reload() };
}

/** 컴포넌트 외부에서 필요 시 호출 */
export async function ensureKakaoLoaded() {
  const w = window as WindowWithKakao;
  if (isMapsCoreReady(w) && hasServicesLibraryLoaded(w)) {
    return w.kakao as KakaoMapsNS;
  }
  return ensureSdk(["services", "clusterer"]);
}
