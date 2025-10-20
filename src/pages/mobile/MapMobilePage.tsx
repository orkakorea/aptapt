import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* =========================================================================
 * Kakao 타입/키
 * ========================================================================= */
type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480b8650cec67ebae";

/* =========================================================================
 * 색상(모바일 톤)
 * ========================================================================= */
const COLOR_PRIMARY = "#6F4BF2";
const COLOR_PRIMARY_LIGHT = "#EEE8FF";
const COLOR_GRAY_CARD = "#F4F6FA";

/* =========================================================================
 * 마커 이미지
 * ========================================================================= */
const PIN_PURPLE_URL = "/makers/pin-purple@2x.png";
const PIN_YELLOW_URL = "/makers/pin-yellow@2x.png";
const PIN_CLICKED_URL = "/makers/pin-purple@3x.png";
const PIN_SIZE = 51;
const PIN_OFFSET = { x: PIN_SIZE / 2, y: PIN_SIZE };

const markerImages = (maps: any) => {
  const { MarkerImage, Size, Point } = maps;
  const opt = { offset: new Point(PIN_OFFSET.x, PIN_OFFSET.y) };
  const sz = new Size(PIN_SIZE, PIN_SIZE);
  return {
    purple: new MarkerImage(PIN_PURPLE_URL, sz, opt),
    yellow: new MarkerImage(PIN_YELLOW_URL, sz, opt),
    clicked: new MarkerImage(PIN_CLICKED_URL, sz, opt),
  };
};

/* =========================================================================
 * 유틸
 * ========================================================================= */
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

function imageForProduct(productName?: string): string {
  const p = (productName || "").toLowerCase().replace(/\s+/g, "");
  if (p.includes("elevat")) return "/products/elevator-tv.png";
  if (p.includes("townbord") || p.includes("townboard")) {
    if (p.includes("_l") || p.endsWith("l")) return "/products/townbord-b.png";
    return "/products/townbord-a.png";
  }
  if (p.includes("media")) return "/products/media-meet-a.png";
  if (p.includes("space")) return "/products/space-living.png";
  if (p.includes("hipost") || (p.includes("hi") && p.includes("post"))) return "/products/hi-post.png";
  return "/placeholder.svg";
}
function preloadImages(paths: string[]) {
  paths.forEach((p) => {
    const img = new Image();
    img.src = p;
  });
}

/* =========================================================================
 * Kakao SDK
 * ========================================================================= */
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

/* =========================================================================
 * 타입/키
 * ========================================================================= */
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

/* =========================================================================
 * 할인 정책 (PC 버전 동일)
 * ========================================================================= */
type RangeRule = { min: number; max: number; rate: number };
type ProductRules = { precomp?: RangeRule[]; period: RangeRule[] };
type DiscountPolicy = Record<string, ProductRules>;

const DEFAULT_POLICY: DiscountPolicy = {
  "ELEVATOR TV": {
    precomp: [
      { min: 1, max: 2, rate: 0.03 },
      { min: 3, max: 12, rate: 0.05 },
    ],
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },
  TOWNBORD_S: {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },
  TOWNBORD_L: {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "MEDIA MEET": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "SPACE LIVING": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "HI-POST": {
    period: [
      { min: 1, max: 5, rate: 0 },
      { min: 6, max: 11, rate: 0.05 },
      { min: 12, max: 12, rate: 0.1 },
    ],
  },
};

function normPolicyKey(productName?: string): keyof DiscountPolicy | "_NONE" {
  const p = (productName || "").toUpperCase().replace(/\s+/g, " ").trim();
  if (p.includes("ELEVATOR")) return "ELEVATOR TV";
  if (p.includes("MEDIA")) return "MEDIA MEET";
  if (p.includes("SPACE")) return "SPACE LIVING";
  if (p.includes("HI") && p.includes("POST")) return "HI-POST";
  if (p.includes("TOWNBORD") || p.includes("TOWNBOARD")) {
    if (/_L\b|\bL\b/.test(p) || p.endsWith("_L") || p.endsWith(" L")) return "TOWNBORD_L";
    return "TOWNBORD_S";
  }
  return "_NONE";
}
function rateFromRanges(ranges: RangeRule[] | undefined, value: number) {
  if (!ranges) return 0;
  for (const r of ranges) {
    if (value >= r.min && value <= r.max) return r.rate;
  }
  return 0;
}
function calcMonthlyWithPolicy(
  productName: string | undefined,
  months: number,
  baseMonthly: number,
  monthlyFeeY1: number | undefined,
  sameProductCountInCart: number,
) {
  if (!Number.isFinite(baseMonthly) || baseMonthly <= 0) return { monthly: 0, rate: 0 };
  // 12개월 & Y1가 있으면 무조건 그 값 사용(할인율은 역산)
  if (months === 12 && Number.isFinite(monthlyFeeY1) && (monthlyFeeY1 as number) > 0) {
    const rate = Math.max(0, Math.min(1, 1 - (monthlyFeeY1 as number) / baseMonthly));
    return { monthly: Math.round(monthlyFeeY1 as number), rate };
  }
  const key = normPolicyKey(productName);
  const rules = key !== "_NONE" ? DEFAULT_POLICY[key] : undefined;
  const periodRate = rateFromRanges(rules?.period, months);
  const preRate = rateFromRanges(rules?.precomp, sameProductCountInCart);
  const effectiveRate = 1 - (1 - periodRate) * (1 - preRate); // 결합
  const monthly = Math.round(baseMonthly * (1 - effectiveRate));
  return { monthly, rate: effectiveRate };
}

/* =========================================================================
 * 카트
 * ========================================================================= */
type CartItem = {
  rowKey: string;
  aptName: string;
  productName?: string;
  months: number;
  baseMonthly?: number;
  monthlyFeeY1?: number;
};
const monthOptions: number[] = Array.from({ length: 12 }, (_, i) => i + 1);

/* =========================================================================
 * 메인 페이지
 * ========================================================================= */
export default function MapMobilePage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const clustererRef = useRef<any>(null);
  const placesRef = useRef<any>(null);

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
  const [searchQ, setSearchQ] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 카트
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartCount = cart.length;
  const [applyAll, setApplyAll] = useState(true);
  const [snack, setSnack] = useState<string | null>(null);

  // 시트 드래그
  const [dragY, setDragY] = useState(0);
  const dragStartYRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  // 바텀시트 최대 높이 동적 제한(카트 버튼 ~ 전화 버튼 사이)
  const [sheetMaxH, setSheetMaxH] = useState<number | null>(null);
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const phoneBtnRef = useRef<HTMLAnchorElement>(null);

  // 패키지 모달/종료 확인
  const [pkgOpen, setPkgOpen] = useState(false);
  const [exitAsk, setExitAsk] = useState(false);
  const popHandlerRef = useRef<(e: PopStateEvent) => void>();

  const showSnack = (msg: string) => {
    setSnack(msg);
    setTimeout(() => setSnack(null), 2200);
  };

  /* 프리로드 */
  useEffect(() => {
    preloadImages([
      "/products/elevator-tv.png",
      "/products/townbord-a.png",
      "/products/townbord-b.png",
      "/products/media-meet-a.png",
      "/products/space-living.png",
      "/products/hi-post.png",
      "/placeholder.svg",
    ]);
  }, []);

  /* Lovable 배지 제거 */
  useEffect(() => {
    const kill = () => {
      const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
      all.forEach((el) => {
        const t = (el.textContent || "").trim().toLowerCase();
        const idc = `${(el as any).id ?? ""} ${(el as any).className ?? ""}`.toLowerCase();
        if ((t.includes("built with") && t.includes("lovable")) || idc.includes("lovable")) {
          el.remove();
        }
      });
    };
    kill();
    const mo = new MutationObserver(kill);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  /* 뒤로가기 가드 */
  useEffect(() => {
    history.pushState({ guard: true }, "");
    const onPop = (e: PopStateEvent) => {
      // 일단 되돌려 놓고 확인 모달
      history.pushState({ guard: true }, "");
      setExitAsk(true);
    };
    popHandlerRef.current = onPop;
    window.addEventListener("popstate", onPop);

    const onBeforeUnload = (ev: BeforeUnloadEvent) => {
      ev.preventDefault();
      ev.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      const h = popHandlerRef.current;
      if (h) window.removeEventListener("popstate", h);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  /* 지도 초기화 */
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
          recalcSheetMax();
        };
        window.addEventListener("resize", resizeHandler);
      })
      .catch((err) => {
        console.error("[KakaoMap] load error:", err);
        setKakaoError(err?.message || String(err));
      });

    return () => {
      window.removeEventListener("resize", resizeHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 시트 열릴 때/탭 전환 시 레이아웃 보정 + 높이 재계산
  useEffect(() => {
    const m = mapObjRef.current;
    if ((window as any).kakao?.maps && m) setTimeout(() => m.relayout(), 0);
    setTimeout(recalcSheetMax, 0);
  }, [sheetOpen, activeTab, cartCount]);

  const recalcSheetMax = () => {
    const winH = window.innerHeight;
    const cartBottom = cartBtnRef.current ? cartBtnRef.current.getBoundingClientRect().bottom : winH * 0.55;
    const phoneTop = phoneBtnRef.current ? phoneBtnRef.current.getBoundingClientRect().top : winH * 0.8;
    // 두 버튼 사이의 중앙값(여유 8px)
    const safeTop = Math.min(winH - 56, Math.max(0, Math.floor((cartBottom + phoneTop) / 2) + 8));
    const maxH = Math.max(320, winH - safeTop);
    setSheetMaxH(maxH);
  };

  /* 같은 좌표 마커 나란히 */
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

  /* 그룹 zIndex */
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

  /* 마커 상태 전환 */
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

  /* 바운드 내 마커 로드 */
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
    const monthlyFeeY1 = toNumLoose(getField(row, ["1년 계약 시 월 광고료", "연간월광고료", "monthlyFeeY1"]));
    const costPerPlay = toNumLoose(getField(row, ["1회당 송출비용", "costPerPlay"]));
    const hours = getField(row, ["운영시간", "hours"]) || "";
    const rawImage = getField(row, ["imageUrl", "이미지", "썸네일", "thumbnail"]) || undefined;

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
      imageUrl: rawImage || imageForProduct(productName),
      lat,
      lng,
    };
  }

  /* 검색 */
  const runPlaceSearch = (q: string) => {
    const kakao = (window as KakaoNS).kakao;
    if (!placesRef.current || !kakao?.maps) return;
    // 포커스 제거(키보드 닫기)
    searchInputRef.current?.blur();
    (document.activeElement as HTMLElement | null)?.blur?.();

    placesRef.current.keywordSearch(q, (results: any[], status: string) => {
      if (status !== kakao.maps.services.Status.OK || !results?.length) return;
      const first = results[0];
      const lat = Number(first.y),
        lng = Number(first.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const latlng = new kakao.maps.LatLng(lat, lng);
      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);
      loadMarkersInBounds().then(() => applyStaticSeparationAll());
    });
  };

  /* 카트 조작 */
  const isInCart = useCallback((rowKey?: string | null) => !!rowKey && cart.some((c) => c.rowKey === rowKey), [cart]);

  const addSelectedToCart = useCallback(() => {
    if (!selected) return;
    const base = selected.monthlyFee ?? 0;
    const nextItem: CartItem = {
      rowKey: selected.rowKey,
      aptName: selected.name,
      productName: selected.productName,
      months: 1,
      baseMonthly: base,
      monthlyFeeY1: selected.monthlyFeeY1 ?? undefined,
    };
    // 항상 맨 위로
    const rest = cart.filter((c) => c.rowKey !== selected.rowKey);
    const next = [nextItem, ...rest];
    setCart(next);
    setMarkerStateByRowKey(selected.rowKey, "selected", true);
    setSheetOpen(true);
    setActiveTab("cart");
    showSnack(`‘${selected.name}’이(가) 카트에 담겼어요.`);
  }, [cart, selected, setMarkerStateByRowKey]);

  const removeFromCart = (rowKey: string, nameHint?: string) => {
    const next = cart.filter((c) => c.rowKey !== rowKey);
    setCart(next);
    setMarkerStateByRowKey(rowKey, "default");
    if (nameHint) showSnack(`‘${nameHint}’을(를) 카트에서 제거했어요.`);
  };

  const toggleSelectedInCart = useCallback(() => {
    if (!selected) return;
    if (isInCart(selected.rowKey)) removeFromCart(selected.rowKey, selected.name);
    else addSelectedToCart();
  }, [selected, isInCart, addSelectedToCart]);

  const updateMonths = (rowKey: string, months: number) => {
    setCart((prev) => {
      if (applyAll) return prev.map((c) => ({ ...c, months }));
      return prev.map((c) => (c.rowKey === rowKey ? { ...c, months } : c));
    });
  };

  /* 파생: 같은 상품 개수 집계 → 할인 계산 */
  const computedCart = useMemo(() => {
    const countMap = new Map<string, number>();
    cart.forEach((c) => {
      const key = normPolicyKey(c.productName);
      const k = key === "_NONE" ? "_NONE" : key;
      countMap.set(k, (countMap.get(k) || 0) + 1);
    });

    return cart.map((c) => {
      const k = normPolicyKey(c.productName);
      const sameCnt = countMap.get(k === "_NONE" ? "_NONE" : k) || 1;
      const { monthly, rate } = calcMonthlyWithPolicy(
        c.productName,
        c.months,
        c.baseMonthly ?? 0,
        c.monthlyFeeY1,
        sameCnt,
      );
      const total = monthly * c.months;
      return { ...c, _monthly: monthly, _discountRate: rate, _total: total };
    });
  }, [cart]);

  // 총 비용 = 총광고료 합계
  const totalCost = useMemo(() => computedCart.reduce((sum, c) => sum + (c._total ?? 0), 0), [computedCart]);

  /* 카트 → 지도 이동 + 상세 탭 */
  const goToRowKey = useCallback(
    (rowKey: string) => {
      const arr = keyIndexRef.current[rowKey];
      if (!arr || !arr.length) return;
      const mk = arr[0];
      const row = mk.__row as PlaceRow;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      const maps = (window as KakaoNS).kakao?.maps;
      if (!maps || !mapObjRef.current) return;

      const pos = new maps.LatLng(lat, lng);
      mapObjRef.current.setLevel(4);
      mapObjRef.current.panTo(pos);

      const sel = toSelected(rowKey, row, lat, lng);
      setSelected(sel);
      setSheetOpen(true);
      setActiveTab("detail");

      const imgs = markerImages(maps);
      if (lastClickedRef.current && lastClickedRef.current !== mk) {
        const prev = lastClickedRef.current;
        const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
        prev.setImage(selectedRowKeySetRef.current.has(prevRowKey) ? imgs.yellow : imgs.purple);
      }
      mk.setImage(imgs.clicked);
      lastClickedRef.current = mk;
      applyStaticSeparationAll();
    },
    [applyStaticSeparationAll],
  );

  /* 드래그 핸들 */
  const onHandlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStartYRef.current = e.clientY;
    setDragY(0);
    isDraggingRef.current = true;
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || dragStartYRef.current == null) return;
    const dy = Math.max(0, e.clientY - dragStartYRef.current);
    setDragY(dy);
  };
  const onHandlePointerUp = () => {
    if (!isDraggingRef.current) return;
    const dy = dragY;
    isDraggingRef.current = false;
    setDragY(0);
    if (dy > 120) setSheetOpen(false);
  };

  /* 렌더 */
  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 상단 헤더만 흰 배경 고정 */}
      <div className="fixed top-0 left-0 right-0 z-[40] bg-white border-b">
        <div className="h-14 px-3 flex items-center justify-between">
          <div className="font-extrabold text-[15px]">응답하라 입주민이여</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPkgOpen(true)} className="px-3 py-1 rounded-full border text-sm font-semibold">
              패키지 문의
            </button>
          </div>
        </div>
      </div>

      {/* 지도: 헤더 높이만큼 top 보정 */}
      <div ref={mapRef} className="fixed top-[56px] left-0 right-0 bottom-0 z-[10]" aria-label="map" />

      {/* 검색창 + 버튼 스택(지도 위 오버레이) */}
      <div className="fixed z-[35] left-3 right-3 top-[64px] pointer-events-none">
        <div className="flex items-start gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runPlaceSearch(searchQ);
            }}
            className="flex-1 pointer-events-auto"
          >
            <input
              ref={searchInputRef}
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="지역명, 아파트 이름, 단지명, 건물명"
              className="w-full h-11 px-4 rounded-xl border outline-none bg-white/95"
              style={{ borderColor: "#E8E0FF" }}
            />
          </form>

          {/* 버튼 스택: 돋보기 → 카트 → 전화 (요청 순서) */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            {/* 돋보기(검색) */}
            <button
              onClick={() => runPlaceSearch(searchQ)}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
              style={{ backgroundColor: COLOR_PRIMARY }}
              aria-label="검색"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79L20 21.49 21.49 20l-5.99-6zM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
              </svg>
            </button>
            {/* 카트 */}
            <button
              ref={cartBtnRef}
              onClick={() => {
                setSheetOpen(true);
                setActiveTab("cart");
              }}
              className="relative w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
              style={{ backgroundColor: COLOR_PRIMARY }}
              aria-label="카트 열기"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 4h-2l-1 2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h9v-2h-8.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h5.74c.75 0 1.41-.41 1.75-1.03L23 6H6.21l-.94-2zM7 20c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#FF3B30] text-[10px] font-bold flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
            {/* 전화 */}
            <a
              ref={phoneBtnRef}
              href="tel:1551-0810"
              className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow"
              style={{ backgroundColor: COLOR_PRIMARY }}
              aria-label="전화 연결"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V21a1 1 0 01-1 1C10.3 22 2 13.7 2 3a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* 바깥 클릭 시 시트 닫기 */}
      {sheetOpen && <div className="fixed inset-0 z-[50] bg-black/0" onClick={() => setSheetOpen(false)} />}

      {/* 하단 시트 (최대 높이 제한 포함) */}
      <MobileBottomSheet
        open={sheetOpen}
        translateY={dragY}
        maxHeightPx={sheetMaxH ?? undefined}
        onHandlePointerDown={onHandlePointerDown}
        onHandlePointerMove={onHandlePointerMove}
        onHandlePointerUp={onHandlePointerUp}
      >
        {/* 탭 헤더 */}
        <div className="px-4 mt-1 flex items-center gap-2">
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold ${activeTab === "cart" ? "text-white" : "bg-gray-100"}`}
            style={activeTab === "cart" ? { backgroundColor: COLOR_PRIMARY } : {}}
            onClick={() => setActiveTab("cart")}
          >
            카트 {cart.length ? `(${cart.length})` : ""}
          </button>
          <button
            className={`px-4 py-2 rounded-full text-sm font-semibold ${activeTab === "detail" ? "text-white" : "bg-gray-100"}`}
            style={activeTab === "detail" ? { backgroundColor: COLOR_PRIMARY } : {}}
            onClick={() => setActiveTab("detail")}
          >
            단지 상세
          </button>
        </div>
        {/* 경계용 흰 스트립 */}
        <div className="-mx-4 h-3 bg-white" />

        {/* 본문을 상·중·하로 나눔(푸터 고정) */}
        <div className="px-4 pb-0 flex flex-col overflow-hidden">
          {/* 상단 요약/필터 (카트 탭일 때만 노출) */}
          {activeTab === "cart" && (
            <div className="shrink-0">
              <div className="mb-3 rounded-xl px-4 py-3" style={{ backgroundColor: COLOR_PRIMARY_LIGHT }}>
                <div className="text-sm text-gray-600">총 비용</div>
                <div className="text-[20px] font-extrabold" style={{ color: COLOR_PRIMARY }}>
                  {fmtWon(totalCost)}
                </div>
                <div className="text-[11px] text-gray-500">(VAT별도)</div>
              </div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm text-gray-700 font-medium">총 {cart.length}건</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-[#6F4BF2]"
                    checked={applyAll}
                    onChange={(e) => setApplyAll(e.target.checked)}
                  />
                  광고기간 일괄적용
                </label>
              </div>
            </div>
          )}

          {/* 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto pt-2 pb-6">
            {activeTab === "cart" ? (
              <CartList
                colorPrimary={COLOR_PRIMARY}
                colorPrimaryLight={COLOR_PRIMARY_LIGHT}
                cart={computedCart}
                onUpdateMonths={updateMonths}
                onRemove={(rk) => {
                  const name = computedCart.find((c) => c.rowKey === rk)?.aptName;
                  removeFromCart(rk, name);
                }}
                onGoTo={(rk) => goToRowKey(rk)}
              />
            ) : (
              <DetailTab
                colorPrimary={COLOR_PRIMARY}
                selected={selected}
                isInCart={isInCart(selected?.rowKey)}
                onToggleCart={toggleSelectedInCart}
              />
            )}
          </div>

          {/* 하단 고정 푸터 */}
          {activeTab === "cart" && (
            <div className="shrink-0 sticky bottom-0 -mx-4 px-4 pb-4 pt-2 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t">
              <button
                className="w-full h-12 rounded-2xl border-2 font-extrabold"
                style={{ color: COLOR_PRIMARY, borderColor: COLOR_PRIMARY }}
                onClick={() => alert("상품견적 자세히보기 (연결 예정)")}
              >
                상품견적 자세히보기
              </button>
            </div>
          )}
        </div>
      </MobileBottomSheet>

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

      {/* 패키지 문의 모달 */}
      {pkgOpen && (
        <SimpleModal open={pkgOpen} onClose={() => setPkgOpen(false)} title="패키지 문의">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">패키지 상품 상담을 원하시면 아래 연락처로 문의 주세요.</p>
            <a
              href="tel:1551-0810"
              className="inline-block px-4 py-2 rounded-xl text-white font-semibold"
              style={{ backgroundColor: COLOR_PRIMARY }}
            >
              1551-0810 전화하기
            </a>
          </div>
        </SimpleModal>
      )}

      {/* 종료 확인 모달 */}
      {exitAsk && (
        <ConfirmModal
          title="정말로 해당 페이지를 종료하시겠습니까?"
          onCancel={() => setExitAsk(false)}
          onConfirm={() => {
            const h = popHandlerRef.current;
            if (h) window.removeEventListener("popstate", h);
            setExitAsk(false);
            setTimeout(() => history.back(), 0);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================================
 * BottomSheet
 * ========================================================================= */
function MobileBottomSheet(props: {
  open: boolean;
  translateY: number;
  maxHeightPx?: number;
  onHandlePointerDown: (e: React.PointerEvent) => void;
  onHandlePointerMove: (e: React.PointerEvent) => void;
  onHandlePointerUp: (e: React.PointerEvent) => void;
  children: React.ReactNode;
}) {
  const { open, translateY, maxHeightPx, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp, children } =
    props;

  return (
    <div
      className={`fixed left-0 right-0 z-[55] transition-transform duration-200 ease-out ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={{
        bottom: 0,
        transform: open ? `translateY(${translateY}px)` : "translateY(110%)",
      }}
    >
      <div
  className="mx-auto w-full max-w-[560px] rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col min-h-0"
  style={{ maxHeight: maxHeightPx ?? undefined }}
>

        <div
          className="pt-2 pb-1 cursor-grab touch-none select-none"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
        <div className="flex-1 min-h-0 overflow-hidden">
  {children}
</div>
    </div>
  );
}

/* =========================================================================
 * Cart 리스트
 * ========================================================================= */
function CartList(props: {
  colorPrimary: string;
  colorPrimaryLight: string;
  cart: (CartItem & { _monthly: number; _discountRate: number; _total: number })[];
  onUpdateMonths: (rowKey: string, months: number) => void;
  onRemove: (rowKey: string) => void;
  onGoTo: (rowKey: string) => void;
}) {
  const { colorPrimary, colorPrimaryLight, cart, onUpdateMonths, onRemove, onGoTo } = props;

  return (
    <div className="space-y-3">
      {cart.map((item) => {
        const percent = Math.round((item._discountRate ?? 0) * 100);
        return (
          <div key={item.rowKey} className="rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <button onClick={() => onGoTo(item.rowKey)} className="flex-1 text-left" title="지도로 이동">
                <div className="font-extrabold text-[16px]">{item.aptName}</div>
                <div className="text-xs text-gray-500">{item.productName ?? "ELEVATOR TV"}</div>
              </button>
              <button
                onClick={() => onRemove(item.rowKey)}
                className="h-8 px-3 rounded-full bg-gray-100 text-gray-600 text-sm"
                aria-label="삭제"
              >
                삭제
              </button>
            </div>

            {/* 기간 선택 */}
            <div className="mt-3">
              <div className="text-sm text-gray-600 mb-1">광고기간</div>
              <select
                className="w-36 rounded-xl border px-3 py-2"
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

            {/* 월광고료(기본) */}
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-600">월광고료(기본)</div>
              <div className="text-right font-semibold">{fmtWon(item.baseMonthly)}</div>
            </div>

            {/* 총광고료(기간/할인 적용) */}
            <div className="mt-1 grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-600">총광고료</div>
              <div className="text-right">
                <span className="inline-flex items-center gap-2">
                  {percent > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: colorPrimaryLight,
                        color: colorPrimary,
                      }}
                    >
                      {percent}%할인
                    </span>
                  )}
                  <span className="font-extrabold" style={{ color: colorPrimary }}>
                    {fmtWon(item._total)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
 * Detail 탭
 * ========================================================================= */
function DetailTab(props: {
  colorPrimary: string;
  selected: SelectedApt | null;
  isInCart: boolean;
  onToggleCart: () => void;
}) {
  const { colorPrimary, selected, isInCart, onToggleCart } = props;
  if (!selected) return <div className="text-center text-sm text-gray-500 py-6">지도의 단지를 선택하세요.</div>;

  const y1Monthly = selected.monthlyFeeY1 ?? Math.round((selected.monthlyFee ?? 0) * 0.7);
  return (
    <div>
      <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
        {selected.imageUrl ? (
          <img src={selected.imageUrl} alt={selected.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">이미지</div>
        )}
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[20px] font-extrabold">{selected.name}</div>
          <div className="text-sm text-gray-500">
            {fmtNum(selected.households)} 세대 · {fmtNum(selected.residents)} 명
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: COLOR_GRAY_CARD }}>
          <div className="text-sm text-gray-600">월 광고료</div>
          <div className="text-[20px] font-extrabold">
            {fmtWon(selected.monthlyFee)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>
        <div
          className="rounded-2xl px-4 py-3 border-2"
          style={{ borderColor: colorPrimary, backgroundColor: COLOR_PRIMARY_LIGHT }}
        >
          <div className="text-sm text-gray-700">1년 계약 시 월 광고료</div>
          <div className="text-[20px] font-extrabold" style={{ color: colorPrimary }}>
            {fmtWon(y1Monthly)} <span className="text-xs text-gray-500">(VAT별도)</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <button
          className={`w-full h-12 rounded-2xl font-extrabold ${isInCart ? "text-gray-700" : "text-white"}`}
          style={{ backgroundColor: isInCart ? "#E5E7EB" : colorPrimary }}
          aria-pressed={isInCart}
          onClick={onToggleCart}
        >
          {isInCart ? "담기 취소" : "아파트 담기"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border">
        <table className="w-full text-sm">
          <tbody className="[&_td]:px-4 [&_td]:py-3">
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
              <td className="font-semibold">{fmtNum(selected.monitors)} 대</td>
            </tr>
            <tr>
              <td className="text-gray-500">월 송출횟수</td>
              <td className="font-semibold">{fmtNum(selected.monthlyImpressions)} 회</td>
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

/* =========================================================================
 * 심플 모달 / 확인 모달
 * ========================================================================= */
function SimpleModal(props: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { open, onClose, title, children } = props;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-4 top-24 rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="font-extrabold">{title}</div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-gray-100 text-gray-600">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal(props: { title: string; onConfirm: () => void; onCancel: () => void }) {
  const { title, onConfirm, onCancel } = props;
  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-x-8 top-1/3 translate-y-[-50%] rounded-2xl bg-white p-4 shadow-xl">
        <div className="font-extrabold text-[15px] mb-3">{title}</div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold">
            아니오
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-white font-semibold"
            style={{ backgroundColor: COLOR_PRIMARY }}
          >
            예
          </button>
        </div>
      </div>
    </div>
  );
}
