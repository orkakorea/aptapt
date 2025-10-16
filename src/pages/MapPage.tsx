import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MapChrome, { SelectedApt } from "../components/MapChrome";

type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480cec67ebae";

/* =========================================================================
   ① 마커 이미지 유틸
   ------------------------------------------------------------------------- */
const PIN_PURPLE_URL = "/makers/pin-purple@2x.png"; // 기본
const PIN_YELLOW_URL = "/makers/pin-yellow@2x.png"; // 담김(선택)
const PIN_CLICKED_URL = "/makers/pin-purple@3x.png"; // 클릭 강조(선택 아님일 때만)

const PIN_SIZE = 51; // 원본 102px(@2x)의 절반
const PIN_OFFSET = { x: PIN_SIZE / 2, y: PIN_SIZE }; // 바닥 중앙

// 검색용 핀(요구사항: public/pin.png)
const SEARCH_PIN_URL = "/pin.png";
const SEARCH_PIN_SIZE = 51;
const SEARCH_PIN_OFFSET = { x: SEARCH_PIN_SIZE / 2, y: SEARCH_PIN_SIZE };

function markerImages(maps: any) {
  const { MarkerImage, Size, Point } = maps;
  const opt = { offset: new Point(PIN_OFFSET.x, PIN_OFFSET.y) };
  const sz = new Size(PIN_SIZE, PIN_SIZE);
  const purple = new MarkerImage(PIN_PURPLE_URL, sz, opt);
  const yellow = new MarkerImage(PIN_YELLOW_URL, sz, opt);
  const clicked = new MarkerImage(PIN_CLICKED_URL, sz, opt);
  return { purple, yellow, clicked };
}

function buildSearchMarkerImage(maps: any) {
  const { MarkerImage, Size, Point } = maps;
  return new MarkerImage(SEARCH_PIN_URL, new Size(SEARCH_PIN_SIZE, SEARCH_PIN_SIZE), {
    offset: new Point(SEARCH_PIN_OFFSET.x, SEARCH_PIN_OFFSET.y),
  });
}

/* =========================================================================
   ② Kakao SDK 정리 + 로더
   ------------------------------------------------------------------------- */
function cleanupKakaoScripts() {
  const candidates = Array.from(document.scripts).filter((s) => s.src.includes("dapi.kakao.com/v2/maps/sdk.js"));
  candidates.forEach((s) => s.parentElement?.removeChild(s));

  const w = window as any;
  if (w.kakao) {
    try {
      delete w.kakao;
    } catch {
      w.kakao = undefined;
    }
  }
}

function loadKakao(): Promise<any> {
  const w = window as any;

  if (w.kakao?.maps && typeof w.kakao.maps.LatLng === "function") {
    return Promise.resolve(w.kakao);
  }
  if (w.__kakaoLoadingPromise) return w.__kakaoLoadingPromise;

  const envKey = (import.meta as any).env?.VITE_KAKAO_JS_KEY as string | undefined;
  const key = envKey && envKey.trim() ? envKey : FALLBACK_KAKAO_KEY;

  cleanupKakaoScripts();

  w.__kakaoLoadingPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = "kakao-maps-sdk";
    s.charset = "utf-8";
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services,clusterer`;
    s.onload = () => {
      if (!w.kakao?.maps) return reject(new Error("kakao maps namespace missing"));
      w.kakao.maps.load(() => {
        if (typeof w.kakao.maps.LatLng !== "function") {
          return reject(new Error("LatLng constructor not ready"));
        }
        resolve(w.kakao);
      });
    };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });

  return w.__kakaoLoadingPromise;
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
  if (v == null) return undefined;
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
   ④ 타입/키 유틸
   ------------------------------------------------------------------------- */
type PlaceRow = {
  id?: number | string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any;
};
type KMarker = any & {
  __key?: string;
  __basePos?: any;
  __row?: PlaceRow;
};

const monthlyFeeOf = (row: PlaceRow): number => {
  return (
    toNumLoose(getField(row, ["월광고료", "월 광고료", "월 광고비", "월비용", "월요금", "month_fee", "monthlyFee"])) ??
    0
  );
};

const groupKeyFromRow = (row: PlaceRow) => `${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}`;

const buildRowKeyFromRow = (row: PlaceRow) => {
  const lat = Number(row.lat),
    lng = Number(row.lng);
  const idPart = row.id != null ? String(row.id) : "";
  const productName = String(getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) || "");
  const installLocation = String(getField(row, ["설치위치", "설치 위치", "installLocation"]) || "");
  return idPart ? `id:${idPart}` : `xy:${lat.toFixed(7)},${lng.toFixed(7)}|p:${productName}|loc:${installLocation}`;
};

/* =========================================================================
   ⑤ ‘정적 분리(항상 나란히)’ 레이아웃
   ------------------------------------------------------------------------- */
/** 같은 좌표의 마커들을 가로로 일정 px 간격으로 나란히 배치 */
function layoutMarkersSideBySide(map: any, group: KMarker[]) {
  if (!group || group.length <= 1) return;
  const proj = map.getProjection();
  const center = group[0].__basePos;
  const cpt = proj.containerPointFromCoords(center);

  const N = group.length;
  const GAP = 26; // 마커 간 픽셀 간격
  const totalW = GAP * (N - 1);
  const startX = cpt.x - totalW / 2;
  const y = cpt.y;

  for (let i = 0; i < N; i++) {
    const pt = new (window as any).kakao.maps.Point(startX + i * GAP, y);
    const pos = proj.coordsFromContainerPoint(pt);
    group[i].setPosition(pos);
  }
}

/* =========================================================================
   ⑥ 메인 컴포넌트
   ------------------------------------------------------------------------- */
export default function MapPage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);

  // 검색 핀 & 반경(1km) 오버레이
  const searchPinRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const radiusLabelRef = useRef<any>(null);
  const radiusLabelElRef = useRef<HTMLDivElement | null>(null);

  // 마커/상태/그룹 캐시
  const markerCacheRef = useRef<Map<string, KMarker>>(new Map());
  const keyIndexRef = useRef<Record<string, KMarker[]>>({});
  const groupsRef = useRef<Map<string, KMarker[]>>(new Map());
  const selectedRowKeySetRef = useRef<Set<string>>(new Set());
  const lastReqIdRef = useRef<number>(0);

  // 마지막 클릭 마커(보라@3x 강조용)
  const lastClickedRef = useRef<KMarker | null>(null);

  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [initialQ, setInitialQ] = useState("");
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  // === 그룹 우선순위: 옐로(담김) > 월광고료 내림차순 ===
  const orderAndApplyZIndex = useCallback((arr: KMarker[]) => {
    if (!arr || arr.length <= 1) return arr;
    const sorted = arr.slice().sort((a, b) => {
      const ra = a.__row as PlaceRow;
      const rb = b.__row as PlaceRow;
      const aRowKey = buildRowKeyFromRow(ra);
      const bRowKey = buildRowKeyFromRow(rb);
      const aSel = selectedRowKeySetRef.current.has(aRowKey) ? 1 : 0;
      const bSel = selectedRowKeySetRef.current.has(bRowKey) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      const aFee = monthlyFeeOf(ra);
      const bFee = monthlyFeeOf(rb);
      if (aFee !== bFee) return bFee - aFee;
      return 0;
    });

    const TOP = 100000;
    for (let i = 0; i < sorted.length; i++) {
      try {
        sorted[i].setZIndex?.(TOP - i);
      } catch {}
    }
    arr.length = 0;
    sorted.forEach((m) => arr.push(m));
    return arr;
  }, []);

  const applyGroupPrioritiesMap = useCallback(
    (groups: Map<string, KMarker[]>) => {
      groups.forEach((list) => orderAndApplyZIndex(list));
    },
    [orderAndApplyZIndex],
  );

  const applyGroupPrioritiesForRowKey = useCallback(
    (rowKey: string) => {
      const list = keyIndexRef.current[rowKey];
      if (!list || !list.length) return;
      const row = list[0].__row as PlaceRow;
      const gk = groupKeyFromRow(row);
      const group = groupsRef.current.get(gk);
      if (group && group.length) orderAndApplyZIndex(group);
    },
    [orderAndApplyZIndex],
  );

  /** 같은 좌표 그룹 전체를 ‘항상 나란히’ 재배치 */
  const applyStaticSeparationAll = useCallback(() => {
    const map = mapObjRef.current;
    if (!map || !(window as any).kakao?.maps) return;
    groupsRef.current.forEach((group) => layoutMarkersSideBySide(map, group));
  }, []);

  /* ------------------ 지도 초기화 ------------------ */
  useEffect(() => {
    let resizeHandler: any;
    let map: any;

    cleanupKakaoScripts();

    loadKakao()
      .then((kakao) => {
        setKakaoError(null);
        if (!mapRef.current) return;
        mapRef.current.style.minHeight = "300px";
        mapRef.current.style.minWidth = "300px";

        const center = new kakao.maps.LatLng(37.5665, 126.978);
        map = new kakao.maps.Map(mapRef.current, { center, level: 6 });
        mapObjRef.current = map;

        (window as any).kakaoMap = map;
        (window as any).__kakaoMap = map;

        placesRef.current = new kakao.maps.services.Places();
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: true,
          gridSize: 80,
        });

        // 줌/리사이즈/렌더링 직후에도 항상 고정 분리 유지
        kakao.maps.event.addListener(map, "zoom_changed", applyStaticSeparationAll);
        kakao.maps.event.addListener(map, "idle", async () => {
          await loadMarkersInBounds(); // ⏱ 즉시 실행
          applyStaticSeparationAll();
        });

        setTimeout(() => map && map.relayout(), 0);
        (async () => {
          await loadMarkersInBounds();
          applyStaticSeparationAll();
        })();

        const q0 = readQuery();
        setInitialQ(q0);
        if (q0) runPlaceSearch(q0);

        resizeHandler = () => {
          if (!map) return;
          map.relayout();
          applyStaticSeparationAll();
        };
        window.addEventListener("resize", resizeHandler);
      })
      .catch((err) => {
        console.error("[KakaoMap] load error:", err);
        setKakaoError(err?.message || String(err));
      });

    return () => {
      window.removeEventListener("resize", resizeHandler);
      const w = window as any;
      if (w.kakaoMap === mapObjRef.current) w.kakaoMap = null;
      if (w.__kakaoMap === mapObjRef.current) w.__kakaoMap = null;

      try {
        radiusCircleRef.current?.setMap(null);
        radiusLabelRef.current?.setMap(null);
        searchPinRef.current?.setMap?.(null);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyStaticSeparationAll]);

  // 2탭 열고 닫을 때 레이아웃 보정
  useEffect(() => {
    const m = mapObjRef.current;
    if ((window as any).kakao?.maps && m)
      setTimeout(() => {
        m.relayout();
        applyStaticSeparationAll();
      }, 0);
  }, [selected, applyStaticSeparationAll]);

  /* ------------------ MapChrome → 행(rowKey) 단위 색 전환 ------------------ */
  const setMarkerStateByRowKey = useCallback(
    (rowKey: string, state: "default" | "selected", forceYellowNow = false) => {
      if (!rowKey) return;
      const maps = (window as KakaoNS).kakao?.maps;
      if (!maps) return;
      const imgs = markerImages(maps);

      if (state === "selected") selectedRowKeySetRef.current.add(rowKey);
      else selectedRowKeySetRef.current.delete(rowKey);

      const list = keyIndexRef.current[rowKey];
      if (list?.length) {
        list.forEach((mk) => {
          const shouldBeYellow = state === "selected" || selectedRowKeySetRef.current.has(rowKey);

          // 담기 즉시 또는 이미 담긴 항목은 무조건 노란색 유지
          if (forceYellowNow || shouldBeYellow) {
            mk.setImage(imgs.yellow);
            // 클릭 강조 대상이었다면 해제
            if (lastClickedRef.current === mk) lastClickedRef.current = null;
          } else {
            mk.setImage(imgs.purple);
          }
        });

        applyGroupPrioritiesForRowKey(rowKey);
        applyStaticSeparationAll();
      }
    },
    [applyGroupPrioritiesForRowKey, applyStaticSeparationAll],
  );

  /* ------------------ 바운드 내 마커 로드 ------------------ */
  async function loadMarkersInBounds() {
    const kakao = (window as KakaoNS).kakao;
    const maps = kakao?.maps;
    const map = mapObjRef.current;
    const clusterer = clustererRef.current;
    if (!maps || !map || !clusterer) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const reqId = Date.now();
    lastReqIdRef.current = reqId;

    const { data, error } = await supabase
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

    const nowKeys = new Set<string>();
    const groups = new Map<string, KMarker[]>();
    const keyOf = (row: PlaceRow) => {
      const lat = Number(row.lat),
        lng = Number(row.lng);
      const idPart = row.id != null ? String(row.id) : "";
      const prod = String(getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) || "");
      const loc = String(getField(row, ["설치위치", "설치 위치", "installLocation"]) || "");
      return `${lat.toFixed(7)},${lng.toFixed(7)}|${idPart}|${prod}|${loc}`;
    };

    keyIndexRef.current = {};
    const toAdd: KMarker[] = [];
    const newMarkers: KMarker[] = [];

    rows.forEach((row) => {
      if (row.lat == null || row.lng == null) return;

      const key = keyOf(row);
      const rowKey = buildRowKeyFromRow(row);
      nowKeys.add(key);

      let mk = markerCacheRef.current.get(key);
      const lat = Number(row.lat),
        lng = Number(row.lng);
      const pos = new maps.LatLng(lat, lng);
      const nameText = String(getField(row, ["단지명", "name", "아파트명"]) || "");

      if (!mk) {
        const isSelected = selectedRowKeySetRef.current.has(rowKey);
        mk = new maps.Marker({
          position: pos,
          title: nameText,
          image: isSelected ? imgs.yellow : imgs.purple,
        });
        mk.__key = key;
        mk.__basePos = pos;
        mk.__row = row;

        // ✅ 클릭 즉시 반응 & 담김 상태 유지
        maps.event.addListener(mk, "click", () => {
          const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
          const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
          const productName = getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) || "";
          const installLocation = getField(row, ["설치위치", "설치 위치", "installLocation"]) || "";

          const households = toNumLoose(
            getField(row, ["세대수", "세대 수", "세대", "가구수", "가구 수", "세대수(가구)", "households"]),
          );
          const residents = toNumLoose(
            getField(row, ["거주인원", "거주 인원", "인구수", "총인구", "입주민수", "거주자수", "residents"]),
          );
          const monitors = toNumLoose(
            getField(row, ["모니터수량", "모니터 수량", "모니터대수", "엘리베이터TV수", "monitors"]),
          );
          const monthlyImpressions = toNumLoose(
            getField(row, ["월송출횟수", "월 송출횟수", "월 송출 횟수", "월송출", "노출수(월)", "monthlyImpressions"]),
          );
          const monthlyFee = toNumLoose(
            getField(row, ["월광고료", "월 광고료", "월 광고비", "월비용", "월요금", "month_fee", "monthlyFee"]),
          );
          const monthlyFeeY1 = toNumLoose(
            getField(row, [
              "1년 계약 시 월 광고료",
              "1년계약시월광고료",
              "연간월광고료",
              "할인 월 광고료",
              "연간_월광고료",
              "monthlyFeeY1",
            ]),
          );
          const costPerPlay = toNumLoose(getField(row, ["1회당 송출비용", "송출 1회당 비용", "costPerPlay"]));
          const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
          const imageUrl = getField(row, ["imageUrl", "이미지", "썸네일", "thumbnail"]) || undefined;

          const sel: SelectedApt = {
            rowKey,
            rowId: row.id != null ? String(row.id) : undefined,
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

          // 🔴 클릭 즉시(바로) 아이콘 갱신:
          // 담겨있는 행이면 계속 노란색 유지, 아니면 보라@3x 강조
          const isAlreadySelected = selectedRowKeySetRef.current.has(rowKey);
          if (isAlreadySelected) {
            mk.setImage(imgs.yellow);
            // 클릭 강조 상태 없앰
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              // 이전 클릭 강조되었던 마커 복구
              const prev = lastClickedRef.current;
              const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
              prev.setImage(selectedRowKeySetRef.current.has(prevRowKey) ? imgs.yellow : imgs.purple);
            }
            lastClickedRef.current = null;
          } else {
            // 이전 클릭 강조 복구
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prev = lastClickedRef.current;
              const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
              prev.setImage(selectedRowKeySetRef.current.has(prevRowKey) ? imgs.yellow : imgs.purple);
            }
            mk.setImage(imgs.clicked);
            lastClickedRef.current = mk;
          }

          // 레이아웃 즉시 유지
          applyStaticSeparationAll();
        });

        markerCacheRef.current.set(key, mk);
        toAdd.push(mk);
      } else {
        mk.setPosition(pos);
        if (mk.getTitle?.() !== nameText) mk.setTitle?.(nameText);
        const isSelected = selectedRowKeySetRef.current.has(rowKey);
        let imgToUse = isSelected ? imgs.yellow : imgs.purple;
        if (!isSelected && lastClickedRef.current && lastClickedRef.current.__key === key) {
          imgToUse = imgs.clicked;
        }
        mk.setImage(imgToUse);
      }

      if (!keyIndexRef.current[rowKey]) keyIndexRef.current[rowKey] = [];
      keyIndexRef.current[rowKey].push(mk);

      const gk = groupKeyFromRow(row);
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk)!.push(mk);

      newMarkers.push(mk);
    });

    if (toAdd.length) clustererRef.current.addMarkers(toAdd);

    const toRemove: KMarker[] = [];
    markerCacheRef.current.forEach((mk, key) => {
      if (!nowKeys.has(key)) {
        toRemove.push(mk);
        markerCacheRef.current.delete(key);
      }
    });
    if (toRemove.length) clustererRef.current.removeMarkers(toRemove);

    if (lastClickedRef.current && toRemove.includes(lastClickedRef.current)) {
      lastClickedRef.current = null;
    }

    applyGroupPrioritiesMap(groups);
    groupsRef.current = groups;

    // 확장 조회(패딩) 분기
    if (!newMarkers.length) {
      const pad = expandBounds(bounds, 0.12);
      const { data: data2, error: err2 } = await supabase
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

        const key = `${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}|${row.id != null ? String(row.id) : ""}|${String(getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) || "")}|${String(getField(row, ["설치위치", "설치 위치", "installLocation"]) || "")}`;
        if (markerCacheRef.current.has(key)) return;

        const lat = Number(row.lat),
          lng = Number(row.lng);
        const pos = new maps.LatLng(lat, lng);
        const nameText = String(getField(row, ["단지명", "name", "아파트명"]) || "");
        const rowKey = buildRowKeyFromRow(row);
        const isSelected = selectedRowKeySetRef.current.has(rowKey);

        const mk: KMarker = new maps.Marker({
          position: pos,
          title: nameText,
          image: isSelected ? imgs.yellow : imgs.purple,
        });
        mk.__key = key;
        mk.__basePos = pos;
        mk.__row = row;

        maps.event.addListener(mk, "click", () => {
          const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
          const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
          const productName = getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName"]) || "";
          const installLocation = getField(row, ["설치위치", "설치 위치", "installLocation"]) || "";
          const households = toNumLoose(
            getField(row, ["세대수", "세대 수", "세대", "가구수", "가구 수", "세대수(가구)", "households"]),
          );
          const residents = toNumLoose(
            getField(row, ["거주인원", "거주 인원", "인구수", "총인구", "입주민수", "거주자수", "residents"]),
          );
          const monitors = toNumLoose(
            getField(row, ["모니터수량", "모니터 수량", "모니터대수", "엘리베이터TV수", "monitors"]),
          );
          const monthlyImpressions = toNumLoose(
            getField(row, ["월송출횟수", "월 송출횟수", "월 송출 횟수", "월송출", "노출수(월)", "monthlyImpressions"]),
          );
          const monthlyFee = toNumLoose(
            getField(row, ["월광고료", "월 광고료", "월 광고비", "월비용", "월요금", "month_fee", "monthlyFee"]),
          );
          const monthlyFeeY1 = toNumLoose(
            getField(row, [
              "1년 계약 시 월 광고료",
              "1년계약시월광고료",
              "연간월광고료",
              "할인 월 광고료",
              "연간_월광고료",
              "monthlyFeeY1",
            ]),
          );
          const costPerPlay = toNumLoose(getField(row, ["1회당 송출비용", "송출 1회당 비용", "costPerPlay"]));
          const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
          const imageUrl = getField(row, ["imageUrl", "이미지", "썸네일", "thumbnail"]) || undefined;

          const sel: SelectedApt = {
            rowKey,
            rowId: row.id != null ? String(row.id) : undefined,
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

          const isAlreadySelected = selectedRowKeySetRef.current.has(rowKey);
          if (isAlreadySelected) {
            mk.setImage(imgs.yellow);
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prevRowKey = buildRowKeyFromRow(lastClickedRef.current.__row as PlaceRow);
              lastClickedRef.current.setImage(selectedRowKeySetRef.current.has(prevRowKey) ? imgs.yellow : imgs.purple);
            }
            lastClickedRef.current = null;
          } else {
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prevRowKey = buildRowKeyFromRow(lastClickedRef.current.__row as PlaceRow);
              lastClickedRef.current.setImage(selectedRowKeySetRef.current.has(prevRowKey) ? imgs.yellow : imgs.purple);
            }
            mk.setImage(imgs.clicked);
            lastClickedRef.current = mk;
          }

          applyStaticSeparationAll();
        });

        markerCacheRef.current.set(key, mk);

        let imgToUse = isSelected ? imgs.yellow : imgs.purple;
        if (!isSelected && lastClickedRef.current && lastClickedRef.current.__key === key) imgToUse = imgs.clicked;
        mk.setImage(imgToUse);

        if (!keyIndexRef.current[rowKey]) keyIndexRef.current[rowKey] = [];
        keyIndexRef.current[rowKey].push(mk);
        clustererRef.current.addMarker(mk);
      });

      const groups2 = new Map<string, KMarker[]>();
      markerCacheRef.current.forEach((m) => {
        const r = m.__row as PlaceRow;
        const gk = groupKeyFromRow(r);
        if (!groups2.has(gk)) groups2.set(gk, []);
        groups2.get(gk)!.push(m);
      });

      applyGroupPrioritiesMap(groups2);
      groupsRef.current = groups2;
    }

    // 마지막: 항상 ‘나란히’ 배치 적용
    applyStaticSeparationAll();
  }

  /* ------------------ 반경 UI 컨트롤 ------------------ */
  function clearRadiusUI() {
    try {
      radiusCircleRef.current?.setMap(null);
    } catch {}
    try {
      radiusLabelRef.current?.setMap(null);
    } catch {}
    try {
      searchPinRef.current?.setMap?.(null);
    } catch {}

    radiusCircleRef.current = null;
    radiusLabelRef.current = null;
    searchPinRef.current = null;
    radiusLabelElRef.current = null;
  }

  function ensureRadiusLabelContent(onClose: () => void) {
    if (radiusLabelElRef.current) return radiusLabelElRef.current;

    const root = document.createElement("div");
    root.style.position = "relative";
    root.style.pointerEvents = "none";

    const chip = document.createElement("div");
    chip.textContent = "1km";
    chip.style.padding = "6px 10px";
    chip.style.borderRadius = "999px";
    chip.style.background = "#FFD400";
    chip.style.color = "#222";
    chip.style.fontSize = "12px";
    chip.style.fontWeight = "700";
    chip.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
    chip.style.whiteSpace = "nowrap";
    chip.style.userSelect = "none";

    const btn = document.createElement("button");
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "1km 범위 닫기");
    btn.style.position = "absolute";
    btn.style.top = "-8px";
    btn.style.right = "-8px";
    btn.style.width = "22px";
    btn.style.height = "22px";
    btn.style.borderRadius = "999px";
    btn.style.background = "#FFFFFF";
    btn.style.border = "2px solid #FFD400";
    btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.fontSize = "14px";
    btn.style.lineHeight = "1";
    btn.style.color = "#222";
    btn.style.cursor = "pointer";
    btn.style.pointerEvents = "auto";
    btn.textContent = "×";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    });

    root.appendChild(chip);
    root.appendChild(btn);

    radiusLabelElRef.current = root;
    return root;
  }

  /* ------------------ 검색 핀 + 반경 1km 오버레이 ------------------ */
  function drawSearchOverlays(latlng: any) {
    const kakao = (window as KakaoNS).kakao;
    if (!kakao?.maps || !mapObjRef.current) return;
    const map = mapObjRef.current;

    if (!radiusCircleRef.current) {
      radiusCircleRef.current = new kakao.maps.Circle({
        map,
        center: latlng,
        radius: 1000,
        strokeWeight: 2,
        strokeColor: "#FFD400",
        strokeOpacity: 0.6,
        strokeStyle: "solid",
        fillColor: "#FFD400",
        fillOpacity: 0.11,
        zIndex: -1000,
      });
    } else {
      radiusCircleRef.current.setOptions({
        center: latlng,
        radius: 1000,
        strokeColor: "#FFD400",
        fillColor: "#FFD400",
        fillOpacity: 0.11,
      });
      radiusCircleRef.current.setZIndex?.(-1000);
      radiusCircleRef.current.setMap(map);
    }

    const labelContent = ensureRadiusLabelContent(clearRadiusUI);
    if (!radiusLabelRef.current) {
      radiusLabelRef.current = new kakao.maps.CustomOverlay({
        map,
        position: latlng,
        content: labelContent,
        yAnchor: 1.6,
        zIndex: 1000000,
      });
    } else {
      radiusLabelRef.current.setContent(labelContent);
      radiusLabelRef.current.setPosition(latlng);
      radiusLabelRef.current.setZIndex?.(1000000);
      radiusLabelRef.current.setMap(map);
    }

    const searchImg = buildSearchMarkerImage(kakao.maps);
    if (!searchPinRef.current) {
      searchPinRef.current = new kakao.maps.Marker({
        map,
        position: latlng,
        image: searchImg,
        zIndex: 500000,
        clickable: false,
      });
    } else {
      searchPinRef.current.setPosition(latlng);
      searchPinRef.current.setImage(searchImg);
      searchPinRef.current.setZIndex?.(500000);
      searchPinRef.current.setMap(map);
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

      drawSearchOverlays(latlng);

      loadMarkersInBounds().then(() => applyStaticSeparationAll());
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
      <div ref={mapRef} className={`fixed top-16 left-0 right-0 bottom-0 z-[10] ${mapLeftClass}`} aria-label="map" />
      <MapChromeAny
        selected={selected}
        onCloseSelected={closeSelected}
        onSearch={handleSearch}
        initialQuery={initialQ}
        setMarkerStateByRowKey={setMarkerStateByRowKey}
      />
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError}
        </div>
      )}
    </div>
  );
}
