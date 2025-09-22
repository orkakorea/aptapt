import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import InquiryModal from "./InquiryModal";

/** =========================
 *  외부에서 사용할 라인아이템 타입
 *  ========================= */
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
 *  워터마크 유틸
 *  ========================= */
function buildWatermarkDataURL(text: string) {
  // 작은 글자, 빽빽한 타일
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='220' height='90'>
  <style>
    @font-face { font-family: Pretendard; src: local('Pretendard'); }
    text { font-family: Pretendard, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans KR", sans-serif; }
  </style>
  <text x='0' y='18' font-size='12' fill='#6B7280' fill-opacity='0.5'>${text}</text>
  <text x='0' y='42' font-size='12' fill='#6B7280' fill-opacity='0.5'>${text}</text>
  <text x='0' y='66' font-size='12' fill='#6B7280' fill-opacity='0.5'>${text}</text>
</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

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
  // 타이틀의 가운데 "-" 제거
  title = "응답하라 입주민이여",
  // 부제목 교체
  subtitle = "주식회사 오르카코리아 아파트 엘리베이터 광고 견적",
}: QuoteModalProps) {
  if (typeof document === "undefined") return null;
  if (!open) return null;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false); // 견적 하단 CTA → 구좌문의 모달

  // 워터마크 스타일 (대각선, 작고 빽빽)
  const watermarkStyle = useMemo<React.CSSProperties>(() => {
    const text = "Copyright © 2025 ORKA KOREA. All rights reserved";
    return {
      position: "absolute",
      inset: 0,
      // 살짝 진하지만 전체 투명도는 낮게: 배경 타일은 0.5, 오버레이에 0.08
      opacity: 0.08,
      transform: "rotate(-30deg) scale(1.4)",
      transformOrigin: "center",
      backgroundImage: buildWatermarkDataURL(text),
      backgroundRepeat: "repeat",
      backgroundSize: "220px 90px",
      pointerEvents: "none",
      zIndex: 5,
    };
  }, []);

  // Body 스크롤 잠금 + ESC 닫기
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const computed = useMemo(() => {
    const rows = (items ?? []).map((it) => {
      const productKey = it.productKeyHint || classifyProductForPolicy(it.mediaName);
      const rule = productKey ? DEFAULT_POLICY[productKey] : undefined;
      const periodRate = findRate(rule?.period, it.months);
      const precompRate = productKey === "ELEVATOR TV" ? findRate(rule?.precomp, it.months) : 0;

      const baseMonthly = it.baseMonthly ?? 0;
      const baseTotal = baseMonthly * it.months;
      const monthlyAfter = Math.round(baseMonthly * (1 - precompRate) * (1 - periodRate));
      const lineTotal = monthlyAfter * it.months;

      return { it, productKey, periodRate, precompRate, baseMonthly, baseTotal, monthlyAfter, lineTotal };
    });

    const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);
    const vat = Math.round(subtotal * vatRate);
    const total = subtotal + vat;

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

  // InquiryModal에 넘길 prefill 생성 (InquiryModal.pickCartTotal과 호환)
  const inquiryPrefill = useMemo(() => {
    const first = items?.[0];
    const monthsMax = Math.max(...(items.map((i) => i.months) as number[]), 0);

    // InquiryModal의 pickCartTotal이 인식하는 필드명(cartTotal / items[].item_total_won 등) 사용
    const cart_snapshot = {
      months: monthsMax || undefined,
      cartTotal: computed.subtotal,
      items: (items ?? []).map((it) => {
        // lineTotal 계산 로직을 여기서도 동일하게 재현
        const productKey = it.productKeyHint || classifyProductForPolicy(it.mediaName);
        const rule = productKey ? DEFAULT_POLICY[productKey] : undefined;
        const periodRate = findRate(rule?.period, it.months);
        const precompRate = productKey === "ELEVATOR TV" ? findRate(rule?.precomp, it.months) : 0;

        const baseMonthly = it.baseMonthly ?? 0;
        const monthlyAfter = Math.round(baseMonthly * (1 - precompRate) * (1 - periodRate));
        const lineTotal = monthlyAfter * it.months;

        return {
          apt_name: it.name,
          product_name: it.mediaName,
          product_code: productKey,
          months: it.months,
          item_total_won: lineTotal,
          total_won: lineTotal,
        };
      }),
    };

    return {
      apt_id: null,
      apt_name: first?.name ?? null,
      product_code: undefined,
      product_name: first?.mediaName ?? null,
      cart_snapshot,
    };
  }, [items, computed.subtotal]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999]">
        {/* 딤드 */}
        <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

        {/* 패널 */}
        <div className="absolute inset-0 overflow-x-auto overflow-y-auto">
          <div
            ref={panelRef}
            className="relative min-w-[1600px] max-w-[1600px] mx-auto my-10 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 워터마크 오버레이 (대각선, 빽빽) */}
            <div aria-hidden="true" style={watermarkStyle} />

            {/* 실제 콘텐츠 래퍼 */}
            <div className="relative z-10">
              {/* 헤더 */}
              <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl">
                <div>
                  <div className="text-lg font-bold text-black">{title}</div>
                  <div className="text-sm text-[#6B7280] mt-1">{subtitle}</div>
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

              {/* 상단 카운터 + (단위) */}
              <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                <div className="text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-semibold">{`총 ${computed.totals.count}개 단지`}</span>
                  <span>· 세대수 <b>{fmtNum(computed.totals.households)}</b> 세대</span>
                  <span>· 거주인원 <b>{fmtNum(computed.totals.residents)}</b> 명</span>
                  <span>· 송출횟수 <b>{fmtNum(computed.totals.monthlyImpressions)}</b> 회</span>
                  <span>· 모니터수량 <b>{fmtNum(computed.totals.monitors)}</b> 대</span>
                </div>
                <div className="text-xs text-[#9CA3AF]">(단위 · 원 / VAT별도)</div>
              </div>

              {/* 테이블 */}
              <div className="px-6 pb-4">
                <div className="rounded-xl border border-[#E5E7EB]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] text-[#111827]">
                        <Th className="text-left">단지명</Th>
                        <Th>광고기간</Th>
                        {/* 날짜열 삭제됨 */}
                        <Th>상품명</Th>
                        <Th>세대수</Th>
                        <Th>거주인원</Th>
                        <Th>월송출횟수</Th>
                        <Th>모니터 수량</Th>
                        <Th>월광고료(FMK=4주)</Th>
                        <Th>기준금액</Th>
                        <Th>기간할인</Th>
                        <Th>사전보상할인</Th>
                        <Th className="!text-[#6C2DFF]">총광고료</Th>
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
                            <Td className="text-left font-medium text-black">{it.name}</Td>
                            <Td center nowrap>{fmtNum(it.months, "개월")}</Td>
                            <Td center nowrap>{safe(it.mediaName)}</Td>
                            <Td center nowrap>{fmtNum(it.households, "세대")}</Td>
                            <Td center nowrap>{fmtNum(it.residents, "명")}</Td>
                            <Td center nowrap>{fmtNum(it.monthlyImpressions, "회")}</Td>
                            <Td center nowrap>{fmtNum(it.monitors, "대")}</Td>
                            <Td center nowrap>{fmtWon(baseMonthly)}</Td>
                            <Td center nowrap>{fmtWon(baseTotal)}</Td>
                            <Td center nowrap>{periodRate > 0 ? `${Math.round(periodRate * 100)}%` : "-"}</Td>
                            <Td center nowrap>{precompRate > 0 ? `${Math.round(precompRate * 100)}%` : "-"}</Td>
                            <Td center nowrap className="font-bold text-[#6C2DFF]">{fmtWon(lineTotal)}</Td>
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
                    {/* 30% 확대 + 밑줄 제거 */}
                    <span className="text-[18px] text-[#6C2DFF] font-semibold">
                      최종광고료
                    </span>
                    {/* 오른쪽 금액도 동일 비율 확대 */}
                    <span className="text-[21px] font-bold text-[#6C2DFF]">
                      {fmtWon(computed.total)} <span className="text-xs text-[#6B7280] font-medium">(VAT 포함)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => {
                    onSubmitInquiry?.({
                      items,
                      subtotal: computed.subtotal,
                      vat: computed.vat,
                      total: computed.total,
                    });
                  }}
                  className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
                >
                  위 견적으로 구좌 (T.O.) 문의하기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* (선택) 구좌문의 모달을 바로 열어야 할 때 사용할 수 있음 */}
      {inquiryOpen && (
        <InquiryModal
          open={inquiryOpen}
          onClose={() => setInquiryOpen(false)}
          prefill={inquiryPrefill as any}
        />
      )}
    </>,
    document.body
  );
}

/** 헤더 셀: 가운데 정렬 + 내용과 동일한 크기(text-sm) + Bold */
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-6 py-4 text-center text-sm font-bold border-b border-[#E5E7EB] ${className}`}>
      {children}
    </th>
  );
}

/** 데이터 셀: 기본 가운데, 필요 시 text-left/nowrap 조합 사용 */
function Td({
  children,
  className = "",
  center,
  nowrap,
}: React.PropsWithChildren<{ className?: string; center?: boolean; nowrap?: boolean }>) {
  return (
    <td
      className={`px-6 py-4 align-middle text-[#111827] ${center ? "text-center" : ""} ${
        nowrap ? "whitespace-nowrap" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}
