/**
 * Kakao Maps SDK 로더 (공용 훅) — 충돌 없는 버전
 * - 전역 kakao 타입 선언을 하지 않아 TS2687 에러가 나지 않습니다.
 * - 브라우저에서만 동작(SSR 안전 가드 포함)
 * - 중복 로딩 방지(싱글톤 Promise)
 */

import { useEffect, useMemo, useState } from "react";

/* ============================================================
 * 로컬 타입(전역 선언 X : Window에 캐스팅만)
 * ============================================================ */
type KakaoMapsNS = { maps: any };
type WindowWithKakao = Window & {
  kakao?: KakaoMapsNS;
  __kakaoLoadingPromise?: Promise<KakaoMapsNS>;
};

/* ============================================================
 * 기본 키(환경변수 없을 때)
 * ============================================================ */
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480cec67ebae";

/* ============================================================
 * 내부 유틸: SDK 스크립트 정리/주입
 * ============================================================ */
function cleanupKakaoScripts() {
  if (typeof document === "undefined") return;
  const targets = Array.from(document.scripts).filter((s) => s.src.includes("dapi.kakao.com/v2/maps/sdk.js"));
  targets.forEach((s) => s.parentElement?.removeChild(s));

  // 전역 네임스페이스 정리(타입 충돌 방지를 위해 any 캐스팅)
  (window as WindowWithKakao).kakao = undefined;
  (window as WindowWithKakao).__kakaoLoadingPromise = undefined;
}

function buildSdkUrl(params: { appkey: string; libraries?: string[]; autoload?: boolean }) {
  const libs = params.libraries && params.libraries.length ? params.libraries.join(",") : "services,clusterer";
  const autoload = params.autoload === false ? "false" : "true";
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
    params.appkey,
  )}&autoload=${autoload}&libraries=${encodeURIComponent(libs)}`;
}

function loadKakaoOnce(opts?: { appkey?: string; libraries?: string[]; forceReload?: boolean }): Promise<KakaoMapsNS> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Kakao Maps can only load in browser."));
  }
  const w = window as WindowWithKakao;

  // 이미 로드됨
  if (w.kakao?.maps && typeof (w.kakao as any).maps.LatLng === "function") {
    return Promise.resolve(w.kakao as KakaoMapsNS);
  }

  // 강제 재로딩이면 정리
  if (opts?.forceReload) cleanupKakaoScripts();

  // 진행 중인 공용 로딩이 있으면 재사용
  if (w.__kakaoLoadingPromise) return w.__kakaoLoadingPromise;

  // 앱키 결정(환경변수 우선)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envKey = (import.meta as any)?.env?.VITE_KAKAO_JS_KEY as string | undefined;
  const appkey = (opts?.appkey && opts.appkey.trim()) || (envKey && envKey.trim()) || FALLBACK_KAKAO_KEY;

  // 스크립트 주입 + 초기화
  w.__kakaoLoadingPromise = new Promise<KakaoMapsNS>((resolve, reject) => {
    try {
      const id = "kakao-maps-sdk";
      document.getElementById(id)?.remove();

      const s = document.createElement("script");
      s.id = id;
      s.charset = "utf-8";
      s.async = true;
      s.src = buildSdkUrl({
        appkey,
        libraries: opts?.libraries ?? ["services", "clusterer"],
        autoload: false, // 로드 후 kakao.maps.load에서 초기화
      });

      s.onload = () => {
        const wk = (window as WindowWithKakao).kakao;
        if (!wk?.maps) {
          reject(new Error("Kakao maps namespace missing"));
          return;
        }
        // autoload=false → 수동 초기화
        (wk as any).maps.load(() => {
          if (typeof (wk as any).maps.LatLng !== "function") {
            reject(new Error("LatLng constructor not ready"));
            return;
          }
          resolve(wk as KakaoMapsNS);
        });
      };
      s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });

  return w.__kakaoLoadingPromise;
}

/* ============================================================
 * 외부에 제공하는 훅
 * ============================================================ */
export function useKakaoLoader(opts?: { appkey?: string; libraries?: string[]; forceReload?: boolean }) {
  const [kakao, setKakao] = useState<KakaoMapsNS | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 옵션 메모이즈(불필요 재로딩 방지)
  const memoOpts = useMemo(
    () => ({
      appkey: opts?.appkey,
      libraries: opts?.libraries ?? ["services", "clusterer"],
      forceReload: opts?.forceReload ?? false,
    }),
    // libraries 배열 비교를 간단히 serialize (작은 배열 전제)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts?.appkey, JSON.stringify(opts?.libraries), opts?.forceReload],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadKakaoOnce(memoOpts)
      .then((k) => {
        if (!cancelled) {
          setKakao(k);
          setLoading(false);
        }
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [memoOpts]);

  /** SDK 강제 재로딩 */
  const reload = async () => {
    try {
      setLoading(true);
      setError(null);
      cleanupKakaoScripts();
      const k = await loadKakaoOnce({
        appkey: memoOpts.appkey,
        libraries: memoOpts.libraries,
        forceReload: true,
      });
      setKakao(k);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return { kakao, loading, error, reload };
}

/* ============================================================
 * 훅 없이도 쓰고 싶을 때용 헬퍼 (선택)
 * ============================================================ */
export async function ensureKakaoLoaded(opts?: {
  appkey?: string;
  libraries?: string[];
  forceReload?: boolean;
}): Promise<KakaoMapsNS> {
  return loadKakaoOnce(opts);
}

/** Kakao SDK 완전 언로드(스크립트/네임스페이스 제거) */
export function unloadKakao() {
  cleanupKakaoScripts();
}
