// path: src/hooks/useMarkers.ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRowKeyFromRow, groupKeyFromRow } from "@/core/map/rowKey";
import type { SelectedApt } from "@/core/types";

/* =========================================================================
 * 마커 PNG (이 3개만 사용)
 * ========================================================================= */
const PIN_PURPLE_URL = "/makers/pin-purple@2x.png"; // 기본
const PIN_YELLOW_URL = "/makers/pin-yellow@2x.png"; // 담김(선택)
const PIN_CLICKED_URL = "/makers/pin-purple@3x.png"; // 클릭 강조(선택 아님일 때만)

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

/** 상품 이미지 매핑(영문+한글 키워드 지원, 설치위치 반영) */
function imageForProduct(productName?: string | null, installLocation?: string | null): string {
  const raw = productName || "";
  const lower = raw.toLowerCase();
  const compactLower = lower.replace(/\s+/g, "");
  const compact = raw.replace(/\s+/g, "");

  const locLower = (installLocation ?? "").replace(/\s+/g, "").toLowerCase();

  // 엘리베이터 TV 계열
  if (
    compactLower.includes("elevat") ||
    compact.includes("엘리베이터") ||
    compact.includes("엘티비") ||
    compact.includes("엘리베이터tv")
  ) {
    return "/products/elevator-tv.png";
  }

  // 타운보드: 설치위치 우선 → 없으면 기존 S/L 규칙 사용
  if (compactLower.includes("townbord") || compactLower.includes("townboard") || compact.includes("타운보드")) {
    if (locLower.includes("ev내부")) {
      // EV 내부
      return "/products/townbord-a.png";
    }
    if (locLower.includes("ev대기공간") || locLower.includes("ev대기") || locLower.includes("대기공간")) {
      // EV 대기공간
      return "/products/townbord-b.png";
    }

    // 설치위치 없으면 기존 사이즈 패턴 유지
    if (compactLower.includes("_l") || compactLower.endsWith("l") || compact.endsWith("L")) {
      return "/products/townbord-b.png";
    }
    return "/products/townbord-a.png";
  }

  // 미디어밋: 설치위치에 따라 A/B 분리
  if (
    compactLower.includes("mediameet") ||
    (compactLower.includes("media") && compactLower.includes("meet")) ||
    compact.includes("미디어밋") ||
    compact.includes("미디어미트")
  ) {
    if (locLower.includes("ev내부")) {
      return "/products/media-meet-a.png";
    }
    if (locLower.includes("ev대기공간") || locLower.includes("ev대기") || locLower.includes("대기공간")) {
      return "/products/media-meet-b.png";
    }
    // 기본값: 내부 타입으로
    return "/products/media-meet-a.png";
  }

  // 스페이스리빙
  if (compactLower.includes("spaceliving") || compactLower.includes("space") || compact.includes("스페이스리빙")) {
    return "/products/space-living.png";
  }

  // 하이포스트
  if (
    compactLower.includes("hipost") ||
    (compactLower.includes("hi") && compactLower.includes("post")) ||
    compact.includes("하이포스트")
  ) {
    return "/products/hi-post.png";
  }

  // 최종 폴백
  return "/products/elevator-tv.png";
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

/** 청크 사이즈(동적) */
function chunkSizeForMap(map: any): number {
  const lvl = map?.getLevel?.();
  if (typeof lvl !== "number") return 600;
  if (lvl <= 4) return 400;
  if (lvl <= 6) return 600;
  return 800;
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
  // 퀵담기 관련 파라미터는 시그니처 호환만 유지(이미지 오버레이/팩토리 사용 없음)
  quickAddEnabled = false,
  onQuickToggle,
}: {
  kakao: any;
  map: any;
  clusterer?: any | null;
  onSelect: (apt: SelectedApt) => void;
  externalSelectedRowKeys?: string[];
  quickAddEnabled?: boolean;
  onQuickToggle?: (rowKey: string, apt: SelectedApt, currentlySelected: boolean) => void;
}) {
  // 시그니처 호환(내부에서 onQuickToggle은 사용하지 않음. 상위에서 토글 처리)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void onQuickToggle;

  const poolRef = useRef<Map<string, any>>(new Map());
  const rowKeyIndexRef = useRef<Map<string, any>>(new Map());
  const lastClickedRef = useRef<any | null>(null);

  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedSetRef.current = new Set(externalSelectedRowKeys);
  }, [externalSelectedRowKeys]);

  // 퀵담기 모드 최신값(ref) — 마커 onClick/색칠에서 사용
  const quickAddEnabledRef = useRef<boolean>(!!quickAddEnabled);
  useEffect(() => {
    quickAddEnabledRef.current = !!quickAddEnabled;
  }, [quickAddEnabled]);

  // onSelect ref 고정(재렌더 영향 제거)
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // clusterer ref 고정
  const clustererRef = useRef<any | null>(clusterer ?? null);
  useEffect(() => {
    clustererRef.current = clusterer ?? null;
  }, [clusterer]);

  const fetchInFlightRef = useRef(false);
  const requestVersionRef = useRef(0);
  const emptyStreakRef = useRef(0);
  const lastFetchBoundsRef = useRef<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const idleDebounceRef = useRef<number | null>(null);

  /* ===== 상품명 / 설치위치 필터 상태 (공용) ===== */
  type MarkerFilterState = {
    productNames: Set<string> | null; // null = 필터 없음(전부 허용)
    installLocations: Set<string> | null; // null = 필터 없음(전부 허용)
  };

  const filterStateRef = useRef<MarkerFilterState>({
    productNames: null,
    installLocations: null,
  });

  const imgs = useMemo(() => {
    if (!kakao?.maps) return null;
    const { maps } = kakao;
    const mk = (url: string, size: number) =>
      new maps.MarkerImage(url, new maps.Size(size, size), { offset: new maps.Point(size / 2, size) });
    try {
      return {
        purple: mk(PIN_PURPLE_URL, 51),
        yellow: mk(PIN_YELLOW_URL, 51),
        clicked: mk(PIN_CLICKED_URL, 51),
      };
    } catch {
      return null;
    }
  }, [kakao]);

  // ★ 실제 이미지 선택기 — PNG 3종만 사용
  const computeImage = useCallback(
    (_mk: any, next: MarkerState) => {
      return imgs ? (imgs as any)[next] : null;
    },
    [imgs],
  );

  const setMarkerState = useCallback(
    (mk: any, next: MarkerState) => {
      if (!mk) return;
      const img = computeImage(mk, next);
      if (!img) return;

      // 중복 setImage 방지: 선택상태 포함해서 키 구성(퀵모드 무관)
      const rowKey = mk.__rowKey as string | undefined;
      const inCart = !!rowKey && selectedSetRef.current.has(rowKey);
      const key = `${next}:${inCart ? 1 : 0}`;

      if (mk.__imgKey === key) return;
      try {
        mk.setImage(img);
        mk.__imgKey = key;
      } catch {}
    },
    [computeImage],
  );

  const paintNormal = useCallback(
    (mk: any) => {
      if (!mk) return;
      const rowKey = mk.__rowKey as string | undefined;
      const isSelected = !!rowKey && selectedSetRef.current.has(rowKey);
      setMarkerState(mk, isSelected ? "yellow" : "purple");
    },
    [setMarkerState],
  );

  const colorByRule = useCallback(
    (mk: any) => {
      if (!mk) return;
      const rowKey = mk.__rowKey as string | undefined;
      const isSelected = !!rowKey && selectedSetRef.current.has(rowKey);
      if (isSelected) {
        // 담김 상태는 항상 노랑
        return setMarkerState(mk, "yellow");
      }
      // 퀵담기 모드에서는 클릭 강조(보라 3x)를 사용하지 않고, 항상 기본 보라만 사용
      if (!quickAddEnabled && lastClickedRef.current === mk) {
        return setMarkerState(mk, "clicked");
      }
      setMarkerState(mk, "purple");
    },
    [setMarkerState, quickAddEnabled],
  );

  // 담기 상태 변경 시 즉시 재칠하기(퀵모드 여부와 무관)
  useEffect(() => {
    poolRef.current.forEach((mk) => colorByRule(mk));
  }, [externalSelectedRowKeys, colorByRule]);

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

    const installLocation = (row.install_location as string) || undefined;

    return {
      rowKey,
      rowId: row.place_id != null ? String(row.place_id) : row.id != null ? String(row.id) : undefined,
      name,
      address: (row.address as string) || "",
      productName,
      installLocation,
      households: toNum(row.households),
      residents: toNum(row.residents),
      monitors: toNum(row.monitors),
      monthlyImpressions: toNum(row.monthly_impressions),
      costPerPlay: toNum(row.cost_per_play),
      hours: (row.hours as string) || "",
      monthlyFee: toNum(row.monthly_fee),
      monthlyFeeY1: toNum(row.monthly_fee_y1),
      imageUrl: rawImage || imageForProduct(productName, installLocation),
      lat,
      lng,
    };
  }, []);

  /** 상세 응답 보강 */
  const enrichWithDetail = useCallback((base: SelectedApt, d: any): SelectedApt => {
    const detailName = (getField(d, ["name"]) as string) ?? (getField(d, ["apt_name"]) as string);
    const detailProduct =
      (getField(d, ["product_name"]) as string) ?? (getField(d, ["productName"]) as string) ?? base.productName;

    const detailInstall =
      (getField(d, ["install_location"]) as string) ??
      base.installLocation; /* 상세 응답 설치위치 우선, 없으면 기존 값 유지 */

    const detailImage =
      (getField(d, ["imageUrl", "image_url", "image", "thumbnail", "thumb", "thumb_url", "thumbUrl"]) as string) ??
      base.imageUrl ??
      imageForProduct(detailProduct, detailInstall);

    return {
      ...base,
      name: detailName ?? base.name,
      productName: detailProduct,
      imageUrl: detailImage,
      installLocation: detailInstall,
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

  /** 중복 덮어쓰기 방지: row_uid 우선 → place_id+좌표+상품+설치위치 → 기타 */
  function stableIdKeyFromRow(row: PlaceRow): string {
    const lat = toNum(row.lat);
    const lng = toNum(row.lng);
    const lat5 = Number.isFinite(lat as number) ? (lat as number).toFixed(5) : "x";
    const lng5 = Number.isFinite(lng as number) ? (lng as number).toFixed(5) : "x";

    // ✅ 상품명 + 설치위치까지 항상 키에 포함
    const prod = String(getField(row, ["product_name", "상품명", "productName"]) || "");
    const loc = String(getField(row, ["install_location", "설치위치"]) || "");

    // row_uid가 같더라도 prod/loc가 다르면 마커를 분리
    if (row.row_uid) return `uid:${row.row_uid}|${prod}|${loc}`;
    if (row.place_id != null) return `pid:${String(row.place_id)}|${lat5},${lng5}|${prod}|${loc}`;
    if (row.id != null) return `id:${String(row.id)}|${lat5},${lng5}|${prod}|${loc}`;

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
      const baseX = typeof (basePt as any).getX === "function" ? (basePt as any).getX() : (basePt as any).x;
      const baseY = typeof (basePt as any).getY === "function" ? (basePt as any).getY() : (basePt as any).y;
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
        const px = baseX + radius * Math.cos(angle);
        const py = baseY + radius * Math.sin(angle);
        const newLL = projection.coordsFromPoint(new kakao.maps.Point(px, py));
        out.push({ ...sorted[i], __posLat: newLL.getLat(), __posLng: newLL.getLng() });
      }
    });

    return out;
  }

  /** 마커 대량 추가를 한 번에 막지 말고 조각내어 추가(UX 버벅임 완화) */
  async function addMarkersInChunks(toAdd: any[], maps: any, chunkSize: number) {
    if (!toAdd.length) return;
    let idx = 0;
    while (idx < toAdd.length) {
      const slice = toAdd.slice(idx, idx + chunkSize);
      try {
        if (clustererRef.current?.addMarkers) clustererRef.current.addMarkers(slice);
        else slice.forEach((m) => m.setMap(map));
      } catch {}
      slice.forEach((mk) => colorByRule(mk));
      idx += chunkSize;
      // 다음 프레임으로 넘겨 메인스레드 블로킹 방지
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /* ===== 상품명/설치위치 필터를 전체 마커에 적용 ===== */
  const applyFilterToAllMarkers = useCallback(() => {
    if (!map) return;

    const { productNames, installLocations } = filterStateRef.current;
    const visibleMarkers: any[] = [];

    // 어떤 마커가 보일지 1차 선택
    poolRef.current.forEach((mk) => {
      const row = mk.__row as PlaceRow | undefined;
      if (!row) return;

      const prod = (row.product_name as string) || "";
      const loc = (row.install_location as string) || "";

      if (productNames && productNames.size > 0 && !productNames.has(prod)) return;
      if (installLocations && installLocations.size > 0 && !installLocations.has(loc)) return;

      visibleMarkers.push(mk);
    });

    const clustererObj = clustererRef.current;

    // 클러스터러가 있을 때: clear → 필터된 마커만 다시 add
    if (clustererObj && typeof clustererObj.clear === "function" && typeof clustererObj.addMarkers === "function") {
      try {
        clustererObj.clear();
        if (visibleMarkers.length) {
          clustererObj.addMarkers(visibleMarkers);
        }
      } catch (e) {
        console.warn("[useMarkers] applyFilterToAllMarkers(clusterer) error:", e);
      }
    } else {
      // 클러스터러가 없으면 setMap(map / null)로 직접 토글
      const visibleSet = new Set(visibleMarkers);
      poolRef.current.forEach((mk) => {
        try {
          mk.setMap(visibleSet.has(mk) ? map : null);
        } catch {}
      });
    }
  }, [clustererRef, filterStateRef, map]);

  const applyRows = useCallback(
    async (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      // 빈 배열이면서 기존 풀 존재 → 일시적 공백 보호(깜빡임 방지)
      if ((rows?.length ?? 0) === 0 && poolRef.current.size > 0) return;

      // 동일 좌표 그룹을 나란히 배치
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
            mk.__imgKey = "purple:0";
          } catch {
            continue;
          }
          mk.__idKey = idKey;
          mk.__rowKey = rowKey;
          mk.__row = row; // 원본 행(기본 lat/lng 포함)

          const onClick = async () => {
            const baseSel = toSelectedBase(mk.__rowKey, mk.__row, Number(mk.__row.lat), Number(mk.__row.lng));

            // 상위로 위임: 퀵모드든 일반모드든 onSelect가 장바구니 토글/시트 오픈을 결정
            onSelectRef.current(baseSel);

            // 퀵모드: 클릭 강조/상세 RPC 없이 담기/취소만 수행
            if (quickAddEnabledRef.current) {
              const wasSelected = selectedSetRef.current.has(mk.__rowKey);
              setMarkerState(mk, wasSelected ? "purple" : "yellow");
              return;
            }

            // 일반 모드: 클릭 강조 처리
            const prev = lastClickedRef.current;
            if (prev && prev !== mk) paintNormal(prev);
            lastClickedRef.current = mk;
            colorByRule(mk);

            // 상세 RPC (모바일 B). 에러는 로깅만.
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
                onSelectRef.current(enrichWithDetail(baseSel, d));
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
        await addMarkersInChunks(toAdd, maps, chunkSizeForMap(map));
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
          if (clustererRef.current?.removeMarkers) clustererRef.current.removeMarkers(toRemove);
          else toRemove.forEach((m) => m.setMap(null));
        } catch {}
        try {
          toRemove.forEach((mk) => {
            kakao.maps.event.removeListener(mk, "click", mk.__onClick);
            if (lastClickedRef.current === mk) lastClickedRef.current = null; // 제거 시 클릭 강조 해제
          });
        } catch {}
      }

      rowKeyIndexRef.current = nextRowKeyIndex;

      // ✅ 필터가 설정된 상태라면, 새로 추가된 마커까지 포함해서 다시 필터 적용
      if (filterStateRef.current.productNames || filterStateRef.current.installLocations) {
        applyFilterToAllMarkers();
      }
    },
    [
      clustererRef,
      colorByRule,
      imgs,
      kakao,
      map,
      toSelectedBase,
      enrichWithDetail,
      paintNormal,
      setMarkerState,
      quickAddEnabled, // 클릭 강조 규칙에 사용
      applyFilterToAllMarkers,
    ],
  );

  /** 바운드 내 데이터 요청 (모바일: public_map_places 직접 조회) */
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

    // 불필요 재요청 방지: 이전 쿼리 영역이 새 영역을 충분히 포함하면 스킵
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
            "row_uid",
            "name",
            "product_name",
            "install_location",
            "lat",
            "lng",
            "image_url",
            "is_active",
            // 🔹 퀵담기에서도 바로 쓸 상세 필드들 추가
            "households",
            "residents",
            "monitors",
            "monthly_impressions",
            "cost_per_play",
            "hours",
            "address",
            "monthly_fee",
            "monthly_fee_y1",
          ].join(","),
        )
        .eq("is_active", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", minLat)
        .lte("lat", maxLat)
        .gte("lng", minLng)
        .lte("lng", maxLng)
        .limit(10000);

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
        // 🔹 추가된 필드들을 PlaceRow에 그대로 매핑
        households: r.households,
        residents: r.residents,
        monitors: r.monitors,
        monthly_impressions: r.monthly_impressions,
        cost_per_play: r.cost_per_play,
        hours: r.hours,
        address: r.address,
        monthly_fee: r.monthly_fee,
        monthly_fee_y1: r.monthly_fee_y1,
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

  // refreshRef로 이벤트 핸들러 함수 아이덴티티 고정
  const refreshRef = useRef(() => {});
  useEffect(() => {
    refreshRef.current = refreshInBounds as any;
  }, [refreshInBounds]);

  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const handleIdle = () => {
      // idle 이벤트 디바운스(과잉 호출 방지)
      if (idleDebounceRef.current) window.clearTimeout(idleDebounceRef.current);
      idleDebounceRef.current = window.setTimeout(() => {
        refreshRef.current();
      }, 180);
    };

    // 초기 타일 로드 직후 1회 강제
    let tilesLoadedOnce = false;
    const handleTilesLoaded = () => {
      if (tilesLoadedOnce) return;
      tilesLoadedOnce = true;
      refreshRef.current();
      try {
        maps.event.removeListener(map, "tilesloaded", handleTilesLoaded);
      } catch {}
    };

    maps.event.addListener(map, "idle", handleIdle);
    maps.event.addListener(map, "tilesloaded", handleTilesLoaded);

    // 첫 페인트 직후 강제 1회
    setTimeout(() => refreshRef.current(), 0);

    return () => {
      try {
        maps.event.removeListener(map, "idle", handleIdle);
        maps.event.removeListener(map, "tilesloaded", handleTilesLoaded);
      } catch {}
      const all: any[] = [];
      poolRef.current.forEach((mk) => all.push(mk));
      try {
        if (clustererRef.current?.removeMarkers) clustererRef.current.removeMarkers(all);
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
      if (idleDebounceRef.current) window.clearTimeout(idleDebounceRef.current);
      idleDebounceRef.current = null;
    };
  }, [kakao, map]);

  const selectByRowKey = useCallback(
    async (rowKey: string) => {
      const mk = rowKeyIndexRef.current.get(rowKey);
      if (!mk || !kakao?.maps || !map) return;

      const row = mk.__row as PlaceRow;
      const lat = Number(row.lat);
      const lng = Number(row.lng);

      const baseSel = toSelectedBase(rowKey, row, lat, lng);
      onSelectRef.current(baseSel);

      // 다른 항목 클릭 시 이전 클릭 강조 해제
      const prev = lastClickedRef.current;
      if (prev && prev !== mk) paintNormal(prev);
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
          onSelectRef.current(enrichWithDetail(baseSel, d));
        } catch (e) {
          console.warn("[useMarkers] detail fetch failed:", e);
        }
      }
    },
    [colorByRule, enrichWithDetail, kakao, map, paintNormal, toSelectedBase],
  );

  /* ===== 외부에서 상품명/설치위치 필터를 변경하는 API ===== */
  const updateFilter = useCallback(
    (opts: { productNames?: string[] | null; installLocations?: string[] | null }) => {
      const next: MarkerFilterState = {
        productNames: filterStateRef.current.productNames,
        installLocations: filterStateRef.current.installLocations,
      };

      if (opts.productNames !== undefined) {
        next.productNames =
          opts.productNames === null
            ? null
            : new Set(opts.productNames.filter((v) => v != null && String(v).trim().length > 0));
      }

      if (opts.installLocations !== undefined) {
        next.installLocations =
          opts.installLocations === null
            ? null
            : new Set(opts.installLocations.filter((v) => v != null && String(v).trim().length > 0));
      }

      filterStateRef.current = next;
      applyFilterToAllMarkers();
    },
    [applyFilterToAllMarkers],
  );

  return { refreshInBounds, selectByRowKey, updateFilter };
}
