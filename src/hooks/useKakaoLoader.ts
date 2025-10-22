// src/hooks/useKakaoLoader.ts
import { useEffect, useMemo, useState } from "react";

type KakaoMapsNS = { maps: any };
type WindowWithKakao = Window & {
  kakao?: KakaoMapsNS;
  __kakaoLoadingPromise?: Promise<KakaoMapsNS>;
};

const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

function buildSdkUrl(appkey: string, libraries?: string[]) {
  const libs = libraries && libraries.length ? libraries.join(",") : "services,clusterer";
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appkey)}&autoload=false&libraries=${libs}`;
}

function ensureByExistingScript(opts?: { libraries?: string[] }): Promise<KakaoMapsNS> {
  const w = window as WindowWithKakao;
  // 이미 로드 완료
  if (w.kakao?.maps && typeof (w.kakao as any).maps.LatLng === "function") {
    return Promise.resolve(w.kakao as KakaoMapsNS);
  }

  // 정적 스크립트 태그가 존재하면 그걸 기다렸다가 maps.load 호출
  const ex = document.getElementById("kakao-maps-sdk") as HTMLScriptElement | null;
  if (ex) {
    return new Promise<KakaoMapsNS>((resolve, reject) => {
      const ready = () => {
        try {
          (w.kakao as any).maps.load(() => {
            if (typeof (w.kakao as any).maps.LatLng !== "function") {
              reject(new Error("LatLng constructor not ready"));
              return;
            }
            resolve(w.kakao as KakaoMapsNS);
          });
        } catch (e) {
          reject(e);
        }
      };
      // 이미 로드된 경우
      if ((w as any).kakao?.maps) {
        ready();
      } else {
        ex.addEventListener("load", ready, { once: true });
        ex.addEventListener("error", () => reject(new Error("Failed to load Kakao Maps SDK")), { once: true });
      }
    });
  }

  // 정적 스크립트가 없으면(로컬/특수 환경) 동적 주입 시도
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envKey = (import.meta as any)?.env?.VITE_KAKAO_JS_KEY as string | undefined;
  const appkey = (envKey && envKey.trim()) || FALLBACK_KAKAO_KEY;
  const url = buildSdkUrl(appkey, opts?.libraries);

  return new Promise<KakaoMapsNS>((resolve, reject) => {
    const s = document.createElement("script");
    s.id = "kakao-maps-sdk";
    s.async = true;
    s.defer = true;
    s.src = url;
    s.onload = () => {
      const w2 = window as WindowWithKakao;
      if (!w2.kakao?.maps) {
        reject(new Error("Kakao maps namespace missing"));
        return;
      }
      (w2.kakao as any).maps.load(() => {
        if (typeof (w2.kakao as any).maps.LatLng !== "function") {
          reject(new Error("LatLng constructor not ready"));
          return;
        }
        resolve(w2.kakao as KakaoMapsNS);
      });
    };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

export function useKakaoLoader(opts?: { libraries?: string[] }) {
  const [kakao, setKakao] = useState<KakaoMapsNS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const memoLibs = useMemo(() => opts?.libraries ?? ["services", "clusterer"], [opts?.libraries]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const k = await ensureByExistingScript({ libraries: memoLibs });
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

export async function ensureKakaoLoaded() {
  const w = window as WindowWithKakao;
  if (w.kakao?.maps && typeof (w.kakao as any).maps.LatLng === "function") {
    return w.kakao as KakaoMapsNS;
  }
  return ensureByExistingScript({});
}
