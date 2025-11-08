// src/pages/MapPage.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MapChrome, { SelectedApt } from "../components/MapChrome";
import { LocateFixed, Plus } from "lucide-react";
import getQuickImageFactory from "@/lib/quickAdd";
import { useKakaoLoader } from "@/hooks/useKakaoLoader";

type KakaoNS = typeof window & { kakao: any };

/* =========================================================================
   ① 마커 이미지 유틸
   ------------------------------------------------------------------------- */
const PIN_PURPLE_URL = "/makers/pin-purple@2x.png"; // 기본
const PIN_YELLOW_URL = "/makers/pin-yellow@2x.png"; // 담김(선택)
const PIN_CLICKED_URL = "/makers/pin-purple@3x.png"; // 클릭 강조(선택 아님일 때만)

const PIN_SIZE = 51;
const PIN_OFFSET = { x: PIN_SIZE / 2, y: PIN_SIZE };

const SEARCH_PIN_URL = "/pin.png";
const SEARCH_PIN_SIZE = 51;
const SEARCH_PIN_OFFSET = { x: SEARCH_PIN_SIZE / 2, y: SEARCH_PIN_SIZE };

// Kakao 이미지 생성자 존재 여부
function hasImgCtors(maps: any) {
  return Boolean(maps?.MarkerImage && maps?.Size && maps?.Point);
}

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
function safeSetImage(marker: any, image: any) {
  try {
    if (image) marker.setImage(image);
  } catch {}
}

/* =========================================================================
   ② 헬퍼
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
  for (const k of keys) if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  return undefined;
}
function expandBounds(bounds: any, pad = 0.05) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return { minLat: sw.getLat() - pad, maxLat: ne.getLat() + pad, minLng: sw.getLng() - pad, maxLng: ne.getLng() + pad };
}
// raw_places.id 또는 RPC place_id 모두 수용
const rowIdOf = (r: any) => r?.id ?? r?.place_id ?? r?.placeId ?? r?.placeID ?? null;

/* =========================================================================
   ③ 타입/키 유틸
   ------------------------------------------------------------------------- */
type PlaceRow = {
  id?: number | string;
  place_id?: number | string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any;
};
type KMarker = any & { __key?: string; __basePos?: any; __row?: PlaceRow };

const monthlyFeeOf = (row: PlaceRow): number =>
  toNumLoose(getField(row, ["월광고료", "월 광고료", "월 광고비", "월비용", "월요금", "month_fee", "monthlyFee"])) ?? 0;

const groupKeyFromRow = (row: PlaceRow) => `${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}`;

const buildRowKeyFromRow = (row: PlaceRow) => {
  const lat = Number(row.lat),
    lng = Number(row.lng);
  const idPart = rowIdOf(row) != null ? String(rowIdOf(row)) : "";
  const productName = String(
    getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName", "product_name"]) || "",
  );
  const installLocation = String(getField(row, ["설치위치", "설치 위치", "installLocation", "install_location"]) || "");
  return idPart ? `id:${idPart}` : `xy:${lat.toFixed(7)},${lng.toFixed(7)}|p:${productName}|loc:${installLocation}`;
};

/* =========================================================================
   ④ ‘정적 분리(항상 나란히)’ 레이아웃
   ------------------------------------------------------------------------- */
function layoutMarkersSideBySide(map: any, group: KMarker[]) {
  const kakao = (window as any).kakao;
  if (!map || !group || group.length <= 1) return;
  if (!kakao?.maps || typeof kakao.maps.Point !== "function") return; // 가드
  const proj = map.getProjection?.();
  if (!proj?.containerPointFromCoords || !proj?.coordsFromContainerPoint) return;

  const center = group[0].__basePos;
  const cpt = proj.containerPointFromCoords(center);
  const N = group.length,
    GAP = 26,
    totalW = GAP * (N - 1),
    startX = cpt.x - totalW / 2,
    y = cpt.y;
  for (let i = 0; i < N; i++) {
    const pt = new kakao.maps.Point(startX + i * GAP, y);
    const pos = proj.coordsFromContainerPoint(pt);
    group[i].setPosition(pos);
  }
}

/* =========================================================================
   ⑤ 메인 컴포넌트
   ------------------------------------------------------------------------- */
type SelectedAptX = SelectedApt & { selectedInCart?: boolean };

export default function MapPage() {
  // ✅ SDK는 오직 커스텀 훅으로만 로드 (중복 주입 금지)
  const {
    kakao,
    loading: kakaoLoading,
    error: kakaoLoadError,
  } = useKakaoLoader({
    libraries: ["services", "clusterer"],
  });

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);

  const searchPinRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const radiusLabelRef = useRef<any>(null);
  const radiusLabelElRef = useRef<HTMLDivElement | null>(null);

  const markerCacheRef = useRef<Map<string, KMarker>>(new Map());
  const keyIndexRef = useRef<Record<string, KMarker[]>>({});
  const groupsRef = useRef<Map<string, KMarker[]>>(new Map());
  const selectedRowKeySetRef = useRef<Set<string>>(new Set());
  const lastReqIdRef = useRef<number>(0);

  const lastClickedRef = useRef<KMarker | null>(null);

  // 퀵담기(공통 팩토리) & 상태
  const quickFactoryRef = useRef<ReturnType<typeof getQuickImageFactory> | null>(null);
  const quickAddRef = useRef(false);
  const [quickAdd, setQuickAdd] = useState(false);

  // 내 위치 오버레이
  const userOverlayRef = useRef<any>(null);
  const userOverlayElRef = useRef<HTMLDivElement | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [selected, setSelected] = useState<SelectedAptX | null>(null);
  const [initialQ, setInitialQ] = useState("");
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  /* ---------- 먼저 선언: 정적 분리 적용 콜백 ---------- */
  const applyStaticSeparationAll = useCallback(() => {
    const map = mapObjRef.current;
    if (!map || !(window as any).kakao?.maps) return;
    groupsRef.current.forEach((group) => layoutMarkersSideBySide(map, group));
  }, []);

  /* ---------- 공통: 마커 이미지 재계산 ---------- */
  const reimageAllMarkers = useCallback(() => {
    const maps = (window as KakaoNS).kakao?.maps;
    if (!maps) return;
    if (!hasImgCtors(maps)) return; // 생성자 없으면 스킵(충돌 회피)

    const imgs = markerImages(maps);
    markerCacheRef.current.forEach((mk) => {
      const row = mk.__row as PlaceRow;
      const rowKey = buildRowKeyFromRow(row);
      const inCart = selectedRowKeySetRef.current.has(rowKey);
      const clicked = !inCart && lastClickedRef.current === mk;
      const image = quickFactoryRef.current
        ? quickFactoryRef.current.get({
            quickOn: quickAddRef.current,
            selected: inCart,
            inCart,
            clicked,
          })
        : inCart
          ? imgs.yellow
          : clicked
            ? imgs.clicked
            : imgs.purple;
      safeSetImage(mk, image);
    });
    applyStaticSeparationAll();
  }, [applyStaticSeparationAll]);

  useEffect(() => {
    quickAddRef.current = quickAdd;
    reimageAllMarkers();
  }, [quickAdd, reimageAllMarkers]);

  /* ---------- 정렬/우선순위 ---------- */
  const orderAndApplyZIndex = useCallback((arr: KMarker[]) => {
    if (!arr || arr.length <= 1) return arr;
    const sorted = arr.slice().sort((a, b) => {
      const ra = a.__row as PlaceRow,
        rb = b.__row as PlaceRow;
      const aRowKey = buildRowKeyFromRow(ra),
        bRowKey = buildRowKeyFromRow(rb);
      const aSel = selectedRowKeySetRef.current.has(aRowKey) ? 1 : 0;
      const bSel = selectedRowKeySetRef.current.has(bRowKey) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel;
      const aFee = monthlyFeeOf(ra),
        bFee = monthlyFeeOf(rb);
      if (aFee !== bFee) return bFee - aFee;
      return 0;
    });
    const TOP = 100000;
    for (let i = 0; i < sorted.length; i++)
      try {
        sorted[i].setZIndex?.(TOP - i);
      } catch {}
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

  /* ---------- 지도 초기화 (SDK 로딩 성공 후에만) ---------- */
  useEffect(() => {
    if (kakaoLoading) return;
    if (kakaoLoadError) {
      setKakaoError(kakaoLoadError);
      return;
    }
    const w = window as any;
    if (!w.kakao?.maps) return; // 아직 window에 탑재 전

    let resizeHandler: any;
    let map: any;

    try {
      setKakaoError(null);
      if (!mapRef.current) return;

      mapRef.current.style.minHeight = "300px";
      mapRef.current.style.minWidth = "300px";
      const center = new w.kakao.maps.LatLng(37.5665, 126.978);
      map = new w.kakao.maps.Map(mapRef.current, { center, level: 6 });
      mapObjRef.current = map;
      w.kakaoMap = map;
      w.__kakaoMap = map;

      placesRef.current = new w.kakao.maps.services.Places();

      // 퀵담기 이미지 팩토리 준비(생성자 있을 때만)
      if (hasImgCtors(w.kakao.maps)) {
        quickFactoryRef.current = getQuickImageFactory(w.kakao.maps, { size: PIN_SIZE, offset: PIN_OFFSET });
      } else {
        quickFactoryRef.current = null;
      }

      const SIZES = [34, 44, 54];
      const clusterStyles = SIZES.map((sz) => ({
        width: `${sz}px`,
        height: `${sz}px`,
        lineHeight: `${sz}px`,
        textAlign: "center",
        borderRadius: "999px",
        background: "rgba(108, 45, 255, 0.18)",
        border: "1px solid rgba(108, 45, 255, 0.35)",
        color: "#6C2DFF",
        fontWeight: "700",
        fontSize: "13px",
      }));
      clustererRef.current = new w.kakao.maps.MarkerClusterer({
        map,
        averageCenter: true,
        minLevel: 6,
        disableClickZoom: true,
        gridSize: 80,
        styles: clusterStyles,
      });

      w.kakao.maps.event.addListener(map, "zoom_changed", applyStaticSeparationAll);
      w.kakao.maps.event.addListener(map, "idle", async () => {
        await loadMarkersInBounds();
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
    } catch (e: any) {
      setKakaoError(e?.message || String(e));
    }

    return () => {
      window.removeEventListener("resize", resizeHandler);
      const ww = window as any;
      if (ww.kakaoMap === mapObjRef.current) ww.kakaoMap = null;
      if (ww.__kakaoMap === mapObjRef.current) ww.__kakaoMap = null;
      try {
        radiusCircleRef.current?.setMap(null);
      } catch {}
      try {
        radiusLabelRef.current?.setMap(null);
      } catch {}
      try {
        searchPinRef.current?.setMap?.(null);
      } catch {}
      try {
        userOverlayRef.current?.setMap(null);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakaoLoading, kakaoLoadError, applyStaticSeparationAll]);

  useEffect(() => {
    const m = mapObjRef.current;
    if ((window as any).kakao?.maps && m)
      setTimeout(() => {
        m.relayout();
        applyStaticSeparationAll();
      }, 0);
  }, [selected, applyStaticSeparationAll]);

  /* ---------- 마커 색 전환(행 키) ---------- */
  const setMarkerStateByRowKey = useCallback(
    (rowKey: string, state: "default" | "selected", forceYellowNow = false) => {
      if (!rowKey) return;
      const maps = (window as KakaoNS).kakao?.maps;
      if (!maps) return;

      const canImg = hasImgCtors(maps);
      const imgs = canImg ? markerImages(maps) : null;
      if (state === "selected") selectedRowKeySetRef.current.add(rowKey);
      else selectedRowKeySetRef.current.delete(rowKey);

      const list = keyIndexRef.current[rowKey];
      if (list?.length) {
        list.forEach((mk) => {
          const inCart = state === "selected" || selectedRowKeySetRef.current.has(rowKey);
          const image =
            quickFactoryRef.current && canImg
              ? quickFactoryRef.current.get({
                  quickOn: quickAddRef.current,
                  selected: inCart,
                  inCart,
                  clicked: false,
                })
              : inCart
                ? imgs?.yellow
                : imgs?.purple;
          safeSetImage(mk, image);
          if (forceYellowNow && inCart) lastClickedRef.current = null;
        });
        setSelected((prev) =>
          prev && prev.rowKey === rowKey ? { ...prev, selectedInCart: state === "selected" } : prev,
        );
        applyGroupPrioritiesForRowKey(rowKey);
        applyStaticSeparationAll();
      }
    },
    [applyGroupPrioritiesForRowKey, applyStaticSeparationAll],
  );

  /* ---------- 카트 탭 열기 유틸(추가) ---------- */
  const openCart = useCallback((opts?: { via?: "quickadd" | "detail"; rowKey?: string }) => {
    // URL 쿼리에 tab=cart 반영(존재 시 갱신)
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", "cart");
      window.history.replaceState(null, "", u.toString());
    } catch {}
    // 커스텀 이벤트들(둘 중 하나라도 MapChrome이 듣도록 중복 발행)
    try {
      window.dispatchEvent(new CustomEvent("orka:open-cart", { detail: opts || {} }));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent("orka:ui:activate-tab", { detail: { tab: "cart", ...(opts || {}) } }));
    } catch {}
  }, []);

  /* ---------- 카트 제어 헬퍼 ---------- */
  const isRowKeySelected = useCallback(
    (rowKey?: string | null) => !!rowKey && selectedRowKeySetRef.current.has(rowKey),
    [],
  );
  const addToCartByRowKey = useCallback(
    (rowKey: string) => {
      // 담기 처리
      selectedRowKeySetRef.current.add(rowKey);
      setMarkerStateByRowKey(rowKey, "selected", true);

      // ✅ 담기 성공 후: 2탭 닫기 + 카트 열기 신호
      setSelected(null);
      applyGroupPrioritiesForRowKey(rowKey);
      applyStaticSeparationAll();
      window.dispatchEvent(new CustomEvent("orka:cart:changed", { detail: { rowKey, selected: true } }));
      openCart({ via: "detail", rowKey }); // 호출부 종류와 무관하게 카트로 전환
    },
    [applyGroupPrioritiesForRowKey, applyStaticSeparationAll, setMarkerStateByRowKey, openCart],
  );
  const removeFromCartByRowKey = useCallback(
    (rowKey: string) => {
      selectedRowKeySetRef.current.delete(rowKey);
      setMarkerStateByRowKey(rowKey, "default");
      setSelected((p) => (p && p.rowKey === rowKey ? { ...p, selectedInCart: false } : p));
      applyGroupPrioritiesForRowKey(rowKey);
      applyStaticSeparationAll();
      window.dispatchEvent(new CustomEvent("orka:cart:changed", { detail: { rowKey, selected: false } }));
      // 해제 시에는 카트를 강제 오픈하지 않음
    },
    [applyGroupPrioritiesForRowKey, applyStaticSeparationAll, setMarkerStateByRowKey],
  );
  const toggleCartByRowKey = useCallback(
    (rowKey: string) => {
      if (selectedRowKeySetRef.current.has(rowKey)) removeFromCartByRowKey(rowKey);
      else addToCartByRowKey(rowKey);
    },
    [addToCartByRowKey, removeFromCartByRowKey],
  );

  /* ---------- 포커스(카트에서 단지 클릭 시) ---------- */
  const focusByRowKey = useCallback(
    async (rowKey: string, opts?: { level?: number }) => {
      const kakao = (window as KakaoNS).kakao;
      const maps = kakao?.maps;
      const map = mapObjRef.current;
      if (!maps || !map || !rowKey) return;
      const list = keyIndexRef.current[rowKey];
      if (list?.length) {
        const mk = list[0];
        const pos = mk.getPosition?.() || mk.__basePos;
        if (opts?.level != null) map.setLevel(opts.level);
        map.setCenter(pos);
        maps.event.trigger(mk, "click"); // ← 마커 클릭과 동일 동작
        applyStaticSeparationAll();
      }
    },
    [applyStaticSeparationAll],
  );

  const focusByLatLng = useCallback(
    async (lat: number, lng: number, opts?: { level?: number }) => {
      const kakao = (window as KakaoNS).kakao;
      const maps = kakao?.maps;
      const map = mapObjRef.current;
      if (!maps || !map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const latlng = new maps.LatLng(lat, lng);
      if (opts?.level != null) map.setLevel(opts.level);
      map.setCenter(latlng);
      await loadMarkersInBounds(); // 로드 후 가장 가까운 마커 트리거
      let best: KMarker | null = null;
      let bestDist = Infinity;
      markerCacheRef.current.forEach((mk) => {
        const r = mk.__row as PlaceRow;
        const dlat = Number(r.lat) - lat;
        const dlng = Number(r.lng) - lng;
        const ds = dlat * dlat + dlng * dlng;
        if (ds < bestDist) {
          bestDist = ds;
          best = mk;
        }
      });
      if (best) {
        maps.event.trigger(best, "click");
        applyStaticSeparationAll();
      }
    },
    [applyStaticSeparationAll],
  );

  /* ---------- 바운드 내 마커 로드 ---------- */
  async function loadMarkersInBounds() {
    const kakao = (window as KakaoNS).kakao;
    const maps = kakao?.maps;
    const map = mapObjRef.current;
    const clusterer = clustererRef.current;
    if (!maps || !map || !clusterer) return;

    const bounds = map.getBounds();
    if (!bounds) return;
    const sw = bounds.getSouthWest(),
      ne = bounds.getNorthEast();

    const reqId = Date.now();
    lastReqIdRef.current = reqId;

    const { data, error } = await (supabase as any).rpc("get_public_map_places", {
      min_lat: sw.getLat(),
      max_lat: ne.getLat(),
      min_lng: sw.getLng(),
      max_lng: ne.getLng(),
      limit_n: 5000,
    });

    if (reqId !== lastReqIdRef.current) return;
    if (error) {
      console.error("Supabase rpc(get_public_map_places) error:", error.message);
      return;
    }

    const rows = (data ?? []) as PlaceRow[];
    const canImg = hasImgCtors(maps);
    const imgs = canImg ? markerImages(maps) : null;

    const nowKeys = new Set<string>();
    const groups = new Map<string, KMarker[]>();
    const keyOf = (row: PlaceRow) => {
      const lat = Number(row.lat),
        lng = Number(row.lng);
      const idPart = rowIdOf(row) != null ? String(rowIdOf(row)) : "";
      const prod = String(
        getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName", "product_name"]) || "",
      );
      const loc = String(getField(row, ["설치위치", "설치 위치", "installLocation", "install_location"]) || "");
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
        const inCart = selectedRowKeySetRef.current.has(rowKey);
        const clicked = false;

        const image =
          quickFactoryRef.current && canImg
            ? quickFactoryRef.current.get({
                quickOn: quickAddRef.current,
                selected: inCart,
                inCart,
                clicked,
              })
            : inCart
              ? imgs?.yellow
              : imgs?.purple;

        const markerOpts: any = { position: pos, title: nameText };
        if (image) markerOpts.image = image;

        mk = new maps.Marker(markerOpts);
        mk.__key = key;
        mk.__basePos = pos;
        mk.__row = row;

        maps.event.addListener(mk, "click", () => {
          // 퀵모드: 패널 열지 않고 담기/취소만
          if (quickAddRef.current) {
            const was = selectedRowKeySetRef.current.has(rowKey);
            if (was) {
              removeFromCartByRowKey(rowKey);
            } else {
              addToCartByRowKey(rowKey); // ✅ 내부에서 2탭 닫고 카트 오픈까지 수행
            }
            const nowSel = selectedRowKeySetRef.current.has(rowKey);

            const newImg =
              quickFactoryRef.current && canImg
                ? quickFactoryRef.current.get({
                    quickOn: true,
                    selected: nowSel,
                    inCart: nowSel,
                    clicked: false,
                  })
                : nowSel
                  ? imgs?.yellow
                  : imgs?.purple;

            safeSetImage(mk, newImg);
            lastClickedRef.current = null;
            applyStaticSeparationAll();
            return;
          }

          const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
          const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
          const productName =
            getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName", "product_name"]) || "";
          const installLocation = getField(row, ["설치위치", "설치 위치", "installLocation", "install_location"]) || "";
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
          const imageUrl = getField(row, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) || undefined;

          const sel: SelectedAptX = {
            rowKey,
            rowId: rowIdOf(row) != null ? String(rowIdOf(row)) : undefined,
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
            selectedInCart: selectedRowKeySetRef.current.has(rowKey),
          };
          setSelected(sel);

          // 상세 보강 RPC
          (() => {
            const pid = rowIdOf(row);
            if (!pid) return;
            (async () => {
              const { data: detail, error: dErr } = await (supabase as any).rpc("get_public_place_detail", {
                p_place_id: pid,
              });
              if (!dErr && detail?.length) {
                const d = detail[0];
                setSelected((prev) =>
                  prev && prev.rowKey === rowKey
                    ? {
                        ...prev,
                        households: d.households ?? prev.households,
                        residents: d.residents ?? prev.residents,
                        monitors: d.monitors ?? prev.monitors,
                        monthlyImpressions: d.monthly_impressions ?? prev.monthlyImpressions,
                        costPerPlay: d.cost_per_play ?? prev.costPerPlay,
                        hours: d.hours ?? prev.hours,
                        address: d.address ?? prev.address,
                        installLocation: d.install_location ?? d.installLocation ?? prev.installLocation,
                        monthlyFee: d.monthly_fee ?? prev.monthlyFee,
                        monthlyFeeY1: d.monthly_fee_y1 ?? prev.monthlyFeeY1,
                        lat: d.lat ?? prev.lat,
                        lng: d.lng ?? prev.lng,
                        imageUrl: d.image_url ?? prev.imageUrl,
                      }
                    : prev,
                );
              } else if (dErr) {
                console.warn("[RPC] get_public_place_detail error:", dErr.message);
              }
            })();
          })();

          const isAlreadySelected = selectedRowKeySetRef.current.has(rowKey);
          if (isAlreadySelected) {
            const newImg =
              quickFactoryRef.current && canImg
                ? quickFactoryRef.current.get({
                    quickOn: quickAddRef.current,
                    selected: true,
                    inCart: true,
                    clicked: false,
                  })
                : imgs?.yellow;
            safeSetImage(mk, newImg);
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prev = lastClickedRef.current;
              const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
              const prevInCart = selectedRowKeySetRef.current.has(prevRowKey);
              const prevImg =
                quickFactoryRef.current && canImg
                  ? quickFactoryRef.current.get({
                      quickOn: quickAddRef.current,
                      selected: prevInCart,
                      inCart: prevInCart,
                      clicked: false,
                    })
                  : prevInCart
                    ? imgs?.yellow
                    : imgs?.purple;
              safeSetImage(prev, prevImg);
            }
            lastClickedRef.current = null;
          } else {
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prev = lastClickedRef.current;
              const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
              const prevInCart = selectedRowKeySetRef.current.has(prevRowKey);
              const prevImg =
                quickFactoryRef.current && canImg
                  ? quickFactoryRef.current.get({
                      quickOn: quickAddRef.current,
                      selected: prevInCart,
                      inCart: prevInCart,
                      clicked: false,
                    })
                  : prevInCart
                    ? imgs?.yellow
                    : imgs?.purple;
              safeSetImage(prev, prevImg);
            }
            const newImg =
              quickFactoryRef.current && canImg
                ? quickFactoryRef.current.get({
                    quickOn: quickAddRef.current,
                    selected: false,
                    inCart: false,
                    clicked: true,
                  })
                : imgs?.clicked;
            safeSetImage(mk, newImg);
            lastClickedRef.current = mk;
          }
          applyStaticSeparationAll();
        });

        markerCacheRef.current.set(key, mk);
        toAdd.push(mk);
      } else {
        mk.setPosition(pos);
        if (mk.getTitle?.() !== nameText) mk.setTitle?.(nameText);
        const inCart = selectedRowKeySetRef.current.has(rowKey);
        const isClicked = !inCart && lastClickedRef.current && lastClickedRef.current.__key === key;
        const imgToUse =
          quickFactoryRef.current && canImg
            ? quickFactoryRef.current.get({
                quickOn: quickAddRef.current,
                selected: inCart,
                inCart,
                clicked: Boolean(isClicked),
              })
            : inCart
              ? imgs?.yellow
              : isClicked
                ? imgs?.clicked
                : imgs?.purple;
        safeSetImage(mk, imgToUse);
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
    if (lastClickedRef.current && toRemove.includes(lastClickedRef.current)) lastClickedRef.current = null;

    applyGroupPrioritiesMap(groups);
    groupsRef.current = groups;

    // 확장 조회(주변에 아무 것도 없을 때)
    if (!newMarkers.length) {
      const pad = expandBounds(bounds, 0.12);
      const { data: data2, error: err2 } = await (supabase as any).rpc("get_public_map_places", {
        min_lat: pad.minLat,
        max_lat: pad.maxLat,
        min_lng: pad.minLng,
        max_lng: pad.maxLng,
        limit_n: 5000,
      });

      if (err2) {
        console.warn("[MapPage] expanded select error:", err2.message);
      } else if (reqId === lastReqIdRef.current) {
        const rows2 = (data2 ?? []) as PlaceRow[];
        rows2.forEach((row) => {
          if (row.lat == null || row.lng == null) return;
          const key = `${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}|${
            rowIdOf(row) != null ? String(rowIdOf(row)) : ""
          }|${String(getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName", "product_name"]) || "")}|${String(getField(row, ["설치위치", "설치 위치", "installLocation", "install_location"]) || "")}`;
          if (markerCacheRef.current.has(key)) return;

          const lat = Number(row.lat),
            lng = Number(row.lng);
          const pos = new maps.LatLng(lat, lng);
          const nameText = String(getField(row, ["단지명", "name", "아파트명"]) || "");
          const rowKey = buildRowKeyFromRow(row);
          const inCart2 = selectedRowKeySetRef.current.has(rowKey);

          const img2 =
            quickFactoryRef.current && canImg
              ? quickFactoryRef.current.get({
                  quickOn: quickAddRef.current,
                  selected: inCart2,
                  inCart: inCart2,
                  clicked: false,
                })
              : inCart2
                ? imgs?.yellow
                : imgs?.purple;

          const mk: KMarker = new maps.Marker({
            position: pos,
            title: nameText,
            image: img2 || undefined,
          });
          mk.__key = key;
          mk.__basePos = pos;
          mk.__row = row;

          maps.event.addListener(mk, "click", () => {
            if (quickAddRef.current) {
              const was = selectedRowKeySetRef.current.has(rowKey);
              if (was) {
                removeFromCartByRowKey(rowKey);
              } else {
                addToCartByRowKey(rowKey); // ✅ 내부에서 2탭 닫고 카트 오픈까지 수행
              }
              const nowSel = selectedRowKeySetRef.current.has(rowKey);
              const newImg =
                quickFactoryRef.current && canImg
                  ? quickFactoryRef.current.get({
                      quickOn: true,
                      selected: nowSel,
                      inCart: nowSel,
                      clicked: false,
                    })
                  : nowSel
                    ? imgs?.yellow
                    : imgs?.purple;
              safeSetImage(mk, newImg);
              lastClickedRef.current = null;
              applyStaticSeparationAll();
              return;
            }

            const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
            const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
            const productName =
              getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName", "product_name"]) || "";
            const installLocation =
              getField(row, ["설치위치", "설치 위치", "installLocation", "install_location"]) || "";
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
              getField(row, [
                "월송출횟수",
                "월 송출횟수",
                "월 송출 횟수",
                "월송출",
                "노출수(월)",
                "monthlyImpressions",
              ]),
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
            const imageUrl = getField(row, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) || undefined;

            const sel: SelectedAptX = {
              rowKey,
              rowId: rowIdOf(row) != null ? String(rowIdOf(row)) : undefined,
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
              selectedInCart: selectedRowKeySetRef.current.has(rowKey),
            };
            setSelected(sel);

            // 상세 보강 RPC
            (() => {
              const pid = rowIdOf(row);
              if (!pid) return;
              (async () => {
                const { data: detail, error: dErr } = await (supabase as any).rpc("get_public_place_detail", {
                  p_place_id: pid,
                });
                if (!dErr && detail?.length) {
                  const d = detail[0];
                  setSelected((prev) =>
                    prev && prev.rowKey === rowKey
                      ? {
                          ...prev,
                          households: d.households ?? prev.households,
                          residents: d.residents ?? prev.residents,
                          monitors: d.monitors ?? prev.monitors,
                          monthlyImpressions: d.monthly_impressions ?? prev.monthlyImpressions,
                          costPerPlay: d.cost_per_play ?? prev.costPerPlay,
                          hours: d.hours ?? prev.hours,
                          address: d.address ?? prev.address,
                          installLocation: d.install_location ?? d.installLocation ?? prev.installLocation,
                          monthlyFee: d.monthly_fee ?? prev.monthlyFee,
                          monthlyFeeY1: d.monthly_fee_y1 ?? prev.monthlyFeeY1,
                          lat: d.lat ?? prev.lat,
                          lng: d.lng ?? prev.lng,
                          imageUrl: d.image_url ?? prev.imageUrl,
                        }
                      : prev,
                  );
                } else if (dErr) {
                  console.warn("[RPC] get_public_place_detail error:", dErr.message);
                }
              })();
            })();

            const isAlreadySelected = selectedRowKeySetRef.current.has(rowKey);
            if (isAlreadySelected) {
              const newImg =
                quickFactoryRef.current && canImg
                  ? quickFactoryRef.current.get({
                      quickOn: quickAddRef.current,
                      selected: true,
                      inCart: true,
                      clicked: false,
                    })
                  : imgs?.yellow;
              safeSetImage(mk, newImg);
              if (lastClickedRef.current && lastClickedRef.current !== mk) {
                const prevRowKey = buildRowKeyFromRow(lastClickedRef.current.__row as PlaceRow);
                const prevInCart = selectedRowKeySetRef.current.has(prevRowKey);
                const prevImg =
                  quickFactoryRef.current && canImg
                    ? quickFactoryRef.current.get({
                        quickOn: quickAddRef.current,
                        selected: prevInCart,
                        inCart: prevInCart,
                        clicked: false,
                      })
                    : prevInCart
                      ? imgs?.yellow
                      : imgs?.purple;
                safeSetImage(lastClickedRef.current, prevImg);
              }
              lastClickedRef.current = null;
            } else {
              if (lastClickedRef.current && lastClickedRef.current !== mk) {
                const prevRowKey = buildRowKeyFromRow(lastClickedRef.current.__row as PlaceRow);
                const prevInCart = selectedRowKeySetRef.current.has(prevRowKey);
                const prevImg =
                  quickFactoryRef.current && canImg
                    ? quickFactoryRef.current.get({
                        quickOn: quickAddRef.current,
                        selected: prevInCart,
                        inCart: prevInCart,
                        clicked: false,
                      })
                    : prevInCart
                      ? imgs?.yellow
                      : imgs?.purple;
                safeSetImage(lastClickedRef.current, prevImg);
              }
              const newImg =
                quickFactoryRef.current && canImg
                  ? quickFactoryRef.current.get({
                      quickOn: quickAddRef.current,
                      selected: false,
                      inCart: false,
                      clicked: true,
                    })
                  : imgs?.clicked;
              safeSetImage(mk, newImg);
              lastClickedRef.current = mk;
            }
            applyStaticSeparationAll();
          });

          markerCacheRef.current.set(key, mk);

          const imgToUse =
            quickFactoryRef.current && canImg
              ? quickFactoryRef.current.get({
                  quickOn: quickAddRef.current,
                  selected: inCart2,
                  inCart: inCart2,
                  clicked: false,
                })
              : inCart2
                ? imgs?.yellow
                : imgs?.purple;
          safeSetImage(mk, imgToUse);

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
    }

    applyStaticSeparationAll();
  }

  /* ---------- 반경 UI ---------- */
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

    // 검색 핀(생성자 없으면 스킵)
    if (hasImgCtors(kakao.maps)) {
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
  }

  /* ---------- 검색 ---------- */
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

  /* ---------- 내 위치(PC) ---------- */
  const ensureUserOverlay = useCallback((lat: number, lng: number) => {
    const kakao = (window as KakaoNS).kakao;
    if (!kakao?.maps || !mapObjRef.current) return;
    const map = mapObjRef.current;

    if (!userOverlayElRef.current) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "999px";
      el.style.background = "#6F4BF2";
      el.style.boxShadow = "0 0 0 3px rgba(111,75,242,0.25), 0 0 0 6px rgba(111,75,242,0.12)";
      el.style.border = "2px solid #FFFFFF";
      el.style.pointerEvents = "none";
      userOverlayElRef.current = el;
    }

    const latlng = new kakao.maps.LatLng(lat, lng);

    if (!userOverlayRef.current) {
      userOverlayRef.current = new kakao.maps.CustomOverlay({
        map,
        position: latlng,
        content: userOverlayElRef.current!,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 999999,
      });
    } else {
      userOverlayRef.current.setPosition(latlng);
      userOverlayRef.current.setMap(map);
      userOverlayRef.current.setZIndex?.(999999);
    }
  }, []);

  const goMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeoError("이 브라우저는 위치 기능을 지원하지 않아요.");
      setTimeout(() => setGeoError(null), 3000);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const kakao = (window as KakaoNS).kakao;
        if (!kakao?.maps || !mapObjRef.current) return;
        const { latitude, longitude } = pos.coords;
        const latlng = new kakao.maps.LatLng(latitude, longitude);
        mapObjRef.current.setLevel(5);
        mapObjRef.current.setCenter(latlng);
        ensureUserOverlay(latitude, longitude);
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "위치 권한이 거부되었어요. 브라우저 설정을 확인해주세요."
            : "내 위치를 가져오지 못했어요.";
        setGeoError(msg);
        setTimeout(() => setGeoError(null), 3000);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }, [ensureUserOverlay]);

  const mapLeftClass = selected ? "md:left-[720px]" : "md:left-[360px]";
  const MapChromeAny = MapChrome as any;

  return (
    <div className="w-screen h-[100dvh] bg-white">
      <div ref={mapRef} className={`fixed top-16 left-0 right-0 bottom-0 z-[10] ${mapLeftClass}`} aria-label="map" />

      {/* 상단(헤더 아래) 고정 버튼 스택: 퀵담기 → 내위치 */}
      <div className="fixed right-4 top-[84px] z-[60] flex flex-col items-end gap-2 pointer-events-auto">
        {/* 퀵담기 토글 */}
        <button
          type="button"
          onClick={() => setQuickAdd((v) => !v)}
          aria-pressed={quickAdd}
          aria-label="빠른 아파트 담기"
          title="빠른 아파트 담기"
          className={
            "w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition active:scale-95 " +
            (quickAdd ? "bg-[#FFD400] text-[#222]" : "bg-[#6F4BF2] text-white hover:brightness-110")
          }
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* 내 위치로 이동 */}
        <button
          type="button"
          onClick={goMyLocation}
          aria-label="내 위치로 이동"
          title="내 위치로 이동"
          className="w-12 h-12 rounded-full shadow-lg bg-[#6F4BF2] text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition"
        >
          <LocateFixed className="w-6 h-6" />
        </button>
      </div>

      <MapChromeAny
        selected={selected}
        onCloseSelected={closeSelected}
        onSearch={handleSearch}
        initialQuery={initialQ}
        setMarkerStateByRowKey={setMarkerStateByRowKey}
        isRowKeySelected={isRowKeySelected}
        addToCartByRowKey={addToCartByRowKey}
        removeFromCartByRowKey={removeFromCartByRowKey}
        toggleCartByRowKey={toggleCartByRowKey}
        /* 카트에서 단지 클릭 → 지도 이동 + 2탭 오픈 */
        focusByRowKey={focusByRowKey}
        focusByLatLng={focusByLatLng}
        cartStickyTopPx={64}
        cartStickyUntil="bulkMonthsApply"
      />

      {/* 에러 토스트들 */}
      {(kakaoError || kakaoLoadError) && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError || kakaoLoadError}
        </div>
      )}
      {geoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          {geoError}
        </div>
      )}
    </div>
  );
}
