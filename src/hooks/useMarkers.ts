import { useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRowKeyFromRow, groupKeyFromRow } from "@/core/map/rowKey";
import type { SelectedApt } from "@/core/types";

/* =========================================================================
 * 로컬 유틸
 * ========================================================================= */
type PlaceRow = {
  id?: number | string;
  place_id?: number | string;
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

/** 상품 이미지 매핑(영문+한글 키워드 지원) */
function imageForProduct(productName?: string): string {
  const raw = productName || "";
  const lower = raw.toLowerCase();
  const compactLower = lower.replace(/\s+/g, "");
  const compact = raw.replace(/\s+/g, "");

  if (
    compactLower.includes("elevat") ||
    compact.includes("엘리베이터") ||
    compact.includes("엘티비") ||
    compact.includes("엘리베이터tv")
  ) {
    return "/products/elevator-tv.png";
  }
  if (compactLower.includes("townbord") || compactLower.includes("townboard") || compact.includes("타운보드")) {
    if (compactLower.includes("_l") || compactLower.endsWith("l") || compact.endsWith("L")) {
      return "/products/townbord-b.png";
    }
    return "/products/townbord-a.png";
  }
  if (
    compactLower.includes("mediameet") ||
    (compactLower.includes("media") && compactLower.includes("meet")) ||
    compact.includes("미디어밋") ||
    compact.includes("미디어미트")
  ) {
    return "/products/media-meet-a.png";
  }
  if (compactLower.includes("spaceliving") || compactLower.includes("space") || compact.includes("스페이스리빙")) {
    return "/products/space-living.png";
  }
  if (
    compactLower.includes("hipost") ||
    (compactLower.includes("hi") && compactLower.includes("post")) ||
    compact.includes("하이포스트")
  ) {
    return "/products/hi-post.png";
  }
  return "/products/elevator-tv.png"; // 최종 폴백
}

type MarkerState = "purple" | "yellow" | "clicked";

/** 오버스캔/최소 스팬 */
const OVERSCAN_RATIO = 0.2;
const MIN_LAT_SPAN = 0.0001;
const MIN_LNG_SPAN = 0.0001;

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
  const poolRef = useRef<Map<string, any>>(new Map());
  const rowKeyIndexRef = useRef<Map<string, any>>(new Map());
  const lastClickedRef = useRef<any | null>(null);

  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedSetRef.current = new Set(externalSelectedRowKeys);
  }, [externalSelectedRowKeys]);

  const fetchInFlightRef = useRef(false);
  const requestVersionRef = useRef(0);
  const emptyStreakRef = useRef(0);

  const imgs = useMemo(() => {
    if (!kakao?.maps) return null;
    const { maps } = kakao;
    const mk = (url: string, size: number) =>
      new maps.MarkerImage(url, new maps.Size(size, size), { offset: new maps.Point(size / 2, size) });
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

  const colorByRule = useCallback(
    (mk: any) => {
      if (!mk) return;
      const rowKey = mk.__rowKey as string | undefined;
      const isSelected = !!rowKey && selectedSetRef.current.has(rowKey);
      if (isSelected) return setMarkerState(mk, "yellow");
      if (lastClickedRef.current === mk) return setMarkerState(mk, "clicked");
      setMarkerState(mk, "purple");
    },
    [setMarkerState],
  );

  /** 기본 선택 객체 생성: 이미지 키를 넓게 탐색 */
  const toSelectedBase = useCallback((rowKey: string, row: PlaceRow, lat: number, lng: number): SelectedApt => {
    const name = getField(row, ["단지명", "단지 명", "name", "아파트명", "apt_name", "aptName", "title"]) || "";
    const productName = getField(row, ["상품명", "productName", "product_name", "mediaName"]) || "";
    const rawImage =
      getField(row, [
        "imageUrl",
        "image_url",
        "image",
        "thumbnail",
        "thumb",
        "thumb_url",
        "thumbUrl",
        "이미지",
        "썸네일",
      ]) || undefined;

    return {
      rowKey,
      rowId: row.id != null ? String(row.id) : row.place_id != null ? String(row.place_id) : undefined,
      name,
      address: "",
      productName,
      installLocation: undefined,
      households: undefined,
      residents: undefined,
      monitors: undefined,
      monthlyImpressions: undefined,
      costPerPlay: undefined,
      hours: "",
      monthlyFee: undefined,
      monthlyFeeY1: undefined,
      imageUrl: rawImage || imageForProduct(productName),
      lat,
      lng,
    };
  }, []);

  /** 상세 응답 보강: 이미지/이름/상품명도 보강 */
  const enrichWithDetail = useCallback((base: SelectedApt, d: any): SelectedApt => {
    const detailName = (getField(d, ["name"]) as string) ?? (getField(d, ["apt_name"]) as string);
    const detailProduct =
      (getField(d, ["product_name"]) as string) ?? (getField(d, ["productName"]) as string) ?? base.productName;

    const detailImage =
      (getField(d, ["imageUrl", "image_url", "image", "thumbnail", "thumb", "thumb_url", "thumbUrl"]) as string) ??
      base.imageUrl;

    return {
      ...base,
      name: detailName ?? base.name,
      productName: detailProduct,
      imageUrl: detailImage ?? imageForProduct(detailProduct),
      installLocation:
        toNum(getField(d, ["install_location"])) != null
          ? (getField(d, ["install_location"]) as any)
          : (d.install_location ?? base.installLocation),
      households: toNum(getField(d, ["households"])) ?? base.households,
      residents: toNum(getField(d, ["residents"])) ?? base.residents,
      monitors: toNum(getField(d, ["monitors"])) ?? base.monitors,
      monthlyImpressions: toNum(getField(d, ["monthly_impressions"])) ?? base.monthlyImpressions,
      costPerPlay: toNum(getField(d, ["cost_per_play"])) ?? base.costPerPlay,
      hours: (getField(d, ["hours"]) as string) ?? base.hours,
      address: (getField(d, ["address"]) as string) ?? base.address,
      monthlyFee: toNum(getField(d, ["monthly_fee"])) ?? base.monthlyFee,
      monthlyFeeY1: toNum(getField(d, ["monthly_fee_y1"])) ?? base.monthlyFeeY1,
      lat: toNum(getField(d, ["lat"])) ?? base.lat,
      lng: toNum(getField(d, ["lng"])) ?? base.lng,
    };
  }, []);

  function stableIdKeyFromRow(row: PlaceRow): string {
    if (row.id != null) return `id:${String(row.id)}`;
    if (row.place_id != null) return `pid:${String(row.place_id)}`;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const lat5 = Number.isFinite(lat) ? lat.toFixed(5) : "x";
    const lng5 = Number.isFinite(lng) ? lng.toFixed(5) : "x";
    const prod = String(getField(row, ["상품명", "productName", "product_name"]) || "");
    const loc = String(getField(row, ["설치위치", "installLocation"]) || "");
    const gk = groupKeyFromRow(row);
    return `geo:${lat5},${lng5}|${gk}|${prod}|${loc}`;
  }

  const applyRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      // 빈 배열이면서 기존 풀 존재 → 일시적 공백 보호
      if ((rows?.length ?? 0) === 0 && poolRef.current.size > 0) return;

      const nextIdKeys = new Set<string>();
      const toAdd: any[] = [];
      const toRemove: any[] = [];
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
        const title = String(getField(row, ["단지명", "name", "아파트명", "apt_name", "title"]) || "");

        let mk = poolRef.current.get(idKey);
        if (!mk) {
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

          const onClick = async () => {
            const baseSel = toSelectedBase(mk.__rowKey, mk.__row, lat, lng);
            onSelect(baseSel);

            if (lastClickedRef.current && lastClickedRef.current !== mk) colorByRule(lastClickedRef.current);
            lastClickedRef.current = mk;
            colorByRule(mk);

            const pid = Number(mk.__row?.place_id ?? mk.__row?.id);
            if (Number.isFinite(pid)) {
              mk.__detailVer = (mk.__detailVer || 0) + 1;
              const myVer = mk.__detailVer;
              try {
                const { data, error } = await (supabase as any).rpc("get_public_place_detail", { p_place_id: pid });
                if (error) {
                  console.warn("[useMarkers] detail rpc error:", error.message);
                  return;
                }
                const d = (data && (Array.isArray(data) ? data[0] : data)) || null;
                if (!d) return;
                if (mk.__detailVer !== myVer) return;

                mk.__row = { ...mk.__row, ...d };
                onSelect(enrichWithDetail(baseSel, d));
              } catch (e) {
                console.warn("[useMarkers] detail fetch failed:", e);
              }
            }
          };
          mk.__onClick = onClick as any;
          maps.event.addListener(mk, "click", onClick);

          poolRef.current.set(idKey, mk);
          toAdd.push(mk);
        } else {
          try {
            const oldPos = mk.getPosition?.();
            if (!oldPos || oldPos.getLat() !== lat || oldPos.getLng() !== lng) mk.setPosition(pos);
            if (mk.getTitle?.() !== title) mk.setTitle?.(title);
          } catch {}
          mk.__rowKey = rowKey;
          mk.__row = row;
          colorByRule(mk);
        }

        nextRowKeyIndex.set(rowKey, mk);
      }

      if (toAdd.length) {
        try {
          if (clusterer?.addMarkers) clusterer.addMarkers(toAdd);
          else toAdd.forEach((m) => m.setMap(map));
        } catch {}
        toAdd.forEach((mk) => colorByRule(mk));
      }

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
        try {
          toRemove.forEach((mk) => kakao.maps.event.removeListener(mk, "click", mk.__onClick));
        } catch {}
      }

      rowKeyIndexRef.current = nextRowKeyIndex;
    },
    [clusterer, colorByRule, imgs, kakao, map, onSelect, toSelectedBase, enrichWithDetail],
  );

  /** 바운드 내 데이터 요청 — ✅ 모바일 목록 RPC(get_public_map_places_v2) 사용 */
  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    const kbounds = map.getBounds?.();
    if (!kbounds) return;

    const sw = kbounds.getSouthWest();
    const ne = kbounds.getNorthEast();

    const latSpan = Math.abs(ne.getLat() - sw.getLat());
    const lngSpan = Math.abs(ne.getLng() - sw.getLng());
    if (latSpan < MIN_LAT_SPAN || lngSpan < MIN_LNG_SPAN) return;

    const latPad = (ne.getLat() - sw.getLat()) * OVERSCAN_RATIO;
    const lngPad = (ne.getLng() - sw.getLng()) * OVERSCAN_RATIO;
    const minLat = Math.min(sw.getLat(), ne.getLat()) - latPad;
    const maxLat = Math.max(sw.getLat(), ne.getLat()) + latPad;
    const minLng = Math.min(sw.getLng(), ne.getLng()) - lngPad;
    const maxLng = Math.max(sw.getLng(), ne.getLng()) + lngPad;

    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    const myVersion = ++requestVersionRef.current;

    try {
      // 🔁 from(...) → rpc(...) 로 교체 (서버에서 필터/정렬/LIMIT 강제)
      const { data, error } = await (supabase as any).rpc("get_public_map_places_v2", {
        p_min_lat: minLat,
        p_max_lat: maxLat,
        p_min_lng: minLng,
        p_max_lng: maxLng,
        p_limit: 5000,
      });

      if (myVersion !== requestVersionRef.current) return;
      if (error) {
        console.error("Supabase(get_public_map_places_v2) error:", error.message);
        return;
      }

      const rows: PlaceRow[] = (data ?? []).map((r: any) => ({
        place_id: r.place_id, // text (숫자 문자열이면 Number(...)로 사용 가능)
        lat: r.lat,
        lng: r.lng,
        name: r.name ?? undefined,
        product_name: r.product_name, // 서버에서 이미 "ELEVATOR TV"로 정규화됨
        productName: r.product_name,
        image_url: r.image_url,
        city: r.city,
        district: r.district,
        updated_at: r.updated_at,
      }));

      if (rows.length === 0) {
        emptyStreakRef.current += 1;
        if (emptyStreakRef.current < 2 && poolRef.current.size > 0) return;
      } else {
        emptyStreakRef.current = 0;
      }

      applyRows(rows);
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [applyRows, kakao, map]);

  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const handleIdle = () => refreshInBounds();
    maps.event.addListener(map, "idle", handleIdle);

    requestAnimationFrame(() => refreshInBounds());

    return () => {
      try {
        maps.event.removeListener(map, "idle", handleIdle);
      } catch {}
      const all: any[] = [];
      poolRef.current.forEach((mk) => all.push(mk));
      try {
        if (clusterer?.removeMarkers) clusterer.removeMarkers(all);
        else all.forEach((m) => m.setMap(null));
      } catch {}
      try {
        all.forEach((mk) => kakao.maps.event.removeListener(mk, "click", mk.__onClick));
      } catch {}
      poolRef.current.clear();
      rowKeyIndexRef.current.clear();
      lastClickedRef.current = null;
    };
  }, [kakao, map, refreshInBounds, clusterer]);

  const selectByRowKey = useCallback(
    async (rowKey: string) => {
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

      const baseSel = toSelectedBase(rowKey, row, lat, lng);
      onSelect(baseSel);

      if (lastClickedRef.current && lastClickedRef.current !== mk) colorByRule(lastClickedRef.current);
      lastClickedRef.current = mk;
      colorByRule(mk);

      const pid = Number(mk.__row?.place_id ?? mk.__row?.id);
      if (Number.isFinite(pid)) {
        mk.__detailVer = (mk.__detailVer || 0) + 1;
        const myVer = mk.__detailVer;
        try {
          const { data, error } = await (supabase as any).rpc("get_public_place_detail", { p_place_id: pid });
          if (error) {
            console.warn("[useMarkers] detail rpc error:", error.message);
            return;
          }
          const d = (data && (Array.isArray(data) ? data[0] : data)) || null;
          if (!d) return;
          if (mk.__detailVer !== myVer) return;

          mk.__row = { ...mk.__row, ...d };
          onSelect(enrichWithDetail(baseSel, d));
        } catch (e) {
          console.warn("[useMarkers] detail fetch failed:", e);
        }
      }
    },
    [colorByRule, enrichWithDetail, kakao, map, onSelect, toSelectedBase],
  );

  return { refreshInBounds, selectByRowKey };
}
