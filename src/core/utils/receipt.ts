// src/core/utils/receipt.ts
import type { SeatItem, SeatSummary } from "@/components/complete-modal/types";

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
      const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0);
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
    const n = Number(i?.months ?? 0);
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

  const topAptName = first?.apt_name ?? prefill?.apt_name ?? "-";
  const aptCount = items.length > 0 ? items.length : prefill?.apt_name ? 1 : 0;
  const aptLabel = aptCount > 1 ? `${topAptName} 외 ${aptCount - 1}개 단지` : topAptName;

  const productFirst =
    first?.product_name ?? first?.product_code ?? prefill?.product_name ?? prefill?.product_code ?? "-";
  const uniqProducts = new Set<string>();
  if (items.length > 0) {
    items.forEach((i) => {
      const key = i?.product_name ?? i?.product_code ?? "";
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

/** SEAT 라인아이템 목록 생성 (접수증 자세히 테이블) */
export function buildSeatItemsFromSnapshot(snap: any): SeatItem[] {
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
  return items.map((it) => {
    const baseMonthly = numOrNull(it?.baseMonthly ?? it?.base_monthly ?? it?.priceMonthly ?? null);
    const monthlyAfter = numOrNull(it?.monthlyAfter ?? it?.monthly_after ?? it?.priceMonthlyAfter ?? null);
    const months = numOrNull(it?.months ?? null);
    const lineTotal =
      months && (monthlyAfter ?? baseMonthly) ? Math.round((monthlyAfter ?? baseMonthly!) * months) : null;

    const discountNote: string | null = it?.discountNote ?? it?.discount_note ?? it?.applied_discounts_text ?? null;

    return {
      aptName: it?.apt_name ?? "-",
      productName: it?.product_name ?? it?.product_code ?? "-",
      months,
      baseMonthly,
      discountNote,
      monthlyAfter: monthlyAfter ?? baseMonthly ?? null,
      lineTotal,
    };
  });
}

function numOrNull(v: any): number | null {
  const n = Number(v);
  return isFinite(n) ? n : null;
}
