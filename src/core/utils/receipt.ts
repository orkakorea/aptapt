import type { SeatItem, SeatSummary } from "@/components/complete-modal/types";

/** 내부 유틸 */
const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const firstOf = <T = any,>(obj: any, keys: string[], map?: (v: any) => T, fallback?: T): T | undefined => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return map ? map(v) : (v as T);
  }
  return fallback;
};

/** 1탭 '총 비용'을 최대한 호환성 있게 추출 */
export function pickCartTotal(snap: any): number | null {
  if (!snap) return null;
  const candidates = [
    snap.cartTotal,
    snap.cart_total,
    snap.cartTotalWon,
    snap.cart_total_won,
    snap.grandTotal,
    snap.grand_total,
    snap.totalWon,
    snap.total_won,
    snap.total,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (isFinite(n) && n > 0) return n;
  }
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    const sum = snap.items.reduce((acc: number, it: any) => {
      const n = Number(
        it?.lineTotal ?? it?.line_total ?? it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0,
      );
      return acc + (isFinite(n) ? n : 0);
    }, 0);
    return sum > 0 ? sum : null;
  }
  return null;
}

/** 전화번호 마스킹 (010-****-1234 형태) */
export function maskPhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 7) return digits;
  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}-****-${tail}`;
}

/** 이메일 도메인만 추출 (@example.com) */
export function emailToDomain(email?: string | null): string | undefined {
  if (!email) return undefined;
  const at = String(email).indexOf("@");
  if (at < 0) return undefined;
  return "@" + String(email).slice(at + 1);
}

/** 스냅샷에서 (개월 집계) months 최댓값과 유니크 개수 반환 */
function extractMonths(snap: any): { max: number | null; uniqueCount: number } {
  const set = new Set<number>();
  let max = 0;
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
  items.forEach((i) => {
    const n = Number(i?.months ?? i?.month ?? 0);
    if (isFinite(n) && n > 0) {
      set.add(n);
      if (n > max) max = n;
    }
  });
  const fb = Number(snap?.months ?? 0);
  if (set.size === 0 && isFinite(fb) && fb > 0) {
    set.add(fb);
    max = fb;
  }
  return { max: max > 0 ? max : null, uniqueCount: set.size };
}

/** 헤더 요약용 라벨 빌드 (단지/상품/개월 라벨) */
export function buildSeatHeaderLabels(prefill?: {
  apt_name?: string | null;
  product_name?: string | null;
  product_code?: string | null;
  cart_snapshot?: any | null;
}): {
  aptLabel: string;
  productLabel: string;
  months: number | null;
  monthsLabel: string;
  totalWon: number | null;
  aptCount: number;
} {
  const snap = prefill?.cart_snapshot || null;
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
  const first = items[0] ?? null;

  const topAptName = first?.apt_name ?? first?.aptName ?? prefill?.apt_name ?? "-";
  const aptCount = items.length > 0 ? items.length : prefill?.apt_name ? 1 : 0;
  const aptLabel = aptCount > 1 ? `${topAptName} 외 ${aptCount - 1}개 단지` : topAptName;

  const productFirst =
    first?.product_name ??
    first?.productName ??
    first?.product_code ??
    prefill?.product_name ??
    prefill?.product_code ??
    "-";
  const uniqProducts = new Set<string>();
  if (items.length > 0) {
    items.forEach((i) => {
      const key = i?.product_name ?? i?.productName ?? i?.product_code ?? "";
      if (key) uniqProducts.add(String(key));
    });
  } else {
    const key = prefill?.product_name ?? prefill?.product_code ?? "";
    if (key) uniqProducts.add(String(key));
  }
  const productLabel = uniqProducts.size >= 2 ? `${productFirst} 외` : productFirst;

  const { max: months, uniqueCount } = extractMonths(snap);
  const monthsLabel = months ? `${months}개월${uniqueCount >= 2 ? " 등" : ""}` : "-";

  const totalWon = pickCartTotal(snap);

  return { aptLabel, productLabel, months, monthsLabel, totalWon, aptCount };
}

/** SEAT 요약(접수증 상단 카드) 계산 */
export function makeSeatSummary(prefill?: {
  apt_name?: string | null;
  product_name?: string | null;
  product_code?: string | null;
  cart_snapshot?: any | null;
}): SeatSummary {
  const labels = buildSeatHeaderLabels(prefill);
  const months = labels.months;
  const monthly = labels.totalWon;
  const period = months && typeof monthly === "number" ? Math.round(monthly * months) : null;

  return {
    aptCount: labels.aptCount,
    topAptLabel: labels.aptLabel,
    productLabel: labels.productLabel,
    months,
    monthlyTotalKRW: typeof monthly === "number" ? monthly : null,
    periodTotalKRW: period,
  };
}

/**
 * SEAT 라인아이템 목록 생성 (접수증 자세히 테이블)
 * - 다양한 스냅샷 키(camelCase/snake_case)를 모두 허용
 * - 누락된 총액은 (monthlyAfter || baseMonthly) * months 로 보강
 * - 추가 필드(모니터수량/세대수/거주인원/월송출횟수)를 함께 전달
 */
export function buildSeatItemsFromSnapshot(snap: any): SeatItem[] {
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
  const fallbackMonths = num(snap?.months);

  return items.map((raw) => {
    // 표시에 필요한 기본값들
    const aptName = firstOf<string>(raw, ["aptName", "apt_name", "name"]) ?? "-";

    const productName =
      firstOf<string>(raw, ["productName", "product_name", "mediaName"]) ??
      firstOf<string>(raw, ["product_code"]) ??
      "-";

    const months = num(firstOf(raw, ["months", "month"])) ?? fallbackMonths ?? null;

    const baseMonthly =
      num(firstOf(raw, ["baseMonthly", "base_monthly", "priceMonthly", "monthlyBase", "monthly_base"])) ?? null;

    const monthlyAfter =
      num(
        firstOf(raw, [
          "monthlyAfter",
          "monthly_after",
          "priceMonthlyAfter",
          "monthlyAfterDiscount",
          "monthly_after_discount",
        ]),
      ) ?? baseMonthly;

    // 총액(lineTotal) 우선순위
    const lineTotalExplicit = num(
      firstOf(raw, ["lineTotal", "line_total", "itemTotalWon", "item_total_won", "totalWon", "total_won"]),
    );
    const lineTotal = lineTotalExplicit ?? (months && monthlyAfter ? Math.round(monthlyAfter * months) : null);

    // 부가정보(표/카운터용) — 타입 충돌 방지 위해 아래서 any로 붙여줌
    const monitors = num(firstOf(raw, ["monitors", "monitorCount", "monitor_count", "screens"])) ?? null;
    const households = num(firstOf(raw, ["households"])) ?? null;
    const residents = num(firstOf(raw, ["residents"])) ?? null;
    const monthlyImpressions =
      num(firstOf(raw, ["monthlyImpressions", "monthly_impressions", "impressions_per_month"])) ?? null;

    const discountNote: string | null =
      firstOf<string>(raw, ["discountNote", "discount_note", "applied_discounts_text"]) ?? null;

    // SeatItem(필수 스키마) 구성
    const base: SeatItem = {
      aptName,
      productName,
      months: months ?? null,
      baseMonthly,
      discountNote,
      monthlyAfter: monthlyAfter ?? null,
      lineTotal,
    };

    // 추가 필드를 얹어서 반환(호환성 위해 any로 확장)
    const withExtras = {
      ...base,
      monitors,
      households,
      residents,
      monthlyImpressions,
    } as any;

    return withExtras;
  });
}
