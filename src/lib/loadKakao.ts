// src/lib/loadKakao.ts

type KakaoNS = typeof window & { kakao: any };

const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

/**
 * Dynamically loads the Kakao Maps SDK
 * @returns Promise that resolves to the kakao object when SDK is loaded
 */
export function loadKakao(): Promise<any> {
  const w = window as any;
  
  // If kakao maps is already loaded, return it
  if (w.kakao?.maps) return Promise.resolve(w.kakao);
  
  // Get API key from environment or use fallback
  const envKey = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  const key = envKey && envKey.trim() ? envKey : FALLBACK_KAKAO_KEY;
  
  return new Promise((resolve, reject) => {
    const id = "kakao-maps-sdk";
    
    // If script is already being loaded, wait for it
    if (document.getElementById(id)) {
      const tryLoad = () => (w.kakao?.maps ? resolve(w.kakao) : setTimeout(tryLoad, 50));
      return tryLoad();
    }
    
    // Create and inject script tag
    const script = document.createElement("script");
    script.id = id;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    
    script.onload = () => {
      if (!w.kakao) return reject(new Error("kakao object not found"));
      w.kakao.maps.load(() => resolve(w.kakao));
    };
    
    script.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    
    document.head.appendChild(script);
  });
}

export type { KakaoNS };