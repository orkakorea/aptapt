import React, { useMemo } from "react";

/** =========================================
 *  외부에서 사용하는 라인아이템 타입 (Named Export)
 *  - MapChrome.tsx 등에서 import { QuoteLineItem } ... 형태로 사용
 *  - 일부 필드는 선택(optional)로 두어 유연성 확보
 * ========================================= */
export type QuoteLineItem = {
  id: string;
  name: string;                 // 단지명
  months: number;
  startDate?: string;
  endDate?: string;

  mediaName?: string;           // 상품명
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
  baseMonthly?: number;         // 월광고료(기준)

  /** 선택 확장 필드: 최종 라인합계/월가 등 외부에서 계산해 전달할 수 있음 */
  monthlyPrice?: number;        // 할인/정책 반영된 "월" 금액 (있으면 사용)
  lineTotal?: number;           // 할인/정책 포함된 라인 합계 (있으면 사용)

  productKeyHint?: string;      // 할인 정책 키 힌트
};

/** =========================================
 *  모달 Props (Default Export Component)
 * ========================================= */
type QuoteModalProps = {
  open: boolean;
  items: QuoteLineItem[];
  onClose: () => void;
  onSubmitInquiry: (payload: {
    items: QuoteLineItem[];
    subtotal: number;
    vat: number;
    total: number;
  }) => void;
  watermarkText?: string; // 워터마크 문구 커스터마이즈
};

/** =========================================
 *  계산 유틸
 *  - 외부에서 lineTotal/monthlyPrice를 주면 우선 사용
 *  - 없을 때는 baseMonthly * months 로 보수적 계산
 *  - VAT는 10% 가정 (스샷 기준)
 * ========================================= */
const VAT_RATE = 0.1;

function getLineTotal(it: QuoteLineItem): number {
  if (typeof it.lineTotal === "number") return it.lineTotal;
  // 월가(할인 반영) * 개월수 우선
  if (typeof it.monthlyPrice === "number") {
    return Math.max(0, Math.round(it.monthlyPrice * (it.months || 1)));
  }
  // 없으면 기준 월광고료(baseMonthly) * 개월수
  if (typeof it.baseMonthly === "number") {
    return Math.max(0, Math.round(it.baseMonthly * (it.months || 1)));
  }
  return 0;
}

function fmtWon(n: number): string {
  try {
    return n.toLocaleString("ko-KR") + "원";
  } catch {
    return `${n}원`;
  }
}

/** =========================================
 *  워터마크 오버레이
 *  - 모달 내부에만 깔림
 *  - 텍스트 기반(해상도 독립, PDF 내보내기 유리)
 * ========================================= */
const WatermarkOverlay: React.FC<{
  text?: string;
  angleDeg?: number;
  rows?: number;
  cols?: number;
  className?: string;
}> = ({
  text = "ORKA KOREA ALL RIGHTS RESERVED",
  angleDeg = -30,
  rows = 6,
  cols = 6,
  className = "",
}) => {
  const total = rows * cols;
  return (
    <div
      aria-hidden="true"
      className={
        "pointer-events-none absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] " +
        className
      }
    >
      <div
        className="absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 opacity-5"
        style={{ transform: `translate(-50%, -50%) rotate(${angleDeg}deg)` }}
      >
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
          }}
        >
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="flex items-center justify-center">
              <span className="select-none whitespace-nowrap text-lg md:text-2xl font-semibold tracking-[0.35em] uppercase text-gray-900/90">
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/** =========================================
 *  견적서 모달 본체 (Default Export)
 *  - MapChrome.tsx 에서 <QuoteModal open items ... /> 로 사용
 *  - 워터마크는 모달 컨테이너에만 적용
 * ========================================= */
const QuoteModal: React.FC<QuoteModalProps> = ({
  open,
  items,
  onClose,
  onSubmitInquiry,
  watermarkText = "ORKA KOREA ALL RIGHTS RESERVED",
}) => {
  const { subtotal, vat, total } = useMemo(() => {
    const sub = items.reduce((acc, it) => acc + getLineTotal(it), 0);
    const v = Math.round(sub * VAT_RATE);
    const t = sub + v;
    return { subtotal: sub, vat: v, total: t };
  }, [items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Dim */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel (워터마크 적용 컨테이너) */}
      <div className="absolute left-1/2 top-8 w-[calc(100%-32px)] max-w-[1120px] -translate-x-1/2 rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        {/* 워터마크 */}
        <WatermarkOverlay text={watermarkText} />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/70 backdrop-blur-[1px]">
          <div>
            <div className="text-lg font-semibold">아파트 모니터광고 견적내용</div>
            <div className="text-xs text-gray-500">단위: 원 / VAT 별도</div>
          </div>
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 px-6 py-5">
          {/* 상단 집계 */}
          <div className="text-sm text-gray-600 mb-3">
            총 <b className="text-gray-900">{items.length}</b>개 단지
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-[920px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <Th>단지명</Th>
                  <Th className="text-center">광고기간</Th>
                  <Th className="text-center">상품명</Th>
                  <Th className="text-center">세대수</Th>
                  <Th className="text-center">거주인원</Th>
                  <Th className="text-center">월송출수</Th>
                  <Th className="text-center">모니터</Th>
                  <Th className="text-right">총광고료</Th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      담긴 견적이 없습니다.
                    </td>
                  </tr>
                )}
                {items.map((it) => {
                  const line = getLineTotal(it);
                  return (
                    <tr key={it.id} className="border-t border-gray-100">
                      <Td className="font-medium text-gray-900">{it.name}</Td>
                      <Td className="text-center">
                        {it.months ? `${it.months}개월` : "—"}
                      </Td>
                      <Td className="text-center">
                        {it.mediaName || "—"}
                      </Td>
                      <Td className="text-center">
                        {it.households ? `${it.households}세대` : "—"}
                      </Td>
                      <Td className="text-center">
                        {it.residents ? `${it.residents}명` : "—"}
                      </Td>
                      <Td className="text-center">
                        {it.monthlyImpressions
                          ? `${it.monthlyImpressions.toLocaleString()}회`
                          : "—"}
                      </Td>
                      <Td className="text-center">
                        {it.monitors ? `${it.monitors}대` : "—"}
                      </Td>
                      <Td className="text-right font-semibold text-[#6C2DFF]">
                        {fmtWon(line)}
                      </Td>
                    </tr>
                  );
                })}
                {items.length > 0 && (
                  <tr className="bg-gray-50 border-t border-gray-100">
                    <Td colSpan={7} className="text-right font-semibold">
                      TOTAL
                    </Td>
                    <Td className="text-right font-semibold">{fmtWon(subtotal)}</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 합계 박스 */}
          <div className="mt-5 rounded-2xl border border-gray-100 bg-white/80 p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-gray-600">부가세</div>
              <div className="text-sm text-gray-900">{fmtWon(vat)}</div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-base font-semibold">최종광고료</div>
              <div className="text-2xl font-extrabold text-[#6C2DFF]">
                {fmtWon(total)} <span className="text-sm font-medium text-gray-500">(VAT 포함)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="relative z-10 px-6 py-4 bg-white/70 backdrop-blur-[1px] border-t border-gray-100">
          <button
            onClick={() => onSubmitInquiry({ items, subtotal, vat, total })}
            className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white text-sm font-semibold hover:opacity-95"
          >
            위 견적으로 구좌 (T.O.) 문의하기
          </button>
        </div>
      </div>
    </div>
  );
};

/** =========================
 *  작은 프레젠테이션용 컴포넌트
 * ========================= */
const Th: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <th
    className={
      "px-4 py-3 text-left font-medium tracking-tight " + (className ?? "")
    }
  >
    {children}
  </th>
);

const Td: React.FC<
  React.PropsWithChildren<{ className?: string; colSpan?: number }>
> = ({ className, children, colSpan }) => (
  <td className={"px-4 py-3 align-middle " + (className ?? "")} colSpan={colSpan}>
    {children}
  </td>
);

export default QuoteModal;
