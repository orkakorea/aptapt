import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** =========================================================================
 *  Kakao 타입 헬퍼
 *  ========================================================================= */
type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

/** =========================================================================
 *  마커 이미지 경로/옵션
 *  ========================================================================= */
const PIN_PURPLE_URL = "/makers/pin-purple@2x.png"; // 기본
const PIN_YELLOW_URL = "/makers/pin-yellow@2x.png"; // 담김(선택)
const PIN_CLICKED_URL = "/makers/pin-purple@3x.png"; // 클릭 강조(선택 아님일 때만)

const PIN_SIZE = 51; // 원본 102px(@2x)의 절반
const PIN_OFFSET = { x: PIN_SIZE / 2, y: PIN_SIZE };

// 검색핀
const SEARCH_PIN_URL = "/pin.png";
const SEARCH_PIN_SIZE = 51;
const SEARCH_PIN_OFFSET = { x: SEARCH_PIN_SIZE / 2, y: SEARCH_PIN_SIZE };

/** =========================================================================
 *  유틸
 *  ========================================================================= */
const fmtNum = (n?: number | null) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString("ko-KR") : "-");
const fmtWon = (n?: number | null) => (Number.isFinite(Number(n)) ? `${Number(n).toLocaleString("ko-KR")}원` : "-");
const toNumLoose = (v: any): number | undefined => {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[^0-9.-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};
const getField = (obj: any, keys: string[]): any => {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
};

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
type SelectedApt = {
  rowKey: string;
  rowId?: string;
  name: string;
  address?: string;
  productName?: string;
  installLocation?: string;
  households?: number;
  residents?: number;
  monitors?: number;
  monthlyImpressions?: number;
  costPerPlay?: number;
  hours?: string;
  monthlyFee?: number;
  monthlyFeeY1?: number;
  imageUrl?: string;
  lat: number;
  lng: number;
};

const markerImages = (maps: any) => {
  const { MarkerImage, Size, Point } = maps;
  const opt = { offset: new Point(PIN_OFFSET.x, PIN_OFFSET.y) };
  const sz = new Size(PIN_SIZE, PIN_SIZE);
  const purple = new MarkerImage(PIN_PURPLE_URL, sz, opt);
  const yellow = new MarkerImage(PIN_YELLOW_URL, sz, opt);
  const clicked = new MarkerImage(PIN_CLICKED_URL, sz, opt);
  return { purple, yellow, clicked };
};
const buildSearchMarkerImage = (maps: any) => {
  const { MarkerImage, Size, Point } = maps;
  return new MarkerImage(SEARCH_PIN_URL, new Size(SEARCH_PIN_SIZE, SEARCH_PIN_SIZE), {
    offset: new Point(SEARCH_PIN_OFFSET.x, SEARCH_PIN_OFFSET.y),
  });
};

const cleanupKakaoScripts = () => {
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
};
const loadKakao = (): Promise<any> => {
  const w = window as any;
  if (w.kakao?.maps && typeof w.kakao.maps.LatLng === "function") return Promise.resolve(w.kakao);
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
        if (typeof w.kakao.maps.LatLng !== "function") return reject(new Error("LatLng constructor not ready"));
        resolve(w.kakao);
      });
    };
    s.onerror = () => reject(new Error("Failed to load Kakao Maps SDK"));
    document.head.appendChild(s);
  });
  return w.__kakaoLoadingPromise;
};

/** =========================================================================
 *  키/그룹 유틸
 *  ========================================================================= */
const groupKeyFromRow = (row: PlaceRow) => `${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}`;
const buildRowKeyFromRow = (row: PlaceRow) => {
  const lat = Number(row.lat),
    lng = Number(row.lng);
  const idPart = row.id != null ? String(row.id) : "";
  const productName = String(getField(row, ["상품명", "productName"]) || "");
  const installLocation = String(getField(row, ["설치위치", "installLocation"]) || "");
  return idPart ? `id:${idPart}` : `xy:${lat.toFixed(7)},${lng.toFixed(7)}|p:${productName}|loc:${installLocation}`;
};
const monthlyFeeOf = (row: PlaceRow): number => toNumLoose(getField(row, ["월광고료", "month_fee", "monthlyFee"])) ?? 0;

/** =========================================================================
 *  카트 타입(모바일 전용 임시 상태)
 *  ========================================================================= */
type CartItem = {
  rowKey: string;
  aptName: string;
  productName?: string;
  months: number; // 1/3/6/12
  baseMonthly?: number; // 월광고료
  discountedMonthly?: number; // 3% 할인 적용가(예시)
};
const monthOptions = [1, 3, 6, 12];

/** =========================================================================
 *  메인: MapMobilePage
 *  ========================================================================= */
export default function MapMobilePage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);

  // 검색핀 + 반경
  const searchPinRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const radiusLabelRef = useRef<any>(null);

  // 마커/그룹
  const markerCacheRef = useRef<Map<string, KMarker>>(new Map());
  const keyIndexRef = useRef<Record<string, KMarker[]>>({});
  const groupsRef = useRef<Map<string, KMarker[]>>(new Map());
  const selectedRowKeySetRef = useRef<Set<string>>(new Set());
  const lastReqIdRef = useRef<number>(0);
  const lastClickedRef = useRef<KMarker | null>(null);

  // UI 상태
  const [selected, setSelected] = useState<SelectedApt | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"cart" | "detail">("cart");
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  // 카트(임시 상태)
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartCount = cart.length;
  const [applyAll, setApplyAll] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  const showSnack = (msg: string) => {
    setSnack(msg);
    setTimeout(() => setSnack(null), 2500);
  };

  /** ---------------- 지도 초기화 ---------------- */
  useEffect(() => {
    let resizeHandler: any;
    let map: any;

    cleanupKakaoScripts();
    loadKakao()
      .then((kakao) => {
        setKakaoError(null);
        if (!mapRef.current) return;

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

        kakao.maps.event.addListener(map, "idle", async () => {
          await loadMarkersInBounds();
          applyStaticSeparationAll();
        });

        setTimeout(() => map && map.relayout(), 0);
        (async () => {
          await loadMarkersInBounds();
          applyStaticSeparationAll();
        })();

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
      try {
        radiusCircleRef.current?.setMap(null);
        radiusLabelRef.current?.setMap(null);
        searchPinRef.current?.setMap?.(null);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 시트 열릴 때 레이아웃 보정
  useEffect(() => {
    const m = mapObjRef.current;
    if ((window as any).kakao?.maps && m) setTimeout(() => m.relayout(), 0);
  }, [sheetOpen, activeTab]);

  /** ---------------- 같은 좌표 마커 나란히 ---------------- */
  const layoutMarkersSideBySide = useCallback((map: any, group: KMarker[]) => {
    if (!group || group.length <= 1) return;
    const proj = map.getProjection();
    const center = group[0].__basePos;
    const cpt = proj.containerPointFromCoords(center);
    const N = group.length;
    const GAP = 26;
    const totalW = GAP * (N - 1);
    const startX = cpt.x - totalW / 2;
    const y = cpt.y;
    for (let i = 0; i < N; i++) {
      const pt = new (window as any).kakao.maps.Point(startX + i * GAP, y);
      const pos = proj.coordsFromContainerPoint(pt);
      group[i].setPosition(pos);
    }
  }, []);
  const applyStaticSeparationAll = useCallback(() => {
    const map = mapObjRef.current;
    if (!map || !(window as any).kakao?.maps) return;
    groupsRef.current.forEach((group) => layoutMarkersSideBySide(map, group));
  }, [layoutMarkersSideBySide]);

  /** ---------------- 그룹 zIndex 우선순위 ---------------- */
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

  /** ---------------- 마커 상태 전환(행 단위) ---------------- */
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
          if (forceYellowNow || shouldBeYellow) {
            mk.setImage(imgs.yellow);
            if (lastClickedRef.current === mk) lastClickedRef.current = null;
          } else {
            mk.setImage(imgs.purple);
          }
        });
        applyStaticSeparationAll();
      }
    },
    [applyStaticSeparationAll],
  );

  /** ---------------- 바운드 내 마커 로드 ---------------- */
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
      const prod = String(getField(row, ["상품명", "productName"]) || "");
      const loc = String(getField(row, ["설치위치", "installLocation"]) || "");
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

        maps.event.addListener(mk, "click", () => {
          const sel = toSelected(rowKey, row, lat, lng);
          setSelected(sel);
          setSheetOpen(true);
          setActiveTab("detail");

          const isAlreadySelected = selectedRowKeySetRef.current.has(rowKey);
          if (isAlreadySelected) {
            mk.setImage(imgs.yellow);
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prev = lastClickedRef.current;
              const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
              prev.setImage(selectedRowKeySetRef.current.has(prevRowKey) ? imgs.yellow : imgs.purple);
            }
            lastClickedRef.current = null;
          } else {
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prev = lastClickedRef.current;
              const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
              prev.setImage(selectedRowKeySetRef.current.has(prevRowKey) ? imgs.yellow : imgs.purple);
            }
            mk.setImage(imgs.clicked);
            lastClickedRef.current = mk;
          }
          applyStaticSeparationAll();
        });

        markerCacheRef.current.set(key, mk);
        toAdd.push(mk);
      } else {
        mk.setPosition(pos);
        if (mk.getTitle?.() !== nameText) mk.setTitle?.(nameText);
        const isSelected = selectedRowKeySetRef.current.has(rowKey);
        let imgToUse = isSelected ? imgs.yellow : imgs.purple;
        if (!isSelected && lastClickedRef.current && lastClickedRef.current.__key === key) imgToUse = imgs.clicked;
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

    // 제거
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
    applyStaticSeparationAll();
  }

  function toSelected(rowKey: string, row: PlaceRow, lat: number, lng: number): SelectedApt {
    const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
    const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
    const productName = getField(row, ["상품명", "productName"]) || "";
    const installLocation = getField(row, ["설치위치", "installLocation"]) || "";
    const households = toNumLoose(getField(row, ["세대수", "households"]));
    const residents = toNumLoose(getField(row, ["거주인원", "residents"]));
    const monitors = toNumLoose(getField(row, ["모니터수량", "monitors"]));
    const monthlyImpressions = toNumLoose(getField(row, ["월송출횟수", "monthlyImpressions"]));
    const monthlyFee = toNumLoose(getField(row, ["월광고료", "month_fee", "monthlyFee"]));
    const monthlyFeeY1 = toNumLoose(
      getField(row, ["1년 계약 시 월 광고료", "1년계약시월광고료", "연간월광고료", "monthlyFeeY1"]),
    );
    const costPerPlay = toNumLoose(getField(row, ["1회당 송출비용", "costPerPlay"]));
    const hours = getField(row, ["운영시간", "hours"]) || "";
    const imageUrl = getField(row, ["imageUrl", "썸네일", "thumbnail"]) || undefined;

    return {
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
  }

  /** ---------------- 검색핀/반경(간단) ---------------- */
  const drawSearchOverlays = (latlng: any) => {
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
        fillColor: "#FFD400",
        fillOpacity: 0.11,
        zIndex: -1000,
      });
    } else {
      radiusCircleRef.current.setOptions({ center: latlng });
      radiusCircleRef.current.setMap(map);
    }

    const searchImg = buildSearchMarkerImage(kakao.maps);
    if (!searchPinRef.current) {
      searchPinRef.current = new kakao.maps.Marker({ map, position: latlng, image: searchImg, zIndex: 500000 });
    } else {
      searchPinRef.current.setPosition(latlng);
      searchPinRef.current.setImage(searchImg);
      searchPinRef.current.setZIndex?.(500000);
      searchPinRef.current.setMap(map);
    }
  };

  /** ---------------- 카트 조작 ---------------- */
  const addSelectedToCart = useCallback(() => {
    if (!selected) return;
    const exists = cart.find((c) => c.rowKey === selected.rowKey);
    const base = selected.monthlyFee ?? 0;
    const discounted = Math.round(base * 0.97); // 예시: 3% 할인
    const nextItem: CartItem = {
      rowKey: selected.rowKey,
      aptName: selected.name,
      productName: selected.productName,
      months: 1,
      baseMonthly: base,
      discountedMonthly: discounted,
    };
    const next = exists
      ? cart.map((c) => (c.rowKey === selected.rowKey ? { ...c, months: c.months } : c))
      : [...cart, nextItem];

    setCart(next);
    setMarkerStateByRowKey(selected.rowKey, "selected", true);
    showSnack(`‘${selected.name}’이(가) 카트에 담겼어요.`);
  }, [cart, selected, setMarkerStateByRowKey]);

  const removeFromCart = (rowKey: string) => {
    const next = cart.filter((c) => c.rowKey !== rowKey);
    setCart(next);
    setMarkerStateByRowKey(rowKey, "default");
  };
  const updateMonths = (rowKey: string, months: number) => {
    setCart((prev) => prev.map((c) => (c.rowKey === rowKey ? { ...c, months } : c)));
    if (applyAll) {
      setCart((prev) => prev.map((c) => ({ ...c, months })));
    }
  };

  const totalMonthly = useMemo(
    () => cart.reduce((sum, c) => sum + (c.discountedMonthly ?? c.baseMonthly ?? 0), 0),
    [cart],
  );

  /** ---------------- 렌더 ---------------- */
  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 상단 앱바(간단) */}
      <div className="fixed top-0 left-0 right-0 z-[40] h-14 px-3 flex items-center justify-between bg-white/90 backdrop-blur border-b">
        <div className="font-extrabold text-[15px]">응답하라 입주민이여</div>
        <a href="tel:1551-0810" className="px-3 py-1 rounded-full bg-[#6E56CF] text-white text-sm font-semibold">
          1551-0810
        </a>
      </div>

      {/* 카카오 지도 */}
      <div ref={mapRef} className="fixed top-14 left-0 right-0 bottom-0 z-[10]" aria-label="map" />

      {/* FAB 카트 버튼 */}
      <button
        onClick={() => {
          setSheetOpen(true);
          setActiveTab("cart");
        }}
        aria-label="카트 열기"
        className="fixed bottom-24 right-4 z-[60] w-14 h-14 rounded-full bg-[#6E56CF] text-white shadow-lg flex items-center justify-center"
      >
        {/* 장바구니 아이콘(간단) */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M7 4h-2l-1 2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h9v-2h-8.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h5.74c.75 0 1.41-.41 1.75-1.03L23 6H6.21l-.94-2zM7 20c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
        {cartCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#FF3B30] text-[11px] font-bold flex items-center justify-center">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </button>

      {/* 하단 시트 */}
      <MobileBottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        /** Cart tab */
        cart={cart}
        applyAll={applyAll}
        setApplyAll={setApplyAll}
        onUpdateMonths={updateMonths}
        onRemove={removeFromCart}
        totalMonthly={totalMonthly}
        /** Detail tab */
        selected={selected}
        onAddToCart={addSelectedToCart}
      />

      {/* 스낵바 */}
      {snack && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full bg-black/80 text-white text-sm shadow">
          {snack}
        </div>
      )}

      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError}
        </div>
      )}
    </div>
  );
}

/** =========================================================================
 *  하단 시트 컴포넌트(모바일 전용 2탭)
 *  ========================================================================= */
function MobileBottomSheet(props: {
  open: boolean;
  onClose: () => void;
  activeTab: "cart" | "detail";
  setActiveTab: (t: "cart" | "detail") => void;

  // Cart tab
  cart: CartItem[];
  applyAll: boolean;
  setApplyAll: (v: boolean) => void;
  onUpdateMonths: (rowKey: string, months: number) => void;
  onRemove: (rowKey: string) => void;
  totalMonthly: number;

  // Detail tab
  selected: SelectedApt | null;
  onAddToCart: () => void;
}) {
  const {
    open,
    onClose,
    activeTab,
    setActiveTab,
    cart,
    applyAll,
    setApplyAll,
    onUpdateMonths,
    onRemove,
    totalMonthly,
    selected,
    onAddToCart,
  } = props;

  return (
    <div
      className={`fixed left-0 right-0 z-[55] transition-transform duration-250 ease-out ${
        open ? "translate-y-0" : "translate-y-[110%]"
      }`}
      style={{ bottom: 0 }}
    >
      <div className="mx-auto w-full max-w-[560px] rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)]">
        {/* Drag handle + Tabs */}
        <div className="pt-2">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200" />
        </div>

        <div className="mt-3 px-4 flex items-center gap-2">
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              activeTab === "cart" ? "bg-[#6E56CF] text-white" : "bg-gray-100"
            }`}
            onClick={() => setActiveTab("cart")}
          >
            카트 {cart.length ? `(${cart.length})` : ""}
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              activeTab === "detail" ? "bg-[#6E56CF] text-white" : "bg-gray-100"
            }`}
            onClick={() => setActiveTab("detail")}
          >
            단지 상세
          </button>

          <button onClick={onClose} className="ml-auto p-2 rounded-full bg-gray-100 text-gray-500" aria-label="닫기">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto px-4 pb-6 pt-3">
          {activeTab === "cart" ? (
            <CartTab
              cart={cart}
              applyAll={applyAll}
              setApplyAll={setApplyAll}
              onUpdateMonths={onUpdateMonths}
              onRemove={onRemove}
              totalMonthly={totalMonthly}
            />
          ) : (
            <DetailTab selected={selected} onAddToCart={onAddToCart} />
          )}
        </div>
      </div>
    </div>
  );
}

/** ---------------- Cart 탭 ---------------- */
function CartTab(props: {
  cart: CartItem[];
  applyAll: boolean;
  setApplyAll: (v: boolean) => void;
  onUpdateMonths: (rowKey: string, months: number) => void;
  onRemove: (rowKey: string) => void;
  totalMonthly: number;
}) {
  const { cart, applyAll, setApplyAll, onUpdateMonths, onRemove, totalMonthly } = props;

  return (
    <div>
      {/* 총 비용 박스 */}
      <div className="mb-3 rounded-xl bg-[#F3EEFF] px-4 py-3">
        <div className="text-sm text-gray-600">총 비용</div>
        <div className="text-[20px] font-extrabold text-[#6E56CF]">{fmtWon(totalMonthly)}</div>
        <div className="text-[11px] text-gray-500">(VAT별도)</div>
      </div>

      {/* 상단 툴바 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-gray-600">총 {cart.length}건</div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-[#6E56CF]"
            checked={applyAll}
            onChange={(e) => setApplyAll(e.target.checked)}
          />
          광고기간 일괄적용
        </label>
      </div>

      {/* 아이템 리스트 */}
      <div className="space-y-3">
        {cart.map((item) => (
          <div key={item.rowKey} className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="font-extrabold text-[16px]">{item.aptName}</div>
                <div className="text-xs text-gray-500">{item.productName ?? "ELEVATOR TV"}</div>
              </div>
              <button
                onClick={() => onRemove(item.rowKey)}
                className="h-8 w-8 rounded-full bg-gray-100 text-gray-600"
                aria-label="삭제"
              >
                ×
              </button>
            </div>

            {/* 기간 선택 */}
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-1">광고기간</div>
              <select
                className="w-32 rounded-xl border px-3 py-2"
                value={item.months}
                onChange={(e) => onUpdateMonths(item.rowKey, Number(e.target.value))}
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}개월
                  </option>
                ))}
              </select>
            </div>

            {/* 금액 */}
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-600">월광고료</div>
              <div className="text-right font-semibold">{fmtWon(item.baseMonthly)}</div>

              <div className="text-gray-600">총광고료</div>
              <div className="text-right">
                <span className="inline-flex items-center gap-2">
                  <span className="rounded-full bg-[#EEE7FF] px-2 py-0.5 text-[11px] text-[#6E56CF] font-bold">
                    3%할인
                  </span>
                  <span className="text-[#6E56CF] font-extrabold">{fmtWon(item.discountedMonthly)}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 CTA */}
      <div className="mt-4">
        <button
          className="w-full h-12 rounded-2xl border-2 border-[#6E56CF] text-[#6E56CF] font-extrabold"
          onClick={() => alert("상품견적 자세히보기 (모달/다음 단계로 연결 예정)")}
        >
          상품견적 자세히보기
        </button>
      </div>
    </div>
  );
}

/** ---------------- Detail 탭 ---------------- */
function DetailTab(props: { selected: SelectedApt | null; onAddToCart: () => void }) {
  const { selected, onAddToCart } = props;
  if (!selected) return <div className="text-center text-sm text-gray-500 py-6">지도의 단지를 선택하세요.</div>;

  const y1Monthly = selected.monthlyFeeY1 ?? Math.round((selected.monthlyFee ?? 0) * 0.76); // 예: 1년가 예시
  return (
    <div>
      {/* 썸네일 */}
      <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {selected.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">이미지</div>
        )}
      </div>

      {/* 타이틀 */}
      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[20px] font-extrabold">{selected.name}</div>
          <div className="text-sm text-gray-500">
            {fmtNum(selected.households)} 세대 · {fmtNum(selected.residents)} 명
          </div>
        </div>
      </div>

      {/* 금액 카드 */}
      <div className="mt-3 space-y-2">
        <div className="rounded-2xl border px-4 py-3">
          <div className="text-sm text-gray-600">월 광고료</div>
          <div className="text-[20px] font-extrabold">
            {fmtWon(selected.monthlyFee)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>
        <div className="rounded-2xl bg-[#F3EEFF] px-4 py-3">
          <div className="text-sm text-gray-600">1년 계약 시 월 광고료</div>
          <div className="text-[20px] font-extrabold text-[#6E56CF]">
            {fmtWon(y1Monthly)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-3">
        <button className="w-full h-12 rounded-2xl bg-[#6E56CF] text-white font-extrabold" onClick={onAddToCart}>
          아파트 담기
        </button>
      </div>

      {/* 상세정보 표 */}
      <div className="mt-4 rounded-2xl border">
        <table className="w-full text-sm">
          <tbody className="[&_td]:px-4 [&_td]:py-2">
            <tr>
              <td className="text-gray-500 w-36">상품명</td>
              <td className="font-semibold">{selected.productName ?? "ELEVATOR TV"}</td>
            </tr>
            <tr>
              <td className="text-gray-500">설치 위치</td>
              <td className="font-semibold">{selected.installLocation ?? "-"}</td>
            </tr>
            <tr>
              <td className="text-gray-500">모니터 수량</td>
              <td className="font-semibold">{fmtNum(selected.monitors)}</td>
            </tr>
            <tr>
              <td className="text-gray-500">월 송출횟수</td>
              <td className="font-semibold">{fmtNum(selected.monthlyImpressions)}</td>
            </tr>
            <tr>
              <td className="text-gray-500">송출 1회당 비용</td>
              <td className="font-semibold">{fmtNum(selected.costPerPlay)} 원</td>
            </tr>
            <tr>
              <td className="text-gray-500">운영 시간</td>
              <td className="font-semibold">{selected.hours || "-"}</td>
            </tr>
            <tr>
              <td className="text-gray-500">주소</td>
              <td className="font-semibold whitespace-pre-line">{selected.address || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
