import { useEffect, useMemo, useState } from "react";

/**
 * useKakaoLoader (보안·안정 강화판)
 * - .env 의 VITE_KAKAO_JS_KEY만 사용 (하드코딩/폴백 키 제거)
 * - 기존 <script>가 있으면 파라미터 분석:
 *    · appkey 다르면 교체
 *    · libraries에 services 없으면 보정 후 재주입
 * - 중복 로드 방지(모듈 전역 Promise 캐싱)
 * - maps.load() 완료까지 대기
 */

type KakaoMapsNS = { maps: any };
type WindowWithKakao = Window & { kakao?: KakaoMapsNS };

const SCRIPT_ID = "kakao-maps-sdk";
const SDK_REGEX = /\/\/dapi\.kakao\.com\/v2\/maps\/sdk\.js/i;

let loaderPromise: Promise<KakaoMapsNS> | null = null;

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
  libSet.add("services"); // 필수
  const libs = Array.from(libSet).join(",");
  const qp = new URLSearchParams({
    appkey,
    autoload: "false",
    libraries: libs,
  });
  return `https://dapi.kakao.com/v2/maps/sdk.js?${qp.toString()}`;
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
          reject(new Error("Kakao maps core not ready after maps.load()"));
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
function findExistingSdkTag(): HTMLScriptElement | null {
  // 1) by ID
  const byId = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (byId) return byId;
  // 2) by src pattern (마지막 태그 우선)
  const tags = [...document.scripts] as HTMLScriptElement[];
  const matches = tags.filter((s) => SDK_REGEX.test(s.src || ""));
  return matches.at(-1) || null;
}
function maskKey(key: string) {
  const k = key.trim();
  if (k.length <= 8) return "***";
  return k.slice(0, 4) + "…" + k.slice(-4);
}

/* -------------------- 핵심 로더 -------------------- */
async function ensureSdk(libraries: string[]): Promise<KakaoMapsNS> {
  const w = window as WindowWithKakao;

  // 이미 완전 준비됨
  if (isMapsCoreReady(w) && hasServicesLibraryLoaded(w)) {
    return w.kakao as KakaoMapsNS;
  }

  // 환경변수 키
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ENV_JS_KEY = (import.meta as any)?.env?.VITE_KAKAO_JS_KEY as string | undefined;
  const envKey = (ENV_JS_KEY || "").trim();

  // 기존 태그 탐색
  let ex = findExistingSdkTag();
  const q = ex ? parseQuery(ex.src || "") : {};
  const exKey = (q["appkey"] || "").trim();
  const exLibs = (q["libraries"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const exHasServices = exLibs.includes("services");

  // 사용할 최종 키 결정: env 우선, 없으면 기존 태그 키
  const desiredKey = envKey || exKey;

  if (!desiredKey) {
    throw new Error(
      "[useKakaoLoader] JavaScript 키가 없습니다. .env의 VITE_KAKAO_JS_KEY를 설정하거나 index.html에 SDK 태그를 추가하세요.",
    );
  }

  // 기존 태그가 있고, 파라미터 점검
  if (ex) {
    const needReplaceByKey = !!exKey && !!envKey && exKey !== envKey; // 키 불일치
    const needReplaceByLib = !exHasServices; // services 누락
    if (needReplaceByKey || needReplaceByLib) {
      try {
        ex.remove();
      } catch {}
      const url = buildSdkUrl(desiredKey, libraries);
      // console.debug("[useKakaoLoader] re-inject SDK:", url.replace(desiredKey, maskKey(desiredKey)));
      await injectScript(url);
      return waitForMapsLoad(w);
    }
    // 태그는 있는데 아직 window.kakao 초기화 전인 경우 → maps.load 대기
    if (!isMapsCoreReady(w)) {
      return waitForMapsLoad(w);
    }
    if (!hasServicesLibraryLoaded(w)) {
      // services 모듈이 아직 없는 경우는 드묾. 안전하게 재주입.
      try {
        ex.remove();
      } catch {}
      const url = buildSdkUrl(desiredKey, libraries);
      await injectScript(url);
      return waitForMapsLoad(w);
    }
    // 준비 완료
    return w.kakao as KakaoMapsNS;
  }

  // 기존 태그가 없으면 신규 주입
  const url = buildSdkUrl(desiredKey, libraries);
  // console.debug("[useKakaoLoader] inject SDK:", url.replace(desiredKey, maskKey(desiredKey)));
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

    if (!loaderPromise) {
      loaderPromise = ensureSdk(memoLibs);
    }

    loaderPromise
      .then((k) => {
        if (!cancelled) setKakao(k);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [memoLibs]);

  return { kakao, loading, error, reload: () => location.reload() };
}

/** 컴포넌트 외부에서도 강제 보장 필요 시 */
export async function ensureKakaoLoaded() {
  if (!loaderPromise) {
    loaderPromise = ensureSdk(["services", "clusterer"]);
  }
  return loaderPromise;
}
