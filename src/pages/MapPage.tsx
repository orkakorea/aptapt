import { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ✅ 카카오 JavaScript 키 (REST 키 아님)
const KAKAO_APP_KEY = "a53075efe7a2256480b8650cec67ebae";
type KakaoNS = typeof window & { kakao: any };

// Vite env를 읽어서 필요할 때만 Supabase 클라이언트를 만든다
function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("[MapPage] Supabase env missing:", { url, key: key ? "(present)" : "(missing)" });
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
    if (v) u.searchParams.set("q", v);
    else u.searchParams.delete("q");
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
      const map = new kakao.maps.Map(mapRef.current, { center, level: 6 });
      mapObjRef.current = map;

      // Places 인스턴스
      placesRef.current = new kakao.maps.services.Places();

      // 마커 클러스터러
      clustererRef.current = new kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: false,
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
        keywordSearch(initial, { dropMarker: true });
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

    const { data, error } = await client
      .from("raw_places")
      .select('"단지명","주소",lat,lng') // 한글 컬럼은 반드시 쌍따옴표
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", swLat)
      .lte("lat", neLat)
      .gte("lng", swLng)
      .lte("lng", neLng)
      .limit(2000);

    if (error) {
      console.error("Supabase select error:", error.message);
      return;
    }

    const markers = (data || []).map((row: any) => {
      const pos = new kakao.maps.LatLng(row.lat, row.lng);
      const title = row["단지명"] || row["주소"] || "";

      const marker = new kakao.maps.Marker({ position: pos, title });

      // 간단 오버레이 (클릭 토글)
      const content = document.createElement("div");
      content.style.padding = "8px 10px";
      content.style.borderRadius = "8px";
      content.style.background = "white";
      content.style.boxShadow = "0 2px 8px rgba(0,0,0,.15)";
      content.style.fontSize = "12px";
      content.innerHTML = `<strong>${escapeHtml(
        row["단지명"] || "단지"
      )}</strong><br/>${escapeHtml(row["주소"] || "")}`;

      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.2,
        zIndex: 100,
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
  function keywordSearch(query: string, opts?: { dropMarker?: boolean }) {
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

  function onSearch() {
    const query = q.trim();
    if (!query) return;
    writeQuery(query);
    keywordSearch(query, { dropMarker: true });
  }

  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-50 bg-white border-b h-16">
        <div className="max-w-[1280px] mx-auto px-4 h-full flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-3 md:py-0">
          {/* Left area - chips */}
          <div className="flex items-center gap-2">
            <div className="h-8 px-3 border border-[#E5E7EB] rounded-full flex items-center text-sm text-[#111827]">
              시·군·구 단위
            </div>
            <div className="h-8 px-3 border border-[#E5E7EB] rounded-full flex items-center text-sm text-[#111827]">
              패키지 문의
            </div>
            <div className="h-8 px-3 bg-[#7B61FF] rounded-full flex items-center text-sm text-white">
              1551 - 1810
            </div>
          </div>

          {/* Right area - search */}
          <div className="w-full md:w-[560px] h-10 bg-white border border-[#E5E7EB] rounded-full overflow-hidden group focus-within:ring-2 focus-within:ring-[#C7B8FF]">
            <div className="flex h-full">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder="지역명, 아파트 이름, 단지명, 건물명을 입력해주세요"
                className="flex-1 px-4 text-base text-[#111827] placeholder-[#9CA3AF] bg-transparent border-0 outline-none"
              />
              <button
                onClick={onSearch}
                className="w-10 h-10 bg-[#7B61FF] hover:bg-[#6A52FF] flex items-center justify-center text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex">
        {/* Left sidebar */}
        <div className="w-[360px] bg-white border-r border-border">
          <div className="p-4">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">검색 결과</h2>
            <div className="text-sm text-muted-foreground">
              지도를 움직여서 해당 지역의 단지를 확인하세요.
            </div>
          </div>
        </div>

        {/* Right map area */}
        <div className="flex-1">
          <div ref={mapRef} className="w-full h-[calc(100vh-4rem)]" />
        </div>
      </div>
    </div>
  );
}