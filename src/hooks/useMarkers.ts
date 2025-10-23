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
   * 풀/인덱스 (rowKey 단일 마커 보장) + 상태 참조
   * ---------------------------------------------------------------- */
  const poolRef = useRef<Map<string, any>>(new Map()); // rowKey -> Marker
  const keyIndexRef = useRef<Record<string, any[]>>({}); // rowKey -> [Marker] (호환성 유지)
  const groupsRef = useRef<Map<string, any[]>>(new Map()); // groupKey -> Markers
  const lastClickedRef = useRef<any | null>(null);
  const fetchInFlightRef = useRef<boolean>(false); // 중복 fetch 가드

  /** ----------------------------------------------------------------
   * 마커 이미지 캐시
   * ---------------------------------------------------------------- */
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

  /** 상태 비교 후 다를 때만 이미지 교체 → 깜빡임 제거 */
  const setMarkerState = useCallback(
    (mk: any, state: MarkerState) => {
      if (!imgs || !mk) return;
      if (mk.__imgState === state) return; // 같은 상태면 건드리지 않음
      try {
        mk.setImage(imgs[state]);
        mk.__imgState = state;
      } catch {}
    },
    [imgs],
  );

  /** 외부 선택(장바구니) 변화 → 색상 반영 (clicked 유지) */
  useEffect(() => {
    if (!imgs) return;
    poolRef.current.forEach((mk, rowKey) => {
      const isSelected = externalSelectedRowKeys.includes(rowKey);
      if (lastClickedRef.current === mk && !isSelected) {
        setMarkerState(mk, "clicked");
      } else {
        setMarkerState(mk, isSelected ? "yellow" : "purple");
      }
    });
  }, [externalSelectedRowKeys, imgs, setMarkerState]);

  /** 행 → SelectedApt 변환 */
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

    const out: SelectedApt = {
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
    return out;
  }, []);

  /** ----------------------------------------------------------------
   * REFRESH: DIFF 업데이트 (추가/제거만, 재생성 금지)
   * ---------------------------------------------------------------- */
  const addOrUpdateFromRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      const nextKeys = new Set<string>();
      const toAdd: any[] = [];
      const toRemove: any[] = [];

      // 인덱스/그룹 임시 집계
      const nextKeyIndex: Record<string, any[]> = {};
      const nextGroups = new Map<string, any[]>();

      rows.forEach((row) => {
        if (row.lat == null || row.lng == null) return;
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        // rowKey 기준으로 유일 마커 보장
        const rowKey = buildRowKeyFromRow(row);
        if (!rowKey) return;
        nextKeys.add(rowKey);

        const pos = new maps.LatLng(lat, lng);
        const title = String(getField(row, ["단지명", "name", "아파트명"]) || "");
        const isSelected = externalSelectedRowKeys.includes(rowKey);

        let mk = poolRef.current.get(rowKey);
        if (!mk) {
          // 새 마커 (최초만 생성)
          try {
            mk = new maps.Marker({
              position: pos,
              title,
              image: isSelected ? imgs.yellow : imgs.purple,
              clickable: true,
            });
            mk.__imgState = isSelected ? "yellow" : "purple";
          } catch {
            return;
          }
          mk.__row = row; // 최신 원본 데이터 보관

          // 클릭 이벤트: 선택/강조
          maps.event.addListener(mk, "click", () => {
            const sel = toSelected(rowKey, row, lat, lng);
            onSelect(sel);

            // 이전 클릭 복원
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              const prev = lastClickedRef.current;
              // prev가 선택된 상태인지 확인
              const prevRowKey = (prev.__row && buildRowKeyFromRow(prev.__row as PlaceRow)) || "";
              const prevSelected = externalSelectedRowKeys.includes(prevRowKey);
              setMarkerState(prev, prevSelected ? "yellow" : "purple");
            }

            const nowSelected = externalSelectedRowKeys.includes(rowKey);
            setMarkerState(mk, nowSelected ? "yellow" : "clicked");
            lastClickedRef.current = mk;
          });

          poolRef.current.set(rowKey, mk);
          toAdd.push(mk);
        } else {
          // 기존 마커 재사용 (깜빡임 방지)
          try {
            // 위치/타이틀 변동 시에만 업데이트
            const oldPos = mk.getPosition?.();
            if (!oldPos || oldPos.getLat() !== lat || oldPos.getLng() !== lng) {
              mk.setPosition(pos);
            }
            if (mk.getTitle?.() !== title) mk.setTitle?.(title);

            // 상태 반영도 "변화시에만"
            const keepClicked = lastClickedRef.current === mk && !isSelected;
            const should: MarkerState = keepClicked ? "clicked" : isSelected ? "yellow" : "purple";
            setMarkerState(mk, should);

            // 최신 행 보관
            mk.__row = row;
          } catch {}
        }

        // 인덱스/그룹 집계
        if (!nextKeyIndex[rowKey]) nextKeyIndex[rowKey] = [];
        nextKeyIndex[rowKey].push(mk);

        const gk = groupKeyFromRow(row);
        if (!nextGroups.has(gk)) nextGroups.set(gk, []);
        nextGroups.get(gk)!.push(mk);
      });

      // 제거 대상: 풀에는 있는데 이번에 안 보이는 키
      poolRef.current.forEach((mk, rowKey) => {
        if (!nextKeys.has(rowKey)) {
          toRemove.push(mk);
          poolRef.current.delete(rowKey);
        }
      });

      // Clusterer 업데이트 (추가/제거만)
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

      // 참조 갱신
      keyIndexRef.current = nextKeyIndex;
      groupsRef.current = nextGroups;
    },
    [clusterer, externalSelectedRowKeys, imgs, kakao, map, onSelect, setMarkerState, toSelected],
  );

  /** 바운드 기반 조회 후 DIFF 반영 */
  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    if (fetchInFlightRef.current) return; // 중복 호출 방지
    const bounds = map.getBounds?.();
    if (!bounds) return;

    fetchInFlightRef.current = true;
    try {
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

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

      if (error) {
        console.error("Supabase(raw_places) error:", error.message);
        return;
      }
      addOrUpdateFromRows((data ?? []) as PlaceRow[]);
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [addOrUpdateFromRows, kakao, map]);

  /** idle 이벤트로 갱신 (초기 1회 포함) */
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const handler = maps.event.addListener(map, "idle", () => {
      // 연속 idle 방지: fetchInFlightRef로 자체 조절
      refreshInBounds();
    });

    // 초기 로딩
    refreshInBounds();

    return () => {
      try {
        maps.event.removeListener(handler);
      } catch {}
      // 언마운트 시 풀을 안전 정리
      const all: any[] = [];
      poolRef.current.forEach((mk) => all.push(mk));
      try {
        if (clusterer?.removeMarkers) clusterer.removeMarkers(all);
        else all.forEach((m) => m.setMap(null));
      } catch {}
      poolRef.current.clear();
      keyIndexRef.current = {};
      groupsRef.current.clear();
      lastClickedRef.current = null;
    };
  }, [kakao, map, refreshInBounds, clusterer]);

  /** 외부에서 rowKey로 선택(지도로 포커스) */
  const selectByRowKey = useCallback(
    (rowKey: string) => {
      const mk = poolRef.current.get(rowKey);
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

      // 클릭 상태 갱신 (외부 선택 + 클릭 유지 규칙 반영)
      const isSelected = externalSelectedRowKeys.includes(rowKey);
      if (lastClickedRef.current && lastClickedRef.current !== mk) {
        const prev = lastClickedRef.current;
        const prevRow = prev.__row as PlaceRow;
        const prevKey = buildRowKeyFromRow(prevRow);
        const prevSelected = externalSelectedRowKeys.includes(prevKey);
        setMarkerState(prev, prevSelected ? "yellow" : "purple");
      }
      setMarkerState(mk, isSelected ? "yellow" : "clicked");
      lastClickedRef.current = mk;
    },
    [externalSelectedRowKeys, kakao, map, onSelect, setMarkerState, toSelected],
  );

  return { refreshInBounds, selectByRowKey };
}
