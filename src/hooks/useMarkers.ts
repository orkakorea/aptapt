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
  row_uid?: string; // 뷰에서 주는 행 고유 식별자
  row_hash?: string;

  lat?: number | null;
  lng?: number | null;

  name?: string | null;
  product_name?: string | null;
  install_location?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
  city?: string | null;
  district?: string | null;
  updated_at?: string | null;

  households?: number | null;
  residents?: number | null;
  monitors?: number | null;
  monthly_impressions?: number | null;
  cost_per_play?: number | null;
  hours?: string | null;
  address?: string | null;
  monthly_fee?: number | null;
  monthly_fee_y1?: number | null;

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

/** 간단 해시(행 순서 고정용) */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 상품 이미지 매핑(영문+한글 키워드 지원) */
function imageForProduct(productName?: string | null): string {
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

/** 오버스캔/최소 스팬/그룹 소수점 */
const OVERSCAN_RATIO = 0.2;
const MIN_LAT_SPAN = 0.0001;
const MIN_LNG_SPAN = 0.0001;
const GROUP_DECIMALS = 6; // 동일 좌표 그룹핑 정밀도(소수점 6)

/** 배치 파라미터(겹침 분해용) */
const BASE_RADIUS_PX = 16; // 원형 배치 반지름(픽셀)
const RADIUS_GROW_PER_ITEM = 1; // 아이템수에 따른 가중
const CHUNK_ADD = 250; // 마커 추가 배치 크기(성능)

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
  const lastFetchBoundsRef = useRef<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const idleDebounceRef = useRef<number | null>(null);

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

  /** 기본 선택 객체 생성: 목록 응답만으로도 패널을 최대 채움 */
  const toSelectedBase = useCallback((rowKey: string, row: PlaceRow, lat: number, lng: number): SelectedApt => {
    const name =
      (row.name as string) ||
      (getField(row, ["단지명", "단지 명", "아파트명", "apt_name", "aptName", "title"]) as string) ||
      "";

    const productName =
      (row.product_name as string) || (getField(row, ["상품명", "productName", "mediaName"]) as string) || "";

    const rawImage =
      (row.image_url as string | undefined) ||
      (getField(row, ["imageUrl", "image", "thumbnail", "thumb", "thumb_url", "thumbUrl", "이미지", "썸네일"]) as
        | string
        | undefined);

    return {
      rowKey,
      rowId: row.place_id != null ? String(row.place_id) : row.id != null ? String(row.id) : undefined,
      name,
      address: (row.address as string) || "",
      productName,
      installLocation: (row.install_location as string) || undefined,
      households: toNum(row.households),
      residents: toNum(row.residents),
      monitors: toNum(row.monitors),
      monthlyImpressions: toNum(row.monthly_impressions),
      costPerPlay: toNum(row.cost_per_play),
      hours: (row.hours as string) || "",
      monthlyFee: toNum(row.monthly_fee),
      monthlyFeeY1: toNum(row.monthly_fee_y1),
      imageUrl: rawImage || imageForProduct(productName),
      lat,
      lng,
    };
  }, []);

  /** 상세 응답 보강 */
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
      installLocation: (getField(d, ["install_location"]) as string) ?? base.installLocation,
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

  /** 중복 덮어쓰기 방지: row_uid 우선 → place_id+좌표 → 기타 */
  function stableIdKeyFromRow(row: PlaceRow): string {
    const lat = toNum(row.lat);
    const lng = toNum(row.lng);
    const lat5 = Number.isFinite(lat as number) ? (lat as number).toFixed(5) : "x";
    const lng5 = Number.isFinite(lng as number) ? (lng as number).toFixed(5) : "x";

    if (row.row_uid) return `uid:${row.row_uid}`; // ★ 최우선
    if (row.place_id != null) return `pid:${String(row.place_id)}|${lat5},${lng5}`;
    if (row.id != null) return `id:${String(row.id)}|${lat5},${lng5}`;

    const prod = String(getField(row, ["상품명", "productName", "product_name"]) || "");
    const loc = String(getField(row, ["설치위치", "install_location"]) || "");
    const gk = groupKeyFromRow(row);
    return `geo:${lat5},${lng5}|${gk}|${prod}|${loc}`;
  }

  /** 동일 좌표 그룹을 "나란히" 배치하기 위한 보조 구조 */
  type AugRow = PlaceRow & { __posLat: number; __posLng: number };

  function arrangeNonOverlapping(rows: PlaceRow[], maps: any): AugRow[] {
    if (!rows.length) return [];
    const projection = map?.getProjection?.();
    if (!projection) {
      // 프로젝션 없으면 그대로 리턴
      return rows.map((r) => ({ ...r, __posLat: Number(r.lat), __posLng: Number(r.lng) }));
    }

    // 1) 좌표 그룹핑(소수점 6자리)
    const groups = new Map<string, PlaceRow[]>();
    for (const r of rows) {
      const lat = toNum(r.lat);
      const lng = toNum(r.lng);
      if (!Number.isFinite(lat as number) || !Number.isFinite(lng as number)) continue;
      const key = `${(lat as number).toFixed(GROUP_DECIMALS)},${(lng as number).toFixed(GROUP_DECIMALS)}`;
      const arr = groups.get(key);
      if (arr) arr.push(r);
      else groups.set(key, [r]);
    }

    const out: AugRow[] = [];

    // 2) 각 그룹 내에서 원형 배치(항상 같은 순서가 되도록 안정 정렬)
    groups.forEach((grp, key) => {
      const [latS, lngS] = key.split(",").map(Number);
      const baseLL = new kakao.maps.LatLng(latS, lngS);
      const basePt = projection.pointFromCoords(baseLL);
      const n = grp.length;

      if (n === 1) {
        out.push({ ...grp[0], __posLat: latS, __posLng: lngS });
        return;
      }

      // 안정 정렬: row_uid > product_name > install_location > place_id
      const sorted = grp.slice().sort((a, b) => {
        const ak = `${a.row_uid ?? ""}|${a.product_name ?? ""}|${a.install_location ?? ""}|${a.place_id ?? ""}`;
        const bk = `${b.row_uid ?? ""}|${b.product_name ?? ""}|${b.install_location ?? ""}|${b.place_id ?? ""}`;
        if (ak < bk) return -1;
        if (ak > bk) return 1;
        return 0;
      });

      // 반지름: 항목 수에 따라 약간 증가 (픽셀 단위, 줌과 무관)
      const radius = BASE_RADIUS_PX + RADIUS_GROW_PER_ITEM * Math.min(n, 12);

      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n;
        const baseX = typeof (basePt as any).getX === "function" ? (basePt as any).getX() : (basePt as any).x;
        const baseY = typeof (basePt as any).getY === "function" ? (basePt as any).getY() : (basePt as any).y;

        const px = baseX + radius * Math.cos(angle);
        const py = baseY + radius * Math.sin(angle);

        const newLL = projection.coordsFromPoint(new kakao.maps.Point(px, py));
        out.push({ ...sorted[i], __posLat: newLL.getLat(), __posLng: newLL.getLng() });
      }
    });

    return out;
  }

  /** 마커 대량 추가를 한 번에 막지 말고 조각내어 추가(UX 버벅임 완화) */
  async function addMarkersInChunks(toAdd: any[], maps: any) {
    if (!toAdd.length) return;
    let idx = 0;
    while (idx < toAdd.length) {
      const slice = toAdd.slice(idx, idx + CHUNK_ADD);
      try {
        if (clusterer?.addMarkers) clusterer.addMarkers(slice);
        else slice.forEach((m) => m.setMap(map));
      } catch {}
      slice.forEach((mk) => colorByRule(mk));
      idx += CHUNK_ADD;
      // 다음 프레임으로 넘겨 메인스레드 블로킹 방지
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const applyRows = useCallback(
    async (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      // 빈 배열이면서 기존 풀 존재 → 일시적 공백 보호(깜빡임 방지)
      if ((rows?.length ?? 0) === 0 && poolRef.current.size > 0) return;

      // ★ 동일 좌표 그룹을 나란히 배치
      const arranged: AugRow[] = arrangeNonOverlapping(rows, maps);

      const nextIdKeys = new Set<string>();
      const toAdd: any[] = [];
      const toRemove: any[] = [];
      const nextRowKeyIndex = new Map<string, any>();

      for (const row of arranged) {
        if (row.__posLat == null || row.__posLng == null) continue;
        const lat = Number(row.__posLat);
        const lng = Number(row.__posLng);
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
          mk.__row = row; // 원본 행(기본 lat/lng 포함)

          const onClick = async () => {
            const baseSel = toSelectedBase(mk.__rowKey, mk.__row, Number(mk.__row.lat), Number(mk.__row.lng));
            onSelect(baseSel);

            if (lastClickedRef.current && lastClickedRef.current !== mk) colorByRule(lastClickedRef.current);
            lastClickedRef.current = mk;
            colorByRule(mk);

            // 상세 RPC (모바일 B 전용). 에러는 로깅만.
            const pidText =
              mk.__row?.place_id != null
                ? String(mk.__row.place_id)
                : mk.__row?.id != null
                  ? String(mk.__row.id)
                  : undefined;

            if (pidText) {
              mk.__detailVer = (mk.__detailVer || 0) + 1;
              const myVer = mk.__detailVer;
              try {
                const { data, error } = await (supabase as any).rpc("get_public_place_detail_b", {
                  p_place_id: pidText,
                });
                if (error) {
                  console.warn("[useMarkers] detail rpc (mobile B) error:", error.message);
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
        // ★ 한 번에 안 넣고 조각 추가 → 버벅임/로딩지연 체감 개선
        await addMarkersInChunks(toAdd, maps);
      }

      // 제거 대상만 정리
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

  /** 바운드 내 데이터 요청 (B 단독 public_map_places) */
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

    // ★ 불필요 재요청 방지: 이전 쿼리 영역이 새 영역을 충분히 포함하면 스킵
    const last = lastFetchBoundsRef.current;
    if (last && minLat >= last.minLat && maxLat <= last.maxLat && minLng >= last.minLng && maxLng <= last.maxLng) {
      return;
    }

    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    const myVersion = ++requestVersionRef.current;

    try {
      const { data, error } = await (supabase as any)
        .from("public_map_places")
        .select(
          [
            "place_id",
            "row_uid", // 키 충돌 방지용
            "name",
            "product_name",
            "install_location",
            "lat",
            "lng",
            "image_url",
            "is_active",
          ].join(","),
        )
        .eq("is_active", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", minLat)
        .lte("lat", maxLat)
        .gte("lng", minLng)
        .lte("lng", maxLng)
        // .order("updated_at", { ascending: false })  // 정렬은 비용이 커서 제거
        .limit(10000); // 넉넉히

      if (myVersion !== requestVersionRef.current) return;
      if (error) {
        console.error("Supabase(public_map_places) error:", error.message);
        return;
      }

      lastFetchBoundsRef.current = { minLat, maxLat, minLng, maxLng };

      const rows: PlaceRow[] = (data ?? []).map((r: any) => ({
        place_id: r.place_id,
        row_uid: r.row_uid,
        lat: r.lat,
        lng: r.lng,
        name: r.name ?? undefined,
        product_name: r.product_name,
        install_location: r.install_location,
        image_url: r.image_url,
        is_active: r.is_active,
      }));

      if (rows.length === 0) {
        emptyStreakRef.current += 1;
        if (emptyStreakRef.current < 2 && poolRef.current.size > 0) return;
      } else {
        emptyStreakRef.current = 0;
      }

      await applyRows(rows);
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [applyRows, kakao, map]);

  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const handleIdle = () => {
      // ★ idle 이벤트 디바운스(과잉 호출 방지)
      if (idleDebounceRef.current) window.clearTimeout(idleDebounceRef.current);
      idleDebounceRef.current = window.setTimeout(() => {
        refreshInBounds();
      }, 200);
    };

    maps.event.addListener(map, "idle", handleIdle);
    // 첫 페인트
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
      if (idleDebounceRef.current) window.clearTimeout(idleDebounceRef.current);
      idleDebounceRef.current = null;
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

      const pidText = row.place_id != null ? String(row.place_id) : row.id != null ? String(row.id) : undefined;

      if (pidText) {
        mk.__detailVer = (mk.__detailVer || 0) + 1;
        const myVer = mk.__detailVer;
        try {
          const { data, error } = await (supabase as any).rpc("get_public_place_detail_b", {
            p_place_id: pidText,
          });
          if (error) {
            console.warn("[useMarkers] detail rpc (mobile B) error:", error.message);
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
