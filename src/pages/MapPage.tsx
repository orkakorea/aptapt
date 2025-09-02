// src/pages/MapPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import MapChrome, { SelectedApt } from "../components/MapChrome";

type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

// --- Supabase ---
function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("[MapPage] Supabase env missing:", { url, hasKey: !!key });
    return null;
  }
  try { return createClient(url, key); } catch { return null; }
}

// --- Kakao loader (HTTPS 고정 + 중복 방지) ---
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
    // ✅ 혼합콘텐츠 방지: https 명시
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    s.onload = () => { if (!w.kakao) return reject(new Error("kakao object not found")); w.kakao.maps.load(() => resolve(w.kakao)); };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

// --- URL ?q ---
function readQuery() {
  const u = new URL(window.location.href);
  return (u.searchParams.get("q") || "").trim();
}
function writeQuery(v: string) {
  const u = new URL(window.location.href);
  if (v) u.searchParams.set("q", v); else u.searchParams.delete("q");
  window.history.replaceState(null, "", u.toString());
}

// 숫자/키 유틸
function toNum(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}
function getField(obj: any, keys: string[]): any {
  for (const k of keys) if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  return undefined;
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const lastReqIdRef = useRef<number>(0);
  const idleTimer = useRef<number | null>(null);

  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [initialQ, setInitialQ] = useState("");
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  function debounceIdle(fn: () => void, ms = 300) {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(fn, ms);
  }

  // 지도 초기화
  useEffect(() => {
    let resizeHandler: any;
    let map: any;

    loadKakao()
      .then((kakao) => {
        setKakaoError(null);
        if (!mapRef.current) return;

        // 🔒 map div가 0px 되는 걸 방지: 최소 높이/폭 강제
        mapRef.current.style.minHeight = "300px";
        mapRef.current.style.minWidth = "300px";

        const center = new kakao.maps.LatLng(37.5665, 126.9780);
        map = new kakao.maps.Map(mapRef.current, { center, level: 6 });
        mapObjRef.current = map;

        placesRef.current = new kakao.maps.services.Places();
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map, averageCenter: true, minLevel: 6, disableClickZoom: false,
        });

        kakao.maps.event.addListener(map, "idle", () => debounceIdle(loadMarkersInBounds, 300));

        // 첫 보정 + 첫 로드
        setTimeout(() => map && map.relayout(), 0);
        loadMarkersInBounds();

        // 초기 ?q
        const q0 = readQuery();
        setInitialQ(q0);
        if (q0) runPlaceSearch(q0);

        resizeHandler = () => map && map.relayout();
        window.addEventListener("resize", resizeHandler);
      })
      .catch((err) => {
        console.error("[KakaoMap] load error:", err);
        setKakaoError(err?.message || String(err));
      });

    return () => window.removeEventListener("resize", resizeHandler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2탭 열고 닫힐 때 레이아웃 보정
  useEffect(() => {
    const m = mapObjRef.current;
    if ((window as any).kakao?.maps && m) setTimeout(() => m.relayout(), 0);
  }, [selected]);

  // 바운드 내 마커 로드 (안전 select('*') + 키 매핑)
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

    let data: any[] | null = null;
    let { data: d1, error: e1 } = await client
      .from("raw_places")
      .select("*")
      .not("lat", "is", null).not("lng", "is", null)
      .gte("lat", sw.getLat()).lte("lat", ne.getLat())
      .gte("lng", sw.getLng()).lte("lng", ne.getLng())
      .limit(2000);

    if (e1) {
      console.warn("select(*) failed:", e1.message);
      const { data: d2, error: e2 } = await client
        .from("raw_places")
        .select('"단지명","주소",lat,lng')
        .not("lat", "is", null).not("lng", "is", null)
        .gte("lat", sw.getLat()).lte("lat", ne.getLat())
        .gte("lng", sw.getLng()).lte("lng", ne.getLng())
        .limit(2000);
      if (e2) { console.error("fallback select failed:", e2.message); return; }
      data = d2 ?? [];
    } else {
      data = d1 ?? [];
    }

    if (reqId !== lastReqIdRef.current) return;

    const markers = data.map((row: any) => {
      const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
      const address = getField(row, ["주소", "address"]) || "";
      const households = toNum(getField(row, ["세대수", "세대 수", "households"]));
      const residents = toNum(getField(row, ["거주인원", "거주 인원", "residents"]));
      const monitors = toNum(getField(row, ["모니터수량", "모니터 수량", "모니터대수", "monitors"]));
      const monthlyImpressions = toNum(getField(row, ["월 송출횟수", "월송출횟수", "월_송출횟수", "monthlyImpressions"]));
      const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
      const productName = getField(row, ["상품명", "상품 명", "productName"]) || "";

      const kakao = (window as KakaoNS).kakao;
      const pos = new kakao.maps.LatLng(row.lat, row.lng);
      const marker = new kakao.maps.Marker({ position: pos, title: name });

      // 마커 클릭 → 지도 오버레이 없이 2탭 열기
      kakao.maps.event.addListener(marker, "click", () => {
        setSelected({
          name, address, productName,
          households, residents, monitors, monthlyImpressions, hours,
          lat: row.lat, lng: row.lng,
        });
      });

      return marker;
    });

    if (clustererRef.current) {
      clustererRef.current.clear();
      if (markers.length) clustererRef.current.addMarkers(markers);
    }
  }

  // Kakao Places 검색 → 이동 후 핀 갱신
  function runPlaceSearch(query: string) {
    const kakao = (window as KakaoNS).kakao;
    const places = placesRef.current;
    if (!places) return;
    places.keywordSearch(query, (results: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !results?.length) return;
      const first = results[0];
      const lat = Number(first.y), lng = Number(first.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const latlng = new kakao.maps.LatLng(lat, lng);
      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);
      loadMarkersInBounds();
    });
  }
  function handleSearch(query: string) { writeQuery(query); runPlaceSearch(query); }
  function closeSelected() { setSelected(null); }

  const mapLeftClass = selected ? "md:left-[720px]" : "md:left-[360px]";

  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 지도 컨테이너: fixed + 확실한 영역 */}
      <div
        ref={mapRef}
        className={`fixed top-16 left-0 right-0 bottom-0 z-[10] ${mapLeftClass}`}
        aria-label="map"
      />
      <MapChrome
        selected={selected}
        onCloseSelected={closeSelected}
        onSearch={handleSearch}
        initialQuery={initialQ}
      />

      {/* (선택) 에러 토스트 */}
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError}
        </div>
      )}
    </div>
  );
}

