// src/pages/MapPage.tsx
import React, { useEffect, useRef } from "react";
import MapChrome from "../components/MapChrome";

// Kakao JS SDK 로더 (중복 로드 방지)
function loadKakao(): Promise<any> {
  const w = window as any;
  if (w.kakao?.maps) return Promise.resolve(w.kakao);

  const key = import.meta.env.VITE_KAKAO_JS_KEY as string;
  if (!key) return Promise.reject(new Error("VITE_KAKAO_JS_KEY is missing"));

  return new Promise((resolve, reject) => {
    const scriptId = "kakao-maps-sdk";
    if (document.getElementById(scriptId)) {
      const tryLoad = () => w.kakao?.maps ? resolve(w.kakao) : setTimeout(tryLoad, 50);
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
    let resizeHandler: any;

    loadKakao()
      .then((kakao) => {
        if (!mapRef.current) return;

        // 서울시청 기준(원하면 바꾸세요)
        const center = new kakao.maps.LatLng(37.5665, 126.9780);
        map = new kakao.maps.Map(mapRef.current, {
          center,
          level: 7,
        });

        // 리사이즈 시 레이아웃 갱신
        resizeHandler = () => {
          if (!map) return;
          map.relayout();
        };
        window.addEventListener("resize", resizeHandler);

        // 최초 1회 레이아웃 보정
        setTimeout(() => map && map.relayout(), 0);
      })
      .catch((err) => {
        console.error("[KakaoMap] load error:", err);
      });

    return () => {
      window.removeEventListener("resize", resizeHandler);
      // kakao map은 명시적인 destroy가 없어도 DOM 제거로 정리됨
    };
  }, []);

  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 지도: 상단바(64px)와 좌측패널(360px) 공간을 제외한 나머지 영역을 채움 */}
      <div
        ref={mapRef}
        className="fixed top-16 left-[360px] right-0 bottom-0 z-[10]"
        aria-label="map"
      />

      {/* 오버레이 UI (상단바 + 좌측 패널) */}
      <MapChrome />
    </div>
  );
}
