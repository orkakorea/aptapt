/**
 * 지도 바운드 내 장소 조회
 * - Supabase에서 위경도 범위로 필터링하여 데이터를 가져옵니다.
 */

import { supabase } from "@/integrations/supabase/client";
import type { BoundsQueryOptions, PlaceRow } from "@/core/types";

/**
 * 바운드 범위 내의 장소 데이터를 조회합니다.
 * @param options - 조회 옵션 (바운드, 필드 선택, 제한)
 * @returns 장소 데이터 배열
 */
export async function getPlacesInBounds(
  options: BoundsQueryOptions
): Promise<PlaceRow[]> {
  const { bounds, fields, limit = 1000 } = options;

  try {
    const selectClause = fields ? fields.join(",") : "*";
    
    // 쿼리를 단순화하여 타입 깊이 문제 해결
    const query = supabase
      .from("raw_places")
      .select(selectClause)
      .filter("is_active", "eq", true)
      .filter("lat", "gte", bounds.sw.lat)
      .filter("lat", "lte", bounds.ne.lat)
      .filter("lng", "gte", bounds.sw.lng)
      .filter("lng", "lte", bounds.ne.lng)
      .limit(limit);

    const { data, error }: any = await query;

    if (error) {
      console.error("[getPlacesInBounds] 조회 실패:", error);
      return [];
    }

    return (data || []) as PlaceRow[];
  } catch (err) {
    console.error("[getPlacesInBounds] 예외 발생:", err);
    return [];
  }
}
