import { supabase } from "@/integrations/supabase/client";
import type { Bounds, PlaceRow } from "../../core/types";

export function limitForLevel(level: number): number {
  if (level <= 4) return 1500;
  if (level <= 6) return 3000;
  return 5000;
}

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

function fieldsToSelect(fields?: readonly string[] | string[]) {
  const f = (fields && fields.length ? fields : MINIMAL_PLACE_FIELDS) as readonly string[];
  return Array.from(new Set(f)).join(",");
}

export async function getPlacesInBounds(opts: {
  bounds: Bounds;
  fields?: string[];
  limit?: number;
}): Promise<{ rows: PlaceRow[]; error: string | null }> {
  const { bounds, fields, limit } = opts;
  const { sw, ne } = bounds;
  const lim = Number.isFinite(limit as number) ? (limit as number) : 3000;

  // 공통 필터 빌더
  const base = (sel: string) =>
    supabase
      .from("raw_places")
      .select(sel)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .gte("lat", sw.lat)
      .lte("lat", ne.lat)
      .gte("lng", sw.lng)
      .lte("lng", ne.lng)
      .limit(lim);

  try {
    // 1차: 지정 필드로 조회
    const sel1 = fieldsToSelect(fields);
    let { data, error } = await base(sel1);

    // 필드 에러면 2차: 전체(*)로 재시도
    if (error) {
      const msg = (error.message || "").toLowerCase();
      const colErr =
        msg.includes("column") ||
        msg.includes("does not exist") ||
        msg.includes("unknown") ||
        msg.includes("select") ||
        msg.includes("syntax");

      if (colErr) {
        // eslint-disable-next-line no-console
        console.warn("[getPlacesInBounds] select fields failed, fallback to *:", error.message);
        const r2 = await base("*");
        if (r2.error) return { rows: [], error: r2.error.message };
        return { rows: (r2.data ?? []) as PlaceRow[], error: null };
      }
      return { rows: [], error: error.message };
    }

    return { rows: (data ?? []) as PlaceRow[], error: null };
  } catch (e: any) {
    return { rows: [], error: e?.message ?? "unknown error" };
  }
}
