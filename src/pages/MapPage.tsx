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
  try { return createClient(url, key); } catch { return null; }
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
    s.onload = () => { if (!w.kakao) return reject(new Error("kakao object not found")); w.kakao.maps.load(() => resolve(w.kakao)); };
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
  if (v) u.searchParams.set("q", v); else u.searchParams.delete("q");
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
function expandBounds(bounds: any, pad = 0.05) {
  // pad는 위경도 degree 단위(약 5~6km 정도)
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return {
    minLat: sw.getLat() - pad,
    maxLat: ne.getLat() + pad,
    minLng: sw.getLng() - pad,
    maxLng: ne.getLng() + pad,
  };
}

// ---------- types ----------
type PlaceRow = {
  id: number;
  단지명?: string | null;
  상품명?: string | null;
  설치위치?: string | null;
  세대수?: string | number | null;
  거주인원?: string | number | null;
  모니터수량?: string | number | null;
  월송출횟수?: string | number | null;
  월광고료?: string | number | null;
  ["1회당 송출비용"]?: string | number | null;
  운영시간?: string | null;
  주소?: string | null;
  imageUrl?: string | null;
  geocode_status?: string | null;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any;
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
  setGroups(groups: Map<string, KMarker[]>) { this.groups = groups; }

  unspiderfy = () => {
    if (!this.activeKey) return;
    const markers = this.groups.get(this.activeKey) || [];
    this.activeLines.forEach((ln) => ln.setMap(null));
    this.activeLines = [];
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

    this.clusterer.removeMarkers(markers);
    const proj = this.map.getProjection();
    const center = markers[0].__basePos;
    const cpt = proj.containerPointFromCoords(center);

    const N = markers.length;
    const ringRadiusPx = Math.max(26, Math.min(60, 18 + N * 1.5));
    const twoRings = N > 14;
    const innerCount = twoRings ? Math.ceil(N * 0.45) : 0;
    const outerCount = twoRings ? N - innerCount : N;

    const mkTarget = (idx: number, count: number, radius: number) => {
      const angle = (2 * Math.PI * idx) / count;
      return new (window as any).kakao.maps.Point(
        cpt.x + Math.cos(angle) * radius,
        cpt.y + Math.sin(angle) * radius
      );
    };

    const targets: { marker: KMarker; toPt: any }[] = [];
    for (let i = 0; i < outerCount; i++) targets.push({ marker: markers[i], toPt: mkTarget(i, outerCount, ringRadiusPx) });
    for (let j = 0; j < innerCount; j++) targets.push({ marker: markers[outerCount + j], toPt: mkTarget(j, innerCount, Math.max(16, ringRadiusPx * 0.6)) });

    const duration = 180; const t0 = performance.now();
    this.animating = true;
    markers.forEach((m) => m.setMap(this.map));

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const e = 1 - Math.pow(1 - t, 3);

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

        const leg = new (window as any).kakao.maps.Polyline({
          path: [center, curPos],
          strokeWeight: 1.5, strokeColor: "#555", strokeOpacity: 0.6, strokeStyle: "solid",
        });
        leg.setMap(this.map);
        this.activeLines.push(leg);
      });

      if (t < 1) requestAnimationFrame(step);
      else { this.animating = false; this.activeKey = key; }
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
          map, averageCenter: true, minLevel: 6, disableClickZoom: true, gridSize: 80,
        });

        spiderRef.current = new SpiderController(map, clustererRef.current);

        kakao.maps.event.addListener(clustererRef.current, "clusterclick", (cluster: any) => {
          const m = mapObjRef.current; if (!m) return;
          m.setLevel(Math.max(m.getLevel() - 1, 1), { anchor: cluster.getCenter() });
        });

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

  // ------- 데이터 로드 공통 루틴 -------
  async function fetchPlacesInBox(client: SupabaseClient, box: {minLat:number,maxLat:number,minLng:number,maxLng:number}, withCostPerPlay = true) {
    const cols = withCostPerPlay
      ? `
        id,
        "단지명",
        "상품명",
        "설치위치",
        "세대수",
        "거주인원",
        "모니터수량",
        "월송출횟수",
        "월광고료",
        "1회당 송출비용",
        "운영시간",
        "주소",
        imageUrl,
        geocode_status,
        lat,
        lng
      `
      : `
        id,
        "단지명",
        "상품명",
        "설치위치",
        "세대수",
        "거주인원",
        "모니터수량",
        "월송출횟수",
        "월광고료",
        "운영시간",
        "주소",
        imageUrl,
        geocode_status,
        lat,
        lng
      `;

    const q = client
      .from("raw_places")
      .select(cols)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", box.minLat).lte("lat", box.maxLat)
      .gte("lng", box.minLng).lte("lng", box.maxLng)
      .limit(5000);

    const { data, error } = await q;
    return { data: (data ?? []) as PlaceRow[], error };
  }

  // 바운드 내 마커 로드
  async function loadMarkersInBounds() {
    const kakao = (window as KakaoNS).kakao;
    const map = mapObjRef.current;
    if (!map) return;

    // 중복/유령 마커 방지
    spiderRef.current?.unspiderfy();
    if (clustererRef.current) clustererRef.current.clear();

    const bounds = map.getBounds();
    if (!bounds) return;
    const padBox = expandBounds(bounds, 0); // 기본 박스

    const client = getSupabase();
    if (!client) return;

    const reqId = Date.now();
    lastReqIdRef.current = reqId;

    console.log("[MapPage] loadMarkersInBounds start", {
      latRange: [padBox.minLat, padBox.maxLat],
      lngRange: [padBox.minLng, padBox.maxLng],
    });

    // 1차 시도: 전체 칼럼(특히 "1회당 송출비용" 포함)
    let { data, error } = await fetchPlacesInBox(client, padBox, true);
    if (error) {
      console.warn('[MapPage] select with "1회당 송출비용" failed, retrying without it →', error.message);
      // 2차 시도: 문제 컬럼 제외 재시도
      const r = await fetchPlacesInBox(client, padBox, false);
      data = r.data; error = r.error;
    }

    if (reqId !== lastReqIdRef.current) return;
    if (error) { console.error("Supabase select(raw_places) error:", error.message); return; }

    // 0건이면 바운드를 살짝 확장해서 한 번 더 시도
    if (!data.length) {
      const expanded = expandBounds(bounds, 0.12); // 약 12~15km 확장
      console.log("[MapPage] 0 rows. retry with expanded bounds", expanded);
      const r2 = await fetchPlacesInBox(client, expanded, true);
      if (r2.error) console.warn("[MapPage] expanded select error:", r2.error.message);
      data = r2.data || [];
    }

    console.log("[MapPage] rows:", data.length);

    // 마커 생성 + 같은 좌표 그룹핑
    const markers: KMarker[] = [];
    const groups = new Map<string, KMarker[]>();
    const keyOf = (lat: number, lng: number) => `${lat.toFixed(7)},${lng.toFixed(7)}`;

    data.forEach((row) => {
      if (row.lat == null || row.lng == null) return;
      const lat = Number(row.lat), lng = Number(row.lng);
      const pos = new kakao.maps.LatLng(lat, lng);
      const marker: KMarker = new kakao.maps.Marker({ position: pos, title: row.단지명 || "" });
      marker.__basePos = pos;
      marker.__row = row;
      marker.__baseKey = keyOf(lat, lng);

      if (!groups.has(marker.__baseKey)) groups.set(marker.__baseKey, []);
      groups.get(marker.__baseKey)!.push(marker);

      kakao.maps.event.addListener(marker, "click", () => {
        const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
        const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
        const productName = getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) || "";
        const installLocation = getField(row, ["설치위치", "설치 위치", "installLocation"]) || "";
        const households = toNumLoose(getField(row, ["세대수","세대 수","세대","가구수","가구 수","세대수(가구)","households"]));
        const residents = toNumLoose(getField(row, ["거주인원","거주 인원","인구수","총인구","입주민수","거주자수","residents"]));
        const monitors = toNumLoose(getField(row, ["모니터수량","모니터 수량","모니터대수","엘리베이터TV수","monitors"]));
        const monthlyImpressions = toNumLoose(getField(row, ["월송출횟수","월 송출횟수","월 송출 횟수","월송출","노출수(월)","monthlyImpressions"]));
        const monthlyFee = toNumLoose(getField(row, ["월광고료","월 광고료","월 광고비","월비용","월요금","month_fee","monthlyFee"]));
        const monthlyFeeY1 = toNumLoose(getField(row, ["1년 계약 시 월 광고료","1년계약시월광고료","연간월광고료","할인 월 광고료","연간_월광고료","monthlyFeeY1"]));
        const costPerPlay = toNumLoose(getField(row, ["1회당 송출비용","송출 1회당 비용","costPerPlay"]));
        const hours = getField(row, ["운영시간","운영 시간","hours"]) || "";
        const imageUrl = getField(row, ["imageUrl", "이미지", "썸네일", "thumbnail"]) || undefined;

        const sel: SelectedApt = {
          name, address, productName, installLocation,
          households, residents, monitors, monthlyImpressions,
          costPerPlay, hours, monthlyFee, monthlyFeeY1,
          imageUrl, lat, lng,
        };
        setSelected(sel);

        // 같은 위치 그룹을 부드럽게 펼치기
        spiderRef.current?.spiderfy(marker.__baseKey!);
      });

      markers.push(marker);
    });

    // 스파이더용 그룹 등록
    spiderRef.current?.setGroups(groups);

    // 클러스터에 추가
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
      <div ref={mapRef} className={`fixed top-16 left-0 right-0 bottom-0 z-[10] ${mapLeftClass}`} aria-label="map" />
      <MapChrome selected={selected} onCloseSelected={closeSelected} onSearch={handleSearch} initialQuery={initialQ} />
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError}
        </div>
      )}
    </div>
  );
}
