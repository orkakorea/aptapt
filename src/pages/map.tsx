import React, { useEffect, useRef, FormEvent, useState } from "react";

declare global { interface Window { kakao: any } }

export default function MapPage() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string; // ← 교체
const url = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`; // ← 교체

    const onload = () => window.kakao.maps.load(() => {
      if (!mapDivRef.current) return;
const { kakao } = window as any; // ← "const kakao = window;" 절대 금지
      const map = new kakao.maps.Map(
        mapDivRef.current,
        { center: new kakao.maps.LatLng(37.5665, 126.9780), level: 5 }
      );
      new kakao.maps.Marker({ position: new kakao.maps.LatLng(37.5665, 126.9780) }).setMap(map);
      setLoaded(true);
    });

    const exist = document.querySelector(`script[src^="${url}"]`) as HTMLScriptElement | null;
    if (exist) exist.addEventListener("load", onload);
    else {
      const s = document.createElement("script");
      s.src = url; s.async = true; s.onload = onload;
      document.head.appendChild(s);
    }
  }, []);

  return (
    <div style={{ width: "100%", minHeight: "100vh" }}>
      {!loaded && <div style={{padding:12}}>지도를 불러오는 중…</div>}
      <div ref={mapDivRef} style={{ width: "100%", height: "100vh" }} />
    </div>
  );
}
useEffect(() => {
  const el = mapDivRef.current;
  if (!el) return;

  const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
  if (!KAKAO_JS_KEY) {
    console.warn("VITE_KAKAO_JS_KEY not set");
  }

  const w = window as any;
  const init = () => {
    if (!w.kakao?.maps || !mapDivRef.current) return;
    const center = new w.kakao.maps.LatLng(37.5665, 126.9780);
    const map = new w.kakao.maps.Map(mapDivRef.current, { center, level: 6 });
    // 선택: 마커 표시
    const marker = new w.kakao.maps.Marker({ position: center });
    marker.setMap(map);
    setLoaded(true);
  };

  const ensureKakao = async () => {
    // 이미 로드됨
    if (w.kakao?.maps) {
      // autoload=false 환경에서도 안전하게
      if (typeof w.kakao.maps.load === "function") w.kakao.maps.load(init);
      else init();
      return;
    }

    // 기존 스크립트가 있는지 확인
    const exist = document.querySelector<HTMLScriptElement>(
      'script[src*="//dapi.kakao.com/v2/maps/sdk.js"]'
    );

    const onLoad = () => {
      if (typeof w.kakao?.maps?.load === "function") w.kakao.maps.load(init);
      else init();
    };

    if (exist) {
      // 이미 붙어있으면: load 이벤트 등록 + 혹시 이미 로드완료면 즉시 실행
      exist.addEventListener("load", onLoad, { once: true });
      if (w.kakao?.maps) onLoad();
      return;
    }

    // 새로 붙이기 (autoload=false)
    const s = document.createElement("script");
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    s.async = true;
    s.onerror = () => {
      console.error("Kakao SDK load failed");
    };
    s.onload = onLoad;
    document.head.appendChild(s);
  };

  setLoaded(false);
  ensureKakao();
}, []);
