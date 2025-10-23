import { useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRowKeyFromRow, groupKeyFromRow } from "@/core/map/rowKey";
import type { SelectedApt } from "@/core/types";

/* =========================================================================
 * 로컬 유틸
 * ========================================================================= */
type PlaceRow = {
  id?: number | string;
  lat?: number | null;
  lng?: number | null;
  [k: string]: any;
};

function getField(obj: any, keys: string[]) {
  for (const k of keys) {
    if (k in obj && obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

const toNum = (v: any) => {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
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

type MarkerState = "purple" | "yellow" | "clicked";

/** 오버스캔 비율(조회 영역 확대) */
const OVERSCAN_RATIO = 0.25;

/** 바운드 유틸 */
type Rect = { minLat: number; maxLat: number; minLng: number; maxLng: number };

function rectFromKakaoBounds(bounds: any): Rect {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const minLat = Math.min(sw.getLat(), ne.getLat());
  const maxLat = Math.max(sw.getLat(), ne.getLat());
  const minLng = Math.min(sw.getLng(), ne.getLng());
  const maxLng = Math.max(sw.getLng(), ne.getLng());
  return { minLat, maxLat, minLng, maxLng };
}

function expandRect(r: Rect, ratio: number): Rect {
  const latPad = (r.maxLat - r.minLat) * ratio;
  const lngPad = (r.maxLng - r.minLng) * ratio;
  return {
    minLat: r.minLat - latPad,
    maxLat: r.maxLat + latPad,
    minLng: r.minLng - lngPad,
    maxLng: r.maxLng + lngPad,
  };
}

function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat &&
    inner.minLng >= outer.minLng &&
    inner.maxLng <= outer.maxLng
  );
}

/** 안정키: row.id 우선, 없으면 좌표 5자리 + 그룹/상품/설치로 고정 */
function stableIdKeyFromRow(row: PlaceRow): string {
  if (row.id != null) return `id:${String(row.id)}`;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  const lat5 = Number.isFinite(lat) ? lat.toFixed(5) : "x";
  const lng5 = Number.isFinite(lng) ? lng.toFixed(5) : "x";
  const prod = String(getField(row, ["상품명", "productName"]) || "");
  const loc = String(getField(row, ["설치위치", "installLocation"]) || "");
  const gk = groupKeyFromRow(row);
  return `geo:${lat5},${lng5}|${gk}|${prod}|${loc}`;
}

/* =========================================================================
 * 훅 본체
 * ========================================================================= */
export default function useMarkers({
  kakao,
  map,
  clusterer,
  onSelect,
  externalSelectedRowKeys = [],
}: {
  kakao: any;
  map: any;
  clusterer?: any | null;
  onSelect: (apt: SelectedApt) => void;
  externalSelectedRowKeys?: string[];
}) {
  /** 풀/인덱스/상태 */
  const poolRef = useRef<Map<string, any>>(new Map()); // idKey -> Marker
  const rowKeyIndexRef = useRef<Map<string, any>>(new Map()); // rowKey -> Marker
  const groupsRef = useRef<Map<string, any[]>>(new Map());
  const lastClickedRef = useRef<any | null>(null);

  /** 선택(장바구니) 집합을 ref로 보관 → 렌더 없이 참조 */
  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedSetRef.current = new Set(externalSelectedRowKeys);
    // 선택 변경 시 색상 규칙만 재적용(이미지 변경은 상태 변화시에만 이루어짐)
    poolRef.current.forEach((mk) => applyColorRule(mk));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedRowKeys.join("|")]); // 내용 기준 변경 감지

  /** 오버스캔 로드 영역/요청 버전 관리 */
  const loadedRectRef = useRef<Rect | null>(null);
  const fetchInFlightRef = useRef(false);
  const requestVersionRef = useRef(0);

  /** 마커 이미지 캐시 */
  const imgs = useMemo(() => {
    if (!kakao?.maps) return null;
    const { maps } = kakao;
    const mk = (url: string, size: number) =>
      new maps.MarkerImage(url, new maps.Size(size, size), {
        offset: new maps.Point(size / 2, size),
      });
    try {
      return {
        purple: mk("/makers/pin-purple@2x.png", 51),
        yellow: mk("/makers/pin-yellow@2x.png", 51),
        clicked: mk("/makers/pin-purple@3x.png", 51),
      };
    } catch {
      return null;
    }
  }, [kakao]);

  /** 상태 변화시에만 이미지 교체 */
  const setMarkerState = useCallback(
    (mk: any, next: MarkerState) => {
      if (!imgs || !mk) return;
      if (mk.__imgState === next) return;
      try {
        mk.setImage(imgs[next]);
        mk.__imgState = next;
      } catch {}
    },
    [imgs],
  );

  /** 공통 컬러링 규칙 (선택 > 클릭 > 기본) */
  const applyColorRule = useCallback(
    (mk: any) => {
      if (!mk) return;
      const rowKey = mk.__rowKey as string | undefined;
      const isSelected = rowKey ? selectedSetRef.current.has(rowKey) : false;
      if (isSelected) {
        setMarkerState(mk, "yellow"); // 담긴 건 항상 노랑
        return;
      }
      if (lastClickedRef.current === mk) {
        setMarkerState(mk, "clicked");
        return;
      }
      setMarkerState(mk, "purple");
    },
    [setMarkerState],
  );

  /** 행 -> 선택객체 */
  const toSelected = useCallback((rowKey: string, row: PlaceRow, lat: number, lng: number): SelectedApt => {
    const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
    const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
    const productName = getField(row, ["상품명", "productName"]) || "";
    const installLocation = getField(row, ["설치위치", "installLocation"]) || "";
    const households = toNum(getField(row, ["세대수", "households"]));
    const residents = toNum(getField(row, ["거주인원", "residents"]));
    const monitors = toNum(getField(row, ["모니터수량", "monitors"]));
    const monthlyImpressions = toNum(getField(row, ["월송출횟수", "monthlyImpressions"]));
    const monthlyFee = toNum(getField(row, ["월광고료", "month_fee", "monthlyFee"]));
    const monthlyFeeY1 = toNum(getField(row, ["1년 계약 시 월 광고료", "연간월광고료", "monthlyFeeY1"]));
    const costPerPlay = toNum(getField(row, ["1회당 송출비용", "costPerPlay"]));
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
  }, []);

  /** DIFF 반영 (추가/제거만, 재생성 금지) */
  const addOrUpdateFromRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      const nextIdKeys = new Set<string>();
      const toAdd: any[] = [];
      const toRemove: any[] = [];

      // 새 인덱스(전체 교체용)
      const nextRowKeyIndex = new Map<string, any>();
      const nextGroups = new Map<string, any[]>();

      for (const row of rows) {
        if (row.lat == null || row.lng == null) continue;
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const idKey = stableIdKeyFromRow(row); // 풀 키(안정)
        const rowKey = buildRowKeyFromRow(row); // 선택/표시 키
        nextIdKeys.add(idKey);

        const pos = new maps.LatLng(lat, lng);
        const title = String(getField(row, ["단지명", "name", "아파트명"]) || "");

        let mk = poolRef.current.get(idKey);
        if (!mk) {
          // 최초 생성(한 번만)
          try {
            mk = new maps.Marker({
              position: pos,
              title,
              image: imgs.purple, // 기본 보라
              clickable: true,
            });
            mk.__imgState = "purple";
          } catch {
            continue;
          }
          mk.__idKey = idKey;
          mk.__rowKey = rowKey;
          mk.__row = row;

          maps.event.addListener(mk, "click", () => {
            const sel = toSelected(mk.__rowKey, mk.__row, lat, lng);
            onSelect(sel);

            // 이전 클릭 복원(선택이면 노랑 유지)
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              applyColorRule(lastClickedRef.current);
            }
            lastClickedRef.current = mk;

            // 현재 클릭 반영(선택이면 노랑, 아니면 클릭색)
            applyColorRule(mk);
          });

          poolRef.current.set(idKey, mk);
          toAdd.push(mk);
        } else {
          // 재사용: 위치/타이틀 변동시에만 업데이트
          try {
            const oldPos = mk.getPosition?.();
            if (!oldPos || oldPos.getLat() !== lat || oldPos.getLng() !== lng) {
              mk.setPosition(pos);
            }
            if (mk.getTitle?.() !== title) mk.setTitle?.(title);
          } catch {}
          mk.__rowKey = rowKey;
          mk.__row = row;

          // 색 상태는 규칙으로만(변화시에만 이미지 교체)
          applyColorRule(mk);
        }

        // 인덱스/그룹 집계
        nextRowKeyIndex.set(rowKey, mk);
        const gk = groupKeyFromRow(row);
        if (!nextGroups.has(gk)) nextGroups.set(gk, []);
        nextGroups.get(gk)!.push(mk);
      }

      // 제거 대상 계산(이번 결과에 없는 idKey는 제거)
      poolRef.current.forEach((mk, idKey) => {
        if (!nextIdKeys.has(idKey)) {
          toRemove.push(mk);
          poolRef.current.delete(idKey);
        }
      });

      // 클러스터 업데이트(추가/제거만) — 전체 clear 금지!
      if (toRemove.length) {
        try {
          if (clusterer?.removeMarkers) clusterer.removeMarkers(toRemove);
          else toRemove.forEach((m) => m.setMap(null));
        } catch {}
      }
      if (toAdd.length) {
        try {
          if (clusterer?.addMarkers) clusterer.addMarkers(toAdd);
          else toAdd.forEach((m) => m.setMap(map));
        } catch {}
      }

      // 참조 교체
      rowKeyIndexRef.current = nextRowKeyIndex;
      groupsRef.current = nextGroups;

      // 방금 추가된 마커에도 컬러 규칙 한 번 더 적용
      toAdd.forEach((mk) => applyColorRule(mk));
    },
    [applyColorRule, clusterer, imgs, kakao, map, onSelect, toSelected],
  );

  /** 바운드 내 데이터 요청 + DIFF 반영 (오버스캔 & 버전관리) */
  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    const kbounds = map.getBounds?.();
    if (!kbounds) return;

    const viewRect = rectFromKakaoBounds(kbounds);

    // 이미 더 넓은 영역을 로드했다면 스킵(깜빡임 방지)
    if (loadedRectRef.current && rectContains(loadedRectRef.current, viewRect)) return;

    // 새로 로드할 오버스캔 영역
    const queryRect = expandRect(viewRect, OVERSCAN_RATIO);

    // 요청 버전 증가
    const myVersion = ++requestVersionRef.current;

    // 중복 요청 방지
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const { minLat, maxLat, minLng, maxLng } = queryRect;
      const { data, error } = await supabase
        .from("raw_places")
        .select("*")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", minLat)
        .lte("lat", maxLat)
        .gte("lng", minLng)
        .lte("lng", maxLng)
        .limit(8000);

      // 낡은 응답은 버림
      if (myVersion !== requestVersionRef.current) return;

      if (error) {
        console.error("Supabase(raw_places) error:", error.message);
        return;
      }

      addOrUpdateFromRows((data ?? []) as PlaceRow[]);
      loadedRectRef.current = queryRect;
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [addOrUpdateFromRows, kakao, map]);

  /** idle에서만 갱신 (버튼 클릭 등 UI 렌더링이 마커에 영향 없게) */
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const h = maps.event.addListener(map, "idle", () => {
      // idle 때에만 데이터 갱신 → 버튼 클릭/패널 열기 등에서 깜빡임 차단
      refreshInBounds();
    });

    // 초기 1회
    refreshInBounds();

    return () => {
      try {
        maps.event.removeListener(h);
      } catch {}
      // 정리
      const all: any[] = [];
      poolRef.current.forEach((mk) => all.push(mk));
      try {
        if (clusterer?.removeMarkers) clusterer.removeMarkers(all);
        else all.forEach((m) => m.setMap(null));
      } catch {}
      poolRef.current.clear();
      rowKeyIndexRef.current.clear();
      groupsRef.current.clear();
      lastClickedRef.current = null;
      loadedRectRef.current = null;
    };
  }, [kakao, map, refreshInBounds, clusterer]);

  /** 외부 포커스: rowKey로 선택/이동 */
  const selectByRowKey = useCallback(
    (rowKey: string) => {
      const mk = rowKeyIndexRef.current.get(rowKey);
      if (!mk || !kakao?.maps || !map) return;

      const row = mk.__row as PlaceRow;
      const lat = Number(row.lat);
      const lng = Number(row.lng);

      try {
        const pos = new kakao.maps.LatLng(lat, lng);
        map.setLevel?.(4);
        map.panTo?.(pos);
      } catch {}

      const sel = toSelected(rowKey, row, lat, lng);
      onSelect(sel);

      // 클릭 규칙 갱신(선택이면 노랑 유지)
      if (lastClickedRef.current && lastClickedRef.current !== mk) {
        applyColorRule(lastClickedRef.current);
      }
      lastClickedRef.current = mk;
      applyColorRule(mk);
    },
    [applyColorRule, kakao, map, onSelect, toSelected],
  );

  return { refreshInBounds, selectByRowKey };
}
