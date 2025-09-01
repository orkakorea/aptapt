import { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ✅ 카카오 JavaScript 키 (REST 키 아님)
const KAKAO_APP_KEY = "8f7b0c647c14bed4b0e49bcab3c080a2";
type KakaoNS = typeof window & {
  kakao: any;
};

// Vite env를 읽어서 필요할 때만 Supabase 클라이언트를 만든다
function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("[MapPage] Supabase env missing:", {
      url,
      key: key ? "(present)" : "(missing)"
    });
    return null;
  }
  try {
    return createClient(url, key);
  } catch (e) {
    console.error("[MapPage] createClient failed:", e);
    return null;
  }
}
export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const [q, setQ] = useState<string>("");

  // 디바운스
  const idleTimer = useRef<number | null>(null);
  function debounceIdle(fn: () => void, ms = 300) {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(fn, ms);
  }

  // URL ?q
  function readQuery() {
    const u = new URL(window.location.href);
    return (u.searchParams.get("q") || "").trim();
  }
  function writeQuery(v: string) {
    const u = new URL(window.location.href);
    if (v) u.searchParams.set("q", v);else u.searchParams.delete("q");
    window.history.replaceState(null, "", u.toString());
  }
  useEffect(() => {
    async function ensureKakao(): Promise<void> {
      if ((window as KakaoNS).kakao?.maps) return;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services,clusterer`;
        s.onload = () => (window as KakaoNS).kakao.maps.load(() => resolve());
        s.onerror = () => reject(new Error("Kakao SDK load failed"));
        document.head.appendChild(s);
      });
    }
    async function init() {
      await ensureKakao();
      if (!mapRef.current) return;
      const kakao = (window as KakaoNS).kakao;
      const center = new kakao.maps.LatLng(37.5665, 126.9780); // 서울시청
      const map = new kakao.maps.Map(mapRef.current, {
        center,
        level: 6
      });
      mapObjRef.current = map;

      // Places 인스턴스
      placesRef.current = new kakao.maps.services.Places();

      // 마커 클러스터러
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: false
      });

      // 맵 이동/확대 종료 시 현재 바운드 기준으로 로드
      kakao.maps.event.addListener(map, "idle", () => {
        debounceIdle(loadMarkersInBounds, 300);
      });

      // 초기 로드
      await loadMarkersInBounds();

      // /map?q=... 초기 검색 처리
      const initial = readQuery();
      if (initial) {
        setQ(initial);
        keywordSearch(initial, {
          dropMarker: true
        });
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===================== 데이터 로드 & 렌더 =====================
  async function loadMarkersInBounds() {
    const kakao = (window as KakaoNS).kakao;
    const map = mapObjRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const swLat = sw.getLat();
    const swLng = sw.getLng();
    const neLat = ne.getLat();
    const neLng = ne.getLng();
    const client = getSupabase();
    if (!client) {
      // 환경변수 미설정이어도 페이지(검색창/지도)는 정상 렌더되도록 그냥 패스
      return;
    }
    const {
      data,
      error
    } = await client.from("raw_places").select('"단지명","주소",lat,lng') // 한글 컬럼은 반드시 쌍따옴표
    .not("lat", "is", null).not("lng", "is", null).gte("lat", swLat).lte("lat", neLat).gte("lng", swLng).lte("lng", neLng).limit(2000);
    if (error) {
      console.error("Supabase select error:", error.message);
      return;
    }
    const markers = (data || []).map((row: any) => {
      const pos = new kakao.maps.LatLng(row.lat, row.lng);
      const title = row["단지명"] || row["주소"] || "";
      const marker = new kakao.maps.Marker({
        position: pos,
        title
      });

      // 간단 오버레이 (클릭 토글)
      const content = document.createElement("div");
      content.style.padding = "8px 10px";
      content.style.borderRadius = "8px";
      content.style.background = "white";
      content.style.boxShadow = "0 2px 8px rgba(0,0,0,.15)";
      content.style.fontSize = "12px";
      content.innerHTML = `<strong>${escapeHtml(row["단지명"] || "단지")}</strong><br/>${escapeHtml(row["주소"] || "")}`;
      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.2,
        zIndex: 100
      });
      kakao.maps.event.addListener(marker, "click", () => {
        const vis = (overlay as any)._visible;
        overlay.setMap(vis ? null : mapObjRef.current);
        (overlay as any)._visible = !vis;
      });
      return marker;
    });
    if (clustererRef.current) {
      clustererRef.current.clear();
      if (markers.length) clustererRef.current.addMarkers(markers);
    }
  }

  // ===================== 검색(Places) =====================
  function keywordSearch(query: string, opts?: {
    dropMarker?: boolean;
  }) {
    const kakao = (window as KakaoNS).kakao;
    const places = placesRef.current;
    if (!places) return;
    places.keywordSearch(query, (results: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !results || !results.length) return;
      const first = results[0];
      const lat = Number(first.y);
      const lng = Number(first.x);
      if (isNaN(lat) || isNaN(lng)) return;
      const latlng = new kakao.maps.LatLng(lat, lng);
      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);
      if (opts && opts.dropMarker) {
        if (searchMarkerRef.current) {
          searchMarkerRef.current.setMap(null);
          searchMarkerRef.current = null;
        }
        const marker = new kakao.maps.Marker({
          position: latlng,
          image: new kakao.maps.MarkerImage("https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png", new kakao.maps.Size(24, 35)),
          zIndex: 999
        });
        marker.setMap(mapObjRef.current);
        searchMarkerRef.current = marker;
      }

      // 이동 후 현재 바운드에 맞춰 아파트 핀 재로드
      loadMarkersInBounds();
    });
  }
  function onSearch() {
    const query = q.trim();
    if (!query) return;
    writeQuery(query);
    keywordSearch(query, {
      dropMarker: true
    });
  }
  function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  return <div className="min-h-screen bg-white">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] h-16">
        <div className="max-w-[1280px] mx-auto px-4 h-full flex items-center">
          {/* Left area - chips */}
          <div className="flex items-center gap-2">
            <div className="h-8 px-3 border border-[#E5E7EB] rounded-full flex items-center text-sm text-[#111827]">
              시·군·구 단위
            </div>
            <div className="h-8 px-3 border border-[#E5E7EB] rounded-full flex items-center text-sm text-[#111827]">
              패키지 문의
            </div>
            <div className="h-8 px-3 bg-[#7B61FF] hover:bg-[#6A52FF] rounded-full flex items-center text-sm text-white transition-colors">
              1551 - 1810
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-4 p-4">
        {/* Left sidebar - shows second on mobile */}
        <div className="w-full md:w-80 order-2 md:order-1 mt-4 md:mt-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-[2]">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative">
              <input 
                value={q} 
                onChange={e => setQ(e.target.value)} 
                onKeyDown={e => e.key === "Enter" && onSearch()} 
                placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요" 
                className="w-full h-10 bg-white border border-[#E5E7EB] rounded-lg px-4 pr-10 text-base text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#C7B8FF]" 
              />
              <button 
                onClick={onSearch}
                className="absolute right-0 top-0 w-10 h-10 flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            </div>

            {/* Card 1 - 송출 희망일 */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
              {/* Title row */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[#111827]">송출 희망일</h3>
                <button className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1"/>
                    <circle cx="19" cy="12" r="1"/>
                    <circle cx="5" cy="12" r="1"/>
                  </svg>
                </button>
              </div>
              {/* Date field */}
              <button className="w-full h-10 border border-[#E5E7EB] hover:border-[#D1D5DB] rounded-lg flex items-center px-3 gap-2 text-[#111827] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#9CA3AF]">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>날짜를 선택하세요</span>
              </button>
            </div>

            {/* Card 2 - 총 비용 */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
              {/* Title row */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-[#111827]">총 비용</h3>
                <span className="text-sm text-[#6B7280]">총 0건</span>
              </div>
              {/* Body - empty placeholder */}
            </div>

            {/* Cart - 장바구니 영역 */}
            <div className="space-y-3">
              {/* Section header */}
              <div className="bg-[#F3EEFF] rounded-xl px-3 h-9 flex items-center">
                <span className="text-sm font-medium text-[#111827]">0원 (VAT별도)</span>
              </div>
              
              {/* Empty state card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 h-[220px] flex flex-col items-center justify-center">
                {/* Building illustration SVG */}
                <svg width="120" height="80" viewBox="0 0 120 80" className="mb-4">
                  <defs>
                    <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#D9CFFF" />
                      <stop offset="100%" stopColor="#BFA6FF" />
                    </linearGradient>
                  </defs>
                  {/* Building 1 */}
                  <rect x="10" y="25" width="25" height="45" fill="url(#buildingGradient)" rx="2" />
                  <rect x="15" y="30" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="25" y="30" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="15" y="40" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="25" y="40" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="15" y="50" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="25" y="50" width="4" height="4" fill="white" opacity="0.8" />
                  
                  {/* Building 2 */}
                  <rect x="40" y="15" width="30" height="55" fill="url(#buildingGradient)" rx="2" />
                  <rect x="45" y="25" width="5" height="5" fill="white" opacity="0.8" />
                  <rect x="55" y="25" width="5" height="5" fill="white" opacity="0.8" />
                  <rect x="45" y="35" width="5" height="5" fill="white" opacity="0.8" />
                  <rect x="55" y="35" width="5" height="5" fill="white" opacity="0.8" />
                  <rect x="45" y="45" width="5" height="5" fill="white" opacity="0.8" />
                  <rect x="55" y="45" width="5" height="5" fill="white" opacity="0.8" />
                  <rect x="45" y="55" width="5" height="5" fill="white" opacity="0.8" />
                  <rect x="55" y="55" width="5" height="5" fill="white" opacity="0.8" />
                  
                  {/* Building 3 */}
                  <rect x="75" y="30" width="25" height="40" fill="url(#buildingGradient)" rx="2" />
                  <rect x="80" y="35" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="90" y="35" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="80" y="45" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="90" y="45" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="80" y="55" width="4" height="4" fill="white" opacity="0.8" />
                  <rect x="90" y="55" width="4" height="4" fill="white" opacity="0.8" />
                </svg>
                
                {/* Caption */}
                <p className="text-sm text-[#9CA3AF] text-center">
                  광고를 원하는 아파트단지를 담아주세요!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right map area - shows first on mobile */}
        <div className="flex-1 order-1 md:order-2 relative z-[1]">
          <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden relative h-[calc(100svh-128px)]">
            <div ref={mapRef} className="w-full h-full relative" />
          </div>
        </div>
      </div>
    </div>;
}