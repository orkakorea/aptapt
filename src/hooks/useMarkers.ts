import { useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRowKeyFromRow, groupKeyFromRow } from "@/core/map/rowKey";
import type { SelectedApt } from "@/core/types";

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

/** 오버스캔 비율(현재 지도 바운드보다 넓게 로드해서 잦은 재요청/깜빡임 방지) */
const OVERSCAN_RATIO = 0.25; // 25%

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

/** 안정키: row.id 우선, 없으면 좌표5자리+그룹/상품/설치키 */
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
  /** ----------------------------------------------------------------
   * 풀/인덱스 및 상태
   *  - pool: 안정키(idKey) -> Marker (재사용)
   *  - rowKeyIndex: rowKey -> Marker (선택/포커스용)
   * ---------------------------------------------------------------- */
  const poolRef = useRef<Map<string, any>>(new Map()); // idKey -> Marker
  const rowKeyIndexRef = useRef<Map<string, any>>(new Map()); // rowKey -> Marker
  const groupsRef = useRef<Map<string, any[]>>(new Map()); // groupKey -> Markers
  const lastClickedRef = useRef<any | null>(null);

  /** 현재 로드된(오버스캔) 영역 */
  const loadedRectRef = useRef<Rect | null>(null);
  const fetchInFlightRef = useRef(false);

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

  /** 상태 비교 후 다를 때만 이미지 교체 */
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

  /** 공통 컬러링 규칙: 선택 > 클릭 > 기본 */
  const applyColorRule = useCallback(
    (mk: any) => {
      const rowKey = mk.__rowKey as string | undefined;
      const isSelected = !!rowKey && externalSelectedRowKeys.includes(rowKey);
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
    [externalSelectedRowKeys, setMarkerState],
  );

  /** 외부 선택(장바구니) 변화 시 전체 마커에 재적용 */
  useEffect(() => {
    poolRef.current.forEach((mk) => applyColorRule(mk));
  }, [externalSelectedRowKeys, applyColorRule]);

  /** 행 -> 선택 객체 */
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

  /** DIFF 반영 */
  const addOrUpdateFromRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      const nextIdKeys = new Set<string>();
      const toAdd: any[] = [];
      const toRemove: any[] = [];

      const nextRowKeyIndex = new Map<string, any>();
      const nextGroups = new Map<string, any[]>();

      for (const row of rows) {
        if (row.lat == null || row.lng == null) continue;
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const idKey = stableIdKeyFromRow(row); // 풀 키 (안정)
        const rowKey = buildRowKeyFromRow(row); // 선택/표시 키
        nextIdKeys.add(idKey);

        const pos = new maps.LatLng(lat, lng);
        const title = String(getField(row, ["단지명", "name", "아파트명"]) || "");

        let mk = poolRef.current.get(idKey);
        if (!mk) {
          // 새 마커 생성 (최초 1회)
          try {
            mk = new maps.Marker({
              position: pos,
              title,
              image: imgs.purple, // 기본은 보라, 컬러링 룰로 즉시 조정됨
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
            // 클릭 → 선택 객체 전달
            const sel = toSelected(mk.__rowKey, mk.__row, lat, lng);
            onSelect(sel);

            // 이전 클릭 복원(선택이면 노랑 유지)
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              applyColorRule(lastClickedRef.current);
            }
            lastClickedRef.current = mk;

            // 현재 클릭 상태 반영(선택이면 노랑, 아니면 클릭색)
            applyColorRule(mk);
          });

          poolRef.current.set(idKey, mk);
          toAdd.push(mk);
        } else {
          // 기존 마커 재사용
          try {
            const oldPos = mk.getPosition?.();
            if (!oldPos || oldPos.getLat() !== lat || oldPos.getLng() !== lng) {
              mk.setPosition(pos);
            }
            if (mk.getTitle?.() !== title) mk.setTitle?.(title);
          } catch {}

          // 최신 데이터/키 보관
          mk.__row = row;
          mk.__rowKey = rowKey;

          // 이동 중에도 컬러 규칙은 "변화시에만" 적용
          applyColorRule(mk);
        }

        // 인덱스/그룹
        nextRowKeyIndex.set(rowKey, mk);
        const gk = groupKeyFromRow(row);
        if (!nextGroups.has(gk)) nextGroups.set(gk, []);
        nextGroups.get(gk)!.push(mk);
      }

      // 제거 대상: 현재 풀에 있는데 이번 결과에 없는 idKey
      poolRef.current.forEach((mk, idKey) => {
        if (!nextIdKeys.has(idKey)) {
          toRemove.push(mk);
          poolRef.current.delete(idKey);
          // rowKeyIndexRef는 새로 교체되므로 별도 삭제 불필요
        }
      });

      // Clusterer 업데이트 (추가/제거만, 전체 클리어 금지)
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

      // 마지막으로 전체 컬러 규칙 한번 더(추가분 포함)
      toAdd.forEach((mk) => applyColorRule(mk));
    },
    [applyColorRule, clusterer, imgs, kakao, map, onSelect, toSelected],
  );

  /** 바운드 내 데이터 요청 + DIFF 반영 (오버스캔) */
  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    if (fetchInFlightRef.current) return;

    const kbounds = map.getBounds?.();
    if (!kbounds) return;

    const viewRect = rectFromKakaoBounds(kbounds);

    // 이미 넓게 로드된 영역 안이면 스킵
    if (loadedRectRef.current && rectContains(loadedRectRef.current, viewRect)) {
      return;
    }

    // 새로 로드할 오버스캔 영역 계산
    const queryRect = expandRect(viewRect, OVERSCAN_RATIO);
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

      if (error) {
        console.error("Supabase(raw_places) error:", error.message);
        return;
      }

      addOrUpdateFromRows((data ?? []) as PlaceRow[]);
      loadedRectRef.current = queryRect; // 로드된 영역 갱신
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [addOrUpdateFromRows, kakao, map]);

  /** idle에서 갱신 (초기 1회 포함) */
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const h = maps.event.addListener(map, "idle", () => {
      refreshInBounds();
    });

    // 초기 호출
    refreshInBounds();

    return () => {
      try {
        maps.event.removeListener(h);
      } catch {}
      // 언마운트 정리
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

      // 클릭/색상 규칙 갱신
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
