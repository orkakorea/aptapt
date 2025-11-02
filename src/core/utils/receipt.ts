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
      const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? it?.lineTotal ?? 0);
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

/** 숫자 or null */
function numOrNull(v: any): number | null {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

/** 내부 숫자 파서(0/NaN 가드) */
function toNum(v: any): number | undefined {
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

/** baseMonthly/ monthlyAfter / months로 lineTotal 계산 (가능할 때만) */
function calcLineTotal(
  baseMonthly?: number | null,
  monthlyAfter?: number | null,
  months?: number | null,
): number | null {
  if (!months || months <= 0) return null;
  const m =
    (typeof monthlyAfter === "number" ? monthlyAfter : undefined) ??
    (typeof baseMonthly === "number" ? baseMonthly : undefined);
  return typeof m === "number" ? Math.round(m * months) : null;
}

/** 안전한 문자열 */
const strOrDash = (v: any) => {
  const s = typeof v === "string" ? v.trim() : v;
  return s && String(s).length > 0 ? String(s) : "-";
};

/** SEAT 라인아이템 목록 생성 (접수증 자세히 테이블) — ★ 키 정규화 보강(A안) */
export function buildSeatItemsFromSnapshot(snap: any): SeatItem[] {
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];

  const fallbackMonths = numOrNull(snap?.months ?? null);

  return items.map((it) => {
    // --- 단지명/상품명: 다양한 키 대응 ---
    const aptName = it?.apt_name ?? it?.aptName ?? it?.apt ?? it?.title ?? it?.name ?? "-";

    const productName = it?.product_name ?? it?.productName ?? it?.mediaName ?? it?.product_code ?? "-";

    // --- 기간 ---
    const months = numOrNull(it?.months ?? it?.month ?? fallbackMonths ?? null);

    // --- 금액(정가/할인 후 월가) ---
    const baseMonthly = numOrNull(
      it?.baseMonthly ??
        it?.base_monthly ??
        it?.priceMonthly ??
        it?.price_monthly ??
        it?.monthlyFee ??
        it?.monthly_fee ??
        null,
    );

    const monthlyAfter =
      numOrNull(
        it?.monthlyAfter ??
          it?.monthly_after ??
          it?.priceMonthlyAfter ??
          it?.price_monthly_after ??
          it?.discountedMonthly ??
          it?.discounted_monthly ??
          null,
      ) ??
      baseMonthly ??
      null;

    // --- 총액(우선순위: 계산 가능한 경우 → 제공값) ---
    let lineTotal =
      calcLineTotal(baseMonthly, monthlyAfter, months) ??
      numOrNull(it?.lineTotal ?? it?.item_total_won ?? it?.itemTotalWon ?? it?.total_won ?? it?.totalWon ?? null) ??
      null;

    // --- 기준금액(정가 × 개월) — SeatItem에는 별도 필드 없지만,
    //     완료모달 테이블에서 표시 계산에 쓰이므로 lineTotal이 없을 때 대체 계산에 도움됨
    //     (필요 시 monthlyAfter가 없으면 baseMonthly로 처리)
    if (lineTotal === null && months && baseMonthly) {
      lineTotal = Math.round(baseMonthly * months);
    }

    const discountNote: string | null =
      it?.discountNote ??
      it?.discount_note ??
      it?.applied_discounts_text ??
      it?.discountText ??
      it?.discount_summary ??
      null;

    const seat: SeatItem = {
      aptName: strOrDash(aptName),
      productName: strOrDash(productName),
      months,
      baseMonthly,
      discountNote,
      monthlyAfter,
      lineTotal,
    };

    return seat;
  });
}

/* ============================================================
 * (1) 완료모달 → 견적 테이블 호환 어댑터
 * ============================================================ */

/** 견적 테이블 구조와 호환되는 최소 타입(의존성 순환 방지용) */
export type QuoteLineItemCompat = {
  id: string;
  name: string; // 단지명
  months: number; // 광고기간(개월)
  startDate?: string;
  endDate?: string;

  mediaName?: string; // 상품명
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;

  baseMonthly?: number; // 기준 월가
  monthlyAfter?: number; // 할인 후 월가
  lineTotal?: number; // 총 광고료(라인 합계)

  productKeyHint?: string;
};

/**
 * 완료 모달의 details.items(Seat 기반) → 견적 라인아이템 구조로 변환.
 * - key 매핑은 우선순위 규칙으로 폭넓게 대응
 * - id는 안정성을 위해 apt|media|months 기반으로 생성(동명이인 대비 index suffix 포함)
 */
export function adaptQuoteItemsFromReceipt(rawItems: any[] | null | undefined): QuoteLineItemCompat[] {
  const arr: any[] = Array.isArray(rawItems) ? rawItems : [];
  return arr.map((raw, idx): QuoteLineItemCompat => {
    const name = (raw?.aptName ?? raw?.apt_name ?? raw?.name ?? "-") as string;
    const mediaName = (raw?.productName ?? raw?.product_name ?? raw?.mediaName ?? raw?.product_code) as
      | string
      | undefined;

    const months = toNum(raw?.months ?? raw?.month) ?? 0;

    const baseMonthly = toNum(raw?.baseMonthly ?? raw?.base_monthly ?? raw?.priceMonthly);

    const monthlyAfter =
      toNum(raw?.monthlyAfter ?? raw?.monthly_after ?? raw?.priceMonthlyAfter) ??
      (toNum(raw?.lineTotal ?? raw?.item_total_won ?? raw?.total_won) && months > 0
        ? Math.round(Number(raw?.lineTotal ?? raw?.item_total_won ?? raw?.total_won) / months)
        : undefined);

    const rawLineTotal = toNum(raw?.lineTotal ?? raw?.item_total_won ?? raw?.total_won);

    const lineTotal = rawLineTotal ?? calcLineTotal(baseMonthly, monthlyAfter, months) ?? undefined;

    const monitors = toNum(raw?.monitors ?? raw?.monitorCount ?? raw?.monitor_count ?? raw?.screens);

    const households = toNum(raw?.households);
    const residents = toNum(raw?.residents);
    const monthlyImpressions = toNum(raw?.monthlyImpressions);

    const productKeyHint = typeof raw?.product_code === "string" ? raw.product_code : undefined;

    const idBase = `${String(name)}|${String(mediaName ?? "")}|${months}`;
    const id = `${idBase}|${idx}`;

    return {
      id,
      name,
      months,
      mediaName,
      households,
      residents,
      monthlyImpressions,
      monitors,
      baseMonthly,
      monthlyAfter,
      lineTotal,
      productKeyHint,
    };
  });
}

/* ============================================================
 * (2) 카운터 합계 계산
 * ============================================================ */

/** 카운터 바에 쓰는 합계치(세대/인원/송출/모니터/행수) */
export function computeQuoteTotals(items: Array<Partial<QuoteLineItemCompat>>): {
  count: number;
  households: number;
  residents: number;
  monthlyImpressions: number;
  monitors: number;
} {
  const sum = (key: keyof QuoteLineItemCompat): number =>
    (items ?? []).reduce((acc, it) => {
      const v = Number((it as any)?.[key]);
      return acc + (isFinite(v) ? v : 0);
    }, 0);

  return {
    count: items?.length ?? 0,
    households: sum("households"),
    residents: sum("residents"),
    monthlyImpressions: sum("monthlyImpressions"),
    monitors: sum("monitors"),
  };
}
