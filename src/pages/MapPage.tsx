import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

// 👉 기존 Kakao JS 앱키
const KAKAO_APP_KEY = "a53075efe7a2256480b8650cec67ebae";

type KakaoNS = typeof window & { kakao: any };

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);

  const [q, setQ] = useState<string>("");

  // queryString 읽기
  function readQuery(): string {
    const u = new URL(window.location.href);
    return (u.searchParams.get("q") || "").trim();
  }

  useEffect(() => {
    async function ensureKakao(): Promise<void> {
      if ((window as KakaoNS).kakao?.maps) return;
      await new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services,clusterer`;
        s.onload = () => (window as KakaoNS).kakao.maps.load(() => resolve());
        document.head.appendChild(s);
      });
    }

    async function init() {
      await ensureKakao();
      if (!mapRef.current) return;

      const kakao = (window as KakaoNS).kakao;
      const center = new kakao.maps.LatLng(37.5665, 126.978); // 기본 서울시청
      const map = new kakao.maps.Map(mapRef.current, { center, level: 5 });
      mapObjRef.current = map;

      // 클러스터러
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: false,
      });

      // DB의 좌표 마커 로드
      await loadAndRenderMarkers();

      // 주소 파라미터가 있으면 입력창에 세팅하고 이동
      const initial = readQuery();
      if (initial) {
        setQ(initial);
        moveToAddress(initial, { dropMarker: true });
      }
    }

    init();
  }, []);

  // Supabase에서 좌표 로드하여 클러스터링
  async function loadAndRenderMarkers() {
    const { data, error } = await supabase
      .from("places")
      .select("id,name,address,lat,lng")
      .eq("geocode_status", "ok")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .limit(2000);

    if (error) {
      console.error("Supabase select error:", error.message);
      return;
    }

    const kakao = (window as KakaoNS).kakao;
    clustererRef.current?.clear();

    const markers: any[] = [];

    (data || []).forEach((row) => {
      const pos = new kakao.maps.LatLng(row.lat, row.lng);
      const marker = new kakao.maps.Marker({
        position: pos,
        title: row.name || row.address,
      });

      // 간단 오버레이
      const content = document.createElement("div");
      content.style.padding = "8px 10px";
      content.style.borderRadius = "8px";
      content.style.background = "white";
      content.style.boxShadow = "0 2px 8px rgba(0,0,0,.15)";
      content.style.fontSize = "12px";
      content.innerHTML = `<strong>${escapeHtml(
        row.name || "단지"
      )}</strong><br/>${escapeHtml(row.address || "")}`;

      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.2,
        zIndex: 2,
      });

      kakao.maps.event.addListener(marker, "click", () => {
        const vis = (overlay as any)._visible;
        overlay.setMap(vis ? null : mapObjRef.current);
        (overlay as any)._visible = !vis;
      });

      markers.push(marker);
    });

    clustererRef.current.addMarkers(markers);
  }

  // 주소로 이동 (옵션: 검색 핀 생성)
  function moveToAddress(addr: string, opts?: { dropMarker?: boolean }) {
    const kakao = (window as KakaoNS).kakao;
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(addr, (result: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !result?.length) return;

      const { y, x } = result[0];
      const latlng = new kakao.maps.LatLng(Number(y), Number(x));

      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);

      if (opts?.dropMarker) {
        // 이전 검색 마커 제거
        if (searchMarkerRef.current) {
          searchMarkerRef.current.setMap(null);
          searchMarkerRef.current = null;
        }
        // 보라색 검색 마커
        const marker = new kakao.maps.Marker({
          position: latlng,
          image: new kakao.maps.MarkerImage(
            "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
            new kakao.maps.Size(24, 35)
          ),
          zIndex: 99,
        });
        marker.setMap(mapObjRef.current);
        searchMarkerRef.current = marker;
      }
    });
  }

  // 검색 실행 핸들러
  function onSearch() {
    const query = q.trim();
    if (!query) return;
    // URL도 동기화
    const u = new URL(window.location.href);
    u.searchParams.set("q", query);
    window.history.replaceState(null, "", u.toString());

    moveToAddress(query, { dropMarker: true });
  }

  // replaceAll 없이 안전 escape
  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {/* 상단 검색바 */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 8,
          zIndex: 10,
          background: "white",
          borderRadius: 12,
          padding: "8px 10px",
          boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          alignItems: "center",
          width: "min(720px, 90vw)",
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch();
          }}
          placeholder="예) 비산동, 강남역, 삼성로 85, ○○아파트"
          style={{
            flex: 1,
            height: 40,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "0 12px",
            fontSize: 14,
          }}
        />
        <button
          onClick={onSearch}
          style={{
            height: 40,
            padding: "0 14px",
            borderRadius: 10,
            background: "#6d28d9",
            color: "white",
            border: "none",
            fontWeight: 600,
          }}
        >
          검색
        </button>
      </div>

      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

