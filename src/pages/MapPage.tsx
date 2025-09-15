// src/pages/MapPage.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import MapChrome, { SelectedApt } from "../components/MapChrome";

type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

/* =========================================================================
   ① 정방형 마커 이미지 유틸 (@2x 기반)
   ------------------------------------------------------------------------- */
const PIN_PURPLE_URL = "/makers/pin-purple@2x.png";   // 기본
const PIN_YELLOW_URL = "/makers/pin-yellow@2x.png";   // 담기(선택) 유지용
const PIN_CLICKED_URL = "/makers/pin-purple@3x.png";  // ★ 클릭 강조 아이콘

const PIN_SIZE = 51; // 원본 102px(@2x)의 절반으로 표시
const PIN_OFFSET = { x: PIN_SIZE / 2, y: PIN_SIZE }; // 바닥 중앙

function markerImages(maps: any) {
  const { MarkerImage, Size, Point } = maps;
  const opt = { offset: new Point(PIN_OFFSET.x, PIN_OFFSET.y) };
  const sz = new Size(PIN_SIZE, PIN_SIZE); // ★ 정사각

  const purple = new MarkerImage(PIN_PURPLE_URL, sz, opt);
  const yellow = new MarkerImage(PIN_YELLOW_URL, sz, opt);
  const clicked = new MarkerImage(PIN_CLICKED_URL, sz, opt); // ★ 추가
  return { purple, yellow, clicked };
}

/* =========================================================================
   ② Supabase / Kakao 로더
   ------------------------------------------------------------------------- */
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

/* =========================================================================
   ③ 헬퍼
   ------------------------------------------------------------------------- */
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
function expandBounds(bounds: any, pad = 0.05) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return {
    minLat: sw.getLat() - pad,
    maxLat: ne.getLat() + pad,
    minLng: sw.getLng() - pad,
    maxLng: ne.getLng() + pad,
  };
}

/* =========================================================================
   ④ 타입
   ------------------------------------------------------------------------- */
type PlaceRow = {
  id?: number | string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any; // 한글/공백 칼럼 포함 전체 수용
};
type KMarker = any & {
  __key?: string;      // 캐시 키
  __basePos?: any;     // spiderfy 복귀용
  __row?: PlaceRow;
};

/* =========================================================================
   ⑤ Spiderfy Controller (기존 로직 유지)
   ------------------------------------------------------------------------- */
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
    for (let i = 0; i < outerCount; i++)
      targets.push({ marker: markers[i], toPt: mkTarget(i, outerCount, ringRadiusPx) });
    for (let j = 0; j < innerCount; j++)
      targets.push({
        marker: markers[outerCount + j],
        toPt: mkTarget(j, innerCount, Math.max(16, ringRadiusPx * 0.6)),
      });

    const duration = 180;
    const t0 = performance.now();
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
          strokeWeight: 1.5,
          strokeColor: "#555",
          strokeOpacity: 0.6,
          strokeStyle: "solid",
        });
        leg.setMap(this.map);
        this.activeLines.push(leg);
      });

      if (t < 1) requestAnimationFrame(step);
      else {
        this.animating = false;
        this.activeKey = key;
      }
    };
    requestAnimationFrame(step);
  };
}

/* =========================================================================
   ⑥ 메인 컴포넌트
   ------------------------------------------------------------------------- */
export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);
  const spiderRef = useRef<SpiderController | null>(null);

  // 깜빡임 방지용 캐시(핵심): 마커 재사용
  const markerCacheRef = useRef<Map<string, KMarker>>(new Map()); // key → marker
  const nameIndexRef = useRef<Record<string, KMarker[]>>({}); // 정규화된 이름 → markers[]
  const selectedNameSetRef = useRef<Set<string>>(new Set()); // 노란아이콘 유지용
  const lastReqIdRef = useRef<number>(0);
  const idleTimer = useRef<number | null>(null);

  // ★ 마지막 클릭 마커 참조
  const lastClickedRef = useRef<KMarker | null>(null);

  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [initialQ, setInitialQ] = useState("");
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  const normName = (s: string) => s?.replace(/\s+/g, "").toLowerCase() || "";

  const debounceIdle = useCallback((fn: () => void, ms = 250) => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(fn, ms);
  }, []);

  /* ------------------ 지도 초기화 ------------------ */
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

        spiderRef.current = new SpiderController(map, clustererRef.current);

        (kakao.maps.event as any).addListener(
          clustererRef.current,
          "clusterclick",
          (cluster: any) => {
            const m = mapObjRef.current;
            if (!m) return;
            m.setLevel(Math.max(m.getLevel() - 1, 1), { anchor: cluster.getCenter() });
          }
        );

        kakao.maps.event.addListener(map, "zoom_changed", () => spiderRef.current?.unspiderfy());
        kakao.maps.event.addListener(map, "dragstart", () => spiderRef.current?.unspiderfy());
        kakao.maps.event.addListener(map, "click", () => spiderRef.current?.unspiderfy());
        kakao.maps.event.addListener(map, "idle", () => debounceIdle(loadMarkersInBounds, 250));

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

  /* ------------------ MapChrome → 마커 색 전환 콜백 ------------------ */
  const setMarkerState = useCallback((name: string, state: "default" | "selected") => {
    const nk = normName(name);
    if (!nk) return;

    const maps = (window as KakaoNS).kakao?.maps;
    if (!maps) return;
    const imgs = markerImages(maps);

    if (state === "selected") selectedNameSetRef.current.add(nk);
    else selectedNameSetRef.current.delete(nk);

    const list = nameIndexRef.current[nk];
    if (list?.length) {
      const img = state === "selected" ? imgs.yellow : imgs.purple;
      list.forEach((mk) => mk.setImage(img));
    }
  }, []);

  /* ------------------ 바운드 내 마커 로드(깜빡임 최소화: diff 적용) ------------------ */
  async function loadMarkersInBounds() {
    const kakao = (window as KakaoNS).kakao;
    const maps = kakao?.maps;
    const map = mapObjRef.current;
    const clusterer = clustererRef.current;
    if (!maps || !map || !clusterer) return;

    // 이전 spiderfy 해제 (표시 안정화)
    spiderRef.current?.unspiderfy();

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
      .select("*")
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", sw.getLat())
      .lte("lat", ne.getLat())
      .gte("lng", sw.getLng())
      .lte("lng", ne.getLng())
      .limit(5000);

    if (reqId !== lastReqIdRef.current) return;
    if (error) {
      console.error("Supabase select(raw_places) error:", error.message);
      return;
    }

    const rows = (data ?? []) as PlaceRow[];
    const imgs = markerImages(maps);

    // 이번 프레임의 key 집합 만들기
    const nowKeys = new Set<string>();
    const groups = new Map<string, KMarker[]>();
    const keyOf = (row: PlaceRow) => {
      const lat = Number(row.lat),
        lng = Number(row.lng);
      const idPart = row.id != null ? String(row.id) : "";
      // 좌표 + 선택적으로 id 섞어서 키 안정화
      return `${lat.toFixed(7)},${lng.toFixed(7)}|${idPart}`;
    };
    const groupKeyOf = (row: PlaceRow) => {
      const lat = Number(row.lat),
        lng = Number(row.lng);
      return `${lat.toFixed(7)},${lng.toFixed(7)}`;
    };

    // 이름 인덱스 초기화(이번 프레임 기준으로 재구성)
    nameIndexRef.current = {};

    const toAdd: KMarker[] = [];
    const newMarkers: KMarker[] = [];

    rows.forEach((row) => {
      if (row.lat == null || row.lng == null) return;

      const key = keyOf(row);
      nowKeys.add(key);

      let mk = markerCacheRef.current.get(key);
      const lat = Number(row.lat),
        lng = Number(row.lng);
      const pos = new maps.LatLng(lat, lng);

      // 이름/타이틀
      const nameText = String(getField(row, ["단지명", "name", "아파트명"]) || "");
      const nk = normName(nameText);

      if (!mk) {
        // 새 마커 생성 (★ 캐시 없으면 추가)
        const isSelected = nk && selectedNameSetRef.current.has(nk);
        mk = new maps.Marker({
          position: pos,
          title: nameText,
          image: isSelected ? imgs.yellow : imgs.purple, // ★ 노란아이콘 유지
        });
        mk.__key = key;
        mk.__basePos = pos;
        mk.__row = row;

        // 클릭 핸들러(2탭 selected 세팅)
        maps.event.addListener(mk, "click", () => {
          const name =
            getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
          const address =
            getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
          const productName =
            getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) ||
            "";
          const installLocation =
            getField(row, ["설치위치", "설치 위치", "installLocation"]) || "";

          const households = toNumLoose(
            getField(row, [
              "세대수",
              "세대 수",
              "세대",
              "가구수",
              "가구 수",
              "세대수(가구)",
              "households",
            ])
          );
          const residents = toNumLoose(
            getField(row, [
              "거주인원",
              "거주 인원",
              "인구수",
              "총인구",
              "입주민수",
              "거주자수",
              "residents",
            ])
          );
          const monitors = toNumLoose(
            getField(row, [
              "모니터수량",
              "모니터 수량",
              "모니터대수",
              "엘리베이터TV수",
              "monitors",
            ])
          );
          const monthlyImpressions = toNumLoose(
            getField(row, [
              "월송출횟수",
              "월 송출횟수",
              "월 송출 횟수",
              "월송출",
              "노출수(월)",
              "monthlyImpressions",
            ])
          );
          const monthlyFee = toNumLoose(
            getField(row, [
              "월광고료",
              "월 광고료",
              "월 광고비",
              "월비용",
              "월요금",
              "month_fee",
              "monthlyFee",
            ])
          );
          const monthlyFeeY1 = toNumLoose(
            getField(row, [
              "1년 계약 시 월 광고료",
              "1년계약시월광고료",
              "연간월광고료",
              "할인 월 광고료",
              "연간_월광고료",
              "monthlyFeeY1",
            ])
          );
          const costPerPlay = toNumLoose(
            getField(row, ["1회당 송출비용", "송출 1회당 비용", "costPerPlay"])
          );
          const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
          const imageUrl =
            getField(row, ["imageUrl", "이미지", "썸네일", "thumbnail"]) ||
            undefined;

          const sel: SelectedApt = {
            name,
            address,
            productName,
            installLocation,
            households,
            residents,
            monitors,
            monthlyImpressions,
            costPerPlay,
            hours,
            monthlyFee,
            monthlyFeeY1,
            imageUrl,
            lat,
            lng,
          };
          setSelected(sel);

          // 같은 좌표 군을 spiderfy
          spiderRef.current?.spiderfy(groupKeyOf(row));

          // ★ 이전 클릭 마커 복구
          if (lastClickedRef.current && lastClickedRef.current !== mk) {
            const prevRow = lastClickedRef.current.__row || {};
            const prevName = String(
              getField(prevRow, ["단지명", "name", "아파트명"]) || ""
            );
            const prevKey = normName(prevName);
            const prevSelected =
              prevKey && selectedNameSetRef.current.has(prevKey);
            lastClickedRef.current.setImage(
              prevSelected ? imgs.yellow : imgs.purple
            );
          }
          // ★ 현재 클릭 마커 강조
          mk.setImage(imgs.clicked);
          lastClickedRef.current = mk;
        });

        markerCacheRef.current.set(key, mk);
        toAdd.push(mk); // 이번 프레임에 새로 add
      } else {
        // 위치/타이틀 최신화(필요 시)
        mk.setPosition(pos);
        if (mk.getTitle?.() !== nameText) mk.setTitle?.(nameText);

        // ★ 선택/클릭 상태 유지(줌/이동 후에도)
        const isSelected = nk && selectedNameSetRef.current.has(nk);
        let imgToUse = isSelected ? imgs.yellow : imgs.purple;
        if (lastClickedRef.current && lastClickedRef.current.__key === key) {
          imgToUse = imgs.clicked; // 클릭된 마커면 클릭 이미지 유지
        }
        mk.setImage(imgToUse);
      }

      // 이름 인덱싱(담기/해제 시 여러 개 동시 전환)
      if (nk) {
        if (!nameIndexRef.current[nk]) nameIndexRef.current[nk] = [];
        nameIndexRef.current[nk].push(mk);
      }

      // spiderfy 그룹 구성
      const gk = groupKeyOf(row);
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk)!.push(mk);

      newMarkers.push(mk);
    });

    // ★ 깜빡임 최소화 핵심: diff 적용 (clear() 안 함)
    // 1) 새로 추가할 마커만 add
    if (toAdd.length) clusterer.addMarkers(toAdd);

    // 2) 캐시에 있었으나 이번 프레임에 빠진 마커만 제거
    const toRemove: KMarker[] = [];
    markerCacheRef.current.forEach((mk, key) => {
      if (!nowKeys.has(key)) {
        toRemove.push(mk);
        markerCacheRef.current.delete(key);
      }
    });
    if (toRemove.length) clusterer.removeMarkers(toRemove);

    // ★ 클릭 마커가 제거됐다면 참조 해제(안전)
    if (lastClickedRef.current && toRemove.includes(lastClickedRef.current)) {
      lastClickedRef.current = null;
    }

    // spiderfy 그룹 최신화
    spiderRef.current?.setGroups(groups);

    // 0건이면 → 확장 바운드 1회 재시도
    if (!newMarkers.length) {
      const pad = expandBounds(bounds, 0.12);
      const { data: data2, error: err2 } = await client
        .from("raw_places")
        .select("*")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", pad.minLat)
        .lte("lat", pad.maxLat)
        .gte("lng", pad.minLng)
        .lte("lng", pad.maxLng)
        .limit(5000);

      if (err2) {
        console.warn("[MapPage] expanded select error:", err2.message);
        return;
      }
      if (reqId !== lastReqIdRef.current) return;

      const rows2 = (data2 ?? []) as PlaceRow[];
      rows2.forEach((row) => {
        if (row.lat == null || row.lng == null) return;

        const key = `${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}|${
          row.id != null ? String(row.id) : ""
        }`;
        if (markerCacheRef.current.has(key)) return; // 이미 존재

        const lat = Number(row.lat),
          lng = Number(row.lng);
        const pos = new maps.LatLng(lat, lng);
        const nameText = String(getField(row, ["단지명", "name", "아파트명"]) || "");
        const nk = normName(nameText);
        const isSelected = nk && selectedNameSetRef.current.has(nk);

        const mk: KMarker = new maps.Marker({
          position: pos,
          title: nameText,
          image: isSelected ? imgs.yellow : imgs.purple,
        });
        mk.__key = key;
        mk.__basePos = pos;
        mk.__row = row;

        maps.event.addListener(mk, "click", () => {
          const name =
            getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
          const address =
            getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
          const productName =
            getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) ||
            "";
          const installLocation =
            getField(row, ["설치위치", "설치 위치", "installLocation"]) || "";
          const households = toNumLoose(
            getField(row, [
              "세대수",
              "세대 수",
              "세대",
              "가구수",
              "가구 수",
              "세대수(가구)",
              "households",
            ])
          );
          const residents = toNumLoose(
            getField(row, [
              "거주인원",
              "거주 인원",
              "인구수",
              "총인구",
              "입주민수",
              "거주자수",
              "residents",
            ])
          );
          const monitors = toNumLoose(
            getField(row, [
              "모니터수량",
              "모니터 수량",
              "모니터대수",
              "엘리베이터TV수",
              "monitors",
            ])
          );
          const monthlyImpressions = toNumLoose(
            getField(row, [
              "월송출횟수",
              "월 송출횟수",
              "월 송출 횟수",
              "월송출",
              "노출수(월)",
              "monthlyImpressions",
            ])
          );
          const monthlyFee = toNumLoose(
            getField(row, [
              "월광고료",
              "월 광고료",
              "월 광고비",
              "월비용",
              "월요금",
              "month_fee",
              "monthlyFee",
            ])
          );
          const monthlyFeeY1 = toNumLoose(
            getField(row, [
              "1년 계약 시 월 광고료",
              "1년계약시월광고료",
              "연간월광고료",
              "할인 월 광고료",
              "연간_월광고료",
              "monthlyFeeY1",
            ])
          );
          const costPerPlay = toNumLoose(
            getField(row, ["1회당 송출비용", "송출 1회당 비용", "costPerPlay"])
          );
          const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
          const imageUrl =
            getField(row, ["imageUrl", "이미지", "썸네일", "thumbnail"]) ||
            undefined;

          const sel: SelectedApt = {
            name,
            address,
            productName,
            installLocation,
            households,
            residents,
            monitors,
            monthlyImpressions,
            costPerPlay,
            hours,
            monthlyFee,
            monthlyFeeY1,
            imageUrl,
            lat,
            lng,
          };
          setSelected(sel);
          spiderRef.current?.spiderfy(`${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}`);

          // ★ 이전 클릭 마커 복구
          if (lastClickedRef.current && lastClickedRef.current !== mk) {
            const prevRow = lastClickedRef.current.__row || {};
            const prevName = String(
              getField(prevRow, ["단지명", "name", "아파트명"]) || ""
            );
            const prevKey = normName(prevName);
            const prevSelected =
              prevKey && selectedNameSetRef.current.has(prevKey);
            lastClickedRef.current.setImage(
              prevSelected ? imgs.yellow : imgs.purple
            );
          }
          // ★ 현재 클릭 마커 강조
          mk.setImage(imgs.clicked);
          lastClickedRef.current = mk;
        });

        markerCacheRef.current.set(key, mk);
        // ★ 클릭/선택 상태 반영하여 이미지 지정
        let imgToUse = isSelected ? imgs.yellow : imgs.purple;
        if (lastClickedRef.current && lastClickedRef.current.__key === key) {
          imgToUse = imgs.clicked;
        }
        mk.setImage(imgToUse);

        clusterer.addMarker(mk);
      });
    }
  }

  /* ------------------ 장소 검색 → 이동 ------------------ */
  function runPlaceSearch(query: string) {
    const kakao = (window as KakaoNS).kakao;
    const places = placesRef.current;
    if (!places) return;
    places.keywordSearch(query, (results: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !results?.length) return;
      const first = results[0];
      const lat = Number(first.y),
        lng = Number(first.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const latlng = new kakao.maps.LatLng(lat, lng);
      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);
      loadMarkersInBounds();
    });
  }
  function handleSearch(q: string) {
    writeQuery(q);
    runPlaceSearch(q);
  }
  function closeSelected() {
    setSelected(null);
  }

  const mapLeftClass = selected ? "md:left-[720px]" : "md:left-[360px]";

  /* ------------------ 렌더 ------------------ */
  const MapChromeAny = MapChrome as any;

  return (
    <div className="w-screen h-[100dvh] bg-white">
      <div
        ref={mapRef}
        className={`fixed top-16 left-0 right-0 bottom-0 z-[10] ${mapLeftClass}`}
        aria-label="map"
      />
      <MapChromeAny
        selected={selected}
        onCloseSelected={closeSelected}
        onSearch={handleSearch}
        initialQuery={initialQ}
        setMarkerState={setMarkerState} // ✅ 담기/해제시 노랑/보라 변경
      />
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError}
        </div>
      )}
    </div>
  );
}
