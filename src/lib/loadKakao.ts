// src/lib/loadKakao.ts
// 안전한 Kakao Maps JS SDK 로더 (중복 로딩 방지 + Promise 기반)
// 사용법:
//   import { loadKakao } from "@/lib/loadKakao";
//   await loadKakao(); // 이후 window.kakao.maps.load(() => { ... });

let kakaoPromise: Promise<typeof window.kakao> | null = null;

function getJsKey(): string {
  // 1) .env에서 읽기 (권장)
  const key = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  if (key && key !== "YOUR_KAKAO_JS_KEY") return key;

  // 2) 혹시 기존 코드에 상수 키가 있다면 이곳에 백업 키를 넣을 수 있음
  //    하지만 보안상 권장하지 않습니다. 반드시 .env를 사용하세요.
  // const FALLBACK = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // <= 지우세요
  // if (FALLBACK) return FALLBACK;

  throw new Error(
    "[KAKAO] VITE_KAKAO_JS_KEY 환경변수가 설정되어 있지 않습니다. " +
      "카카오 개발자 콘솔의 JavaScript 키를 .env 에 VITE_KAKAO_JS_KEY=... 로 넣어주세요."
  );
}

export function loadKakao(timeoutMs = 15000): Promise<typeof window.kakao> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("[KAKAO] window가 없습니다 (SSR 환경)."));
  }
  if ((window as any).kakao && (window as any).kakao.maps) {
    // 이미 로드됨
    return Promise.resolve((window as any).kakao);
  }
  if (kakaoPromise) return kakaoPromise;

  kakaoPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="dapi.kakao.com/v2/maps/sdk.js"]'
    );
    if (existing) {
      // 기존 스크립트가 있으나 아직 maps 로드 전일 수 있음
      waitForKakao(resolve, reject, timeoutMs);
      return;
    }

    const jsKey = getJsKey();
    const script = document.createElement("script");
    // autoload=false 로드 후 kakao.maps.load(...)에서 초기화
    const params = new URLSearchParams({
      appkey: jsKey,
      libraries: "services",
      autoload: "false",
    });
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      reject(new Error("[KAKAO] Kakao Maps SDK 스크립트 로드 실패"));
    };
    document.head.appendChild(script);

    waitForKakao(resolve, reject, timeoutMs);
  });

  return kakaoPromise;
}

function waitForKakao(
  resolve: (k: typeof window.kakao) => void,
  reject: (e: any) => void,
  timeoutMs: number
) {
  const started = Date.now();
  (function check() {
    const k = (window as any).kakao;
    if (k && k.maps) {
      resolve(k);
      return;
    }
    if (Date.now() - started > timeoutMs) {
      reject(
        new Error(
          "[KAKAO] SDK 로드 타임아웃. (도메인 미등록/키오류/네트워크 문제 가능)"
        )
      );
      return;
    }
    requestAnimationFrame(check);
  })();
}
