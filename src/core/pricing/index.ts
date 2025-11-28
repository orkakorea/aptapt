/**
 * 가격 정책 / 할인 계산 (PC·모바일 공통)
 * -------------------------------------------------------------
 * - React, Kakao, Supabase 등 어떤 런타임 의존성도 없습니다.
 * - 숫자 계산만 담당합니다. 어디서든 안전하게 import 하세요.
 */

/* =========================
 * 타입
 * ========================= */
export type RangeRule = { min: number; max: number; rate: number }; // rate: 0.1 = 10%
export type ProductRules = { precomp?: RangeRule[]; period: RangeRule[] };
export type DiscountPolicy = Record<string, ProductRules>;
export type PolicyKey = keyof typeof DEFAULT_POLICY;

/* =========================
 * 기본 정책 (PC 버전과 동일)
 * ========================= */
export const DEFAULT_POLICY = {
  // ✅ ELEVATOR TV: 사전보상 할인 없음(= precomp는 빈 배열)
  "ELEVATOR TV": {
    precomp: [], // << 이 줄만 추가
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },

  // ✅ 강남/서초/송파 전용: 기간할인 없는 정책 키
  "ELEVATOR TV_NOPD": {
    // 사전보상 없음
    precomp: [], // 없어도 되지만 통일감 위해 넣어두면 좋음
    // 모든 기간에 할인 0%
    period: [
      { min: 1, max: 12, rate: 0 },
    ],
  },

  TOWNBORD_S: {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },
  TOWNBORD_L: {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "MEDIA MEET": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "SPACE LIVING": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.2 },
      { min: 12, max: 12, rate: 0.3 },
    ],
  },
  "HI-POST": {
    period: [
      { min: 1, max: 5, rate: 0 },
      { min: 6, max: 11, rate: 0.05 },
      { min: 12, max: 12, rate: 0.1 },
    ],
  },
} as const satisfies DiscountPolicy;


export const POLICY_KEY_NONE = "_NONE" as const;

/* =========================
 * 정책 키 정규화
 *  - 상품명 문자열을 정책 키로 변환
 * ========================= */
export function normPolicyKey(productName?: string): PolicyKey | typeof POLICY_KEY_NONE {
  const p = (productName || "").toUpperCase().replace(/\s+/g, " ").trim();
  if (p.includes("ELEVATOR")) return "ELEVATOR TV";
  if (p.includes("MEDIA")) return "MEDIA MEET";
  if (p.includes("SPACE")) return "SPACE LIVING";
  if (p.includes("HI") && p.includes("POST")) return "HI-POST";
  if (p.includes("TOWNBORD") || p.includes("TOWNBOARD")) {
    // _L / L 버전 구분(뒤에 L이 붙거나 _L로 끝나면 L)
    if (/_L\b|\bL\b/.test(p) || p.endsWith("_L") || p.endsWith(" L")) return "TOWNBORD_L";
    return "TOWNBORD_S";
  }
  return POLICY_KEY_NONE;
}

/* =========================
 * 구간(rate) 조회
 * ========================= */
export function rateFromRanges(ranges: RangeRule[] | undefined, value: number): number {
  if (!ranges || !Number.isFinite(value)) return 0;
  for (const r of ranges) {
    if (value >= r.min && value <= r.max) return clamp01(r.rate);
  }
  return 0;
}

/* =========================
 * 메인 계산 함수
 *  - months: 계약 개월수(1~12)
 *  - baseMonthly: 기본 월 광고료(정가)
 *  - monthlyFeeY1: 12개월 전용 월가(별도 제공 시)
 *  - sameProductCountInCart: 같은 상품 유형의 카트 수량(사전보상 할인용)
 * 결과:
 *  - monthly: 할인 적용 후 월 광고료(반올림)
 *  - rate: 총 할인율(0~1)
 * ========================= */
export function calcMonthlyWithPolicy(
  productName: string | undefined,
  months: number,
  baseMonthly: number,
  monthlyFeeY1: number | undefined,
  sameProductCountInCart: number,
  policy: DiscountPolicy = DEFAULT_POLICY,
): { monthly: number; rate: number } {
  if (!Number.isFinite(baseMonthly) || baseMonthly <= 0) {
    return { monthly: 0, rate: 0 };
  }

  // 12개월 전용 월가가 제공되면 그것을 우선 사용
  if (months === 12 && Number.isFinite(monthlyFeeY1) && (monthlyFeeY1 as number) > 0) {
    const y1 = Math.round(monthlyFeeY1 as number);
    const impliedRate = clamp01(1 - y1 / baseMonthly);
    return { monthly: y1, rate: impliedRate };
  }

  const key = normPolicyKey(productName);
  const rules = key !== POLICY_KEY_NONE ? policy[key] : undefined;

  const periodRate = rateFromRanges(rules?.period, months);
  const precompRate = rateFromRanges(rules?.precomp, sameProductCountInCart);

  // 복합 할인: (1 - a) * (1 - b) 형태로 합성
  const effectiveRate = clamp01(1 - (1 - periodRate) * (1 - precompRate));
  const monthly = Math.round(baseMonthly * (1 - effectiveRate));

  return { monthly, rate: effectiveRate };
}

/* =========================
 * 보조: 카트 한 줄 계산(선택)
 * ========================= */
export type CartPricingInput = {
  productName?: string;
  months: number;
  baseMonthly: number;
  monthlyFeeY1?: number;
  sameProductCountInCart: number;
};

export type CartPricingOutput = CartPricingInput & {
  discountedMonthly: number;
  discountRate: number; // 0~1
  lineTotal: number; // discountedMonthly * months
};

/** 카트 아이템 1개에 정책 적용 */
export function priceCartItem(input: CartPricingInput, policy: DiscountPolicy = DEFAULT_POLICY): CartPricingOutput {
  const { productName, months, baseMonthly, monthlyFeeY1, sameProductCountInCart } = input;
  const { monthly, rate } = calcMonthlyWithPolicy(
    productName,
    months,
    baseMonthly,
    monthlyFeeY1,
    sameProductCountInCart,
    policy,
  );
  return {
    ...input,
    discountedMonthly: monthly,
    discountRate: rate,
    lineTotal: monthly * months,
  };
}

/* =========================
 * 내부 유틸
 * ========================= */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
