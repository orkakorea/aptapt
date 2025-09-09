import React, { useMemo } from "react";

/** =========================
 *  타입 (라인 아이템 입력)
 *  ========================= */
export type QuoteLineItem = {
  id: string;                     // 고유키(단지+상품 조합 권장)
  name: string;                   // 단지명
  months: number;                 // 광고기간(개월)
  startDate?: string;             // 송출개시 (YYYY-MM-DD)
  endDate?: string;               // 송출종료 (YYYY-MM-DD)

  // 전시용/계산 보조 데이터 (있으면 표시, 없으면 —)
  mediaName?: string;             // 매체/상품명 (예: 타운보드 L)
  households?: number;            // 세대수
  residents?: number;             // 거주인원
  monthlyImpressions?: number;    // 송출횟수(월)
  monitors?: number;              // 모니터 수량
  baseMonthly?: number;           // 기준 월광고료(FMK=4주)

  // 정책 분류 힌트 (없으면 자동 분류)
  productKeyHint?: keyof DiscountPolicy;
};

/** =========================
 *  할인 정책 / 유틸 (MapChrome과 동일 스펙)
 *  ========================= */
type RangeRule = { min: number; max: number; rate: number };
type ProductRules = { precomp?: RangeRule[]; period: RangeRule[] };
type DiscountPolicy = Record<string, ProductRules>;

const DEFAULT_POLICY: DiscountPolicy = {
  "ELEVATOR TV": {
    precomp: [
      { min: 1, max: 2, rate: 0.03 },
      { min: 3, max: 12, rate: 0.05 },
    ],
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },
  "TOWNBORD_S": {
    period: [
      { min: 1, max: 2, rate: 0 },
      { min: 3, max: 5, rate: 0.1 },
      { min: 6, max: 11, rate: 0.15 },
      { min: 12, max: 12, rate: 0.2 },
    ],
  },
  "TOWNBORD_L": {
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
};

const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");

function findRate(rules: RangeRule[] | undefined, months: number): number {
  if (!rules || !Number.isFinite(months)) return 0;
  return rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0;
}

/** 상품명/설치위치 정보 없이도 최대한 보수적으로 분류:
 *  - _S/_L 키워드 → 우선
 *  - 일반 키워드
 *  - 타운보드는 S 기본
 *  (설치위치가 필요하면 Hint를 넘기도록)
 */
function classifyProductForPolicy(productName?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  if (!pn) return undefined;

  if (pn.includes("townbord_l") || pn.includes("townboard_l") ||
      /\btownbord[-_\s]?l\b/.test(pn) || /\btownboard[-_\s]?l\b/.test(pn)) return "TOWNBORD_L";
  if (pn.includes("townbord_s") || pn.includes("townboard_s") ||
      /\btownbord[-_\s]?s\b/.test(pn) || /\btownboard[-_\s]?s\b/.test(pn)) return "TOWNBORD_S";

  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) return "ELEVATOR TV";
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "HI-POST";

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) return "TOWNBORD_S";
  return undefined;
}

/** =========================
 *  포맷터
 *  ========================= */
const fmtWon = (n?: number) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString()}원` : "—";
const fmtNum = (n?: number, unit = "") =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString()}${unit ? unit : ""}` : "—";
const safe = (s?: string) => (s && s.trim().length > 0 ? s : "—");

/** =========================
 *  컴포넌트
 *  ========================= */
type QuoteModalProps = {
  open: boolean;
  items: QuoteLineItem[];
  vatRate?: number; // 기본 10%
  onClose?: () => void;
  onSubmitInquiry?: (payload: {
    items: QuoteLineItem[];
    subtotal: number;
    vat: number;
    total: number;
  }) => void;
  title?: string;   // 상단 좌측 타이틀
  subtitle?: string; // 상단 좌측 서브타이틀
};

export default function QuoteModal({
  open,
  items,
  vatRate = 0.1,
  onClose,
  onSubmitInquiry,
  title = "응답하라 - 입주민이여",
  subtitle = "아파트 모니터광고 견적내용",
}: QuoteModalProps) {
  const computed = useMemo(() => {
    const rows = items.map((it) => {
      const productKey =
        it.productKeyHint || classifyProductForPolicy(it.mediaName);

      const rule = productKey ? DEFAULT_POLICY[productKey] : undefined;
      const periodRate = findRate(rule?.period, it.months);
      const precompRate =
        productKey === "ELEVATOR TV" ? findRate(rule?.precomp, it.months) : 0;

      const baseMonthly = it.baseMonthly ?? 0;
      const baseTotal = baseMonthly * it.months;

      const monthlyAfter = Math.round(baseMonthly * (1 - precompRate) * (1 - periodRate));
      const lineTotal = monthlyAfter * it.months;

      return {
        it,
        productKey,
        periodRate,
        precompRate,
        baseMonthly,
        baseTotal,
        monthlyAfter,
        lineTotal,
      };
    });

    const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);
    const vat = Math.round(subtotal * vatRate);
    const total = subtotal + vat;

    return { rows, subtotal, vat, total };
  }, [items, vatRate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* 딤드 배경 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 패널 */}
      <div className="absolute inset-0 flex items-start justify-center overflow-auto">
        <div className="mt-10 mb-10 w-[min(1200px,95vw)] bg-white rounded-2xl shadow-xl border border-[#E5E7EB]">
          {/* 헤더 */}
          <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between">
            <div>
              <div className="text-lg font-bold text-black">{title}</div>
              <div className="text-sm text-[#6B7280] mt-1">{subtitle}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xs text-[#9CA3AF]">
                (단위 · 원 / VAT별도)
              </div>
              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
                aria-label="닫기"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* 단지 카운트 */}
          <div className="px-6 pt-4 pb-2 text-sm text-[#6B7280]">
            {`총 ${items.length}개 단지`}
          </div>

          {/* 테이블 */}
          <div className="px-6 pb-4">
            <div className="overflow-auto rounded-xl border border-[#E5E7EB]">
              <table className="min-w-[1100px] w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#4B5563]">
                    <Th>단지명</Th>
                    <Th>광고기간</Th>
                    <Th>송출개시 - 송출종료</Th>
                    <Th>매체</Th>
                    <Th>세대수</Th>
                    <Th>거주인원</Th>
                    <Th>송출횟수</Th>
                    <Th>모니터 수량</Th>
                    <Th>월광고료<br/>(FMK=4주)</Th>
                    <Th>기준금액</Th>
                    <Th>기간할인</Th>
                    <Th>사전보상할인</Th>
                    <Th className="!text-[#6C2DFF]">총광고료</Th>
                  </tr>
                </thead>
                <tbody>
                  {computed.rows.map(({ it, periodRate, precompRate, baseMonthly, baseTotal, lineTotal }, idx) => (
                    <tr key={it.id} className="border-t border-[#F3F4F6]">
                      <Td className="font-medium text-black">{it.name}</Td>
                      <Td>{fmtNum(it.months, "개월")}</Td>
                      <Td>
                        {safe(it.startDate)}{it.startDate || it.endDate ? " - " : ""}{safe(it.endDate)}
                      </Td>
                      <Td>{safe(it.mediaName)}</Td>
                      <Td>{fmtNum(it.households, "세대")}</Td>
                      <Td>{fmtNum(it.residents, "명")}</Td>
                      <Td>{fmtNum(it.monthlyImpressions, "회")}</Td>
                      <Td>{fmtNum(it.monitors, "대")}</Td>
                      <Td>{fmtWon(baseMonthly)}</Td>
                      <Td>{fmtWon(baseTotal)}</Td>
                      <Td>{periodRate > 0 ? `${Math.round(periodRate * 100)}%` : "-"}</Td>
                      <Td>{precompRate > 0 ? `${Math.round(precompRate * 100)}%` : "-"}</Td>
                      <Td className="font-bold text-[#6C2DFF]">{fmtWon(lineTotal)}</Td>
                    </tr>
                  ))}
                </tbody>
                {/* 합계 Row */}
                <tfoot>
                  <tr className="border-t border-[#E5E7EB]">
                    <td colSpan={12} className="text-right px-4 py-4 bg-[#F7F5FF] text-[#6B7280] font-medium">
                      TOTAL
                    </td>
                    <td className="px-4 py-4 bg-[#F7F5FF] text-right font-bold text-[#6C2DFF]">
                      {fmtWon(computed.subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 부가세/최종 */}
          <div className="px-6 pb-6">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F7FF] p-4">
              <div className="flex items-center justify-between text-sm text-[#6B7280]">
                <span>부가세</span>
                <span className="text-black">{fmtWon(computed.vat)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-[#6C2DFF] font-semibold underline underline-offset-2">
                  최종광고료
                </span>
                <span className="text-base font-bold text-[#6C2DFF]">
                  {fmtWon(computed.total)} <span className="text-xs text-[#6B7280] font-medium">(VAT 포함)</span>
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="px-6 pb-6">
            <button
              onClick={() =>
                onSubmitInquiry?.({
                  items,
                  subtotal: computed.subtotal,
                  vat: computed.vat,
                  total: computed.total,
                })
              }
              className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
            >
              위 견적으로 구좌 (T.O.) 문의하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 셀 컴포넌트 (가독성용) */
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold border-b border-[#E5E7EB] ${className}`}>{children}</th>
  );
}
function Td({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return <td className={`px-4 py-3 align-middle text-[#111827] ${className}`}>{children}</td>;
}
