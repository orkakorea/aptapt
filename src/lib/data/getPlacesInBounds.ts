// src/lib/data/getPlacesInBounds.ts
import { supabase } from "@/integrations/supabase/client";
import type { Bounds, PlaceRow } from "../../core/types";

/** 지도 레벨에 따른 기본 limit 계산 (기존 동일) */
export function limitForLevel(level: number): number {
  if (level <= 4) return 1500;
  if (level <= 6) return 3000;
  return 5000;
}

/**
 * NOTE:
 * 아래 상수는 과거 select 필드 최적화를 위해 사용됐습니다.
 * 이제 이 모듈은 raw 테이블을 직접 조회하지 않고,
 * 서버 RPC(get_public_map_places)만 호출하므로 내부에서는 더 이상 사용하지 않습니다.
 * 외부에서의 import 호환성을 위해 남겨둡니다.
 */
export const MINIMAL_PLACE_FIELDS = [
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
  "1년 계약 시 월 광고료",
  "연간월광고료",
  "monthlyFeeY1",
  "세대수",
  "households",
  "거주인원",
  "residents",
  "모니터수량",
  "monitors",
  "월송출횟수",
  "monthlyImpressions",
  "imageUrl",
  "이미지",
  "썸네일",
  "thumbnail",
  "1회당 송출비용",
  "costPerPlay",
  "운영시간",
  "hours",
  "주소",
  "도로명주소",
  "지번주소",
  "address",
] as const;

/**
 * 바운드 내 장소 조회 (핫픽스):
 * - raw_places 직접 select를 전면 금지
 * - 서버 RPC: get_public_map_places 만 호출
 */
export async function getPlacesInBounds(opts: {
  bounds: Bounds;
  /** 호환성 유지용 파라미터(무시됨) */
  fields?: string[];
  limit?: number;
}): Promise<{ rows: PlaceRow[]; error: string | null }> {
  const { bounds, limit } = opts;
  const { sw, ne } = bounds;
  const lim = Number.isFinite(limit as number) ? (limit as number) : 3000;

  try {
    const { data, error } = await (supabase as any).rpc("get_public_map_places", {
      min_lat: sw.lat,
      max_lat: ne.lat,
      min_lng: sw.lng,
      max_lng: ne.lng,
      limit_n: lim,
    });

    if (error) {
      return { rows: [], error: error.message ?? "rpc error" };
    }
    return { rows: (data ?? []) as PlaceRow[], error: null };
  } catch (e: any) {
    return { rows: [], error: e?.message ?? "unknown error" };
  }
}
