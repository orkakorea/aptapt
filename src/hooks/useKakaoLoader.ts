// src/hooks/useKakaoLoader.ts
import { useEffect, useMemo, useState } from "react";

/**
 * Kakao Maps SDK 로더 (단일 진입점)
 * - index.html 에서 SDK <script>는 제거하고, 이 훅만 사용하세요.
 * - 환경변수 VITE_KAKAO_JS_KEY (Kakao Developers "JavaScript 키")가 반드시 필요합니다.
 * - 멱등 보장: 전역 Promise 캐시로 StrictMode/다중 호출에서도 1회만 로드
 * - 중복 방지: 기존 스크립트/라이브러리 검사 후 필요 시 재주입
 */

type KakaoMapsNS = { maps: any };
type WindowWithKakao = Window & {
  kakao?: KakaoMapsNS;
  __KAKAO_SDK_PROMISE__?: Promise<KakaoMapsNS>;
};

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
  // 항상 services 포함
  const libSet = new Set(libraries.map((s) => s.trim()).filter(Boolean));
  libSet.add("services");
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
          reject(new Error("[Kakao] maps.load 이후에도 코어가 준비되지 않았습니다."));
          return;
        }
        resolve(w.kakao as KakaoMapsNS);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

function injectScript(src: string) {
  return new Promise<HTMLScriptElement>((resolve, reject) => {
    const prev = document.getElementById(SCRIPT_ID);
    if (prev) prev.remove();

    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = src;
    s.onload = () => resolve(s);
    s.onerror = () => reject(new Error("[Kakao] SDK 스크립트 로드 실패"));
    document.head.appendChild(s);
  });
}

/* -------------------- 핵심 로더 -------------------- */
async function ensureSdk(libraries: string[]): Promise<KakaoMapsNS> {
  const w = window as WindowWithKakao;

  // 이미 완전 준비
  if (isMapsCoreReady(w) && hasServicesLibraryLoaded(w)) {
    return w.kakao as KakaoMapsNS;
  }

  // 동시 호출 합치기
  if (w.__KAKAO_SDK_PROMISE__) {
    return w.__KAKAO_SDK_PROMISE__;
  }

  const ENV_JS_KEY = (import.meta as any)?.env?.VITE_KAKAO_JS_KEY as string | undefined;
  if (!ENV_JS_KEY || !ENV_JS_KEY.trim()) {
    throw new Error(
      "[Kakao] VITE_KAKAO_JS_KEY 가 설정되어 있지 않습니다. Kakao Developers의 JavaScript 키를 .env에 설정해 주세요.",
    );
  }

  // 기존 스크립트 검사(있다면 라이브러리 보정)
  const existingById = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  const existingAny =
    existingById ||
    (document.querySelector('script[src*="dapi.kakao.com/v2/maps/sdk.js"]') as HTMLScriptElement | null);

  const promise = (async () => {
    if (existingAny) {
      const q = parseQuery(existingAny.src || "");
      const exLibs = (q["libraries"] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const needLibs = new Set(["services", ...libraries]);

      const hasAllLibs = Array.from(needLibs).every((lib) => exLibs.includes(lib));

      // 라이브러리가 부족하면 재주입(ENV 키로 통일)
      if (!hasAllLibs) {
        existingAny.remove();
        const url = buildSdkUrl(ENV_JS_KEY.trim(), libraries);
        await injectScript(url);
      }
      // 이미 있던 스크립트가 있고, libs도 충분하면 그대로 진행
    } else {
      // 스크립트 없음 → ENV 키로 신규 주입
      const url = buildSdkUrl(ENV_JS_KEY.trim(), libraries);
      await injectScript(url);
    }

    // maps.load 대기
    return waitForMapsLoad(w);
  })();

  w.__KAKAO_SDK_PROMISE__ = promise;
  try {
    const k = await promise;
    return k;
  } finally {
    // 성공/실패와 무관하게, 이후 호출은 최신 상태를 다시 판단하도록 캐시 유지
    // (원한다면 성공시에만 유지하고, 실패 시엔 삭제하는 패턴도 가능)
  }
}

/* -------------------- React Hook -------------------- */
export function useKakaoLoader(opts?: { libraries?: string[] }) {
  const [kakao, setKakao] = useState<KakaoMapsNS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memoLibs = useMemo(
    () => (opts?.libraries && opts.libraries.length ? opts.libraries : ["clusterer"]), // services는 내부에서 강제 포함
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
  return ensureSdk(["clusterer"]);
}
