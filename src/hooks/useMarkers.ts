import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRowKeyFromRow, groupKeyFromRow } from "@/core/map/rowKey";
import { getField, toNumLoose } from "@/core/utils";
import type { SelectedApt } from "@/core/types";

type KakaoNS = typeof window & { kakao: any };

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

export default function useMarkers({
  kakao,
  map,
  clusterer,
  onSelect,
  externalSelectedRowKeys,
}: {
  kakao: any;
  map: any;
  clusterer: any;
  onSelect: (apt: SelectedApt) => void;
  /** 카트에 담긴 rowKey 등 외부 선택 상태(노란 핀 표현용) */
  externalSelectedRowKeys?: string[];
}) {
  const markerCacheRef = useRef<Map<string, KMarker>>(new Map());
  const keyIndexRef = useRef<Record<string, KMarker[]>>({});
  const groupsRef = useRef<Map<string, KMarker[]>>(new Map());
  const lastReqIdRef = useRef<number>(0);
  const lastClickedRef = useRef<KMarker | null>(null);

  // 외부 선택 상태 → 마커 이미지 반영
  useEffect(() => {
    const maps = (window as KakaoNS).kakao?.maps;
    if (!maps) return;
    const imgs = markerImages(maps);
    const setYellow = new Set(externalSelectedRowKeys ?? []);
    Object.entries(keyIndexRef.current).forEach(([rowKey, list]) => {
      list.forEach((mk) => {
        const isYellow = setYellow.has(rowKey);
        // 클릭으로 강조된 경우는 그대로 두고, 외부선택만 토글
        const isClicked = lastClickedRef.current && lastClickedRef.current.__key === mk.__key;
        if (isClicked) return;
        mk.setImage(isYellow ? imgs.yellow : imgs.purple);
      });
    });
  }, [externalSelectedRowKeys]);

  const layoutMarkersSideBySide = useCallback(
    (group: KMarker[]) => {
      if (!map || !kakao?.maps || !group || group.length <= 1) return;
      const proj = map.getProjection();
      const center = group[0].__basePos;
      const cpt = proj.containerPointFromCoords(center);
      const N = group.length;
      const GAP = 26;
      const totalW = GAP * (N - 1);
      const startX = cpt.x - totalW / 2;
      const y = cpt.y;
      for (let i = 0; i < N; i++) {
        const pt = new kakao.maps.Point(startX + i * GAP, y);
        const pos = proj.coordsFromContainerPoint(pt);
        group[i].setPosition(pos);
      }
    },
    [kakao?.maps, map],
  );

  const applyStaticSeparationAll = useCallback(() => {
    if (!map || !kakao?.maps) return;
    groupsRef.current.forEach((group) => layoutMarkersSideBySide(group));
  }, [kakao?.maps, map, layoutMarkersSideBySide]);

  const orderAndApplyZIndex = useCallback((arr: KMarker[]) => {
    if (!arr || arr.length <= 1) return arr;
    const TOP = 100000;
    for (let i = 0; i < arr.length; i++) {
      try {
        arr[i].setZIndex?.(TOP - i);
      } catch {}
    }
    return arr;
  }, []);

  const applyGroupPrioritiesMap = useCallback(
    (groups: Map<string, KMarker[]>) => {
      groups.forEach((list) => orderAndApplyZIndex(list));
    },
    [orderAndApplyZIndex],
  );

  async function refreshInBounds() {
    if (!kakao?.maps || !map || !clusterer) return;

    const bounds = map.getBounds?.();
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
    const imgs = markerImages(kakao.maps);

    const nowKeys = new Set<string>();
    const groups = new Map<string, KMarker[]>();

    const buildCacheKey = (row: PlaceRow) => {
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

      const cacheKey = buildCacheKey(row);
      const rowKey = buildRowKeyFromRow(row);
      nowKeys.add(cacheKey);

      let mk = markerCacheRef.current.get(cacheKey);
      const lat = Number(row.lat),
        lng = Number(row.lng);
      const pos = new kakao.maps.LatLng(lat, lng);
      const nameText = String(getField(row, ["단지명", "name", "아파트명"]) || "");

      if (!mk) {
        const isExternallySelected = (externalSelectedRowKeys ?? []).includes(rowKey);
        mk = new kakao.maps.Marker({
          position: pos,
          title: nameText,
          image: isExternallySelected ? imgs.yellow : imgs.purple,
        });
        mk.__key = cacheKey;
        mk.__basePos = pos;
        mk.__row = row;

        kakao.maps.event.addListener(mk, "click", () => {
          const sel = toSelected(rowKey, row, lat, lng);
          // 클릭된 마커 비주얼 갱신
          if (lastClickedRef.current && lastClickedRef.current !== mk) {
            const prev = lastClickedRef.current;
            const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
            prev.setImage((externalSelectedRowKeys ?? []).includes(prevRowKey) ? imgs.yellow : imgs.purple);
          }
          mk.setImage(imgs.clicked);
          lastClickedRef.current = mk;
          applyStaticSeparationAll();
          onSelect(sel);
        });

        markerCacheRef.current.set(cacheKey, mk);
        toAdd.push(mk);
      } else {
        mk.setPosition(pos);
        if (mk.getTitle?.() !== nameText) mk.setTitle?.(nameText);
        // 외부선택 반영 + 클릭 유지
        const rowSelected = (externalSelectedRowKeys ?? []).includes(rowKey);
        let imgToUse = rowSelected ? imgs.yellow : imgs.purple;
        if (lastClickedRef.current && lastClickedRef.current.__key === cacheKey) imgToUse = imgs.clicked;
        mk.setImage(imgToUse);
      }

      if (!keyIndexRef.current[rowKey]) keyIndexRef.current[rowKey] = [];
      keyIndexRef.current[rowKey].push(mk);

      const gk = groupKeyFromRow(row);
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk)!.push(mk);

      newMarkers.push(mk);
    });

    if (toAdd.length) clusterer.addMarkers(toAdd);

    const toRemove: KMarker[] = [];
    markerCacheRef.current.forEach((mk, key) => {
      if (!nowKeys.has(key)) {
        toRemove.push(mk);
        markerCacheRef.current.delete(key);
      }
    });
    if (toRemove.length) clusterer.removeMarkers(toRemove);
    if (lastClickedRef.current && toRemove.includes(lastClickedRef.current)) lastClickedRef.current = null;

    applyGroupPrioritiesMap(groups);
    groupsRef.current = groups;
    applyStaticSeparationAll();
  }

  /** ✅ 정확히 해당 rowKey를 선택(상세 열기 + 클릭 비주얼) */
  const selectByRowKey = useCallback(
    (rowKey: string) => {
      const maps = (window as KakaoNS).kakao?.maps;
      if (!maps || !map) return;
      const list = keyIndexRef.current[rowKey];
      if (!list || !list.length) return;

      const mk = list[0];
      const row = mk.__row as PlaceRow;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      const pos = new maps.LatLng(lat, lng);

      // 지도 이동
      try {
        map.setLevel(4);
        map.panTo(pos);
      } catch {}

      const imgs = markerImages(maps);
      // 이전 클릭 복원
      if (lastClickedRef.current && lastClickedRef.current !== mk) {
        const prev = lastClickedRef.current;
        const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
        prev.setImage((externalSelectedRowKeys ?? []).includes(prevRowKey) ? imgs.yellow : imgs.purple);
      }
      // 현재 클릭 강조
      mk.setImage(imgs.clicked);
      lastClickedRef.current = mk;
      applyStaticSeparationAll();

      const sel = toSelected(rowKey, row, lat, lng);
      onSelect(sel);
    },
    [map, onSelect, externalSelectedRowKeys, kakao?.maps, applyStaticSeparationAll],
  );

  /** 기존 호환: 포커스만 하고 선택은 호출자가 처리하고 싶을 때 */
  const focusRowKey = useCallback(
    (rowKey: string) => {
      const maps = (window as KakaoNS).kakao?.maps;
      if (!maps || !map) return;
      const list = keyIndexRef.current[rowKey];
      if (!list || !list.length) return;
      const mk = list[0];
      const row = mk.__row as PlaceRow;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      const pos = new maps.LatLng(lat, lng);
      try {
        map.setLevel(4);
        map.panTo(pos);
      } catch {}
    },
    [map, kakao?.maps],
  );

  // 맵 idle 시 자동 로딩
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const listener = kakao.maps.event.addListener(map, "idle", async () => {
      await refreshInBounds();
      applyStaticSeparationAll();
    });
    // 초기 1회
    setTimeout(() => {
      refreshInBounds().then(() => applyStaticSeparationAll());
    }, 0);
    return () => {
      if (listener && kakao?.maps?.event?.removeListener) {
        try {
          kakao.maps.event.removeListener(map, "idle", listener);
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kakao, map, clusterer]);

  return {
    refreshInBounds,
    focusRowKey,
    /** ✅ 장바구니 클릭 시 이걸 쓰면 정확히 해당 단지로 이동 + 상세 열림 */
    selectByRowKey,
  };
}
