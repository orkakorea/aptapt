// src/pages/MapPage.tsx
import React, { useEffect, useRef } from "react";
import MapChrome from "../components/MapChrome";

// ❗ 임시: env가 비어 있으면 하드코드 키로 fallback (나중에 .env로 옮기세요)
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

// Kakao JS SDK 로더 (중복 로드 방지)
function loadKakao(): Promise<any> {
  const w = window as any;
  if (w.kakao?.maps) return Promise.resolve(w.kakao);

  const envKey = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  const key = envKey && envKey.trim().length > 0 ? envKey : FALLBACK_KAKAO_KEY;
  if (!key) return Promise.reject(new Error("KAKAO JS KEY missing"));

  return new Promise((resolve, reject) => {
    const scriptId = "kakao-maps-sdk";
    if (document.getElementById(scriptId)) {
      const tryLoad = () => (w.kakao?.maps ? resolve(w.kakao) : setTimeout(tryLoad, 50));
      return tryLoad();
    }
    const s = document.createElement("script");
    s.id = scriptId;
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    s.onload = () => {
      if (!w.kakao) return reject(new Error("kakao object not found"));
      w.kakao.maps.load(() => resolve(w.kakao));
    };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let map: any;
    const handleResize = () => {
      // 지도 컨테이너가 레이아웃 기반 크기라 relayout 필요
      if (map) map.relayout();
    };

    loadKakao()
      .then((kakao) => {
        if (!mapRef.current) return;

        // 초기 중심: 서울시청
        const center = new kakao.maps.LatLng(37.5665, 126.9780);
        map = new kakao.maps.Map(mapRef.current, { center, level: 7 });

        // 첫 페인트 뒤 1회 보정
        setTimeout(() => map && map.relayout(), 0);

        // 리사이즈 대응
        window.addEventListener("resize", handleResize);
      })
      .catch((err) => {
        console.error("[KakaoMap] load error:", err);
      });

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 지도: 모바일에선 좌패널 제거 가정 → left-0, 데스크탑(md↑)에선 360px 여백 */}
      <div
        ref={mapRef}
        className="fixed top-16 left-0 md:left-[360px] right-0 bottom-0 z-[10]"
        aria-label="map"
      />

      {/* 오버레이 UI (상단바 + 좌측 패널) */}
      <MapChrome />
    </div>
  );
}
