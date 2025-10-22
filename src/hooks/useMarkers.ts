/**
 * 마커 관리 훅 (지도 바운드 → 데이터 조회 → 마커 캐시/상태/클러스터)
 * - PC/모바일 공용. 지도/클러스터러만 주면 동작합니다.
 * - 같은 좌표 마커를 좌우로 벌려서 겹침을 줄입니다.
 * - 선택(노랑) / 클릭(보라+확대) 상태를 이미지로 표현합니다.
 *
 * 기본 사용 예)
 * const markers = useMarkers({
 *   kakao, map, clusterer,
 *   onSelect: (apt) => setSelected(apt),
 * });
 * // 지도가 멈출 때마다 자동으로 바운드 로드(기본값 autoReloadOnIdle=true)
 *
 * 수동 갱신 예)
 * const { refreshInBounds } = useMarkers({ kakao, map, clusterer, autoReloadOnIdle: false });
 * useKakaoMap(... onIdle: () => refreshInBounds() ...)
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PlaceRow, SelectedApt } from "../core/types";
import { buildRowKeyFromRow, groupKeyFromRow, monthlyFeeOf } from "../core/map/rowKey";
import { getField, imageForProduct, toNumLoose } from "../core/utils";
import { getPlacesInBounds, limitForLevel, MINIMAL_PLACE_FIELDS } from "../lib/data/getPlacesInBounds";

/* ============================================================
 * 상수: 마커 이미지 경로(프로젝트 public/ 자산 기준)
 * ============================================================ */
const PIN_PURPLE_URL = "/makers/pin-purple@2x.png";
const PIN_YELLOW_URL = "/makers/pin-yellow@2x.png";
const PIN_CLICKED_URL = "/makers/pin-purple@3x.png";
const PIN_SIZE = 51;
const PIN_OFFSET = { x: PIN_SIZE / 2, y: PIN_SIZE };

/* ============================================================
 * Kakao MarkerImage 캐시(맵스 네임스페이스별 1회 생성)
 * ============================================================ */
type MarkerImages = { purple: any; yellow: any; clicked: any };
const imageCache = new WeakMap<any, MarkerImages>();

function getMarkerImages(maps: any): MarkerImages {
  const cached = imageCache.get(maps);
  if (cached) return cached;
  const { MarkerImage, Size, Point } = maps;
  const opt = { offset: new Point(PIN_OFFSET.x, PIN_OFFSET.y) };
  const sz = new Size(PIN_SIZE, PIN_SIZE);
  const imgs = {
    purple: new MarkerImage(PIN_PURPLE_URL, sz, opt),
    yellow: new MarkerImage(PIN_YELLOW_URL, sz, opt),
    clicked: new MarkerImage(PIN_CLICKED_URL, sz, opt),
  };
  imageCache.set(maps, imgs);
  return imgs;
}

/* ============================================================
 * 내부 타입
 * ============================================================ */
type KMarker = any & {
  __key?: string; // 캐시 키(좌표+id+상품+설치위치)
  __basePos?: any; // 원래 좌표(겹침 분리 전)
  __row?: PlaceRow; // 원본 행
};

export type UseMarkersOptions = {
  kakao?: any;
  map?: any | null;
  clusterer?: any | null;

  /** 지도가 idle일 때 자동으로 바운드 재로딩(기본 true) */
  autoReloadOnIdle?: boolean;

  /** 줌 레벨별 limit 함수(기본: limitForLevel) */
  limitForLevel?: (level: number) => number;

  /** 마커 클릭 → 상세 선택 콜백 */
  onSelect?: (apt: SelectedApt) => void;

  /**
   * 외부에서 "선택(담김)된 rowKey"들을 주면 노란 마커로 표시
   * - 카트/선택 상태와 색상을 일치시키기 위함
   */
  externalSelectedRowKeys?: string[];
};

export function useMarkers(opts: UseMarkersOptions) {
  const maps = opts.kakao?.maps;
  const map = opts.map;
  const clusterer = opts.clusterer;

  // 캐시/인덱스
  const markerCacheRef = useRef<Map<string, KMarker>>(new Map()); // key → marker
  const rowKeyIndexRef = useRef<Record<string, KMarker[]>>({}); // rowKey → markers[]
  const groupsRef = useRef<Map<string, KMarker[]>>(new Map()); // groupKey(좌표) → markers[]
  const lastClickedRef = useRef<KMarker | null>(null); // 클릭 강조 상태
  const selectedRowKeysRef = useRef<Set<string>>(new Set()); // 외부 선택(노랑)

  // 최신 콜백 참조
  const onSelectRef = useRef<((apt: SelectedApt) => void) | undefined>(opts.onSelect);
  onSelectRef.current = opts.onSelect;

  // 외부 선택 상태 → 내부 Set 동기화
  useEffect(() => {
    const set = new Set<string>(opts.externalSelectedRowKeys ?? []);
    selectedRowKeysRef.current = set;
    // 색상 반영
    repaintAll("from-external");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(opts.externalSelectedRowKeys ?? [])]);

  /* ------------------------------------------------------------
   * 지도 idle 시 자동 리로드(옵션)
   * ------------------------------------------------------------ */
  useEffect(() => {
    if (!maps || !map || opts.autoReloadOnIdle === false) return;
    const handler = maps.event.addListener(map, "idle", () => {
      refreshInBounds().catch(() => void 0);
    });
    return () => {
      try {
        if (handler) maps.event.removeListener(handler);
      } catch {
        /* no-op */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps, map, opts.autoReloadOnIdle]);

  /* ------------------------------------------------------------
   * 메인: 바운드 내 데이터 → 마커 갱신
   * ------------------------------------------------------------ */
  const refreshInBounds = useCallback(async () => {
    if (!maps || !map) return;

    const b = map.getBounds?.();
    if (!b) return;

    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const level = map.getLevel?.() ?? 6;
    const limit = (opts.limitForLevel ?? limitForLevel)(level);

    const { rows, error } = await getPlacesInBounds({
      bounds: { sw: { lat: sw.getLat(), lng: sw.getLng() }, ne: { lat: ne.getLat(), lng: ne.getLng() } },
      fields: [...MINIMAL_PLACE_FIELDS],
      limit,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[useMarkers] getPlacesInBounds error:", error);
      return;
    }

    // 키 만들기
    const nowKeys = new Set<string>();
    const newMarkers: KMarker[] = [];
    const toAdd: KMarker[] = [];

    // 인덱스 초기화(다시 채움)
    rowKeyIndexRef.current = {};
    const localGroups = new Map<string, KMarker[]>();

    const imgs = getMarkerImages(maps);

    rows.forEach((row) => {
      if (row.lat == null || row.lng == null) return;

      const lat = Number(row.lat);
      const lng = Number(row.lng);
      const pos = new maps.LatLng(lat, lng);

      // 캐시 키(좌표+id+상품+설치위치 조합)
      const idPart = row.id != null ? String(row.id) : "";
      const prod = String(getField(row, ["상품명", "productName"]) || "");
      const loc = String(getField(row, ["설치위치", "installLocation"]) || "");
      const key = `${lat.toFixed(7)},${lng.toFixed(7)}|${idPart}|${prod}|${loc}`;

      const rowKey = buildRowKeyFromRow(row);
      nowKeys.add(key);

      let mk = markerCacheRef.current.get(key);
      const nameText = String(getField(row, ["단지명", "name", "아파트명"]) || "");

      if (!mk) {
        const isSelected = selectedRowKeysRef.current.has(rowKey);
        mk = new maps.Marker({
          position: pos,
          title: nameText,
          image: isSelected ? imgs.yellow : imgs.purple,
        }) as KMarker;
        mk.__key = key;
        mk.__basePos = pos;
        mk.__row = row;

        // 클릭 이벤트
        maps.event.addListener(mk, "click", () => {
          const sel = toSelected(rowKey, row, lat, lng);
          onSelectRef.current?.(sel);

          // 클릭 강조 이미지
          if (selectedRowKeysRef.current.has(rowKey)) {
            // 이미 선택(노랑)이면 노랑 유지, 클릭 강조 해제
            setMarkerImage(mk, imgs.yellow);
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              resetMarkerImage(lastClickedRef.current, imgs);
            }
            lastClickedRef.current = null;
          } else {
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              resetMarkerImage(lastClickedRef.current, imgs);
            }
            setMarkerImage(mk, imgs.clicked);
            lastClickedRef.current = mk;
          }

          // 같은 좌표 벌리기 재적용
          applyStaticSeparationAll();
        });

        markerCacheRef.current.set(key, mk);
        toAdd.push(mk);
      } else {
        mk.setPosition(pos);
        if (mk.getTitle?.() !== nameText) mk.setTitle?.(nameText);

        // 이미지 동기화
        let imgToUse = selectedRowKeysRef.current.has(rowKey) ? imgs.yellow : imgs.purple;
        if (!selectedRowKeysRef.current.has(rowKey) && lastClickedRef.current?.__key === key) {
          imgToUse = imgs.clicked;
        }
        setMarkerImage(mk, imgToUse);
      }

      // rowKey 인덱스
      if (!rowKeyIndexRef.current[rowKey]) rowKeyIndexRef.current[rowKey] = [];
      rowKeyIndexRef.current[rowKey].push(mk);

      // 그룹 수집
      const gk = groupKeyFromRow(row);
      if (!localGroups.has(gk)) localGroups.set(gk, []);
      localGroups.get(gk)!.push(mk);

      newMarkers.push(mk);
    });

    // 클러스터러 반영
    if (toAdd.length && clusterer) clusterer.addMarkers(toAdd);

    const toRemove: KMarker[] = [];
    markerCacheRef.current.forEach((mk, key) => {
      if (!nowKeys.has(key)) {
        toRemove.push(mk);
        markerCacheRef.current.delete(key);
      }
    });
    if (toRemove.length && clusterer) clusterer.removeMarkers(toRemove);
    if (lastClickedRef.current && toRemove.includes(lastClickedRef.current)) lastClickedRef.current = null;

    // 그룹 우선순위(zIndex) + 겹침 분리
    groupsRef.current = localGroups;
    applyGroupPrioritiesMap(localGroups);
    applyStaticSeparationAll();
  }, [maps, map, clusterer, opts.limitForLevel]);

  /* ------------------------------------------------------------
   * 외부에서 rowKey 배열을 주고 "노랑 상태"로 만들고 싶을 때
   * ------------------------------------------------------------ */
  const setSelectedRowKeys = useCallback((rowKeys: string[]) => {
    selectedRowKeysRef.current = new Set(rowKeys ?? []);
    repaintAll("setSelectedRowKeys");
  }, []);

  /* ------------------------------------------------------------
   * 특정 rowKey로 "지도로 이동 + 클릭 강조" 하고 싶을 때
   * ------------------------------------------------------------ */
  const focusRowKey = useCallback(
    (rowKey: string) => {
      if (!maps || !map) return;
      const arr = rowKeyIndexRef.current[rowKey];
      if (!arr || !arr.length) return;
      const mk = arr[0];
      const row = mk.__row as PlaceRow;
      const lat = Number(row.lat);
      const lng = Number(row.lng);

      try {
        const pos = new maps.LatLng(lat, lng);
        map.setLevel?.(4);
        map.panTo?.(pos);
      } catch {
        /* no-op */
      }

      const imgs = getMarkerImages(maps);
      if (lastClickedRef.current && lastClickedRef.current !== mk) {
        resetMarkerImage(lastClickedRef.current, imgs);
      }
      setMarkerImage(mk, selectedRowKeysRef.current.has(rowKey) ? imgs.yellow : imgs.clicked);
      lastClickedRef.current = mk;
      applyStaticSeparationAll();
    },
    [maps, map],
  );

  /* ------------------------------------------------------------
   * 유틸: 전 마커 재도색/겹침 분리
   * ------------------------------------------------------------ */
  const repaintAll = useCallback(
    (reason?: string) => {
      if (!maps) return;
      const imgs = getMarkerImages(maps);
      markerCacheRef.current.forEach((mk) => {
        const row = mk.__row as PlaceRow;
        const rowKey = buildRowKeyFromRow(row);
        const isSel = selectedRowKeysRef.current.has(rowKey);
        const isClicked = lastClickedRef.current === mk && !isSel;
        setMarkerImage(mk, isClicked ? imgs.clicked : isSel ? imgs.yellow : imgs.purple);
      });
      applyGroupPrioritiesMap(groupsRef.current);
      applyStaticSeparationAll();
      // eslint-disable-next-line no-console
      if (reason) console.debug?.("[useMarkers] repaintAll:", reason);
    },
    [maps],
  );

  /* ============================================================
   * 겹침 분리 & zIndex 우선순위
   * ============================================================ */

  const layoutMarkersSideBySide = useCallback(
    (group: KMarker[]) => {
      if (!maps || !map || !group || group.length <= 1) return;
      const proj = map.getProjection?.();
      if (!proj) return;

      const center = group[0].__basePos;
      const cpt = proj.containerPointFromCoords(center);
      const N = group.length;
      const GAP = 26; // px
      const totalW = GAP * (N - 1);
      const startX = cpt.x - totalW / 2;
      const y = cpt.y;

      for (let i = 0; i < N; i++) {
        const pt = new maps.Point(startX + i * GAP, y);
        const pos = proj.coordsFromContainerPoint(pt);
        try {
          group[i].setPosition(pos);
        } catch {
          /* no-op */
        }
      }
    },
    [maps, map],
  );

  const applyStaticSeparationAll = useCallback(() => {
    if (!map || !maps) return;
    groupsRef.current.forEach((grp) => layoutMarkersSideBySide(grp));
  }, [maps, map, layoutMarkersSideBySide]);

  const orderAndApplyZIndex = useCallback((arr: KMarker[]) => {
    if (!arr || arr.length <= 1) return arr;
    // 선택(노랑) 우선 → 월광고료 높은 순
    const sorted = arr.slice().sort((a, b) => {
      const ra = a.__row as PlaceRow;
      const rb = b.__row as PlaceRow;
      const aKey = buildRowKeyFromRow(ra);
      const bKey = buildRowKeyFromRow(rb);
      const aSel = selectedRowKeysRef.current.has(aKey) ? 1 : 0;
      const bSel = selectedRowKeysRef.current.has(bKey) ? 1 : 0;
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
      } catch {
        /* no-op */
      }
    }
    // 원본 배열 내용 유지
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

  /* ============================================================
   * 보조: 이미지/선택 변환/리셋
   * ============================================================ */
  function setMarkerImage(mk: KMarker, img: any) {
    try {
      mk.setImage(img);
    } catch {
      /* no-op */
    }
  }

  function resetMarkerImage(mk: KMarker, imgs: MarkerImages) {
    const row = mk.__row as PlaceRow;
    const rk = buildRowKeyFromRow(row);
    const isSel = selectedRowKeysRef.current.has(rk);
    setMarkerImage(mk, isSel ? imgs.yellow : imgs.purple);
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
      imageUrl: (rawImage as string) || imageForProduct(String(productName)),
      lat,
      lng,
    };
  }

  /* ============================================================
   * 외부 제공 API
   * ============================================================ */
  return useMemo(() => {
    return {
      /** 현재 바운드 기준으로 데이터 재로딩 */
      refreshInBounds,
      /** 외부 선택 rowKeys(노랑 마커) 강제 반영 */
      setSelectedRowKeys,
      /** 특정 rowKey를 지도에서 포커스(이동+클릭 강조) */
      focusRowKey,
      /** 현재 마커 수 */
      getMarkerCount: () => markerCacheRef.current.size,
      /** 내부 캐시를 비우고 클러스터러에서 제거 */
      clearAll: () => {
        try {
          if (clusterer) {
            const all: KMarker[] = [];
            markerCacheRef.current.forEach((m) => all.push(m));
            if (all.length) clusterer.removeMarkers(all);
          }
        } catch {
          /* no-op */
        }
        markerCacheRef.current.clear();
        rowKeyIndexRef.current = {};
        groupsRef.current.clear();
        lastClickedRef.current = null;
      },
    };
  }, [refreshInBounds, setSelectedRowKeys, focusRowKey, clusterer]);
}

export default useMarkers;
