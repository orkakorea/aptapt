import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import InquiryModal from "./InquiryModal"; // ✅ 구좌문의 모달 임포트
import type { QuoteLineItem } from "./QuoteModal"; // 자기 자신 타입 내보내는 경우 주석처리 필요

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
};

/** =========================
 *  기본 내보내기: QuoteModal
 *  ========================= */
export default function QuoteModal({
  open,
  items,
  vatRate = 0.1,
  onClose,
}: QuoteModalProps) {
  if (typeof document === "undefined") return null;
  if (!open) return null;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false); // ✅ 구좌문의 모달 상태

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

      return { it, periodRate, precompRate, baseMonthly, baseTotal, lineTotal };
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

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999]">
        {/* 딤드 */}
        <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

        {/* 패널 */}
        <div className="absolute inset-0 overflow-x-auto overflow-y-auto">
          <div
            ref={panelRef}
            className="min-w-[1600px] max-w-[1600px] mx-auto my-10 bg-white rounded-2xl shadow-xl border border-[#E5E7EB]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ... (헤더, 테이블, 합계 부분 동일) */}

            {/* CTA */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setInquiryOpen(true)} // ✅ InquiryModal 열기
                className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
              >
                위 견적으로 구좌 (T.O.) 문의하기
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* InquiryModal 붙임 */}
      <InquiryModal
        open={inquiryOpen}
        mode="SEAT"
        onClose={() => setInquiryOpen(false)}
        prefill={{
          cart_snapshot: { items, cartTotal: computed.total },
        }}
      />
    </>,
    document.body
  );
}

/** 헤더 셀 */
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-6 py-4 text-center text-sm font-bold border-b border-[#E5E7EB] ${className}`}>
      {children}
    </th>
  );
}

/** 데이터 셀 */
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
