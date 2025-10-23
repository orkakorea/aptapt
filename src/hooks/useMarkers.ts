import { useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRowKeyFromRow, groupKeyFromRow } from "@/core/map/rowKey";

type PlaceRow = {
  id?: number | string;
  lat?: number | null;
  lng?: number | null;
  [k: string]: any;
};

type SelectedApt = {
  rowKey: string;
  rowId?: string;
  name: string;
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
  const markerCacheRef = useRef<Map<string, any>>(new Map()); // key: unique per row
  const keyIndexRef = useRef<Record<string, any[]>>({});
  const groupsRef = useRef<Map<string, any[]>>(new Map());
  const lastClickedRef = useRef<any | null>(null);

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

  // 선택 상태 반영(색상 전환)
  useEffect(() => {
    if (!imgs) return;
    Object.entries(keyIndexRef.current).forEach(([rowKey, mks]) => {
      const selected = externalSelectedRowKeys.includes(rowKey);
      mks.forEach((mk) => {
        try {
          mk.setImage(selected ? imgs.yellow : imgs.purple);
        } catch {}
      });
    });
  }, [externalSelectedRowKeys, imgs]);

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

  const addMarkers = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      const nowKeys = new Set<string>();
      const newToAdd: any[] = [];
      const newMarkers: any[] = [];
      const groups = new Map<string, any[]>();
      keyIndexRef.current = {};

      const mkTitle = (row: PlaceRow) => String(getField(row, ["단지명", "name", "아파트명"]) || "");

      rows.forEach((row) => {
        if (row.lat == null || row.lng == null) return;

        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const idPart = row.id != null ? String(row.id) : "";
        const prod = String(getField(row, ["상품명", "productName"]) || "");
        const loc = String(getField(row, ["설치위치", "installLocation"]) || "");
        const key = `${lat.toFixed(7)},${lng.toFixed(7)}|${idPart}|${prod}|${loc}`;
        const rowKey = buildRowKeyFromRow(row);

        nowKeys.add(key);

        let mk = markerCacheRef.current.get(key);
        const pos = new maps.LatLng(lat, lng);
        const title = mkTitle(row);

        if (!mk) {
          try {
            mk = new maps.Marker({
              position: pos,
              title,
              image: externalSelectedRowKeys.includes(rowKey) ? imgs.yellow : imgs.purple,
            });
          } catch {
            return;
          }
          mk.__key = key;
          mk.__row = row;

          maps.event.addListener(mk, "click", () => {
            const sel = toSelected(rowKey, row, lat, lng);
            onSelect(sel);
            try {
              if (lastClickedRef.current && lastClickedRef.current !== mk) {
                const prev = lastClickedRef.current;
                const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
                prev.setImage(externalSelectedRowKeys.includes(prevRowKey) ? imgs.yellow : imgs.purple);
              }
              mk.setImage(imgs.clicked);
              lastClickedRef.current = mk;
            } catch {}
          });

          markerCacheRef.current.set(key, mk);
          newToAdd.push(mk);
        } else {
          try {
            mk.setPosition(pos);
            if (mk.getTitle?.() !== title) mk.setTitle?.(title);
            const img = externalSelectedRowKeys.includes(rowKey) ? imgs.yellow : imgs.purple;
            mk.setImage(img);
          } catch {}
        }

        if (!keyIndexRef.current[rowKey]) keyIndexRef.current[rowKey] = [];
        keyIndexRef.current[rowKey].push(mk);

        const gk = groupKeyFromRow(row);
        if (!groups.has(gk)) groups.set(gk, []);
        groups.get(gk)!.push(mk);

        newMarkers.push(mk);
      });

      if (newToAdd.length) {
        try {
          if (clusterer) clusterer.addMarkers(newToAdd);
          else newToAdd.forEach((m) => m.setMap(map));
        } catch {}
      }

      const toRemove: any[] = [];
      markerCacheRef.current.forEach((mk, key) => {
        if (!nowKeys.has(key)) {
          toRemove.push(mk);
          markerCacheRef.current.delete(key);
        }
      });
      if (toRemove.length) {
        try {
          if (clusterer) clusterer.removeMarkers(toRemove);
          else toRemove.forEach((m) => m.setMap(null));
        } catch {}
      }

      groupsRef.current = groups;
    },
    [clusterer, externalSelectedRowKeys, imgs, kakao, map, onSelect, toSelected],
  );

  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    const bounds = map.getBounds?.();
    if (!bounds) return;

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
    addMarkers((data ?? []) as PlaceRow[]);
  }, [addMarkers, kakao, map]);

  // idle 이벤트에서 갱신
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;
    const h = maps.event.addListener(map, "idle", () => {
      refreshInBounds();
    });
    // 최초 1회
    refreshInBounds();
    return () => {
      try {
        maps.event.removeListener(h);
      } catch {}
    };
  }, [kakao, map, refreshInBounds]);

  const selectByRowKey = useCallback(
    (rowKey: string) => {
      const arr = keyIndexRef.current[rowKey];
      if (!arr?.length || !kakao?.maps || !map) return;
      const mk = arr[0];
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
      try {
        if (lastClickedRef.current && lastClickedRef.current !== mk) {
          const prev = lastClickedRef.current;
          const prevRowKey = buildRowKeyFromRow(prev.__row as PlaceRow);
          prev.setImage(externalSelectedRowKeys.includes(prevRowKey) ? imgs?.yellow : imgs?.purple);
        }
        mk.setImage(imgs?.clicked);
        lastClickedRef.current = mk;
      } catch {}
    },
    [externalSelectedRowKeys, kakao, map, onSelect, toSelected, imgs],
  );

  return { refreshInBounds, selectByRowKey };
}
