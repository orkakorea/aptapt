// src/components/QuoteModal.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

/** =========================
 *  외부에서 사용할 라인아이템 타입
 *  ========================= */
export type QuoteLineItem = {
  id: string;
  name: string;
  months: number;
  startDate?: string;
  endDate?: string;

  mediaName?: string;
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
  baseMonthly?: number;

  productKeyHint?: keyof DiscountPolicy;
};

/** =========================
 *  할인 정책 / 유틸
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
function classifyProductForPolicy(productName?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  if (!pn) return undefined;

  if (
    pn.includes("townbord_l") || pn.includes("townboard_l") ||
    /\btownbord[-_\s]?l\b/.test(pn) || /\btownboard[-_\s]?l\b/.test(pn)
  ) return "TOWNBORD_L";
  if (
    pn.includes("townbord_s") || pn.includes("townboard_s") ||
    /\btownbord[-_\s]?s\b/.test(pn) || /\btownboard[-_\s]?s\b/.test(pn)
  ) return "TOWNBORD_S";

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
 *  컴포넌트 Props
 *  ========================= */
type QuoteModalProps = {
  open: boolean;
  items: QuoteLineItem[];
  vatRate?: number;
  onClose?: () => void;
  onSubmitInquiry?: (payload: {
    items: QuoteLineItem[];
    subtotal: number;
    vat: number;
    total: number;
  }) => void;
  title?: string;
  subtitle?: string;
};

/** =========================
 *  기본 내보내기: QuoteModal
 *  ========================= */
export default function QuoteModal({
  open,
  items,
  vatRate = 0.1,
  onClose,
  onSubmitInquiry,
  title = "응답하라 - 입주민이여",
  subtitle = "아파트 모니터광고 견적내용",
}: QuoteModalProps) {
  // SSR 안전장치
  if (typeof document === "undefined") return null;
  if (!open) return null;

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Body 스크롤 잠금 + ESC 로 닫기
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const computed = useMemo(() => {
    const rows = (items ?? []).map((it) => {
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

    // 합계 카운터(세대수/거주인원/송출횟수/모니터수량)
    const sum = <T extends keyof QuoteLineItem>(key: T) =>
      (items ?? []).reduce((acc, cur) => {
        const v = cur[key] as unknown as number | undefined;
        return acc + (Number.isFinite(v) ? (v as number) : 0);
      }, 0);

    const totals = {
      households: sum("households"),
      residents: sum("residents"),
      monthlyImpressions: sum("monthlyImpressions"),
      monitors: sum("monitors"),
      count: items?.length ?? 0,
    };

    return { rows, subtotal, vat, total, totals };
  }, [items, vatRate]);

  // === 포털로 body에 렌더 ===
  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* 딤드 배경 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 패널 (가로 1600 고정, 화면이 더 작으면 가로 스크롤) */}
      <div className="absolute inset-0 overflow-x-auto overflow-y-auto">
        <div
          ref={panelRef}
          className="min-w-[1600px] max-w-[1600px] mx-auto my-10 bg-white rounded-2xl shadow-xl border border-[#E5E7EB]"
          onClick={(e) => e.stopPropagation()} // 내부 클릭 시 닫힘 방지
        >
          {/* 헤더 */}
          <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between sticky top-0 bg-white rounded-t-2xl">
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

          {/* 상단 카운터: 총 단지 수 + 합계 */}
          <div className="px-6 pt-4 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold">{`총 ${computed.totals.count}개 단지`}</span>
            <span>· 세대수 <b>{fmtNum(computed.totals.households)}</b> 세대</span>
            <span>· 거주인원 <b>{fmtNum(computed.totals.residents)}</b> 명</span>
            <span>· 송출횟수 <b>{fmtNum(computed.totals.monthlyImpressions)}</b> 회</span>
            <span>· 모니터수량 <b>{fmtNum(computed.totals.monitors)}</b> 대</span>
          </div>

          {/* 테이블 */}
          <div className="px-6 pb-4">
            <div className="rounded-xl border border-[#E5E7EB]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[#111827]">
                    <Th>단지명</Th>
                    <Th alignRight>광고기간</Th>
                    {/* 삭제됨: 송출개시 - 송출종료 */}
                    <Th>매체</Th>
                    <Th alignRight>세대수</Th>
                    <Th alignRight>거주인원</Th>
                    <Th alignRight>송출횟수</Th>
                    <Th alignRight>모니터 수량</Th>
                    <Th alignRight>월광고료(FMK=4주)</Th>
                    <Th alignRight>기준금액</Th>
                    <Th alignRight>기간할인</Th>
                    <Th alignRight>사전보상할인</Th>
                    <Th alignRight className="!text-[#6C2DFF]">총광고료</Th>
                  </tr>
                </thead>
                <tbody>
                  {computed.rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-10 text-center text-[#6B7280]">
                        담은 단지가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    computed.rows.map(({ it, periodRate, precompRate, baseMonthly, baseTotal, lineTotal }) => (
                      <tr key={it.id} className="border-t border-[#F3F4F6]">
                        <Td className="font-medium text-black">{it.name}</Td>
                        <Td right nowrap>{fmtNum(it.months, "개월")}</Td>
                        {/* 날짜 열 삭제됨 */}
                        <Td nowrap>{safe(it.mediaName)}</Td>
                        <Td right nowrap>{fmtNum(it.households, "세대")}</Td>
                        <Td right nowrap>{fmtNum(it.residents, "명")}</Td>
                        <Td right nowrap>{fmtNum(it.monthlyImpressions, "회")}</Td>
                        <Td right nowrap>{fmtNum(it.monitors, "대")}</Td>
                        <Td right nowrap>{fmtWon(baseMonthly)}</Td>
                        <Td right nowrap>{fmtWon(baseTotal)}</Td>
                        <Td right nowrap>{periodRate > 0 ? `${Math.round(periodRate * 100)}%` : "-"}</Td>
                        <Td right nowrap>{precompRate > 0 ? `${Math.round(precompRate * 100)}%` : "-"}</Td>
                        <Td right nowrap className="font-bold text-[#6C2DFF]">{fmtWon(lineTotal)}</Td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#E5E7EB]">
                    <td colSpan={11} className="text-right px-4 py-4 bg-[#F7F5FF] text-[#6B7280] font-medium">
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
    </div>,
    document.body
  );
}

/** 셀 컴포넌트 */
function Th({
  children,
  className = "",
  alignRight,
}: React.PropsWithChildren<{ className?: string; alignRight?: boolean }>) {
  return (
    <th
      className={`px-6 py-4 text-left text-sm font-bold border-b border-[#E5E7EB] ${alignRight ? "text-right" : ""} ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  right,
  nowrap,
}: React.PropsWithChildren<{ className?: string; right?: boolean; nowrap?: boolean }>) {
  return (
    <td
      className={`px-6 py-4 align-middle text-[#111827] ${right ? "text-right" : ""} ${
        nowrap ? "whitespace-nowrap" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
