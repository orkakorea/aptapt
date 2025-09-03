// src/pages/MapPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import MapChrome, { SelectedApt } from "../components/MapChrome";

type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

// ---------- Supabase ----------
function getSupabase(): SupabaseClient | null {
  const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !key) {
    console.warn("[MapPage] Supabase env missing:", { url, hasKey: !!key });
    return null;
  }
  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

// ---------- Kakao loader (HTTPS) ----------
function loadKakao(): Promise<any> {
  const w = window as any;
  if (w.kakao?.maps) return Promise.resolve(w.kakao);
  const envKey = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  const key = envKey && envKey.trim() ? envKey : FALLBACK_KAKAO_KEY;
  return new Promise((resolve, reject) => {
    const id = "kakao-maps-sdk";
    if (document.getElementById(id)) {
      const tryLoad = () => (w.kakao?.maps ? resolve(w.kakao) : setTimeout(tryLoad, 50));
      return tryLoad();
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    s.onload = () => {
      if (!w.kakao) return reject(new Error("kakao object not found"));
      w.kakao.maps.load(() => resolve(w.kakao));
    };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
}

// ---------- helpers ----------
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

function toNumLoose(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[^0-9.-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
function getField(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

// ---------- types ----------
type PlaceRow = {
  id: number;
  단지명?: string | null;
  상품명?: string | null;
  주소?: string | null;
  geocode_status?: string | null;
  lat?: number | null;
  lng?: number | null;
};

// ---------- Spiderfy Controller ----------
type KMarker = any & { __baseKey?: string; __basePos?: any; __row?: PlaceRow };
class SpiderController {
  private map: any;
  private clusterer: any;
  private groups: Map<string, KMarker[]> = new Map();
  private activeKey: string | null = null;
  private activeLines: any[] = [];
  private animating = false;

  constructor(map: any, clusterer: any) {
    this.map = map;
    this.clusterer = clusterer;
  }

  setGroups(groups: Map<string, KMarker[]>) {
    this.groups = groups;
  }

  unspiderfy = () => {
    if (!this.activeKey) return;
    const markers = this.groups.get(this.activeKey) || [];
    // remove legs
    this.activeLines.forEach((ln) => ln.setMap(null));
    this.activeLines = [];
    // move back & return to clusterer
    markers.forEach((m) => {
      if (!m.__basePos) return;
      m.setPosition(m.__basePos);
      m.setMap(null);
    });
    if (markers.length) this.clusterer.addMarkers(markers);
    this.activeKey = null;
  };

  spiderfy = (key: string) => {
    if (this.animating) return;
    if (this.activeKey === key) return;
    this.unspiderfy();

    const markers = this.groups.get(key) || [];
    if (markers.length <= 1) return;

    // pull out from clusterer to control individually
    this.clusterer.removeMarkers(markers);

    // arrange in ring(s) around center (pixel space)
    const proj = this.map.getProjection();
    const center = markers[0].__basePos;
    const cpt = proj.containerPointFromCoords(center);

    const N = markers.length;
    const ringRadiusPx = Math.max(26, Math.min(60, 18 + N * 1.5)); // 반지름 픽셀
    const twoRings = N > 14; // 15개 이상이면 2개 링
    const innerCount = twoRings ? Math.ceil(N * 0.45) : 0;
    const outerCount = twoRings ? N - innerCount : N;

    const targets: { marker: KMarker; toPt: any }[] = [];
    const mkTarget = (m: KMarker, idx: number, count: number, radius: number) => {
      const angle = (2 * Math.PI * idx) / count;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      return new (window as any).kakao.maps.Point(cpt.x + dx, cpt.y + dy);
    };

    // outer ring
    for (let i = 0; i < outerCount; i++) {
      const toPt = mkTarget(markers[i], i, outerCount, ringRadiusPx);
      targets.push({ marker: markers[i], toPt });
    }
    // inner ring
    for (let j = 0; j < innerCount; j++) {
      const toPt = mkTarget(markers[outerCount + j], j, innerCount, Math.max(16, ringRadiusPx * 0.6));
      targets.push({ marker: markers[outerCount + j], toPt });
    }

    // draw legs & animate
    const duration = 180; // ms
    const t0 = performance.now();
    this.animating = true;

    // set visible on map
    markers.forEach((m) => m.setMap(this.map));

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      // easeOutCubic
      const e = 1 - Math.pow(1 - t, 3);

      // clear previous legs
      this.activeLines.forEach((ln) => ln.setMap(null));
      this.activeLines = [];

      targets.forEach(({ marker, toPt }) => {
        const fromPt = proj.containerPointFromCoords(center);
        const curPt = new (window as any).kakao.maps.Point(
          fromPt.x + (toPt.x - fromPt.x) * e,
          fromPt.y + (toPt.y - fromPt.y) * e
        );
        const curPos = proj.coordsFromContainerPoint(curPt);
        marker.setPosition(curPos);

        // leg
        const leg = new (window as any).kakao.maps.Polyline({
          path: [center, curPos],
          strokeWeight: 1.5,
          strokeColor: "#555",
          strokeOpacity: 0.6,
          strokeStyle: "solid",
        });
        leg.setMap(this.map);
        this.activeLines.push(leg);
      });

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        this.animating = false;
        this.activeKey = key;
      }
    };

    requestAnimationFrame(step);
  };
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const spiderRef = useRef<SpiderController | null>(null);
  const lastReqIdRef = useRef<number>(0);
  const idleTimer = useRef<number | null>(null);

  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [initialQ, setInitialQ] = useState("");
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  function debounceIdle(fn: () => void, ms = 300) {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(fn, ms);
  }

  // init kakao map
  useEffect(() => {
    let resizeHandler: any;
    let map: any;

    loadKakao()
      .then((kakao) => {
        setKakaoError(null);
        if (!mapRef.current) return;
        mapRef.current.style.minHeight = "300px";
        mapRef.current.style.minWidth = "300px";

        const center = new kakao.maps.LatLng(37.5665, 126.978);
        map = new kakao.maps.Map(mapRef.current, { center, level: 6 });
        mapObjRef.current = map;

        placesRef.current = new kakao.maps.services.Places();
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: true,
          gridSize: 80,
        });

        // set up spider controller
        spiderRef.current = new SpiderController(map, clustererRef.current);

        // 클러스터 클릭 시 한 단계 줌인
        kakao.maps.event.addListener(clustererRef.current, "clusterclick", (cluster: any) => {
          const m = mapObjRef.current;
          if (!m) return;
          const c = cluster.getCenter();
          m.setLevel(Math.max(m.getLevel() - 1, 1), { anchor: c });
        });

        // 스파이더 해제 트리거: 줌/드래그/맵 클릭
        kakao.maps.event.addListener(map, "zoom_changed", () => spiderRef.current?.unspiderfy());
        kakao.maps.event.addListener(map, "dragstart", () => spiderRef.current?.unspiderfy());
        kakao.maps.event.addListener(map, "click", () => spiderRef.current?.unspiderfy());

        kakao.maps.event.addListener(map, "idle", () => debounceIdle(loadMarkersInBounds, 300));

        setTimeout(() => map && map.relayout(), 0);
        loadMarkersInBounds();

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

  // 2탭 열고 닫을 때 레이아웃 보정
  useEffect(() => {
    const m = mapObjRef.current;
    if ((window as any).kakao?.maps && m) setTimeout(() => m.relayout(), 0);
  }, [selected]);

  // 바운드 내 마커 로드 (중복 제거 금지 / 원본 lat/lng 사용 / 스파이더 준비)
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

    // 원본 raw_places에서 가져오기 (lat/lng 기준)
    const { data, error } = await client
      .from("raw_places")
      .select(`id, "단지명", "상품명", "주소", geocode_status, lat, lng`)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", sw.getLat())
      .lte("lat", ne.getLat())
      .gte("lng", sw.getLng())
      .lte("lng", ne.getLng())
      .limit(5000);

    if (error) {
      console.error("Supabase select(raw_places) error:", error.message);
      return;
    }
    if (reqId !== lastReqIdRef.current) return;

    const records = (data ?? []) as PlaceRow[];

    // 기존 마커/클러스터 비우기
    if (clustererRef.current) clustererRef.current.clear();

    // 마커 생성 + 그룹핑(같은 좌표)
    const markers: KMarker[] = [];
    const groups = new Map<string, KMarker[]>();
    const keyOf = (lat: number, lng: number) => `${lat.toFixed(7)},${lng.toFixed(7)}`;

    records.forEach((row) => {
      const lat = row.lat!, lng = row.lng!;
      const pos = new kakao.maps.LatLng(lat, lng);
      const marker: KMarker = new kakao.maps.Marker({ position: pos, title: row.단지명 || "" });
      marker.__basePos = pos;
      marker.__row = row;
      marker.__baseKey = keyOf(lat, lng);

      if (!groups.has(marker.__baseKey)) groups.set(marker.__baseKey, []);
      groups.get(marker.__baseKey)!.push(marker);

      // 마커 클릭 → 같은 그룹을 spiderfy
      kakao.maps.event.addListener(marker, "click", () => {
        const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
        const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
        const productName =
          getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) || "";

        const households = toNumLoose(getField(row, [
          "세대수", "세대 수", "세대", "가구수", "가구 수", "세대수(가구)", "households",
        ]));
        const residents = toNumLoose(getField(row, [
          "거주인원", "거주 인원", "인구수", "총인구", "입주민수", "거주자수", "residents",
        ]));
        const monitors = toNumLoose(getField(row, [
          "모니터수량", "모니터 수량", "모니터대수", "엘리베이터TV수", "monitors",
        ]));
        const monthlyImpressions = toNumLoose(getField(row, [
          "월 송출횟수","월송출횟수","월 송출 횟수","월송출","노출수(월)","monthlyImpressions",
        ]));
        const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
        const monthlyFee = toNumLoose(getField(row, [
          "월 광고료","월광고료","월 광고비","월비용","월요금","month_fee","monthlyFee",
        ]));
        const monthlyFeeY1 = toNumLoose(getField(row, [
          "1년 계약 시 월 광고료","1년계약시월광고료","연간월광고료","할인 월 광고료","연간_월광고료","monthlyFeeY1",
        ]));

        setSelected({
          name, address, productName,
          households, residents, monitors, monthlyImpressions, hours,
          monthlyFee, monthlyFeeY1,
          lat, lng,
        });

        // 같은 위치의 다른 마커들을 부드럽게 펼치기
        spiderRef.current?.spiderfy(marker.__baseKey!);
      });

      markers.push(marker);
    });

    // 그룹 정보 등록(스파이더에게)
    spiderRef.current?.setGroups(groups);

    // 클러스터러에 모든 마커 추가
    if (clustererRef.current && markers.length) {
      clustererRef.current.addMarkers(markers);
    }
  }

  // Places 검색 → 이동
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
  function handleSearch(q: string) { writeQuery(q); runPlaceSearch(q); }
  function closeSelected() { setSelected(null); }

  const mapLeftClass = selected ? "md:left-[720px]" : "md:left-[360px]";

  return (
    <div className="w-screen h-[100dvh] bg-white">
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
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError}
        </div>
      )}
    </div>
  );
}
