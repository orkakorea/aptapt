// src/components/mobile/QuotePanel.tsx
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

  installLocation?: string; // 설치 위치 (PC 견적서와 동일 컬럼용)

  households?: number; // 세대수
  residents?: number; // 거주인원
  monthlyImpressions?: number; // 월송출횟수
  monitors?: number; // 모니터 수량

  baseMonthly: number; // 월광고료(운영사 기준, FMK=4주)
  listPrice?: number; // 기준금액(표시용. 없으면 baseMonthly로 대체 또는 "-")

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

/* % 표시 (기존: 단순 정수 %) */
function fmtRate(r?: number) {
  if (r === undefined || r === null) return dash;
  if (r <= 0) return dash;
  return `${Math.round(r * 100)}%`;
}

/* PC 견적서와 동일한 할인율 포맷 (소수 1자리, 0이면 "-") */
function fmtDiscountRate(rate?: number) {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return "-";
  const rounded = Math.round(rate * 1000) / 10; // 소수 1자리 기준 반올림
  const text = rounded.toFixed(1).replace(/\.0$/, "");
  return `${text}%`;
}

/* 단위 있는 숫자 */
function withUnit(n?: number, unit?: string) {
  if (n === undefined || n === null || Number.isNaN(n)) return dash;
  return unit ? `${nf.format(n)}${unit}` : nf.format(n);
}

/* 문자열 안전 표시 ("—" 대체) */
function safeText(s?: string) {
  if (s === undefined || s === null) return dash;
  const trimmed = String(s).trim();
  return trimmed.length > 0 ? trimmed : dash;
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
      {/* ✅ 1) 상단 요약: 스크롤 컨테이너 바깥으로 분리 */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="text-[12px] font-extrabold text-gray-800 whitespace-nowrap leading-tight">
          총 {summary.count}개 단지 · 세대수 {withUnit(summary.households, "세대")} · 거주인원{" "}
          {withUnit(summary.residents, "명")} · 월송출횟수 {withUnit(summary.monthlyImpressions, "회")} · 모니터수량{" "}
          {withUnit(summary.monitors, "대")}
        </div>
        <div className="ml-4 text-[10px] text-gray-400 whitespace-nowrap">(단위 · 원 / VAT별도)</div>
      </div>

      {/* ✅ 2) 테이블만 가로 스크롤 */}
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          <div className="rounded-2xl border overflow-hidden">
            <table className="min-w-[1200px] w-full text-[12px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-gray-700">
                  <Th>단지명</Th>
                  <Th className="w-[140px]">상품명</Th>
                  <Th className="w-[120px]">설치위치</Th>
                  <Th className="w-[90px] text-right">세대수</Th>
                  <Th className="w-[100px] text-right">거주인원</Th>
                  <Th className="w-[100px] text-right">모니터 수량</Th>
                  <Th className="w-[110px] text-right">월 송출 횟수</Th>
                  <Th className="w-[140px] text-right">월광고료(FMK=4주)</Th>
                  <Th className="w-[90px] text-center">광고기간</Th>
                  <Th className="w-[120px] text-right">기준금액</Th>
                  <Th className="w-[100px] text-center">할인율</Th>
                  <Th className="w-[130px] text-right">총광고료</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it) => {
                  const monthly = it._monthly ?? it.baseMonthly ?? 0;
                  const subtotal = it._total ?? monthly * (it.months ?? 1);

                  // ✅ 기준금액 = 월광고료 × 광고기간 (PC: baseTotal)
                  const listPrice = (it.baseMonthly ?? 0) * (it.months ?? 1);

                  // ✅ 복합 할인율: _discountRate 우선, 없으면 기간/사전보상으로 계산
                  const periodRate = it.discPeriodRate ?? 0;
                  const precompRate = it.discPrecompRate ?? 0;
                  const combinedRate =
                    typeof it._discountRate === "number" ? it._discountRate : 1 - (1 - precompRate) * (1 - periodRate);

                  const discountText = fmtDiscountRate(combinedRate);

                  return (
                    <tr key={it.rowKey} className="bg-white">
                      {/* 단지명 */}
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

                      {/* 상품명 */}
                      <Td>{safeText(it.productName)}</Td>

                      {/* 설치위치 */}
                      <Td>{safeText(it.installLocation)}</Td>

                      {/* 세대수 */}
                      <Td className="text-right">{withUnit(it.households, "세대")}</Td>

                      {/* 거주인원 */}
                      <Td className="text-right">{withUnit(it.residents, "명")}</Td>

                      {/* 모니터 수량 */}
                      <Td className="text-right">{withUnit(it.monitors, "대")}</Td>

                      {/* 월 송출 횟수 */}
                      <Td className="text-right">{withUnit(it.monthlyImpressions, "회")}</Td>

                      {/* 월광고료(FMK=4주) */}
                      <Td className="text-right">{fmtWon(it.baseMonthly ?? 0)}</Td>

                      {/* 광고기간 */}
                      <Td className="text-center">{withUnit(it.months, "개월")}</Td>

                      {/* 기준금액 */}
                      <Td className="text-right">{fmtWon(listPrice)}</Td>

                      {/* 할인율 (PC와 동일 스타일: 뱃지 or "-") */}
                      <Td className="text-center">
                        {discountText === "-" ? (
                          "-"
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-[11px] font-semibold px-2 py-[2px] align-middle">
                            {discountText}할인
                          </span>
                        )}
                      </Td>

                      {/* 총광고료 */}
                      <Td className="text-right font-semibold" style={{ color: brandColor }}>
                        {fmtWon(subtotal)}
                      </Td>
                    </tr>
                  );
                })}

                {/* TOTAL 행 (PC와 동일 위치/형식) */}
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
      </div>

      {/* 합계 영역 (PC 로직과 동일 값 사용) */}
      <div className="rounded-2xl border bg-white">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="text-[13px] text-gray-700">부가세 (VAT 10%)</div>
          <div className="text-[13px] font-semibold text-gray-900">{fmtWon(vat)}</div>
        </div>

        {/* 라벨/금액 분리: 금액 오른쪽 정렬, 라벨 크기=부가세 라벨 크기 */}
        <div className="px-4 py-3">
          <div className="flex items-baseline justify-between">
            <div className="text-[13px] text-gray-700">최종 광고료(VAT 포함)</div>
            <div className="text-[22px] font-extrabold text-right" style={{ color: brandColor }}>
              {fmtWon(grand)}
            </div>
          </div>
        </div>
      </div>

      {/* 안내문구 → 오른쪽 정렬 */}
      <div className="text-[11px] text-gray-500 leading-relaxed text-right">
        ※ 계약 시점의 운영사 정책에 따라 단가가 변경 될 수 있습니다.
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
