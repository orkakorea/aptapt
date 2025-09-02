// src/pages/MapPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import MapChrome from "../components/MapChrome";

/** Kakao + Supabase 유틸 */
type KakaoNS = typeof window & { kakao: any };

// ❗ env가 비어 있으면 임시 키 사용 (배포 전 .env 로 옮기세요)
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("[MapPage] Supabase env missing:", { url, key: !!key });
    return null;
  }
  try {
    return createClient(url, key);
  } catch (e) {
    console.error("[MapPage] createClient failed:", e);
    return null;
  }
}

function loadKakao(): Promise<any> {
  const w = window as any;
  if (w.kakao?.maps) return Promise.resolve(w.kakao);

  const envKey = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  const key = envKey && envKey.trim().length > 0 ? envKey : FALLBACK_KAKAO_KEY;
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
    s.onload = () => {
      if (!w.kakao) return reject(new Error("kakao object not found"));
      w.kakao.maps.load(() => resolve(w.kakao));
    };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

/** HTML escape */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);

  // 안정성용
  const openOverlaysRef = useRef<any[]>([]);
  const lastReqIdRef = useRef<number>(0);
  const idleTimer = useRef<number | null>(null);

  const [q, setQ] = useState("");

  /** idle 디바운스 */
  function debounceIdle(fn: () => void, ms = 300) {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(fn, ms);
  }

  /** URL ?q 동기화 */
  function readQuery() {
    const u = new URL(window.location.href);
    return (u.searchParams.get("q") || "").trim();
  }
  function writeQuery(v: string) {
    const u = new URL(window.location.href);
    if (v) u.searchParams.set("q", v);
    else u.searchParams.delete("q");
    window.history.replaceState(null, "", u.toString());
  }

  /** 초기화 */
  useEffect(() => {
    let resizeHandler: any;
    let map: any;

    loadKakao()
      .then((kakao) => {
        if (!mapRef.current) return;

        const center = new kakao.maps.LatLng(37.5665, 126.9780); // 서울시청
        map = new kakao.maps.Map(mapRef.current, { center, level: 6 });
        mapObjRef.current = map;

        // Places / Clusterer
        placesRef.current = new kakao.maps.services.Places();
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: false,
        });

        // idle 시 현재 바운드 재조회
        kakao.maps.event.addListener(map, "idle", () => {
          debounceIdle(loadMarkersInBounds, 300);
        });

        // 첫 레이아웃 보정 + 첫 로드
        setTimeout(() => map && map.relayout(), 0);
        loadMarkersInBounds();

        // ?q 초기 검색
        const initial = readQuery();
        if (initial) {
          setQ(initial);
          keywordSearch(initial, { dropMarker: true });
        }

        // 리사이즈 대응
        resizeHandler = () => map && map.relayout();
        window.addEventListener("resize", resizeHandler);
      })
      .catch((err) => console.error("[KakaoMap] load error:", err));

    return () => {
      window.removeEventListener("resize", resizeHandler);
    };
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
    if (!client) return; // env 없으면 조용히 패스(지도/검색만 동작)

    const reqId = Date.now();
    lastReqIdRef.current = reqId;

    const { data, error } = await client
      .from("raw_places")
      .select('"단지명","주소",lat,lng') // 한글 컬럼은 반드시 쌍따옴표
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", sw.getLat())
      .lte("lat", ne.getLat())
      .gte("lng", sw.getLng())
      .lte("lng", ne.getLng())
      .limit(2000);

    if (reqId !== lastReqIdRef.current) return; // 오래된 응답 무시
    if (error) {
      console.error("Supabase select error:", error.message);
      return;
    }

    // 기존 오버레이 정리
    openOverlaysRef.current.forEach((o) => o.setMap(null));
    openOverlaysRef.current = [];

    const markers = (data || []).map((row: any) => {
      const pos = new kakao.maps.LatLng(row.lat, row.lng);
      const title = row["단지명"] || row["주소"] || "";

      const marker = new kakao.maps.Marker({ position: pos, title });

      const content = document.createElement("div");
      content.style.padding = "8px 10px";
      content.style.borderRadius = "8px";
      content.style.background = "white";
      content.style.boxShadow = "0 2px 8px rgba(0,0,0,.15)";
      content.style.fontSize = "12px";
      content.innerHTML = `<strong>${escapeHtml(row["단지명"] || "단지")}</strong><br/>${escapeHtml(
        row["주소"] || ""
      )}`;

      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.2,
        zIndex: 100,
      });

      kakao.maps.event.addListener(marker, "click", () => {
        const isOpen = (overlay as any)._visible;
        if (isOpen) {
          overlay.setMap(null);
          openOverlaysRef.current = openOverlaysRef.current.filter((o) => o !== overlay);
        } else {
          overlay.setMap(mapObjRef.current);
          openOverlaysRef.current.push(overlay);
        }
        (overlay as any)._visible = !isOpen;
      });

      return marker;
    });

    if (clustererRef.current) {
      clustererRef.current.clear();
      if (markers.length) clustererRef.current.addMarkers(markers);
    }
  }

  /** Kakao Places 검색 */
  function keywordSearch(query: string, opts?: { dropMarker?: boolean }) {
    const kakao = (window as KakaoNS).kakao;
    const places = placesRef.current;
    if (!places) return;

    places.keywordSearch(query, (results: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !results?.length) return;
      const first = results[0];
      const lat = Number(first.y);
      const lng = Number(first.x);
      if (isNaN(lat) || isNaN(lng)) return;

      const latlng = new kakao.maps.LatLng(lat, lng);
      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);

      if (opts?.dropMarker) {
        if (searchMarkerRef.current) {
          searchMarkerRef.current.setMap(null);
          searchMarkerRef.current = null;
        }
        const marker = new kakao.maps.Marker({
          position: latlng,
          image: new kakao.maps.MarkerImage(
            "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
            new kakao.maps.Size(24, 35)
          ),
          zIndex: 999,
        });
        marker.setMap(mapObjRef.current);
        searchMarkerRef.current = marker;
      }

      // 이동 후 현재 바운드에 맞춰 아파트 핀 재로드
      loadMarkersInBounds();
    });
  }

  /** (선택) 외부에서 쓰고 싶다면 MapChrome에 prop으로 연결 예정 */
  function onSearch() {
    const query = q.trim();
    if (!query) return;
    writeQuery(query);
    keywordSearch(query, { dropMarker: true });
  }

  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 지도: 모바일에선 좌패널 없음 → left-0, 데스크탑(md↑) 360px 여백 */}
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

