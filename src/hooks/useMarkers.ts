import { useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildRowKeyFromRow, groupKeyFromRow } from "@/core/map/rowKey";
import type { SelectedApt } from "@/core/types";

/* =========================================================================
 * 정적 에셋 베이스 (PC 버전과 동일 규칙)
 * ========================================================================= */
const PRIMARY_ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE || "/products/";
const FALLBACK_ASSET_BASE = (import.meta as any).env?.VITE_ASSET_BASE_FALLBACK || "";
const PLACEHOLDER = "/placeholder.svg";

const ensureTrailingSlash = (s: string) => (s.endsWith("/") ? s : s + "/");
const PRIMARY_BASE = ensureTrailingSlash(PRIMARY_ASSET_BASE);
const FALLBACK_BASE = FALLBACK_ASSET_BASE ? ensureTrailingSlash(FALLBACK_ASSET_BASE) : "";

/** 절대/루트 경로 여부(이미 완성된 URL인지) */
const isAbsoluteLike = (s?: string) => !!s && /^(https?:|data:|\/)/i.test(s || "");

/** 파일명(or 부분 경로)을 풀 URL로 변환 */
function toImageUrl(input?: string): string | undefined {
  if (!input) return undefined;
  if (isAbsoluteLike(input)) return input; // http(s), data:, / 로 시작하면 그대로
  return PRIMARY_BASE + input.replace(/^\/+/, "");
}

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

/** PC 버전과 동일한 매핑 규칙(상품명 + 설치위치) → 파일명 */
const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");
function resolveProductFile(productName?: string, installLocation?: string): string | undefined {
  const pn = norm(productName);
  const loc = norm(installLocation);
  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) {
    if (loc.includes("ev내부")) return "townbord-a.png";
    if (loc.includes("ev대기공간")) return "townbord-b.png";
  }
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) {
    if (loc.includes("ev내부")) return "media-meet-a.png";
    if (loc.includes("ev대기공간")) return "media-meet-b.png";
    return "media-meet-a.png";
  }
  if (pn.includes("엘리베이터tv") || pn.includes("elevatortv") || pn.includes("elevator")) return "elevator-tv.png";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "hi-post.png";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "space-living.png";
  return undefined;
}

type MarkerState = "purple" | "yellow" | "clicked";

/** 오버스캔 비율(조회 영역 확대) — 너무 크지 않게 */
const OVERSCAN_RATIO = 0.2;

/** 바운드가 비정상적으로 작은 경우 fetch 스킵(임시 레이아웃/relayout 구간 보호) */
const MIN_LAT_SPAN = 0.0001; // 약 90m
const MIN_LNG_SPAN = 0.0001; // 약 90m

/* =========================================================================
 * 훅 본체(⚠️ 훅 호출은 항상 동일한 순서/개수로 유지)
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

  /** 선택 집합을 ref로 보관 → 렌더 영향 없이 참조 */
  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    selectedSetRef.current = new Set(externalSelectedRowKeys);
  }, [externalSelectedRowKeys]);

  /** 중복 요청/늦은 응답/빈결과 스트릭 가드 */
  const fetchInFlightRef = useRef(false);
  const requestVersionRef = useRef(0);
  const emptyStreakRef = useRef(0); // 연속 0건 응답 횟수 (2회 이상이면 정리 허용)

  /** 마커 이미지 캐시 (항상 훅은 호출, 내부에서 kakao 준비 여부만 분기) */
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

  /** 행 -> 선택객체(기본: map용 최소 컬럼만으로 생성) */
  const toSelectedBase = useCallback((rowKey: string, row: PlaceRow, lat: number, lng: number): SelectedApt => {
    const name = getField(row, ["단지명", "단지 명", "name", "아파트명"]) || "";
    const productName = getField(row, ["상품명", "productName", "product_name"]) || "";
    const installLocation = getField(row, ["설치위치", "installLocation"]) || "";

    // 1) DB image_url 최우선
    const rawImage = getField(row, ["image_url", "imageUrl", "이미지", "썸네일", "thumbnail"]) as string | undefined;

    // 2) 파일명 매핑(상품/설치위치) → 기본 파일
    const mappedFile = resolveProductFile(productName, installLocation);

    // 3) 최종 URL 결정(원격/루트는 그대로, 파일명은 베이스 붙임)
    const imageUrl = toImageUrl(rawImage) || toImageUrl(mappedFile) || PLACEHOLDER;

    return {
      rowKey,
      rowId: row.id != null ? String(row.id) : row.place_id != null ? String(row.place_id) : undefined,
      name,
      address: "", // 상세 호출 후 채움
      productName,
      installLocation,
      households: undefined,
      residents: undefined,
      monitors: undefined,
      monthlyImpressions: undefined,
      costPerPlay: undefined,
      hours: "",
      monthlyFee: undefined,
      monthlyFeeY1: undefined,
      imageUrl,
      lat,
      lng,
    };
  }, []);

  /** 상세 응답 -> SelectedApt로 보강 */
  const enrichWithDetail = useCallback((base: SelectedApt, d: any): SelectedApt => {
    // 문자열 필드 그대로 갱신(버그 수정: toNum 사용 금지)
    const installLocation = (getField(d, ["install_location", "설치위치"]) as string) ?? base.installLocation;

    // 이미지: detail이 제공하면 우선, 없으면 기존값 유지. (상대경로면 베이스 붙임)
    const detailImage = getField(d, ["image_url"]) as string | undefined;
    const nextImage =
      toImageUrl(detailImage) ||
      base.imageUrl || // 이미 정해진 값 유지
      toImageUrl(resolveProductFile(base.productName, installLocation)) ||
      PLACEHOLDER;

    return {
      ...base,
      installLocation,
      households: toNum(getField(d, ["households"])) ?? base.households,
      residents: toNum(getField(d, ["residents"])) ?? base.residents,
      monitors: toNum(getField(d, ["monitors"])) ?? base.monitors,
      monthlyImpressions: toNum(getField(d, ["monthly_impressions"])) ?? base.monthlyImpressions,
      costPerPlay: toNum(getField(d, ["cost_per_play"])) ?? base.costPerPlay,
      hours: (getField(d, ["hours"]) as string) ?? base.hours,
      address: (getField(d, ["address"]) as string) ?? base.address,
      monthlyFee: toNum(getField(d, ["monthly_fee"])) ?? base.monthlyFee,
      monthlyFeeY1: toNum(getField(d, ["monthly_fee_y1"])) ?? base.monthlyFeeY1,
      imageUrl: nextImage,
      lat: toNum(getField(d, ["lat"])) ?? base.lat,
      lng: toNum(getField(d, ["lng"])) ?? base.lng,
    };
  }, []);

  /** 안정키: row.id/place_id 우선, 없으면 좌표 5자리 + 그룹/상품/설치 */
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

  /** DIFF 반영 (오직 새 fetch 결과 기준으로만 추가/제거) */
  const applyRows = useCallback(
    (rows: PlaceRow[]) => {
      if (!kakao?.maps || !map || !imgs) return;
      const { maps } = kakao;

      // ⚠️ 빈 배열 보호: 기존 마커가 있고 rows가 0이면 "일시적 공백"일 가능성 → 적용 스킵
      if ((rows?.length ?? 0) === 0 && poolRef.current.size > 0) {
        return; // 전체 사라짐 방지
      }

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

          const onClick = async () => {
            // 1) 빠른 선택(기본 정보)
            const baseSel = toSelectedBase(mk.__rowKey, mk.__row, lat, lng);
            onSelect(baseSel);

            // 2) 클릭 색상 규칙
            if (lastClickedRef.current && lastClickedRef.current !== mk) colorByRule(lastClickedRef.current);
            lastClickedRef.current = mk;
            colorByRule(mk);

            // 3) 상세 보강 (place_id/id 우선 사용)
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
                // 늦게 도착한 응답 폐기
                if (mk.__detailVer !== myVer) return;

                // 마커 내부 row에도 병합(다음 클릭 시 즉시 사용)
                mk.__row = { ...mk.__row, ...d };

                // UI 덮어쓰기
                const enriched = enrichWithDetail(baseSel, d);
                onSelect(enriched);
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

      // 먼저 추가를 반영 → 화면 공백 방지
      if (toAdd.length) {
        try {
          if (clusterer?.addMarkers) clusterer.addMarkers(toAdd);
          else toAdd.forEach((m) => m.setMap(map));
        } catch {}
        // 추가분 색상 최종 적용(선택 반영)
        toAdd.forEach((mk) => colorByRule(mk));
      }

      // 제거 대상: 이번 결과에 없는 idKey만 제거 (오직 새 데이터 기준)
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
        // 이벤트 해제(메모리 누수 방지)
        try {
          toRemove.forEach((mk) => {
            kakao.maps.event.removeListener(mk, "click", mk.__onClick);
          });
        } catch {}
      }

      // 인덱스 교체
      rowKeyIndexRef.current = nextRowKeyIndex;
    },
    [clusterer, colorByRule, imgs, kakao, map, onSelect, toSelectedBase, enrichWithDetail],
  );

  /** 바운드 내 데이터 요청 + DIFF 반영 */
  const refreshInBounds = useCallback(async () => {
    if (!kakao?.maps || !map) return;
    const kbounds = map.getBounds?.();
    if (!kbounds) return;

    const sw = kbounds.getSouthWest();
    const ne = kbounds.getNorthEast();

    // ❗ 비정상적으로 작은 바운드(레이아웃 전환/relayout 중)면 스킵 → 집단 깜빡임 방지
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
      // ✅ 지도용 최소 뷰 → 빠름
      const { data, error } = await (supabase as any)
        .from("public_map_places")
        .select("place_id,name,product_name,lat,lng,image_url,is_active,city,district,updated_at,install_location")
        .eq("is_active", true)
        .not("lat", "is", null)
        .not("lng", "is", null)
        .gte("lat", minLat)
        .lte("lat", maxLat)
        .gte("lng", minLng)
        .lte("lng", maxLng)
        .order("updated_at", { ascending: false })
        .limit(5000);

      // 느리게 도착한 응답은 폐기
      if (myVersion !== requestVersionRef.current) return;

      if (error) {
        console.error("Supabase(public_map_places) error:", error.message);
        return;
      }

      // 🔁 새 뷰 스키마 → 기존 로직이 쓰는 키로 정규화
      const rows: PlaceRow[] = (data ?? []).map((r: any) => ({
        place_id: r.place_id, // 안정 키
        lat: r.lat,
        lng: r.lng,
        name: r.name,
        product_name: r.product_name,
        productName: r.product_name,
        image_url: r.image_url,
        installLocation: r.install_location,
        city: r.city,
        district: r.district,
        updated_at: r.updated_at,
      }));

      // ❗ 일시적 0건 보호: 1회는 무시, 2회 연속이면 진짜로 비어있다고 판단
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

  /** idle에서만 갱신 (UI 액션과 분리) + 초기 1회 강제 */
  useEffect(() => {
    if (!kakao?.maps || !map) return;
    const { maps } = kakao;

    const handleIdle = () => {
      refreshInBounds();
    };

    maps.event.addListener(map, "idle", handleIdle);

    // 초기: 다음 프레임에 강제 1회 실행 (초기 idle 누락 대비)
    requestAnimationFrame(() => refreshInBounds());

    return () => {
      try {
        maps.event.removeListener(map, "idle", handleIdle);
      } catch {}
      // 정리
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

  /** 외부 포커스: rowKey로 선택/이동 (+ 상세 보강) */
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

      // 1) 기본 선택
      const baseSel = toSelectedBase(rowKey, row, lat, lng);
      onSelect(baseSel);

      // 2) 색 규칙 갱신
      if (lastClickedRef.current && lastClickedRef.current !== mk) colorByRule(lastClickedRef.current);
      lastClickedRef.current = mk;
      colorByRule(mk);

      // 3) 상세 보강
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

  // 항상 동일 shape의 API 반환
  return { refreshInBounds, selectByRowKey };
}
