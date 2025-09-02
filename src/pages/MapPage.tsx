// src/pages/MapPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import MapChrome, { SelectedApt } from "../components/MapChrome";

type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("[MapPage] Supabase env missing:", { url, hasKey: !!key });
    return null;
  }
  try { return createClient(url, key); } catch (e) { console.error(e); return null; }
}

function loadKakao(): Promise<any> {
  const w = window as any;
  if (w.kakao?.maps) return Promise.resolve(w.kakao);
  const envKey = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  const key = envKey && envKey.trim() ? envKey : FALLBACK_KAKAO_KEY;
  if (!key) return Promise.reject(new Error("KAKAO JS KEY missing"));

  return new Promise((resolve, reject) => {
    const id = "kakao-maps-sdk";
    if (document.getElementById(id)) {
      const tryLoad = () => (w.kakao?.maps ? resolve(w.kakao) : setTimeout(tryLoad, 50));
      return tryLoad();
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    s.onload = () => { if (!w.kakao) return reject(new Error("kakao object not found")); w.kakao.maps.load(() => resolve(w.kakao)); };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);

  const lastReqIdRef = useRef<number>(0);
  const idleTimer = useRef<number | null>(null);

  // ✅ 선택된 단지 → 2탭 표시에 사용
  const [selected, setSelected] = useState<SelectedApt | null>(null);

  function debounceIdle(fn: () => void, ms = 300) {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(fn, ms);
  }

  useEffect(() => {
    let resizeHandler: any;
    let map: any;

    loadKakao()
      .then((kakao) => {
        if (!mapRef.current) return;
        const center = new kakao.maps.LatLng(37.5665, 126.9780); // 서울시청
        map = new kakao.maps.Map(mapRef.current, { center, level: 6 });
        mapObjRef.current = map;

        placesRef.current = new kakao.maps.services.Places();
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map, averageCenter: true, minLevel: 6, disableClickZoom: false,
        });

        kakao.maps.event.addListener(map, "idle", () => debounceIdle(loadMarkersInBounds, 300));

        setTimeout(() => map && map.relayout(), 0); // 첫 보정
        loadMarkersInBounds();

        resizeHandler = () => map && map.relayout();
        window.addEventListener("resize", resizeHandler);
      })
      .catch((err) => console.error("[KakaoMap] load error:", err));

    return () => window.removeEventListener("resize", resizeHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 바운드 내 마커 로드(Supabase) */
  async function loadMarkersInBounds() {
    const kakao = (window as KakaoNS).kakao;
    const map = mapObjRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const client = getSupabase();
    if (!client) return;

    const reqId = Date.now();
    lastReqIdRef.current = reqId;

    const { data, error } = await client
      .from("raw_places")
      .select('"단지명","주소",lat,lng')
      .not("lat", "is", null).not("lng", "is", null)
      .gte("lat", sw.getLat()).lte("lat", ne.getLat())
      .gte("lng", sw.getLng()).lte("lng", ne.getLng())
      .limit(2000);

    if (reqId !== lastReqIdRef.current) return;
    if (error) { console.error("Supabase select error:", error.message); return; }

    const markers = (data || []).map((row: any) => {
      const kakao = (window as KakaoNS).kakao;
      const pos = new kakao.maps.LatLng(row.lat, row.lng);
      const name = row["단지명"] || "";
      const address = row["주소"] || "";

      const marker = new kakao.maps.Marker({ position: pos, title: name });

      // ✅ 마커 클릭 → 지도 오버레이 없이 2탭 열기
      kakao.maps.event.addListener(marker, "click", () => {
        setSelected({ name, address, lat: row.lat, lng: row.lng });
      });

      return marker;
    });

    if (clustererRef.current) {
      clustererRef.current.clear();
      if (markers.length) clustererRef.current.addMarkers(markers);
    }
  }

  // 2탭 닫기
  function closeSelected() {
    setSelected(null);
  }

  // 지도 컨테이너: 2탭 열림 여부에 따라 좌측 오프셋 변경 (360px vs 720px)
  const mapLeftClass = selected ? "md:left-[720px]" : "md:left-[360px]";

  return (
    <div className="w-screen h-[100dvh] bg-white">
      <div
        ref={mapRef}
        className={`fixed top-16 left-0 right-0 bottom-0 z-[10] ${mapLeftClass}`}
        aria-label="map"
      />
      <MapChrome selected={selected} onCloseSelected={closeSelected} />
    </div>
  );
}

