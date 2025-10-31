import { useEffect, useMemo, useState } from "react";

/**
 * ✅ 이 로더가 보장하는 것
 * 1) Kakao Maps SDK가 반드시 `libraries=services`(+ clusterer) 포함으로 로드됩니다.
 * 2) index.html에 미리 넣은 <script id="kakao-maps-sdk">가 있어도,
 *    libraries가 빠져 있으면 자동으로 보정(재로드)합니다.
 * 3) 키는 오직 "자바스크립트 키"만 사용합니다. (REST 키 금지)
 */

type KakaoMapsNS = { maps: any };
type WindowWithKakao = Window & {
  kakao?: KakaoMapsNS;
};

const SCRIPT_ID = "kakao-maps-sdk";

/** ⚠️ 로컬 임시 키: 반드시 카카오 디벨로퍼스에서 발급받은 JS 키를 .env로 설정하세요. */
const FALLBACK_KAKAO_JS_KEY = "a53075efe7a2256480b8650cec67ebae";

/* =========================================================
 * 유틸
 * ========================================================= */
function parseQuery(url: string): Record<string, string> {
  try {
    const q = url.split("?")[1] || "";
    return Object.fromEntries(new URLSearchParams(q).entries());
  } catch {
    return {};
  }
}

function buildSdkUrl(appkey: string, libraries: string[]) {
  // 중복 제거 + 정렬(캐시 안정화)
  const libSet = new Set(libraries.map((s) => s.trim()).filter(Boolean));
  // services는 반드시 있어야 함
  libSet.add("services");
  const libs = Array.from(libSet).join(",");

  // autoload=false 로 불러온 뒤, maps.load()로 초기화
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
    appkey,
  )}&autoload=false&libraries=${encodeURIComponent(libs)}`;
}

function hasServicesLibraryLoaded(w: WindowWithKakao) {
  return !!w.kakao?.maps?.services;
}

function isMapsCoreReady(w: WindowWithKakao) {
  return !!w.kakao?.maps && typeof (w.kakao as any).maps.LatLng === "function";
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

/**
 * SDK를 보정하여 로드한다.
 * - index.html에 기존 스크립트가 있으면 분석 후 사용/보정
 * - 없으면 동적 주입
 */
async function ensureSdk(libraries: string[]): Promise<KakaoMapsNS> {
  const w = window as WindowWithKakao;

  // 0) 이미 완전히 준비됨
  if (isMapsCoreReady(w) && hasServicesLibraryLoaded(w)) {
    return w.kakao as KakaoMapsNS;
  }

  const ex = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

  // .env의 JS 키
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ENV_JS_KEY = (import.meta as any)?.env?.VITE_KAKAO_JS_KEY as string | undefined;
  const APPKEY = (ENV_JS_KEY && ENV_JS_KEY.trim()) || FALLBACK_KAKAO_JS_KEY;
  if (!ENV_JS_KEY) {
    // 개발 중 안내용. 운영에서는 반드시 .env에 설정하세요.
    console.warn(
      "[useKakaoLoader] VITE_KAKAO_JS_KEY가 비어 있어 임시 키(FALLBACK_KAKAO_JS_KEY)를 사용합니다. 운영 배포 전 반드시 교체하세요.",
    );
  }

  // 1) 기존 스크립트가 있는 경우
  if (ex) {
    const q = parseQuery(ex.src || "");
    const exAppKey = q["appkey"];
    const exLibs = (q["libraries"] || "").split(",").map((s) => s.trim());
    const exHasServices = exLibs.includes("services");

    // a) 아직 window.kakao가 없고, scripts가 로드 완료되지 않았다면:
    //    libraries에 services가 없으면 보정해서 다시 주입
    if (!w.kakao?.maps) {
      if (!exHasServices) {
        // 기존 스크립트 제거 후, 올바른 라이브러리로 재주입
        ex.remove();
        const url = buildSdkUrl(exAppKey || APPKEY, libraries);
        await injectScript(url);
      }
      // maps.load() 호출 대기
      return waitForMapsLoad(w);
    }

    // b) window.kakao는 있는데 services가 없다 → 라이브러리 누락
    if (!hasServicesLibraryLoaded(w)) {
      // 보정: 올바른 라이브러리로 다시 한 번 로드(중복 로드 허용)
      const url = buildSdkUrl(exAppKey || APPKEY, libraries);
      await injectScript(url);
      return waitForMapsLoad(w);
    }

    // c) 이미 services까지 준비 → 그대로 반환
    return w.kakao as KakaoMapsNS;
  }

  // 2) 기존 스크립트가 없으면 동적 주입
  const url = buildSdkUrl(APPKEY, libraries);
  await injectScript(url);
  return waitForMapsLoad(w);
}

/* =========================================================
 * React Hook
 * ========================================================= */
export function useKakaoLoader(opts?: { libraries?: string[] }) {
  const [kakao, setKakao] = useState<KakaoMapsNS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 기본 라이브러리: services + clusterer (중복 제거 로직이 있으므로 순서는 무관)
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

/**
 * 컴포넌트 외부(비리액트)에서 SDK 보장 호출이 필요할 때 사용.
 * 단, 가능하면 상단의 useKakaoLoader 훅을 사용하세요.
 */
export async function ensureKakaoLoaded() {
  const w = window as WindowWithKakao;
  if (isMapsCoreReady(w) && hasServicesLibraryLoaded(w)) {
    return w.kakao as KakaoMapsNS;
  }
  return ensureSdk(["services", "clusterer"]);
}
