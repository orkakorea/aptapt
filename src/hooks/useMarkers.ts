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

/** 청소(지연 제거) 지연 시간(ms) */
const CLEANUP_DELAY = 900;

/** 1회 청소에서 최대 제거 수 (프레임 드랍 방지) */
const CLEANUP_MAX_REMOVE = 400;

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
  const lastClickedRef = useRef<any | null>(null);

  /** 선택 집합의 이전/현재를 ref로 보관 → 델타 업데이트 */
  const selectedSetRef = useRef<Set<string>>(new Set());
  const prevSelectedSetRef = useRef<Set<string>>(new Set());

  /** 오버스캔 로드 영역/요청 버전 관리 */
  const loadedRectRef = useRef<Rect | null>(null);
  const fetchInFlightRef = useRef(false);
  const requestVersionRef = useRef(0);

  /** 청소 타이머 */
  const cleanupTimerRef = useRef<number | null>(null);

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
  const colorByRule = useCallback(
    (mk: any) => {
      const rowKey = mk.__rowKey as string | undefined;
      const isSelected = !!rowKey && selectedSetRef.current.has(rowKey);
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

  /** 선택 집합 변경 → 델타만 색상 업데이트 (전체 setImage 폭주 방지) */
  useEffect(() => {
    const next = new Set(externalSelectedRowKeys);
    selectedSetRef.current = next;

    // added / removed 계산
    const added: string[] = [];
    const removed: string[] = [];
    next.forEach((k) => {
      if (!prevSelectedSetRef.current.has(k)) added.push(k);
    });
    prevSelectedSetRef.current.forEach((k) => {
      if (!next.has(k)) removed.push(k);
    });
    prevSelectedSetRef.current = next;

    // 추가된 키는 노란색으로, 제거된 키는 규칙 재적용
    for (const k of added) {
      const mk = rowKeyIndexRef.current.get(k);
      if (mk) setMarkerState(mk, "yellow");
    }
    for (const k of removed) {
      const mk = rowKeyIndexRef.current.get(k);
      if (mk) colorByRule(mk);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedRowKeys.join("|")]);

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

  /** 마커 추가/업데이트 (즉시 제거 없음) */
  const addOrUpdateFromRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      // 새 rowKey 인덱스 (전체 교체)
      const nextRowKeyIndex = new Map<string, any>();

      const toAdd: any[] = [];
      for (const row of rows) {
        if (row.lat == null || row.lng == null) continue;
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const idKey = stableIdKeyFromRow(row); // 안정키
        const rowKey = buildRowKeyFromRow(row); // 선택/표시용 키
        const pos = new maps.LatLng(lat, lng);
        const title = String(getField(row, ["단지명", "name", "아파트명"]) || "");

        let mk = poolRef.current.get(idKey);
        if (!mk) {
          // 최초 생성(추가만)
          try {
            mk = new maps.Marker({
              position: pos,
              title,
              image: imgs.purple,
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
              colorByRule(lastClickedRef.current);
            }
            lastClickedRef.current = mk;

            // 현재 클릭 반영(선택이면 노랑, 아니면 클릭색)
            colorByRule(mk);
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
          colorByRule(mk);
        }

        nextRowKeyIndex.set(rowKey, mk);
      }

      // 먼저 추가만 수행 → 화면 공백 방지
      if (toAdd.length) {
        try {
          if (clusterer?.addMarkers) clusterer.addMarkers(toAdd);
          else toAdd.forEach((m) => m.setMap(map));
        } catch {}
        // 방금 추가된 것들 컬러 규칙 한 번 더 (선택 집합 반영)
        toAdd.forEach((mk) => colorByRule(mk));
      }

      // 최신 인덱스 교체
      rowKeyIndexRef.current = nextRowKeyIndex;

      // 지연 청소 예약: 현재 뷰의 넓은 keepRect 밖에 있고 선택/클릭도 아닌 것만 조금씩 제거
      scheduleLazyCleanup();
    },
    [clusterer, colorByRule, imgs, kakao, map, onSelect, toSelected],
  );

  /** 지연 청소: keepRect 밖 + 선택/클릭 아님 → 조금씩 제거 */
  const scheduleLazyCleanup = useCallback(() => {
    if (!kakao?.maps || !map) return;
    if (cleanupTimerRef.current) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    cleanupTimerRef.current = window.setTimeout(() => {
      try {
        const kbounds = map.getBounds?.();
        if (!kbounds) return;
        const view = rectFromKakaoBounds(kbounds);
        const keepRect = expandRect(view, OVERSCAN_RATIO * 1.2); // 유지 범위(오버스캔보다 조금 넓게)

        const toRemove: any[] = [];
        poolRef.current.forEach((mk) => {
          if (mk === lastClickedRef.current) return; // 클릭 유지
          const rowKey = mk.__rowKey as string | undefined;
          if (rowKey && selectedSetRef.current.has(rowKey)) return; // 선택 유지

          const row: PlaceRow = mk.__row;
          const lat = Number(row.lat);
          const lng = Number(row.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          if (lat < keepRect.minLat || lat > keepRect.maxLat || lng < keepRect.minLng || lng > keepRect.maxLng) {
            toRemove.push(mk);
          }
        });

        // 너무 많이 지우면 프레임 드랍 → 분할 제거
        const batch = toRemove.slice(0, CLEANUP_MAX_REMOVE);
        if (batch.length) {
          batch.forEach((m) => {
            // 풀에서 제거
            poolRef.current.delete(m.__idKey as string);
            // rowKey 인덱스도 제거
            rowKeyIndexRef.current.delete(m.__rowKey as string);
          });
          try {
            if (clusterer?.removeMarkers) clusterer.removeMarkers(batch);
            else batch.forEach((m) => m.setMap(null));
          } catch {}
        }
      } finally {
        cleanupTimerRef.current = null;
      }
    }, CLEANUP_DELAY) as unknown as number;
  }, [kakao, map, clusterer]);

  /** 바운드 내 데이터 요청 + 추가(지연 제거) */
  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    const kbounds = map.getBounds?.();
    if (!kbounds) return;

    const viewRect = rectFromKakaoBounds(kbounds);

    // 이미 더 넓은 영역을 로드했다면 스킵
    if (loadedRectRef.current && rectContains(loadedRectRef.current, viewRect)) {
      // 그래도 청소는 예약
      scheduleLazyCleanup();
      return;
    }

    // 새로 로드할 오버스캔 영역
    const queryRect = expandRect(viewRect, OVERSCAN_RATIO);

    // 요청 버전 증가
    const myVersion = ++requestVersionRef.current;

    // 중복 요청 방지
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const { minLat, maxLat, minLng, maxLng } = queryRect;

      // ⚡ 가벼운 SELECT (필요 칼럼만)
      const { data, error } = await supabase
        .from("raw_places")
        .select(
          [
            "id",
            "lat",
            "lng",
            "단지명",
            "name",
            "아파트명",
            "상품명",
            "productName",
            "설치위치",
            "installLocation",
            "월광고료",
            "month_fee",
            "monthlyFee",
            "월송출횟수",
            "monthlyImpressions",
            "모니터수량",
            "monitors",
            "세대수",
            "households",
            "거주인원",
            "residents",
            "imageUrl",
            "이미지",
            "썸네일",
            "thumbnail",
            "1회당 송출비용",
            "costPerPlay",
            "1년 계약 시 월 광고료",
            "연간월광고료",
            "monthlyFeeY1",
            "운영시간",
            "hours",
          ].join(","),
        )
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", minLat)
        .lte("lat", maxLat)
        .gte("lng", minLng)
        .lte("lng", maxLng)
        .limit(3000); // 과도 쿼리 방지

      // 늦게 온 응답은 무시
      if (myVersion !== requestVersionRef.current) return;

      if (error) {
        console.error("Supabase(raw_places) error:", error.message);
        return;
      }

      addOrUpdateFromRows((data ?? []) as PlaceRow[]);
      loadedRectRef.current = queryRect; // 로드된 영역 갱신
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [addOrUpdateFromRows, kakao, map, scheduleLazyCleanup]);

  /** idle에서만 갱신 (버튼 클릭 등 UI와 분리) + 초기 1회 */
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const h = maps.event.addListener(map, "idle", () => {
      refreshInBounds();
    });

    // 초기: 다음 프레임에 1회 강제 호출(초기 idle 누락 대비)
    requestAnimationFrame(() => refreshInBounds());

    return () => {
      try {
        maps.event.removeListener(h);
      } catch {}
      // 정리
      if (cleanupTimerRef.current) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      const all: any[] = [];
      poolRef.current.forEach((mk) => all.push(mk));
      try {
        if (clusterer?.removeMarkers) clusterer.removeMarkers(all);
        else all.forEach((m) => m.setMap(null));
      } catch {}
      poolRef.current.clear();
      rowKeyIndexRef.current.clear();
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
        colorByRule(lastClickedRef.current);
      }
      lastClickedRef.current = mk;
      colorByRule(mk);
    },
    [colorByRule, kakao, map, onSelect, toSelected],
  );

  return { refreshInBounds, selectByRowKey };
}
