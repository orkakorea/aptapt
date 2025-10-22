/**
 * 바운드(지도 화면 영역) 안의 아파트 데이터를 가볍게 조회
 * - Supabase 의존(클라이언트 SDK)
 * - 공통 타입은 core/types 에서 가져옴
 *
 * 사용 예:
 *  const { rows, error } = await getPlacesInBounds({
 *    bounds: { sw: {lat: 37.4, lng: 126.8}, ne: {lat: 37.7, lng: 127.1} },
 *    // fields: MINIMAL_PLACE_FIELDS, // 필요시 필드 축소
 *    limit: limitForLevel(map.getLevel()),
 *  });
 */

import { supabase } from "@/integrations/supabase/client";
import type { Bounds, PlaceRow } from "../../core/types";

/** 줌 레벨별 권장 limit (너무 많이 가져오면 모바일이 버거움) */
export function limitForLevel(level: number): number {
  if (level <= 4) return 1500;
  if (level <= 6) return 3000;
  return 5000;
}

/**
 * 마커/상세에 필요한 최소 필드 세트
 * - 꼭 필요한 것만 남겨 네트워크 트래픽을 줄입니다.
 * - 프로젝트 컬럼명이 한글/영문 혼재여서 후보 컬럼도 포함함(있으면 반환됨).
 */
export const MINIMAL_PLACE_FIELDS = [
  // 좌표/키
  "id",
  "lat",
  "lng",

  // 표시용 기본 정보
  "단지명",
  "name",
  "아파트명",

  // 상품/설치 위치
  "상품명",
  "productName",
  "설치위치",
  "installLocation",

  // 가격/정책 관련
  "월광고료",
  "month_fee",
  "monthlyFee",
  "1년 계약 시 월 광고료",
  "연간월광고료",
  "monthlyFeeY1",

  // 통계
  "세대수",
  "households",
  "거주인원",
  "residents",
  "모니터수량",
  "monitors",
  "월송출횟수",
  "monthlyImpressions",

  // 부가 정보
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

/** 기본 필드 리스트 → Supabase select 문자열로 변환 */
function fieldsToSelect(fields: readonly string[] | string[] | undefined): string {
  const f = (fields && fields.length ? fields : MINIMAL_PLACE_FIELDS) as readonly string[];
  // Supabase PostgREST select: "id,lat,lng,단지명,상품명,..."
  return Array.from(new Set(f)).join(",");
}

export async function getPlacesInBounds(opts: {
  bounds: Bounds;
  fields?: string[]; // 생략하면 MINIMAL_PLACE_FIELDS
  limit?: number; // 생략하면 3000
}): Promise<{ rows: PlaceRow[]; error: string | null }> {
  const { bounds, fields, limit } = opts;
  const { sw, ne } = bounds;
  const sel = fieldsToSelect(fields);
  const lim = Number.isFinite(limit as number) ? (limit as number) : 3000;

  try {
    const q = supabase
      .from("raw_places")
      .select(sel)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", sw.lat)
      .lte("lat", ne.lat)
      .gte("lng", sw.lng)
      .lte("lng", ne.lng)
      .limit(lim);

    const { data, error } = await q;
    if (error) return { rows: [], error: error.message };

    // 타입 맞춰서 반환
    return { rows: (data ?? []) as PlaceRow[], error: null };
  } catch (e: any) {
    return { rows: [], error: e?.message ?? "unknown error" };
  }
}
