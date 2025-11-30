// src/pages/MapPage.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MapChrome, { SelectedApt } from "../components/MapChrome";
import { LocateFixed, Zap, Plus, Minus } from "lucide-react";

type KakaoNS = typeof window & { kakao: any };
const FALLBACK_KAKAO_KEY = "a53075efe7a2256480cec67ebae";

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
   ② Kakao SDK 로더/정리
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
}

/* =========================================================================
   ③ 헬퍼
   ------------------------------------------------------------------------- */
// ✅ HashRouter(#/map?q=...)와 BrowserRouter(/map?q=...) 둘 다 지원
function readQuery() {
  const u = new URL(window.location.href);

  // 1) HashRouter: "#/map?q=산본역" 형태에서 q 추출
  const hash = u.hash || ""; // 예: "#/map?q=산본역"
  const qFromHash = (() => {
    if (!hash) return "";
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return "";
    const searchInHash = hash.slice(qIndex + 1); // "q=산본역"
    const sp = new URLSearchParams(searchInHash);
    return (sp.get("q") || "").trim();
  })();
  if (qFromHash) return qFromHash;

  // 2) BrowserRouter: "/map?q=산본역" 형태에서 q 추출
  return (u.searchParams.get("q") || "").trim();
}

function writeQuery(v: string) {
  const u = new URL(window.location.href);

  // 1) HashRouter: "#/map?q=..." 안의 q를 갱신
  if (u.hash) {
    const hash = u.hash; // 예: "#/map?q=산본역" 또는 "#/map"
    const qIndex = hash.indexOf("?");
    const hashPath = qIndex === -1 ? hash : hash.slice(0, qIndex); // "#/map"
    const hashSearch = qIndex === -1 ? "" : hash.slice(qIndex + 1); // "q=산본역" 또는 ""

    const sp = new URLSearchParams(hashSearch);
    if (v) sp.set("q", v);
    else sp.delete("q");

    const newHashSearch = sp.toString();
    u.hash = newHashSearch ? `${hashPath}?${newHashSearch}` : hashPath; // "#/map?q=..." 또는 "#/map"
  } else {
    // 2) BrowserRouter: 일반 쿼리(/map?q=...) 갱신
    if (v) u.searchParams.set("q", v);
    else u.searchParams.delete("q");
  }

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
   ④ 타입/키 유틸
   ------------------------------------------------------------------------- */
type PlaceRow = {
  id?: number | string;
  place_id?: number | string;
  lat?: number | null;
  lng?: number | null;
  [key: string]: any;
};
type KMarker = any & { __key?: string; __basePos?: any; __row?: PlaceRow };

// ✅ monthly_fee(뷰 컬럼)까지 함께 읽도록 수정
const monthlyFeeOf = (row: PlaceRow): number =>
  toNumLoose(
    getField(row, ["월광고료", "월 광고료", "월 광고비", "월비용", "월요금", "monthly_fee", "month_fee", "monthlyFee"]),
  ) ?? 0;

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
// ✅ rowKey("id:1234" 형태)에서 place_id 추출
const parsePlaceIdFromRowKey = (rowKey?: string): string | undefined => {
  if (!rowKey) return undefined;
  const m = /^id:([^|]+)$/i.exec(rowKey.trim());
  return m ? m[1] : undefined;
};

/* =========================================================================
   ⑤ ‘정적 분리(항상 나란히)’ 레이아웃
   ------------------------------------------------------------------------- */
function layoutMarkersSideBySide(map: any, group: KMarker[]) {
  if (!group || group.length <= 1) return;
  const proj = map.getProjection();
  const center = group[0].__basePos;
  const cpt = proj.containerPointFromCoords(center);
  const N = group.length,
    GAP = PIN_SIZE + 6, // ✅ 핀 너비(51px) + 여백 6px → 아이콘이 겹치지 않고 나란히 배치
    totalW = GAP * (N - 1),
    startX = cpt.x - totalW / 2,
    y = cpt.y;
  for (let i = 0; i < N; i++) {
    const pt = new (window as any).kakao.maps.Point(startX + i * GAP, y);
    const pos = proj.coordsFromContainerPoint(pt);
    group[i].setPosition(pos);
  }
}

/* =========================================================================
   ⑥ 메인 컴포넌트
   ------------------------------------------------------------------------- */
type SelectedAptX = SelectedApt & { selectedInCart?: boolean };

export default function MapPage() {
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

  // ✅ 내 위치 오버레이용 ref/state (PC 버튼)
  const userOverlayRef = useRef<any>(null);
  const userOverlayElRef = useRef<HTMLDivElement | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // ✅ Quick Add 모드 상태
  const quickModeRef = useRef<boolean>(false);
  const [quickMode, setQuickMode] = useState(false);

  // ✅ 선택 스냅샷 참조 (이벤트 payload에 사용)
  const selectedRef = useRef<SelectedAptX | null>(null);
  const lastSelectedSnapRef = useRef<SelectedAptX | null>(null);

  // ✅ 상세 캐시 & 중복요청 방지
  const detailCacheRef = useRef<Map<string, any>>(new Map());
  const inflightDetailRef = useRef<Map<string, Promise<any>>>(new Map());

  // ✅ 패널 폭 상태 (지도/패널 동적 레이아웃)
  const [cartW, setCartW] = useState<number>(360); // 1탭(카트)
  const [detailW, setDetailW] = useState<number>(360); // 2탭(상세)

  // 상세 응답 → SelectedAptX에 병합
  const patchFromDetail = useCallback(
    (d: any, prev: SelectedAptX) => ({
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
      city: d.city ?? prev.city,
      district: d.district ?? prev.district,

      lat: d.lat ?? prev.lat,
      lng: d.lng ?? prev.lng,
      imageUrl: d.image_url ?? prev.imageUrl,
    }),
    [],
  );

  // RPC 1회 보장 + 결과 캐싱
  const fetchDetailCached = useCallback(async (pid: string | number, rowKey: string) => {
    const cacheKey = rowKey;
    if (detailCacheRef.current.has(cacheKey)) return detailCacheRef.current.get(cacheKey);
    if (inflightDetailRef.current.has(cacheKey)) return inflightDetailRef.current.get(cacheKey);

    const p = (async () => {
      const { data, error } = await (supabase as any).rpc("get_public_place_detail", { p_place_id: pid });
      if (error) throw error;
      const d = Array.isArray(data) ? data[0] : data;
      if (d) detailCacheRef.current.set(cacheKey, d);
      inflightDetailRef.current.delete(cacheKey);
      return d;
    })();

    inflightDetailRef.current.set(cacheKey, p);
    return p;
  }, []);

  const [selected, setSelected] = useState<SelectedAptX | null>(null);
  const [initialQ, setInitialQ] = useState("");
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  // 🔒 퀵담기 토글 억제 플래그(카트에서 단지명 클릭 → 프로그램틱 클릭 시 한 번 억제)
  const suppressQuickToggleOnceRef = useRef<boolean>(false);

  // Sync quickMode state to ref
  useEffect(() => {
    quickModeRef.current = quickMode;
  }, [quickMode]);

  // ✅ selected → ref 동기화 (이벤트용 스냅샷 보존)
  useEffect(() => {
    selectedRef.current = selected ?? null;
    if (selected) lastSelectedSnapRef.current = selected;
  }, [selected]);

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
    const TOP = 2000000; // 반경 라벨(1,000,000)·검색핀(500,000)보다 높게
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

  const applyStaticSeparationAll = useCallback(() => {
    const map = mapObjRef.current;
    if (!map || !(window as any).kakao?.maps) return;
    groupsRef.current.forEach((group) => layoutMarkersSideBySide(map, group));
  }, []);

  // 화면 중심에 가까운 마커 상세를 조용히 프리페치
  const prefetchTopDetails = useCallback(
    (limit = 8) => {
      const kakao = (window as KakaoNS).kakao;
      const maps = kakao?.maps;
      const map = mapObjRef.current;
      if (!maps || !map) return;
      const center = map.getCenter();

      const items: { rowKey: string; pid: string; dist: number }[] = [];
      markerCacheRef.current.forEach((mk) => {
        const r = mk.__row as PlaceRow;
        const pid = rowIdOf(r);
        if (!pid) return;
        const rk = buildRowKeyFromRow(r);
        if (detailCacheRef.current.has(rk) || inflightDetailRef.current.has(rk)) return;
        const p = mk.getPosition?.() || mk.__basePos;
        const dlat = p.getLat() - center.getLat();
        const dlng = p.getLng() - center.getLng();
        items.push({ rowKey: rk, pid: String(pid), dist: dlat * dlat + dlng * dlng });
      });

      items.sort((a, b) => a.dist - b.dist);
      items.slice(0, limit).forEach((it) => {
        fetchDetailCached(it.pid, it.rowKey).catch(() => {});
      });
    },
    [fetchDetailCached],
  );

  /* ---------- 지도 초기화 ---------- */
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
        (window as any).kakaoMap = map;
        (window as any).__kakaoMap = map;

        placesRef.current = new kakao.maps.services.Places();

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
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map,
          averageCenter: true,
          minLevel: 6,
          disableClickZoom: true,
          gridSize: 80,
          styles: clusterStyles,
        });
        console.log("[map] clusterer init", clustererRef.current);
        // ✅ 클러스터 클릭 시: 해당 클러스터 범위로 지도 이동/확대
        kakao.maps.event.addListener(clustererRef.current, "clusterclick", (cluster: any) => {
          const m = mapObjRef.current;
          if (!m || !cluster) return;

          // 클러스터 안에 포함된 마커들의 범위를 얻어서 그 범위로 지도 이동
          const bounds = cluster.getBounds();
          if (bounds) {
            m.setBounds(bounds);
          } else {
            // 혹시 bounds가 없으면 센터만 이동
            const center = cluster.getCenter?.();
            if (center) {
              m.setCenter(center);
              const curLevel = m.getLevel();
              m.setLevel(Math.max(curLevel - 1, 1));
            }
          }
        });
        kakao.maps.event.addListener(map, "zoom_changed", applyStaticSeparationAll);
        kakao.maps.event.addListener(map, "idle", async () => {
          await loadMarkersInBounds();
          applyStaticSeparationAll();
          // PC에서는 지도 idle 시 상세 RPC를 미리 호출하지 않음 (모바일과 동일 패턴)
          // prefetchTopDetails(8);
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
      } catch {}
      try {
        radiusLabelRef.current?.setMap(null);
      } catch {}
      try {
        searchPinRef.current?.setMap?.(null);
      } catch {}
      // ✅ 내 위치 오버레이 정리
      try {
        userOverlayRef.current?.setMap(null);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyStaticSeparationAll, prefetchTopDetails]);

  useEffect(() => {
    const m = mapObjRef.current;
    if ((window as any).kakao?.maps && m)
      setTimeout(() => {
        m.relayout();
        applyStaticSeparationAll();
      }, 0);
  }, [selected, applyStaticSeparationAll]);

  /* ---------- 패널 줌 이벤트 연결 (MapChrome → MapPage) ---------- */
  useEffect(() => {
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const onZoom = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {};
      const op: "expand" | "collapse" = detail.op || "expand";
      const step: number = Number(detail.step) || 36;
      const target: "both" | "cart" | "detail" = detail.target || "both";

      setCartW((w) => (target === "detail" ? w : clamp(w + (op === "expand" ? step : -step), 280, 392)));
      setDetailW((w) => (target === "cart" ? w : clamp(w + (op === "expand" ? step : -step), 320, 504)));

      // 지도의 가시 영역 갱신
      setTimeout(() => {
        try {
          mapObjRef.current?.relayout();
          applyStaticSeparationAll();
        } catch {}
      }, 0);
    };

    window.addEventListener("orka:panel:zoom", onZoom as EventListener);
    return () => window.removeEventListener("orka:panel:zoom", onZoom as EventListener);
  }, [applyStaticSeparationAll]);

  /* ---------- 폭/선택 변화 시 지도 리레이아웃 보장 ---------- */
  useEffect(() => {
    const m = mapObjRef.current;
    if (m) {
      try {
        m.relayout();
        applyStaticSeparationAll();
      } catch {}
    }
  }, [cartW, detailW, selected, applyStaticSeparationAll]);

  /* ---------- 마커 색 전환(행 키) ---------- */
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
          } else mk.setImage(imgs.purple);
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

  /* ---------- 카트 제어 헬퍼 ---------- */
  const isRowKeySelected = useCallback(
    (rowKey?: string | null) => !!rowKey && selectedRowKeySetRef.current.has(rowKey),
    [],
  );

  // ✅ rowKey 기준으로 항상 같은 단지 스냅샷을 만들어주는 헬퍼
  const buildSnapshotFromRowKey = useCallback((rowKey: string): SelectedAptX | null => {
    if (!rowKey) return null;
    const list = keyIndexRef.current[rowKey];
    const row = (list?.[0]?.__row as PlaceRow) || undefined;
    if (!row) return null;

    const lat = Number(row.lat);
    const lng = Number(row.lng);

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

    // ✅ monthly_impressions / monthly_fee_y1 / cost_per_play 컬럼도 함께 읽기
    const monthlyImpressions = toNumLoose(
      getField(row, [
        "월송출횟수",
        "월 송출횟수",
        "월 송출 횟수",
        "월송출",
        "노출수(월)",
        "monthly_impressions",
        "monthlyImpressions",
      ]),
    );

    const monthlyFee = monthlyFeeOf(row);

    const monthlyFeeY1 = toNumLoose(
      getField(row, [
        "1년 계약 시 월 광고료",
        "1년계약시월광고료",
        "연간월광고료",
        "할인 월 광고료",
        "연간_월광고료",
        "monthly_fee_y1",
        "monthlyFeeY1",
      ]),
    );

    const costPerPlay = toNumLoose(
      getField(row, ["1회당 송출비용", "송출 1회당 비용", "cost_per_play", "costPerPlay"]),
    );

    const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
    const imageUrl = getField(row, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) || undefined;

    // ✅ 시/구 정보도 스냅샷에 포함
    const city = (row as any).city ?? getField(row, ["city"]);
    const district = (row as any).district ?? getField(row, ["district"]);

    return {
      rowKey,
      rowId: rowIdOf(row) != null ? String(rowIdOf(row)) : undefined,
      name,
      address,
      productName,
      installLocation, // ✅ 설치위치 포함
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
      city,
      district,
      selectedInCart: selectedRowKeySetRef.current.has(rowKey),
    };
  }, []);

  const addToCartByRowKey = useCallback(
    (rowKey: string) => {
      selectedRowKeySetRef.current.add(rowKey);
      setMarkerStateByRowKey(rowKey, "selected", true);
      setSelected((p) => (p && p.rowKey === rowKey ? { ...p, selectedInCart: true } : p));
      applyGroupPrioritiesForRowKey(rowKey);
      applyStaticSeparationAll();

      // ✅ rowKey 기준 스냅샷을 우선 사용 (퀵담기에서도 설치위치 포함 보장)
      const snapFromRow = buildSnapshotFromRowKey(rowKey);
      const snap = snapFromRow ?? selectedRef.current ?? lastSelectedSnapRef.current ?? null;

      window.dispatchEvent(
        new CustomEvent("orka:cart:changed", {
          detail: {
            rowKey,
            selected: true,
            selectedSnapshot: snap,
          },
        }),
      );
    },
    [applyGroupPrioritiesForRowKey, applyStaticSeparationAll, setMarkerStateByRowKey, buildSnapshotFromRowKey],
  );

  const removeFromCartByRowKey = useCallback(
    (rowKey: string) => {
      selectedRowKeySetRef.current.delete(rowKey);
      setMarkerStateByRowKey(rowKey, "default");
      setSelected((p) => (p && p.rowKey === rowKey ? { ...p, selectedInCart: false } : p));
      applyGroupPrioritiesForRowKey(rowKey);
      applyStaticSeparationAll();

      // ✅ 제거 이벤트도 형식 맞춰 동일하게 처리
      const snapFromRow = buildSnapshotFromRowKey(rowKey);
      const snap = snapFromRow ?? selectedRef.current ?? lastSelectedSnapRef.current ?? null;

      window.dispatchEvent(
        new CustomEvent("orka:cart:changed", {
          detail: {
            rowKey,
            selected: false,
            selectedSnapshot: snap,
          },
        }),
      );
    },
    [applyGroupPrioritiesForRowKey, applyStaticSeparationAll, setMarkerStateByRowKey, buildSnapshotFromRowKey],
  );

  const toggleCartByRowKey = useCallback(
    (rowKey: string) => {
      if (selectedRowKeySetRef.current.has(rowKey)) removeFromCartByRowKey(rowKey);
      else addToCartByRowKey(rowKey);
    },
    [addToCartByRowKey, removeFromCartByRowKey],
  );

  /* ---------- 카트 아파트 클릭 → 2탭 상세 선택 ---------- */
  const handleCartItemSelectByRowKey = useCallback(
    async (rowKey: string) => {
      if (!rowKey) return;

      // 1) 이미 로드된 마커/행에서 바로 SelectedAptX 구성
      const list = keyIndexRef.current[rowKey];
      const row = (list?.[0]?.__row as PlaceRow) || undefined;

      if (row) {
        const lat = Number(row.lat);
        const lng = Number(row.lng);
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
          getField(row, [
            "월송출횟수",
            "월 송출횟수",
            "월 송출 횟수",
            "월송출",
            "노출수(월)",
            "monthly_impressions",
            "monthlyImpressions",
          ]),
        );
        const monthlyFee = monthlyFeeOf(row);
        const monthlyFeeY1 = toNumLoose(
          getField(row, [
            "1년 계약 시 월 광고료",
            "1년계약시월광고료",
            "연간월광고료",
            "할인 월 광고료",
            "연간_월광고료",
            "monthly_fee_y1",
            "monthlyFeeY1",
          ]),
        );
        const costPerPlay = toNumLoose(
          getField(row, ["1회당 송출비용", "송출 1회당 비용", "cost_per_play", "costPerPlay"]),
        );
        const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
        const imageUrl = getField(row, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) || undefined;

        const city = (row as any).city ?? getField(row, ["city"]);
        const district = (row as any).district ?? getField(row, ["district"]);

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
          city,
          district,
          selectedInCart: selectedRowKeySetRef.current.has(rowKey),
        };
        setSelected(sel);

        const pid = rowIdOf(row);
        if (pid) {
          try {
            const d = await fetchDetailCached(pid, rowKey);
            if (d) {
              setSelected((prev) => (prev && prev.rowKey === rowKey ? { ...prev, ...patchFromDetail(d, prev) } : prev));
            }
          } catch (e: any) {
            console.warn("[handleCartItemSelectByRowKey] detail RPC error:", e?.message || e);
          }
        }
        return;
      }

      // 2) 현재 마커가 없으면 rowKey에서 place_id 파싱 후 RPC만으로 상세/좌표 구성
      const placeId = parsePlaceIdFromRowKey(rowKey);
      if (!placeId) return;

      try {
        const d = await fetchDetailCached(placeId, rowKey);
        if (!d) return;

        const lat = d.lat;
        const lng = d.lng;

        const sel: SelectedAptX = {
          rowKey,
          rowId: String(placeId),
          name: d.name ?? "",
          address: d.address ?? "",
          productName: d.product_name ?? d.productName ?? "",
          installLocation: d.install_location ?? d.installLocation ?? "",
          households: d.households ?? undefined,
          residents: d.residents ?? undefined,
          monitors: d.monitors ?? undefined,
          monthlyImpressions: d.monthly_impressions ?? undefined,
          costPerPlay: d.cost_per_play ?? undefined,
          hours: d.hours ?? "",
          monthlyFee: d.monthly_fee ?? undefined,
          monthlyFeeY1: d.monthly_fee_y1 ?? undefined,
          imageUrl: d.image_url ?? undefined,
          lat,
          lng,
          city: d.city ?? undefined,
          district: d.district ?? undefined,
          selectedInCart: selectedRowKeySetRef.current.has(rowKey),
        };
        setSelected(sel);

        // 지도도 같이 이동(마커가 아직 없어도)
        const kakao = (window as KakaoNS).kakao;
        const maps = kakao?.maps;
        const map = mapObjRef.current;
        if (maps && map && Number.isFinite(lat) && Number.isFinite(lng)) {
          const latlng = new maps.LatLng(lat, lng);
          map.setLevel(4);
          map.setCenter(latlng);
        }
      } catch (e: any) {
        console.warn("[handleCartItemSelectByRowKey] RPC from rowKey error:", e?.message || e);
      }
    },
    [fetchDetailCached, patchFromDetail],
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
        // 🚫 프로그램틱 클릭에서는 퀵담기 토글을 한 번 억제
        suppressQuickToggleOnceRef.current = true;
        maps.event.trigger(mk, "click");
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
        // 🚫 프로그램틱 클릭에서는 퀵담기 토글을 한 번 억제
        suppressQuickToggleOnceRef.current = true;
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

    console.log("[map] RPC NOW:", (data ?? []).length, error?.message);

    if (reqId !== lastReqIdRef.current) return;
    if (error) {
      console.error("Supabase rpc(get_public_map_places) error:", error.message);
      return;
    }

    const rows = (data ?? []) as PlaceRow[];
    const imgs = markerImages(maps);

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
        const isSelected = selectedRowKeySetRef.current.has(rowKey);
        mk = new maps.Marker({ position: pos, title: nameText, image: isSelected ? imgs.yellow : imgs.purple });
        mk.__key = key;
        mk.__basePos = pos;
        mk.__row = row;

        maps.event.addListener(mk, "click", () => {
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
            getField(row, [
              "월송출횟수",
              "월 송출횟수",
              "월 송출 횟수",
              "월송출",
              "노출수(월)",
              "monthly_impressions",
              "monthlyImpressions",
            ]),
          );
          const monthlyFee = monthlyFeeOf(row);
          const monthlyFeeY1 = toNumLoose(
            getField(row, [
              "1년 계약 시 월 광고료",
              "1년계약시월광고료",
              "연간월광고료",
              "할인 월 광고료",
              "연간_월광고료",
              "monthly_fee_y1",
              "monthlyFeeY1",
            ]),
          );
          const costPerPlay = toNumLoose(
            getField(row, ["1회당 송출비용", "송출 1회당 비용", "cost_per_play", "costPerPlay"]),
          );
          const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
          const imageUrl = getField(row, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) || undefined;

          const city = (row as any).city ?? getField(row, ["city"]);
          const district = (row as any).district ?? getField(row, ["district"]);

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
            city,
            district,
            selectedInCart: selectedRowKeySetRef.current.has(rowKey),
          };
          setSelected(sel);

          // 🚫 카트/프로그램틱 클릭 시에는 퀵담기 자동 토글 1회 억제
          const suppress = suppressQuickToggleOnceRef.current;
          suppressQuickToggleOnceRef.current = false;

          // React 커밋 이후 한 틱 지연
          setTimeout(() => {
            if (quickModeRef.current && !suppress) {
              toggleCartByRowKey(rowKey);
              lastClickedRef.current = null;
              applyStaticSeparationAll();
            }
          }, 0);

          // ✅ 상세 보강 RPC (캐시 사용: 공백/깜빡임 제거)
          (async () => {
            const pid = rowIdOf(row);
            if (!pid) return;
            try {
              const d = await fetchDetailCached(pid, rowKey);
              if (!d) return;
              setSelected((prev) => (prev && prev.rowKey === rowKey ? { ...prev, ...patchFromDetail(d, prev) } : prev));
            } catch (e: any) {
              console.warn("[RPC] get_public_place_detail error:", e?.message || e);
            }
          })();

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

    // 확장 조회
    if (!newMarkers.length) {
      const pad = expandBounds(bounds, 0.12);
      const { data: data2, error: err2 } = await (supabase as any).rpc("get_public_map_places", {
        min_lat: pad.minLat,
        max_lat: pad.maxLat,
        min_lng: pad.minLng,
        max_lng: pad.maxLng,
        limit_n: 5000,
      });
      console.log("[map] RPC EXPANDED:", (data2 ?? []).length, err2?.message);

      if (err2) {
        console.warn("[MapPage] expanded select error:", err2.message);
        return;
      }
      if (reqId !== lastReqIdRef.current) return;

      const rows2 = (data2 ?? []) as PlaceRow[];
      rows2.forEach((row) => {
        if (row.lat == null || row.lng == null) return;
        const key = `${Number(row.lat).toFixed(7)},${Number(row.lng).toFixed(7)}|${
          rowIdOf(row) != null ? String(rowIdOf(row)) : ""
        }|${String(
          getField(row, ["상품명", "상품 명", "제품명", "광고상품명", "productName", "product_name"]) || "",
        )}|${String(getField(row, ["설치위치", "설치 위치", "installLocation", "install_location"]) || "")}`;
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
            getField(row, [
              "월송출횟수",
              "월 송출횟수",
              "월 송출 횟수",
              "월송출",
              "노출수(월)",
              "monthly_impressions",
              "monthlyImpressions",
            ]),
          );
          const monthlyFee = monthlyFeeOf(row);
          const monthlyFeeY1 = toNumLoose(
            getField(row, [
              "1년 계약 시 월 광고료",
              "1년계약시월광고료",
              "연간월광고료",
              "할인 월 광고료",
              "연간_월광고료",
              "monthly_fee_y1",
              "monthlyFeeY1",
            ]),
          );
          const costPerPlay = toNumLoose(
            getField(row, ["1회당 송출비용", "송출 1회당 비용", "cost_per_play", "costPerPlay"]),
          );
          const hours = getField(row, ["운영시간", "운영 시간", "hours"]) || "";
          const imageUrl = getField(row, ["imageUrl", "image_url", "이미지", "썸네일", "thumbnail"]) || undefined;

          const city = (row as any).city ?? getField(row, ["city"]);
          const district = (row as any).district ?? getField(row, ["district"]);

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
            city,
            district,
            selectedInCart: selectedRowKeySetRef.current.has(rowKey),
          };
          setSelected(sel);

          // 🚫 카트/프로그램틱 클릭 시에는 퀵담기 자동 토글 1회 억제
          const suppress = suppressQuickToggleOnceRef.current;
          suppressQuickToggleOnceRef.current = false;

          setTimeout(() => {
            if (quickModeRef.current && !suppress) {
              toggleCartByRowKey(rowKey);
              lastClickedRef.current = null;
              applyStaticSeparationAll();
            }
          }, 0);

          // ✅ 상세 보강 RPC (캐시 사용: 공백/깜빡임 제거)
          (async () => {
            const pid = rowIdOf(row);
            if (!pid) return;
            try {
              const d = await fetchDetailCached(pid, rowKey);
              if (!d) return;
              setSelected((prev) => (prev && prev.rowKey === rowKey ? { ...prev, ...patchFromDetail(d, prev) } : prev));
            } catch (e: any) {
              console.warn("[RPC] get_public_place_detail error:", e?.message || e);
            }
          })();

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

    // ▼ 검색 좌표가 기존 단지 마커와 "시각적으로 겹치는지" 픽셀 기준으로 판단(18px 이내면 겹침)
    const proj = map.getProjection();
    const centerPt = proj.containerPointFromCoords(latlng);
    let hasAptHere = false;
    markerCacheRef.current.forEach((mk) => {
      const p = mk.getPosition?.() || mk.__basePos;
      if (!p) return;
      const pt = proj.containerPointFromCoords(p);
      const dx = pt.x - centerPt.x;
      const dy = pt.y - centerPt.y;
      if (dx * dx + dy * dy <= 18 * 18) {
        // ← 임계값 18px
        hasAptHere = true;
      }
    });

    // 원(반경)은 지도 아래 레이어로 유지
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

    if (hasAptHere) {
      // ▼ 겹치면 라벨/검색핀 숨김 → 단지 마커가 우선 노출
      radiusLabelRef.current?.setMap(null);
      searchPinRef.current?.setMap?.(null);
    } else {
      // ▼ 겹치지 않으면 라벨/검색핀 표시(낮은 zIndex 유지)
      const labelContent = ensureRadiusLabelContent(clearRadiusUI);
      if (!radiusLabelRef.current) {
        radiusLabelRef.current = new kakao.maps.CustomOverlay({
          map,
          position: latlng,
          content: labelContent,
          yAnchor: 1.6,
          zIndex: 50,
        });
      } else {
        radiusLabelRef.current.setContent(labelContent);
        radiusLabelRef.current.setPosition(latlng);
        radiusLabelRef.current.setZIndex?.(50);
        radiusLabelRef.current.setMap(map);
      }
      const searchImg = buildSearchMarkerImage(kakao.maps);
      if (!searchPinRef.current) {
        searchPinRef.current = new kakao.maps.Marker({
          map,
          position: latlng,
          image: searchImg,
          zIndex: 40,
          clickable: false,
        });
      } else {
        searchPinRef.current.setPosition(latlng);
        searchPinRef.current.setImage(searchImg);
        searchPinRef.current.setZIndex?.(40);
        searchPinRef.current.setMap(map);
      }
    }
  }

  /* ---------- 검색 ---------- */
  function runPlaceSearch(query: string) {
    const kakaoNS = (window as KakaoNS).kakao;
    const places = placesRef.current;

    // ✅ SDK가 아직 준비 안 된 경우 방어
    if (!places || !kakaoNS?.maps?.services) return;

    places.keywordSearch(query, (results: any[], status: string) => {
      // 혹시 모를 상황에 대비해 한 번 더 방어
      if (!kakaoNS?.maps?.services) return;
      if (status !== kakaoNS.maps.services.Status.OK || !results?.length) return;

      const first = results[0];
      const lat = Number(first.y),
        lng = Number(first.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const latlng = new kakaoNS.maps.LatLng(lat, lng);
      mapObjRef.current.setLevel(4);
      mapObjRef.current.setCenter(latlng);

      drawSearchOverlays(latlng);

      loadMarkersInBounds().then(() => {
        applyStaticSeparationAll();
        drawSearchOverlays(latlng);
      });
    });
  }

  function handleSearch(q: string) {
    writeQuery(q);
    runPlaceSearch(q);
  }
  function closeSelected() {
    setSelected(null);
  }

  /* ---------- ✅ PC: 내 위치 버튼 구현 ---------- */
  const ensureUserOverlay = useCallback((lat: number, lng: number) => {
    const kakao = (window as KakaoNS).kakao;
    if (!kakao?.maps || !mapObjRef.current) return;
    const map = mapObjRef.current;

    // 오버레이용 엘리먼트(작은 보라 점)
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

  /* ---------- ✅ 확대/축소 버튼 행동 ---------- */
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 14;
  const changeZoom = useCallback((delta: number) => {
    const kakao = (window as KakaoNS).kakao;
    const map = mapObjRef.current;
    if (!kakao?.maps || !map) return;
    const cur = typeof map.getLevel === "function" ? map.getLevel() : 6;
    const next = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, cur + delta)); // -1: zoom in, +1: zoom out
    if (next !== cur) map.setLevel(next);
  }, []);
  const zoomIn = useCallback(() => changeZoom(-1), [changeZoom]);
  const zoomOut = useCallback(() => changeZoom(1), [changeZoom]);

  /* ---------- ✅ 태블릿/터치 기기용 핀치 줌 + 드래그 이동 ---------- */
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    // 터치 기반 디바이스인지 판별
    const mm = window.matchMedia?.("(pointer: coarse)");
    const hasCoarsePointer = !!mm && mm.matches;
    const hasTouchEvent = "ontouchstart" in window || (navigator as any).maxTouchPoints > 0;
    const isTouchLike = hasCoarsePointer || hasTouchEvent;

    if (!isTouchLike) return;

    let pinchActive = false;
    let panActive = false;
    let startDist = 0;
    let lastX = 0;
    let lastY = 0;

    const getDistance = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: any) => {
      const touches: TouchList = e.touches;

      if (touches.length === 2) {
        // ✌️ 핀치 시작
        pinchActive = true;
        panActive = false;
        startDist = getDistance(touches[0], touches[1]);
      } else if (touches.length === 1) {
        // 👆 한 손가락 드래그 시작
        panActive = true;
        pinchActive = false;
        startDist = 0;
        lastX = touches[0].clientX;
        lastY = touches[0].clientY;
      } else {
        pinchActive = false;
        panActive = false;
        startDist = 0;
      }
    };

    const onTouchMove = (e: any) => {
      const touches: TouchList = e.touches;
      const map = mapObjRef.current;
      if (!map) return;

      // ✌️ 핀치 줌 처리
      if (touches.length === 2 && pinchActive) {
        const newDist = getDistance(touches[0], touches[1]);
        if (!startDist) {
          startDist = newDist;
          return;
        }
        const scale = newDist / startDist;
        const THRESHOLD = 0.12; // 12% 이상 변화했을 때만 한 단계 줌

        if (scale > 1 + THRESHOLD) {
          // 확대
          e.preventDefault();
          changeZoom(-1); // 버튼과 동일: -1 → zoom in
          startDist = newDist;
        } else if (scale < 1 - THRESHOLD) {
          // 축소
          e.preventDefault();
          changeZoom(1); // +1 → zoom out
          startDist = newDist;
        }
        return;
      }

      // 👆 한 손가락 드래그로 지도 이동
      if (touches.length === 1 && panActive) {
        const t = touches[0];

        // 이전 좌표 기준으로 이번 이벤트에서의 실제 이동량
        const dxRaw = t.clientX - lastX;
        const dyRaw = t.clientY - lastY;

        // ===== 튜닝용 상수 =====
        const PAN_SCALE = 2.5; // 손가락 이동 대비 지도 이동 배율 (2.0~3.0 사이에서 취향껏 미세조정)
        const DEAD_ZONE = 1.5; // 이 이하의 미세 움직임은 무시 (손가락 떠는 정도)
        const MAX_STEP = 30; // 한 번의 이벤트에서 허용할 최대 이동량(px)

        // 1) 데드존: 너무 미세한 움직임은 무시
        if (Math.abs(dxRaw) < DEAD_ZONE && Math.abs(dyRaw) < DEAD_ZONE) {
          lastX = t.clientX;
          lastY = t.clientY;
          return;
        }

        // 2) 상한선(clamp) 함수: 한 번에 너무 많이 튀지 않게 제한
        const clamp = (v: number, max: number) => (v > max ? max : v < -max ? -max : v);

        const dx = clamp(dxRaw, MAX_STEP);
        const dy = clamp(dyRaw, MAX_STEP);

        // 기본 스크롤/줌 방지
        e.preventDefault();

        try {
          // 손가락 이동 방향의 반대로 지도를 이동 (좌우/상하 반전 + 배율 적용)
          map.panBy(-dx * PAN_SCALE, -dy * PAN_SCALE);
        } catch {
          // map이 아직 준비 안 되었을 때 등 안전장치
        }

        // 마지막 좌표 갱신
        lastX = t.clientX;
        lastY = t.clientY;
      }
    };

    const onTouchEnd = (e: any) => {
      const touches: TouchList = e.touches;

      if (touches.length === 1) {
        // 핀치 끝나고 손가락 하나만 남은 경우 → 다시 드래그 모드
        panActive = true;
        pinchActive = false;
        startDist = 0;
        lastX = touches[0].clientX;
        lastY = touches[0].clientY;
      } else if (touches.length === 0) {
        // 모든 손가락이 떨어짐 → 초기화
        pinchActive = false;
        panActive = false;
        startDist = 0;
      }
    };

    // move에서 preventDefault를 쓰기 때문에 passive: false
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [changeZoom]);

  const MapChromeAny = MapChrome as any;

  const leftPx = selected ? cartW + detailW : cartW;

  return (
    <div className="w-screen h-[100dvh] bg-white">
      {/* 지도 컨테이너: left를 동적으로 적용 */}
      <div ref={mapRef} className="fixed top-16 right-0 bottom-0 z-[10]" style={{ left: leftPx }} aria-label="map" />

      {/* ▼ 지도 우상단 고정 오버레이 */}
      <div className="fixed top-[84px] right-4 z-[70] pointer-events-none">
        <div className="flex flex-col items-end gap-2">
          {/* 퀵담기 버튼 + 툴팁 */}
          <div className="relative group pointer-events-auto">
            <button
              type="button"
              onClick={() => setQuickMode((v) => !v)}
              aria-label="빠른담기"
              aria-pressed={quickMode}
              className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition
          ${quickMode ? "bg-[#FFD400] text-[#6F4BF2]" : "bg-[#6F4BF2] text-white"}
          hover:brightness-110 active:scale-95`}
            >
              <Zap className="w-6 h-6" />
            </button>
            {/* 툴팁: 빠른담기 */}
            <div
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                   rounded-md bg-[#111827] text-white text-xs px-2 py-1 shadow-md
                   opacity-0 scale-95 transition
                   group-hover:opacity-100 group-focus-within:opacity-100"
            >
              빠른담기
            </div>
          </div>

          {/* 내 위치 버튼 */}
          <button
            type="button"
            onClick={goMyLocation}
            aria-label="내 위치로 이동"
            title="내 위치로 이동"
            className="w-12 h-12 rounded-full shadow-lg bg-[#6F4BF2] text-white
                 flex items-center justify-center hover:brightness-110 active:scale-95 transition pointer-events-auto"
          >
            <LocateFixed className="w-6 h-6" />
          </button>

          {/* ✅ 확대/축소 버튼 */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={zoomIn}
              aria-label="확대"
              title="확대"
              className="w-12 h-12 rounded-full shadow-lg bg-[#6F4BF2] text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition"
            >
              <Plus className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              aria-label="축소"
              title="축소"
              className="w-12 h-12 rounded-full shadow-lg bg-[#6F4BF2] text-white flex items-center justify-center hover:brightness-110 active:scale-95 transition"
            >
              <Minus className="w-6 h-6" />
            </button>
          </div>
        </div>
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
        /* 🔎 카트에서 단지 클릭 → 지도 이동 + 2탭 오픈 */
        onCartItemSelectByRowKey={handleCartItemSelectByRowKey}
        focusByRowKey={focusByRowKey}
        focusByLatLng={focusByLatLng}
        cartStickyTopPx={64}
        cartStickyUntil="bulkMonthsApply"
        /* ▼ 패널 폭 전달(연결 완료) */
        cartWidthPx={cartW}
        detailWidthPx={detailW}
        /* ▼ 퀵담기 상태 */
        quickMode={quickMode}
        onToggleQuick={() => setQuickMode((v) => !v)}
      />

      {/* 에러 토스트들 */}
      {kakaoError && (
        <div className="fixed bottom-4 right-4 z-[100] rounded-lg bg-red-600 text-white px-3 py-2 text-sm shadow">
          Kakao SDK 로드 오류: {kakaoError}
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
