import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// 👉 기존에 쓰던 Kakao JS 앱키를 넣으세요.
const KAKAO_APP_KEY = "a53075efe7a2256480b8650cec67ebae";

type KakaoNS = typeof window & {
  kakao: any;
};

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const clustererRef = useRef<any>(null);
  const mapObjRef = useRef<any>(null);

  // 쿼리스트링 ?q=검색어 지원
  function getQuery() {
    const u = new URL(window.location.href);
    const q = (u.searchParams.get("q") || "").trim();
    return q;
  }

  useEffect(() => {
    async function ensureKakao(): Promise<void> {
      if ((window as KakaoNS).kakao?.maps) return;

      await new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.async = true;
        // services(지오코더) + clusterer(클러스터러)
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services,clusterer`;
        s.onload = () => {
          (window as KakaoNS).kakao.maps.load(() => resolve());
        };
        document.head.appendChild(s);
      });
    }

    async function init() {
      await ensureKakao();
      if (!mapRef.current) return;

      const kakao = (window as KakaoNS).kakao;
      const center = new kakao.maps.LatLng(37.5665, 126.9780); // 기본: 서울시청
      const map = new kakao.maps.Map(mapRef.current, { center, level: 5 });
      mapObjRef.current = map;

      // 클러스터러 준비
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: false,
      });

      // 1) Supabase에서 좌표 가져와 렌더
      await loadAndRenderMarkers();

      // 2) ?q=주소가 있으면 해당 위치로 '이동만'
      const q = getQuery();
      if (q) moveToAddress(q);
    }

    init();
  }, []);

  // Supabase에서 ok된 좌표만 불러와 핀/클러스터 렌더
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
    if (clustererRef.current) clustererRef.current.clear();

    const markers: any[] = [];

    data?.forEach((row) => {
      const pos = new kakao.maps.LatLng(row.lat, row.lng);
      const marker = new kakao.maps.Marker({
        position: pos,
        title: row.name || row.address,
      });

      // 간단한 오버레이(클릭 시 토글)
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
        // 오버레이 토글
        if ((overlay as any)._visible) {
          overlay.setMap(null);
          (overlay as any)._visible = false;
        } else {
          overlay.setMap(mapObjRef.current);
          (overlay as any)._visible = true;
        }
      });

      markers.push(marker);
    });

    clustererRef.current.addMarkers(markers);
  }

  // 주소 문자열로 지도 '이동만' (마커 생성 X)
  async function moveToAddress(addr: string) {
    const kakao = (window as KakaoNS).kakao;
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(addr, (result: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !result?.length) return;
      const { y, x } = result[0];
      const latlng = new kakao.maps.LatLng(Number(y), Number(x));
      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);
    });
  }

  // replaceAll 없이 호환되는 escape
  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return <div ref={mapRef} style={{ width: "100%", height: "100vh" }} />;
}

