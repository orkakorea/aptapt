/**
 * Kakao Maps SDK 로더 (공용 훅)
 * - SSR 안전(브라우저에서만 동작)
 * - 중복 로딩 방지(싱글톤 Promise)
 * - 기본 라이브러리: services, clusterer
 *
 * 사용 예)
 * const { kakao, loading, error, reload } = useKakaoLoader();
 * if (kakao) {
 *   const center = new kakao.maps.LatLng(37.5665, 126.9780);
 *   const map = new kakao.maps.Map(ref.current!, { center, level: 6 });
 * }
 */

import { useEffect, useMemo, useState } from "react";

/* ============================================================
 * 타입
 * ============================================================ */
type KakaoNS = typeof window & { kakao: any };
declare global {
  interface Window {
    kakao?: any;
    __kakaoLoadingPromise?: Promise<any>;
  }
}

/* ============================================================
 * 기본 키(환경변수 없을 때)
 *  - 운영 시에는 VITE_KAKAO_JS_KEY 로 주입 권장
 * ============================================================ */
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

/* ============================================================
 * 내부 유틸: SDK 스크립트 정리/주입
 * ============================================================ */
function cleanupKakaoScripts() {
  if (typeof document === "undefined") return;
  const targets = Array.from(document.scripts).filter((s) => s.src.includes("dapi.kakao.com/v2/maps/sdk.js"));
  targets.forEach((s) => s.parentElement?.removeChild(s));

  try {
    // 윈도우 네임스페이스 정리
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).kakao = undefined;
  } catch {
    /* no-op */
  }
  // 로딩 약속도 제거
  window.__kakaoLoadingPromise = undefined;
}

function buildSdkUrl(params: { appkey: string; libraries?: string[]; autoload?: boolean }) {
  const libs = params.libraries && params.libraries.length ? params.libraries.join(",") : "services,clusterer";
  const autoload = params.autoload === false ? "false" : "true";
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
    params.appkey,
  )}&autoload=${autoload}&libraries=${encodeURIComponent(libs)}`;
}

function loadKakaoOnce(opts?: {
  appkey?: string;
  libraries?: string[];
  forceReload?: boolean; // true면 강제 재로딩(스크립트 제거 후 다시 로드)
}): Promise<any> {
  if (typeof window === "undefined") {
    // SSR: 브라우저에서만 가능
    return Promise.reject(new Error("Kakao Maps can only load in browser."));
  }
  const w = window as KakaoNS;

  // 이미 로드 완료되어 LatLng가 존재하면 즉시 resolve
  if (w.kakao?.maps && typeof w.kakao.maps.LatLng === "function") {
    return Promise.resolve(w.kakao);
  }

  // 강제 재로딩 요청 시 스크립트/네임스페이스 제거
  if (opts?.forceReload) {
    cleanupKakaoScripts();
  }

  // 진행 중인 공용 로딩 약속이 있으면 그걸 그대로 사용
  if (w.__kakaoLoadingPromise) return w.__kakaoLoadingPromise;

  // 앱키 결정(환경변수 우선)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envKey = (import.meta as any)?.env?.VITE_KAKAO_JS_KEY as string | undefined;
  const appkey = (opts?.appkey && opts.appkey.trim()) || (envKey && envKey.trim()) || FALLBACK_KAKAO_KEY;

  // 스크립트 주입
  w.__kakaoLoadingPromise = new Promise((resolve, reject) => {
    try {
      const id = "kakao-maps-sdk";
      if (document.getElementById(id)) {
        // 혹시 남아있다면 일단 제거하고 다시 주입
        document.getElementById(id)?.remove();
      }

      const s = document.createElement("script");
      s.id = id;
      s.charset = "utf-8";
      s.async = true;
      s.src = buildSdkUrl({
        appkey,
        libraries: opts?.libraries ?? ["services", "clusterer"],
        autoload: false, // load 콜백에서 초기화
      });

      s.onload = () => {
        if (!w.kakao?.maps) {
          reject(new Error("Kakao maps namespace missing"));
          return;
        }
        // autoload=false 상태에서 초기화
        w.kakao.maps.load(() => {
          if (typeof w.kakao.maps.LatLng !== "function") {
            reject(new Error("LatLng constructor not ready"));
            return;
          }
          resolve(w.kakao);
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
export function useKakaoLoader(opts?: {
  /** 커스텀 앱키(기본: VITE_KAKAO_JS_KEY → FALLBACK) */
  appkey?: string;
  /** 사용할 라이브러리(기본: ["services","clusterer"]) */
  libraries?: string[];
  /** true면 기존 스크립트를 제거 후 강제 재로딩 */
  forceReload?: boolean;
}) {
  const [kakao, setKakao] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 옵션 메모이즈(불필요 재로딩 방지)
  const memoOpts = useMemo(
    () => ({
      appkey: opts?.appkey,
      libraries: opts?.libraries ?? ["services", "clusterer"],
      forceReload: opts?.forceReload ?? false,
    }),
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

  /** 강제 재로딩: 스크립트/네임스페이스를 지우고 다시 로드 */
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
 *  - 예: 비리액트 환경의 초기화 스크립트
 * ============================================================ */
export async function ensureKakaoLoaded(opts?: {
  appkey?: string;
  libraries?: string[];
  forceReload?: boolean;
}): Promise<any> {
  return loadKakaoOnce(opts);
}

/** Kakao SDK 완전 언로드(스크립트/네임스페이스 제거) */
export function unloadKakao() {
  cleanupKakaoScripts();
}
