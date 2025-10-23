import React, { useMemo, useState } from "react";
import { fmtWon } from "@/core/utils";

/* =========================================================================
 * 타입: PC 모달과 동일한 정보(열) 매핑
 *  - 계산 로직은 부모(페이지)에서 완료된 값만 내려옵니다.
 *  - 이 컴포넌트는 "표현 전용"입니다.
 * ========================================================================= */
export type QuoteComputedItem = {
  rowKey: string;
  aptName: string; // 단지명
  productName: string; // 상품명
  months: number; // 광고기간(개월)

  households?: number; // 세대수
  residents?: number; // 거주인원
  monthlyImpressions?: number; // 월송출횟수
  monitors?: number; // 모니터 수량

  baseMonthly: number; // 월광고료(운영사 기준, FMK=4주)
  listPrice?: number; // 기준금액(표시용. 없으면 baseMonthly로 대체 또는 "—")

  // 할인/적용가(부모에서 계산해 전달)
  discPeriodRate?: number; // 기간할인률(0~1)
  discPrecompRate?: number; // 사전보상할인률(0~1)
  _monthly?: number; // 할인 적용 후 월가
  _discountRate?: number; // 총 할인율(0~1) - 필요 시 표시용
  _total?: number; // 라인 소계(월가 × 개월)
};

type Summary = {
  count: number;
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
};

export type QuotePanelProps = {
  items: QuoteComputedItem[];
  total: number; // 공급가(부가세 별도, = items 소계 합계)
  brandColor?: string; // 기본 #6F4BF2
  showVatDefault?: boolean; // VAT 포함/별도 초기값
  onInquiry?: () => void; // 하단 CTA 클릭
  onGoTo?: (rowKey: string) => void; // 단지명 클릭 시 지도 포커싱 등
};

/* 숫자 포맷터 (명/회/대 등) */
const nf = new Intl.NumberFormat("ko-KR");
const dash = "—";
const COLOR_PRIMARY_DEFAULT = "#6F4BF2";

/* % 표시 */
function fmtRate(r?: number) {
  if (r === undefined || r === null) return dash;
  if (!Number.isFinite(r) || r <= 0) return dash;
  return `${Math.round(r * 100)}%`;
}

/* 단위 있는 숫자 (0은 유효값으로 표기) */
function withUnit(n?: number, unit?: string) {
  if (n === undefined || n === null || Number.isNaN(n)) return dash;
  return unit ? `${nf.format(n)}${unit}` : nf.format(n);
}

export default function QuotePanel({
  items,
  total,
  brandColor = COLOR_PRIMARY_DEFAULT,
  showVatDefault = false,
  onInquiry,
  onGoTo,
}: QuotePanelProps) {
  const [showVatIncluded, setShowVatIncluded] = useState<boolean>(showVatDefault);

  // 합계(공급가/부가세/총액)
  const supply = total;
  const vat = Math.round(supply * 0.1);
  const grand = supply + vat;

  // 상단 요약(집계)
  const summary: Summary = useMemo(() => {
    const acc = items.reduce<Required<Summary>>(
      (s, it) => ({
        count: s.count + 1,
        households: s.households + (it.households ?? 0),
        residents: s.residents + (it.residents ?? 0),
        monthlyImpressions: s.monthlyImpressions + (it.monthlyImpressions ?? 0),
        monitors: s.monitors + (it.monitors ?? 0),
      }),
      { count: 0, households: 0, residents: 0, monthlyImpressions: 0, monitors: 0 },
    );
    return acc;
  }, [items]);

  if (!items || items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        장바구니가 비어 있습니다. 단지를 담으면 견적 상세가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 상단 요약 */}
      <div className="rounded-2xl border px-4 py-3 bg-white">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="text-[12px] sm:text-[13px] text-gray-700 leading-relaxed">
            <b>총 {summary.count}개 단지</b> · <b>세대수 {withUnit(summary.households, "세대")}</b> ·{" "}
            <b>거주인원 {withUnit(summary.residents, "명")}</b> ·{" "}
            <b>월송출 {withUnit(summary.monthlyImpressions, "회")}</b> ·{" "}
            <b>모니터수 {withUnit(summary.monitors, "대")}</b>
          </div>
          <div className="text-[11px] text-gray-500">(단위 · 원 / VAT별도)</div>
        </div>
      </div>

      {/* 상세 테이블 */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-[12px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="text-gray-700">
                <Th>단지명</Th>
                <Th className="w-[90px] text-center">광고기간</Th>
                <Th className="w-[140px]">상품명</Th>
                <Th className="w-[90px] text-right">세대수</Th>
                <Th className="w-[100px] text-right">거주인원</Th>
                <Th className="w-[110px] text-right">월송출횟수</Th>
                <Th className="w-[100px] text-right">모니터 수량</Th>
                <Th className="w-[140px] text-right">월광고료(FMK=4주)</Th>
                <Th className="w-[120px] text-right">기준금액</Th>
                <Th className="w-[100px] text-right">기간할인</Th>
                <Th className="w-[120px] text-right">사전보상할인</Th>
                <Th className="w-[130px] text-right">총광고료</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((it) => {
                const monthly = it._monthly ?? it.baseMonthly ?? 0;
                const months = it.months ?? 1;
                const subtotal = it._total ?? monthly * months;
                const listPrice = typeof it.listPrice === "number" ? it.listPrice : (it.baseMonthly ?? undefined);

                return (
                  <tr key={it.rowKey} className="bg-white">
                    <Td>
                      {onGoTo ? (
                        <button
                          type="button"
                          onClick={() => onGoTo(it.rowKey)}
                          className="underline underline-offset-2 hover:opacity-80"
                          title="지도에서 보기"
                        >
                          {it.aptName}
                        </button>
                      ) : (
                        it.aptName
                      )}
                    </Td>
                    <Td className="text-center">{months}개월</Td>
                    <Td>{it.productName}</Td>
                    <Td className="text-right">{withUnit(it.households, "세대")}</Td>
                    <Td className="text-right">{withUnit(it.residents, "명")}</Td>
                    <Td className="text-right">{withUnit(it.monthlyImpressions, "회")}</Td>
                    <Td className="text-right">{withUnit(it.monitors, "대")}</Td>
                    <Td className="text-right">{fmtWon(it.baseMonthly ?? 0)}</Td>
                    <Td className="text-right">{typeof listPrice === "number" ? fmtWon(listPrice) : dash}</Td>
                    <Td className="text-right">{fmtRate(it.discPeriodRate)}</Td>
                    <Td className="text-right">{fmtRate(it.discPrecompRate)}</Td>
                    <Td className="text-right font-semibold" style={{ color: brandColor }}>
                      {fmtWon(subtotal)}
                    </Td>
                  </tr>
                );
              })}

              {/* TOTAL 행 (공급가 총합) */}
              <tr className="bg-gray-50">
                <Td colSpan={11} className="text-right font-semibold">
                  TOTAL
                </Td>
                <Td className="text-right font-extrabold" style={{ color: brandColor }}>
                  {fmtWon(supply)}
                </Td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 합계 영역 */}
      <div className="rounded-2xl border bg-white">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-[13px] text-gray-700">부가세 (VAT 10%)</div>
          <div className="text-[13px] font-semibold text-gray-900">{fmtWon(vat)}</div>
        </div>

        <div className="px-4 py-3">
          <div className="text-[12px] text-gray-500 mb-1">최종광고료</div>
          <div className="text-[22px] font-extrabold" style={{ color: brandColor }}>
            {fmtWon(grand)} <span className="text-[12px] text-gray-500 font-normal">(VAT 포함)</span>
          </div>

          {/* VAT 토글 (표 상단 총액 안내만 전환, 행 단위는 VAT별도 유지) */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowVatIncluded((v) => !v)}
              className="text-[12px] px-3 py-1 rounded-full border bg-white font-semibold"
              title="VAT 포함/별도 보기 전환"
            >
              {showVatIncluded ? "VAT 별도 보기" : "VAT 포함 보기"}
            </button>
            <div className="mt-2 text-[12px] text-gray-600">
              {showVatIncluded ? (
                <>
                  총액(포함): <b className="ml-1">{fmtWon(grand)}</b>
                </>
              ) : (
                <>
                  공급가(별도): <b className="ml-1">{fmtWon(supply)}</b>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 안내문구 */}
      <div className="text-[11px] text-gray-500 leading-relaxed">
        ※ 실제 청구 시점의 운영사 정책 및 사전보상/기간 할인 규칙에 따라 단가가 달라질 수 있습니다. 본 견적은 참고용으로
        제공됩니다.
      </div>

      {/* 하단 CTA */}
      <div className="h-4" />
      <div className="sticky bottom-0 left-0 right-0">
        <div className="pointer-events-none h-6 bg-gradient-to-t from-white to-transparent" />
        <button
          type="button"
          onClick={() => (onInquiry ? onInquiry() : console.log("문의하기 클릭"))}
          className="w-full rounded-2xl py-4 text-white font-bold text-[15px] shadow pointer-events-auto"
          style={{ backgroundColor: brandColor }}
        >
          위 견적으로 구좌(T.O.) 문의하기
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
 * 소형 테이블 셀/헤더 컴포넌트
 *  - style 프롭 허용(오류 원인 해결)
 * ========================================================================= */
function Th({
  className = "",
  style,
  children,
}: React.PropsWithChildren<{ className?: string; style?: React.CSSProperties }>) {
  return (
    <th className={`px-3 py-3 text-left whitespace-nowrap border-b ${className}`} style={style}>
      {children}
    </th>
  );
}

function Td({
  className = "",
  colSpan,
  style,
  children,
}: React.PropsWithChildren<{ className?: string; colSpan?: number; style?: React.CSSProperties }>) {
  return (
    <td className={`px-3 py-3 align-middle whitespace-nowrap ${className}`} colSpan={colSpan} style={style}>
      {children}
    </td>
  );
}
