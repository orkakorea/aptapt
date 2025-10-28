// src/hooks/useMarkers.ts
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

/** 오버스캔 비율(조회 영역 확대) — 너무 크지 않게 */
const OVERSCAN_RATIO = 0.2;
/** 바운드가 비정상적으로 작은 경우 fetch 스킵 */
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
  /** 풀/인덱스/상태 */
  const poolRef = useRef<Map<string, any>>(new Map()); // idKey -> Marker
  const rowKeyIndexRef = useRef<Map<string, any>>(new Map()); // rowKey -> Marker
  const lastClickedRef = useRef<any | null>(null);

  /** 선택 집합을 ref로 보관 */
  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedSetRef.current = new Set(externalSelectedRowKeys);
  }, [externalSelectedRowKeys]);

  /** 중복요청/빈결과 가드 */
  const fetchInFlightRef = useRef(false);
  const requestVersionRef = useRef(0);
  const emptyStreakRef = useRef(0);

  /** 마커 이미지 */
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

  /** 공통 컬러링 규칙 */
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

  /** 행 -> SelectedApt (snake_case도 지원) */
  const toSelected = useCallback((rowKey: string, row: PlaceRow, lat: number, lng: number): SelectedApt => {
    const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
    const address = getField(row, ["주소", "도로명주소", "지번주소", "address"]) || "";
    const productName = getField(row, ["상품명", "productName", "product_name"]) || "";

    // ⚠️ snake_case 컬럼도 포함
    const installLocation = getField(row, ["설치위치", "installLocation", "install_location"]) || "";

    const households = toNum(getField(row, ["세대수", "households"]));
    const residents = toNum(getField(row, ["거주인원", "residents"]));
    const monitors = toNum(getField(row, ["모니터수량", "monitors"]));
    const monthlyImpressions = toNum(getField(row, ["월송출횟수", "monthlyImpressions", "monthly_impressions"]));
    const monthlyFee = toNum(getField(row, ["월광고료", "month_fee", "monthly_fee", "monthlyFee"]));
    const monthlyFeeY1 = toNum(
      getField(row, ["1년 계약 시 월 광고료", "연간월광고료", "monthlyFeeY1", "monthly_fee_y1"]),
    );
    const costPerPlay = toNum(getField(row, ["1회당 송출비용", "costPerPlay", "cost_per_play"]));
    const hours = getField(row, ["운영시간", "hours"]) || "";
    const rawImage = getField(row, ["imageUrl", "이미지", "썸네일", "thumbnail", "image_url"]) || undefined;

    return {
      rowKey,
      rowId: row.id != null ? String(row.id) : row.place_id != null ? String(row.place_id) : undefined,
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
      imageUrl: rawImage || imageForProduct(String(productName)),
      lat,
      lng,
    };
  }, []);

  /** 상세 로드(RPC) → 선택 갱신 */
  const enrichAndReselect = useCallback(
    async (mk: any) => {
      if (!mk || !kakao?.maps) return;

      const row: PlaceRow = mk.__row || {};
      // public_map_places는 place_id, get_public_map_places RPC는 id(=raw_places.id)를 줄 수 있음
      const pid = row.place_id ?? row.id;
      if (pid == null) return;

      try {
        // 1) 함수 호출 (SETOF 반환 가정 → 첫 행 사용)
        const { data, error } = await (supabase as any).rpc("get_public_place_detail", {
          place_id: Number(pid),
        });

        let det: any | undefined = undefined;
        if (!error && data) det = Array.isArray(data) ? data[0] : data;

        // 2) 백업: 실패 시 raw_places 직접 조회(권한이 있으면)
        if (!det) {
          const { data: bkp } = await (supabase as any)
            .from("raw_places")
            .select(
              'id, "설치위치", "세대수", "거주인원", "모니터수량", "월송출횟수", "월광고료", "1회당 송출비용", "운영시간", "주소"',
            )
            .eq("id", Number(pid))
            .limit(1)
            .maybeSingle();
          det = bkp || undefined;
        }

        if (!det) return;

        // mk.__row에 상세 머지(영문 snake_case → 앱에서 쓰는 키도 같이 보유)
        const merged: PlaceRow = {
          ...row,
          // 표준화된 snake_case를 그대로 보관
          install_location: det.install_location ?? det["설치위치"],
          households: det.households ?? det["세대수"],
          residents: det.residents ?? det["거주인원"],
          monitors: det.monitors ?? det["모니터수량"],
          monthly_impressions: det.monthly_impressions ?? det["월송출횟수"],
          monthly_fee: det.monthly_fee ?? det["월광고료"],
          monthly_fee_y1: det.monthly_fee_y1,
          cost_per_play: det.cost_per_play ?? det["1회당 송출비용"],
          hours: det.hours ?? det["운영시간"],
          address: det.address ?? det["주소"],
          image_url: det.image_url ?? row.image_url,
          lat: det.lat ?? row.lat,
          lng: det.lng ?? row.lng,
        };

        mk.__row = merged;

        const lat = Number(merged.lat);
        const lng = Number(merged.lng);
        const sel = toSelected(mk.__rowKey, merged, lat, lng);
        onSelect(sel);
      } catch {
        // 무시(최초 클릭으로 보여주는 기본 정보는 이미 표시됨)
      }
    },
    [kakao, onSelect, toSelected],
  );

  /** 안정키: row.id 우선, 없으면 좌표 5자리 + 그룹/상품/설치 */
  function stableIdKeyFromRow(row: PlaceRow): string {
    if (row.id != null) return `id:${String(row.id)}`;
    if (row.place_id != null) return `id:${String(row.place_id)}`;
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    const lat5 = Number.isFinite(lat) ? lat.toFixed(5) : "x";
    const lng5 = Number.isFinite(lng) ? lng.toFixed(5) : "x";
    const prod = String(getField(row, ["상품명", "productName", "product_name"]) || "");
    const loc = String(getField(row, ["설치위치", "installLocation", "install_location"]) || "");
    const gk = groupKeyFromRow(row);
    return `geo:${lat5},${lng5}|${gk}|${prod}|${loc}`;
  }

  /** DIFF 반영 (오직 새 fetch 결과 기준으로만 추가/제거) */
  const applyRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      if ((rows?.length ?? 0) === 0 && poolRef.current.size > 0) {
        return; // 첫 0건 응답은 무시 → 전마커 보존
      }

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
        const title = String(getField(row, ["단지명", "name", "아파트명"]) || "");

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

          const onClick = () => {
            // 1) 우선 현재 가진 데이터로 보여주기
            const sel0 = toSelected(mk.__rowKey, mk.__row, lat, lng);
            onSelect(sel0);

            // 2) 클릭 상태 컬러
            if (lastClickedRef.current && lastClickedRef.current !== mk) {
              colorByRule(lastClickedRef.current);
            }
            lastClickedRef.current = mk;
            colorByRule(mk);

            // 3) 상세 데이터 비동기 로드 후 다시 갱신
            enrichAndReselect(mk);
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
          toRemove.forEach((mk) => {
            kakao.maps.event.removeListener(mk, "click", mk.__onClick);
          });
        } catch {}
      }

      rowKeyIndexRef.current = nextRowKeyIndex;
    },
    [clusterer, colorByRule, imgs, kakao, map, onSelect, toSelected, enrichAndReselect],
  );

  /** 바운드 내 데이터 요청 + DIFF 반영 */
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
      // 공개 뷰
      const { data, error } = await (supabase as any)
        .from("public_map_places")
        .select("place_id,name,product_name,lat,lng,image_url,is_active,city,district,updated_at")
        .eq("is_active", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", minLat)
        .lte("lat", maxLat)
        .gte("lng", minLng)
        .lte("lng", maxLng)
        .order("updated_at", { ascending: false })
        .limit(5000);

      if (myVersion !== requestVersionRef.current) return;
      if (error) {
        console.error("Supabase(public_map_places) error:", error.message);
        return;
      }

      const rows: PlaceRow[] = (data ?? []).map((r: any) => ({
        id: r.place_id, // 안정 키로 사용
        place_id: r.place_id,
        lat: r.lat,
        lng: r.lng,
        name: r.name,
        productName: r.product_name,
        product_name: r.product_name,
        imageUrl: r.image_url,
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

  /** idle에서만 갱신 + 초기 1회 강제 */
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const handleIdle = () => {
      refreshInBounds();
    };

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
        all.forEach((mk) => {
          kakao.maps.event.removeListener(mk, "click", mk.__onClick);
        });
      } catch {}
      poolRef.current.clear();
      rowKeyIndexRef.current.clear();
      lastClickedRef.current = null;
    };
  }, [kakao, map, refreshInBounds, clusterer]);

  /** 외부 포커스: rowKey로 선택/이동 (+상세 로드) */
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

      if (lastClickedRef.current && lastClickedRef.current !== mk) {
        colorByRule(lastClickedRef.current);
      }
      lastClickedRef.current = mk;
      colorByRule(mk);

      // 포커스 시에도 상세 동기화
      enrichAndReselect(mk);
    },
    [colorByRule, kakao, map, onSelect, toSelected, enrichAndReselect],
  );

  return { refreshInBounds, selectByRowKey };
}
