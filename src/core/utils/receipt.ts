// src/core/utils/receipt.ts
import type { SeatItem, SeatSummary } from "@/components/complete-modal/types";

/** -------------------------------------------------------------
 * 공통: 느슨한 숫자 파서
 *  - "1,234,000원" / "12개월" / "90,000회" 등을 숫자로 변환
 * ------------------------------------------------------------- */
function parseNumberLoose(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.replace(/[^\d.-]/g, ""); // 쉼표/원/회/대/명 등 제거
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function parseIntLoose(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Math.floor(v);
  if (typeof v === "string") {
    const m = v.match(/-?\d+/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

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
    const n = parseNumberLoose(c);
    if (n != null && n > 0) return n;
  }
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    const sum = snap.items.reduce((acc: number, it: any) => {
      const n =
        parseNumberLoose(it?.itemTotalWon) ??
        parseNumberLoose(it?.item_total_won) ??
        parseNumberLoose(it?.totalWon) ??
        parseNumberLoose(it?.total_won) ??
        0;
      return acc + (Number.isFinite(n) ? (n as number) : 0);
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
    const n = parseIntLoose(i?.months ?? 0) ?? 0;
    if (Number.isFinite(n) && n > 0) {
      set.add(n);
      if (n > max) max = n;
    }
  });
  const fb = parseIntLoose(snap?.months ?? 0) ?? 0;
  if (set.size === 0 && Number.isFinite(fb) && fb > 0) {
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

/** SEAT 라인아이템 목록 생성 (접수증 자세히 테이블) — 견적서 합계 우선 사용 */
export function buildSeatItemsFromSnapshot(snap: any): SeatItem[] {
  const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
  return items.map((it) => {
    // 개월
    const months = parseIntLoose(it?.months ?? it?.month);

    // 금액(숫자 파싱)
    const baseMonthly =
      parseNumberLoose(it?.baseMonthly) ?? parseNumberLoose(it?.base_monthly) ?? parseNumberLoose(it?.priceMonthly);

    const rawLineTotal =
      parseNumberLoose(it?.lineTotal) ?? parseNumberLoose(it?.item_total_won) ?? parseNumberLoose(it?.total_won);

    let monthlyAfter =
      parseNumberLoose(it?.monthlyAfter) ??
      parseNumberLoose(it?.monthly_after) ??
      parseNumberLoose(it?.priceMonthlyAfter) ??
      null;

    // 합계가 있으면 우선 신뢰 → 월가 역산
    if (monthlyAfter == null && rawLineTotal != null && months && months > 0) {
      monthlyAfter = Math.round((rawLineTotal as number) / months);
    }

    // lineTotal 우선순위: 스냅샷 합계 → (월가×개월) → (정가×개월)
    let lineTotal: number | null = rawLineTotal ?? null;
    if (lineTotal == null) {
      if (monthlyAfter != null && months && months > 0) {
        lineTotal = (monthlyAfter as number) * (months as number);
      } else if (baseMonthly != null && months && months > 0) {
        lineTotal = (baseMonthly as number) * (months as number);
      } else {
        lineTotal = null;
      }
    }

    const discountNote: string | null = it?.discountNote ?? it?.discount_note ?? it?.applied_discounts_text ?? null;

    return {
      aptName: it?.apt_name ?? it?.aptName ?? "-",
      productName: it?.product_name ?? it?.productName ?? it?.product_code ?? "-",
      months: months ?? null,
      baseMonthly: baseMonthly ?? null,
      discountNote,
      monthlyAfter: monthlyAfter ?? baseMonthly ?? null,
      lineTotal,
      // SeatItem 타입의 다른 확장 필드는 요구되지 않음
    };
  });
}

function numOrNull(v: any): number | null {
  const n = parseNumberLoose(v);
  return n == null ? null : n;
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

/** 내부 숫자 파서(0/NaN 가드) */
function toNum(v: any): number | undefined {
  const n = parseNumberLoose(v);
  return n == null ? undefined : n;
}

/** baseMonthly/ monthlyAfter / months로 lineTotal 계산 (가능할 때만) */
function calcLineTotal(baseMonthly?: number, monthlyAfter?: number, months?: number): number | undefined {
  if (!months || months <= 0) return undefined;
  const m = typeof monthlyAfter === "number" ? monthlyAfter : typeof baseMonthly === "number" ? baseMonthly : undefined;
  return typeof m === "number" ? Math.round(m * months) : undefined;
}

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

    const months = (parseIntLoose(raw?.months ?? raw?.month) ?? 0) as number;

    const baseMonthly = toNum(raw?.baseMonthly ?? raw?.base_monthly ?? raw?.priceMonthly);

    const rawLineTotal = toNum(raw?.lineTotal ?? raw?.item_total_won ?? raw?.total_won);

    const monthlyAfter =
      toNum(raw?.monthlyAfter ?? raw?.monthly_after ?? raw?.priceMonthlyAfter) ??
      (rawLineTotal != null && months > 0 ? Math.round((rawLineTotal as number) / months) : undefined);

    const lineTotal = rawLineTotal ?? calcLineTotal(baseMonthly, monthlyAfter, months);

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
      const v = parseNumberLoose((it as any)?.[key]);
      return acc + (v != null ? v : 0);
    }, 0);

  return {
    count: items?.length ?? 0,
    households: sum("households"),
    residents: sum("residents"),
    monthlyImpressions: sum("monthlyImpressions"),
    monitors: sum("monitors"),
  };
}
