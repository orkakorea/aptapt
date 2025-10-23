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
const OVERSCAN_RATIO = 0.2;
/** 바운드가 너무 작을 때 fetch 스킵(임시 레이아웃/relayout 보호) */
const MIN_LAT_SPAN = 0.001;
const MIN_LNG_SPAN = 0.001;
/** 액션 직후 제거 일시정지 시간(ms) */
const REMOVAL_PAUSE_MS = 1200;

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

  /** 선택 집합 → 렌더 영향 없이 참조 */
  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedSetRef.current = new Set(externalSelectedRowKeys);
    // 선택(담기/해제 등) 직후에는 잠깐 제거 금지 → 집단 깜빡임 방지
    pauseRemoval(REMOVAL_PAUSE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSelectedRowKeys.join("|")]);

  /** 요청 가드/이전 결과 해시/액션 후 제거 잠금 */
  const fetchInFlightRef = useRef(false);
  const requestVersionRef = useRef(0);
  const prevIdKeysHashRef = useRef<string>(""); // 이전 결과의 idKey 집합 해시
  const removalPauseUntilRef = useRef<number>(0);
  const emptyStreakRef = useRef(0); // 연속 0건 응답(2회 이상이면 진짜 비움 허용)

  function pauseRemoval(ms: number) {
    removalPauseUntilRef.current = Math.max(removalPauseUntilRef.current, Date.now() + ms);
  }
  function removalPaused() {
    return Date.now() < removalPauseUntilRef.current;
  }

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
      if (!mk) return;
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

  /** 안정키: row.id 우선, 없으면 좌표 5자리 + 그룹/상품/설치 */
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

  /** rows -> idKey 집합 해시 (순서 무관) */
  function hashIdKeys(rows: PlaceRow[]): string {
    const keys: string[] = [];
    for (const r of rows) {
      if (r.lat == null || r.lng == null) continue;
      keys.push(stableIdKeyFromRow(r));
    }
    keys.sort();
    // 간단 해시: 길이|첫/중/끝 조합
    const n = keys.length;
    return `${n}|${keys[0] ?? ""}|${keys[Math.floor(n / 2)] ?? ""}|${keys[n - 1] ?? ""}`;
  }

  /** DIFF 반영 (동일 집합이면 완전 NO-OP) */
  const applyRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      // ⚠️ 빈 배열 보호: 기존 마커가 있고 rows가 0이면 일시적 공백일 가능성 → 적용 스킵
      if ((rows?.length ?? 0) === 0 && poolRef.current.size > 0) {
        return; // 전체 사라짐 방지
      }

      // 동일 집합이면 완전 NO-OP (클러스터러 재계산조차 막음)
      const nextHash = hashIdKeys(rows);
      if (nextHash === prevIdKeysHashRef.current) {
        // 그래도 행 데이터 최신화/색 규칙은 현상 유지
        return;
      }
      prevIdKeysHashRef.current = nextHash;

      const nextIdKeys = new Set<string>();
      const toAdd: any[] = [];
      const toRemove: any[] = [];

      // 새 rowKey 인덱스 (전체 교체)
      const nextRowKeyIndex = new Map<string, any>();

      for (const row of rows) {
        if (row.lat == null || row.lng == null) continue;
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const idKey = stableIdKeyFromRow(row);
        const rowKey = buildRowKeyFromRow(row);
        nextIdKeys.add(idKey);

        const pos = new maps.LatLng(lat, lng);
        const title = String(getField(row, ["단지명", "name", "아파트명"]) || "");

        let mk = poolRef.current.get(idKey);
        if (!mk) {
          // 최초 생성(추가만)
          try {
            mk = new maps.Marker({
              position: pos,
              title,
              image: imgs.purple, // 기본은 보라 (선택/클릭 규칙으로 즉시 보정)
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
          // 재사용: 위치/타이틀 변동시에만 갱신
          try {
            const oldPos = mk.getPosition?.();
            if (!oldPos || oldPos.getLat() !== lat || oldPos.getLng() !== lng) {
              mk.setPosition(pos);
            }
            if (mk.getTitle?.() !== title) mk.setTitle?.(title);
          } catch {}
          mk.__rowKey = rowKey;
          mk.__row = row;

          // 색 규칙 적용(변화시에만 이미지 교체)
          colorByRule(mk);
        }

        nextRowKeyIndex.set(rowKey, mk);
      }

      // 먼저 추가 반영 → 화면 공백 방지
      if (toAdd.length) {
        try {
          if (clusterer?.addMarkers) clusterer.addMarkers(toAdd);
          else toAdd.forEach((m) => m.setMap(map));
        } catch {}
        // 추가분 색상 최종 적용(선택 반영)
        toAdd.forEach((mk) => colorByRule(mk));
      }

      // 제거 대상: 이번 결과에 없는 idKey만 제거
      if (!removalPaused()) {
        poolRef.current.forEach((mk, idKey) => {
          if (!nextIdKeys.has(idKey)) {
            toRemove.push(mk);
            poolRef.current.delete(idKey);
          }
        });

        if (toRemove.length) {
          try {
            if (clusterer?.removeMarkers) clusterer.removeMarkers(toRemove);
            else toRemove.forEach((m) => m.setMap(null));
          } catch {}
        }
      }

      // 인덱스 교체
      rowKeyIndexRef.current = nextRowKeyIndex;
    },
    [clusterer, colorByRule, imgs, kakao, map, onSelect, toSelected],
  );

  /** 바운드 내 데이터 요청 + DIFF 반영 */
  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    const kbounds = map.getBounds?.();
    if (!kbounds) return;

    const sw = kbounds.getSouthWest();
    const ne = kbounds.getNorthEast();

    // ❗ 너무 작은 바운드(레이아웃 전환/relayout 중)면 스킵 → 집단 깜빡임 방지
    const latSpan = Math.abs(ne.getLat() - sw.getLat());
    const lngSpan = Math.abs(ne.getLng() - sw.getLng());
    if (latSpan < MIN_LAT_SPAN || lngSpan < MIN_LNG_SPAN) return;

    // 오버스캔 적용
    const latPad = (ne.getLat() - sw.getLat()) * OVERSCAN_RATIO;
    const lngPad = (ne.getLng() - sw.getLng()) * OVERSCAN_RATIO;
    const minLat = Math.min(sw.getLat(), ne.getLat()) - latPad;
    const maxLat = Math.max(sw.getLat(), ne.getLat()) + latPad;
    const minLng = Math.min(sw.getLng(), ne.getLng()) - lngPad;
    const maxLng = Math.max(sw.getLng(), ne.getLng()) + lngPad;

    // 중복 요청 가드
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    const myVersion = ++requestVersionRef.current;

    try {
      const { data, error } = await supabase
        .from("raw_places")
        .select("*")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", minLat)
        .lte("lat", maxLat)
        .gte("lng", minLng)
        .lte("lng", maxLng)
        .limit(5000);

      // 느리게 도착한 응답은 폐기
      if (myVersion !== requestVersionRef.current) return;

      if (error) {
        console.error("Supabase(raw_places) error:", error.message);
        return;
      }

      const rows = (data ?? []) as PlaceRow[];

      // ❗ 일시적 0건 보호: 1회는 무시(풀이 비어있지 않다면)
      if (rows.length === 0) {
        emptyStreakRef.current += 1;
        if (emptyStreakRef.current < 2 && poolRef.current.size > 0) {
          return; // 첫 0건 응답 무시 → 전마커 보존(깜빡임 방지)
        }
      } else {
        emptyStreakRef.current = 0;
      }

      applyRows(rows);
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [applyRows, kakao, map]);

  /** idle에서만 갱신 (UI 액션과 분리) + 초기 1회 강제 */
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const h = maps.event.addListener(map, "idle", () => {
      refreshInBounds();
    });

    // 초기: 다음 프레임에 강제 1회 실행 (초기 idle 누락 대비)
    requestAnimationFrame(() => refreshInBounds());

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
      lastClickedRef.current = null;
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

      // 외부 포커싱 액션 직후에는 잠깐 제거 금지
      pauseRemoval(REMOVAL_PAUSE_MS);
    },
    [colorByRule, kakao, map, onSelect, toSelected],
  );

  return { refreshInBounds, selectByRowKey };
}
