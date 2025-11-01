// QuoteMiniTable component
// src/components/quote/QuoteMiniTable.tsx
import * as React from "react";
import { useMemo } from "react";
import { computeQuoteTotals, QuoteLineItemCompat } from "@/core/utils/receipt";

/** 숫자 포맷 유틸 */
const fmtWon = (n?: number) => (typeof n === "number" && isFinite(n) ? `${n.toLocaleString()}원` : "—");
const fmtNum = (n?: number, unit = "") =>
  typeof n === "number" && isFinite(n) ? `${n.toLocaleString()}${unit}` : undefined;
const safe = (s?: string) => (s && s.trim().length ? s : "—");

/** 내부 계산: 월광고료(= monthlyAfter 우선, 없으면 lineTotal/months) */
function inferMonthlyAfter(it: QuoteLineItemCompat): number | undefined {
  if (typeof it.monthlyAfter === "number" && isFinite(it.monthlyAfter)) return it.monthlyAfter;
  if (typeof it.lineTotal === "number" && isFinite(it.lineTotal) && it.months > 0) {
    return Math.round(it.lineTotal / it.months);
  }
  return undefined;
}

/** 내부 계산: 기준금액(= baseMonthly * months) */
function inferBaseTotal(it: QuoteLineItemCompat): number | undefined {
  if (typeof it.baseMonthly === "number" && isFinite(it.baseMonthly) && it.months > 0) {
    return Math.round(it.baseMonthly * it.months);
  }
  return undefined;
}

/** 내부 계산: 할인율(= 1 - monthlyAfter/baseMonthly) */
function inferDiscountRate(it: QuoteLineItemCompat): number | undefined {
  if (typeof it.baseMonthly === "number" && isFinite(it.baseMonthly) && it.baseMonthly > 0) {
    const ma = inferMonthlyAfter(it);
    if (typeof ma === "number" && isFinite(ma)) {
      const rate = 1 - ma / it.baseMonthly;
      // 허용범위 안쪽만 표기(이상치 가드)
      if (rate > -0.01 && rate < 0.9) return rate;
    }
  }
  return undefined;
}

/** 헤더 셀 / 데이터 셀 */
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-6 py-3 text-center text-sm font-bold border-b border-[#E5E7EB] ${className}`}>{children}</th>
  );
}
function Td({
  children,
  className = "",
  center,
  nowrap,
}: React.PropsWithChildren<{ className?: string; center?: boolean; nowrap?: boolean }>) {
  return (
    <td
      className={`px-6 py-3 align-middle text-[#111827] ${center ? "text-center" : ""} ${
        nowrap ? "whitespace-nowrap" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/** 카운터 바: “총 N개 단지 · 세대수 … · 모니터수량 …” */
export function QuoteMiniCounters({ items }: { items: QuoteLineItemCompat[] }) {
  const totals = useMemo(() => computeQuoteTotals(items), [items]);
  return (
    <div className="px-5 pt-1 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
      <span className="font-medium">{`총 ${totals.count}개 단지`}</span>
      {fmtNum(totals.households) && (
        <span>
          · 세대수 <b>{fmtNum(totals.households)}</b> 세대
        </span>
      )}
      {fmtNum(totals.residents) && (
        <span>
          · 거주인원 <b>{fmtNum(totals.residents)}</b> 명
        </span>
      )}
      {fmtNum(totals.monthlyImpressions) && (
        <span>
          · 송출횟수 <b>{fmtNum(totals.monthlyImpressions)}</b> 회
        </span>
      )}
      {fmtNum(totals.monitors) && (
        <span>
          · 모니터수량 <b>{fmtNum(totals.monitors)}</b> 대
        </span>
      )}
    </div>
  );
}

/**
 * 문의 내역 테이블(견적 테이블 축약판)
 * 열 순서(요청): 단지명 / 상품명 / 월광고료 / 광고기간 / 기준금액 / 할인율 / 총 광고료
 */
export default function QuoteMiniTable({
  items,
  className = "",
  showFooterTotal = true,
}: {
  items: QuoteLineItemCompat[];
  className?: string;
  showFooterTotal?: boolean;
}) {
  const total = useMemo(
    () =>
      (items ?? []).reduce((acc, it) => {
        const v = typeof it.lineTotal === "number" && isFinite(it.lineTotal) ? it.lineTotal : 0;
        return acc + v;
      }, 0),
    [items],
  );

  return (
    <div className={className}>
      <div className="rounded-xl border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-[#F9FAFB] text-[#111827]">
              <Th className="text-left">단지명</Th>
              <Th>상품명</Th>
              <Th>월광고료</Th>
              <Th>광고기간</Th>
              <Th>기준금액</Th>
              <Th>할인율</Th>
              <Th className="!text-[#6C2DFF]">총 광고료</Th>
            </tr>
          </thead>
          <tbody>
            {(!items || items.length === 0) && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-[#6B7280]">
                  문의 내역이 없습니다.
                </td>
              </tr>
            )}

            {items?.map((it) => {
              const monthlyAfter = inferMonthlyAfter(it);
              const baseTotal = inferBaseTotal(it);
              const discountRate = inferDiscountRate(it);

              return (
                <tr key={it.id} className="border-t border-[#F3F4F6]">
                  <Td className="text-left font-medium text-black">{safe(it.name)}</Td>
                  <Td center>{safe(it.mediaName)}</Td>
                  <Td center>{fmtWon(monthlyAfter)}</Td>
                  <Td center>{it.months ? `${it.months}개월` : "—"}</Td>
                  <Td center>{fmtWon(baseTotal)}</Td>
                  <Td center>{typeof discountRate === "number" ? `${Math.round(discountRate * 100)}%` : "—"}</Td>
                  <Td center className="font-bold text-[#6C2DFF]">
                    {fmtWon(it.lineTotal)}
                  </Td>
                </tr>
              );
            })}
          </tbody>

          {showFooterTotal && (
            <tfoot>
              <tr className="border-t border-[#E5E7EB]">
                <td colSpan={6} className="text-right px-4 py-4 bg-[#F7F5FF] text-[#6B7280] font-medium">
                  TOTAL
                </td>
                <td className="px-4 py-4 bg-[#F7F5FF] text-right font-bold text-[#6C2DFF]">{fmtWon(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
