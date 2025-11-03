import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, ExternalLink, FileSignature, Mail, X, CheckCircle2 } from "lucide-react";

import type { CompleteModalProps, ReceiptData, ReceiptSeat } from "./types";
import { isSeatReceipt } from "./types";

import { saveFullContentAsPNG, saveFullContentAsPDF } from "@/core/utils/capture";
import { calcMonthlyWithPolicy, normPolicyKey, DEFAULT_POLICY, rateFromRanges } from "@/core/pricing";
import { adaptQuoteItemsFromReceipt } from "@/core/utils/receipt";

/* =======================================================================
 * 공통 상수/유틸
 * ======================================================================= */
const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

const formatKRW = (n?: number | null) =>
  n == null || !isFinite(Number(n)) ? "₩0" : "₩" + Number(n).toLocaleString("ko-KR");

function formatKST(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const f = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return f.format(d) + " KST";
  } catch {
    return "";
  }
}

function toYMD(input?: any): string | undefined {
  if (input == null || input === "") return undefined;
  const v = typeof input === "string" ? input.trim() : input;
  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return typeof v === "string" ? v : undefined;
}

function parseMonths(value: any): number {
  if (value == null) return 0;
  if (typeof value === "number" && isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const num = parseInt(value.replace(/[^\d]/g, ""), 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function maskEmail(email?: string | null) {
  if (!email) return "-";
  const str = String(email);
  const at = str.indexOf("@");
  if (at <= 0) return str.slice(0, 2) + "…";
  const local = str.slice(0, at);
  const domain = str.slice(at + 1);
  const shown = local.slice(0, 2);
  const masked = local.length > 2 ? "*".repeat(local.length - 2) : "";
  return `${shown}${masked}@${domain}`;
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/* 숫자 파서(문자열 "12,345" → 12345) */
function num(v: any): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.replace(/[^\d.-]/g, "");
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }
  return 0;
}
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/* =======================================================================
 * 헤더(성공)
 * ======================================================================= */
function HeaderSuccess({ ticketCode, createdAtISO }: { ticketCode: string; createdAtISO: string }) {
  const kst = useMemo(() => formatKST(createdAtISO), [createdAtISO]);
  return (
    <div className="flex items-center gap-3">
      <motion.div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_LIGHT }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <CheckCircle2 size={28} color={BRAND} />
      </motion.div>
      <div>
        <div className="text-lg font-semibold">문의가 접수됐어요!</div>
        <div className="mt-0.5 text-sm text-gray-500">
          접수번호 {ticketCode} · {kst}
        </div>
      </div>
    </div>
  );
}

/* =======================================================================
 * 오른쪽: 다음 절차 카드
 * ======================================================================= */
function NextSteps() {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="mb-2 text-sm font-semibold">다음 절차</div>
      <ol className="space-y-3">
        <li className="grid grid-cols-[28px_1fr] items-start gap-3">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND_LIGHT }}
          >
            <ClipboardList size={16} color={BRAND} />
          </span>
          <div className="text-sm leading-6">
            <b>구좌(T.O) 확인 (1~2일 소요)</b>
          </div>
        </li>
        <li className="grid grid-cols-[28px_1fr] items-start gap-3">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND_LIGHT }}
          >
            <Mail size={16} color={BRAND} />
          </span>
          <div className="text-sm leading-6">
            <b>맞춤 견적 전달</b> (이메일,전화)
          </div>
        </li>
        <li className="grid grid-cols-[28px_1fr] items-start gap-3">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: BRAND_LIGHT }}
          >
            <FileSignature size={16} color={BRAND} />
          </span>
          <div className="text-sm leading-6">
            <b>상담/계약</b> (전자 계약)
          </div>
        </li>
      </ol>
    </div>
  );
}

/* =======================================================================
 * 좌: 고객 문의(항상 펼침)
 * ======================================================================= */
function RowLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 break-words text-sm text-gray-800">{value || "-"}</div>
    </div>
  );
}

function CustomerInquirySection({ data }: { data: ReceiptData }) {
  const c: any = (data as any).customer || {};
  const form: any = (data as any).form || {};
  const summary: any = (data as any).summary || {};

  const emailMasked = maskEmail(c.email ?? form.email ?? null) || (c.emailDomain ? `**${String(c.emailDomain)}` : "-");
  const campaignType = form.campaignType ?? form.campaign_type ?? summary.campaignType ?? summary.campaign_type ?? "-";

  const preferredRaw =
    form.desiredDate ??
    form.hopeDate ??
    summary.desiredDate ??
    summary.hopeDate ??
    (data as any)?.meta?.desiredDate ??
    (data as any)?.meta?.startDate ??
    (data as any)?.meta?.start_date;

  const desiredValue =
    toYMD(preferredRaw) ??
    form.periodLabel ??
    form.period_label ??
    (typeof form.months === "number" ? `${form.months}개월` : undefined) ??
    summary.periodLabel ??
    summary.period_label ??
    (typeof summary.months === "number" ? `${summary.months}개월` : undefined) ??
    "-";

  const promoCode =
    form.promotionCode ??
    form.promoCode ??
    form.promotion_code ??
    form.promo_code ??
    summary.promotionCode ??
    summary.promoCode ??
    summary.promotion_code ??
    summary.promo_code ??
    (data as any)?.meta?.promotionCode ??
    (data as any)?.meta?.promoCode ??
    (data as any)?.meta?.promo_code ??
    "-";

  const inquiryText: string =
    form.request ?? form.message ?? form.memo ?? form.note ?? (data as any)?.meta?.note ?? "-";

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold">고객 문의</span>
      </div>

      <div className="px-4">
        <RowLine label="상호명" value={c.company ?? form.company} />
        <RowLine label="담당자" value={c.name ?? form.manager ?? form.contactName} />
        <RowLine label="연락처" value={c.phoneMasked ?? form.phoneMasked ?? form.phone} />
        <RowLine label="이메일" value={emailMasked} />
        <RowLine label="캠페인 유형" value={campaignType} />
        <RowLine label="광고 송출 예정(희망)일" value={desiredValue} />
        <RowLine label="프로모션코드" value={promoCode} />
      </div>

      <div className="mt-2 border-t border-gray-100 px-4 py-3">
        <div className="mb-2 text-xs text-gray-500">문의내용</div>
        <div
          className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-3 text-sm"
          data-capture-scroll
        >
          {inquiryText}
        </div>
      </div>
    </div>
  );
}

/* =======================================================================
 * 좌: SEAT 문의 내역 (ELEVATOR TV 곱연산)
 *  - 카운터 바는 요청에 따라 제거
 * ======================================================================= */
function SeatInquiryTable({ data }: { data: ReceiptSeat }) {
  const detailsItems: any[] = (data as any)?.details?.items ?? [];
  const snapshotItems: any[] = (data as any)?.form?.cart_snapshot?.items ?? (data as any)?.cart_snapshot?.items ?? [];
  const length = Math.max(detailsItems.length, snapshotItems.length);

  const getVal = (obj: any, keys: string[], fallback?: any) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return fallback;
  };

  const topFallback =
    typeof (data as any)?.summary?.topAptLabel === "string"
      ? String((data as any).summary.topAptLabel).replace(/\s*외.*$/, "")
      : "-";

  const productKeyCounts = (() => {
    const m = new Map<string, number>();
    const src = Array.isArray(snapshotItems) && snapshotItems.length ? snapshotItems : detailsItems;
    src.forEach((raw) => {
      const p = raw?.product_name ?? raw?.productName ?? raw?.product_code ?? raw?.mediaName ?? "";
      const key = normPolicyKey(p);
      if (!key || key === "_NONE") return;
      m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  })();

  const rows = Array.from({ length }).map((_, i) => {
    const primary = detailsItems[i] ?? {};
    const shadow = snapshotItems[i] ?? {};

    const aptName =
      getVal(primary, ["apt_name", "aptName", "name", "apt", "title"]) ??
      getVal(shadow, ["apt_name", "aptName", "name", "apt", "title"]) ??
      topFallback ??
      "-";

    const months = parseMonths(getVal(primary, ["months", "month"], getVal(shadow, ["months", "month"], 0)));
    const periodLabel = months ? `${months}개월` : getVal(primary, ["period", "periodLabel"], "-");

    const productName =
      getVal(primary, ["productName", "product_name", "mediaName", "product_code"]) ??
      getVal(shadow, ["productName", "product_name", "mediaName", "product_code"]) ??
      "-";

    const baseMonthlyRaw = Number(
      getVal(primary, ["baseMonthly", "priceMonthly"], getVal(shadow, ["baseMonthly", "priceMonthly"], NaN)),
    );
    const baseTotalRaw =
      Number(getVal(primary, ["baseTotal"], NaN)) ||
      (isFinite(baseMonthlyRaw) && months ? baseMonthlyRaw * months : NaN);
    let baseTotal = isFinite(baseTotalRaw) ? baseTotalRaw : NaN;

    const snapLineTotal = Number(
      getVal(
        primary,
        ["lineTotal", "item_total_won", "total_won"],
        getVal(shadow, ["lineTotal", "item_total_won", "total_won"], NaN),
      ),
    );
    const monthlyAfterRaw = Number(
      getVal(
        primary,
        ["monthlyAfter", "monthly_after", "priceMonthlyAfter", "discountedMonthly", "discounted_monthly"],
        getVal(
          shadow,
          ["monthlyAfter", "monthly_after", "priceMonthlyAfter", "discountedMonthly", "discounted_monthly"],
          NaN,
        ),
      ),
    );

    const policyKey = normPolicyKey(String(productName));
    if (!isFinite(baseTotal) && isFinite(baseMonthlyRaw) && months > 0) baseTotal = baseMonthlyRaw * months;
    if (!isFinite(baseTotal) && months > 0) {
      if (isFinite(monthlyAfterRaw)) baseTotal = monthlyAfterRaw * months;
      else if (isFinite(snapLineTotal)) baseTotal = snapLineTotal;
    }
    if (!isFinite(baseTotal)) baseTotal = 0;

    // 할인율
    let discountPct = "-";
    let lineTotal = 0;

    if (policyKey === "ELEVATOR TV") {
      // 곱연산 규칙
      const precompRate = months < 3 ? 0.03 : 0.05;
      const periodRate = months < 3 ? 0.1 : months < 6 ? 0.15 : 0.2;
      const factor = (1 - precompRate) * (1 - periodRate);
      lineTotal = Math.round(baseTotal * factor);
      discountPct = `${Math.round((1 - clamp01(factor)) * 100)}%`;
    } else {
      const sameCount = policyKey && policyKey !== "_NONE" ? (productKeyCounts.get(policyKey) ?? 1) : 1;
      const monthlyProxy = isFinite(baseMonthlyRaw) ? baseMonthlyRaw : baseTotal && months ? baseTotal / months : 0;
      const calc = calcMonthlyWithPolicy(String(productName), months || 1, monthlyProxy, undefined, sameCount);
      const rate = clamp01(calc.rate);
      lineTotal = Math.round((baseTotal || 0) * (1 - rate));
      discountPct = `${Math.round(rate * 100)}%`;
    }

    const baseMonthlyEff =
      baseTotal && months ? Math.round(baseTotal / months) : isFinite(baseMonthlyRaw) ? baseMonthlyRaw : 0;

    return {
      aptName,
      productName,
      monthlyFee: baseMonthlyEff,
      periodLabel,
      baseTotal: baseTotal || 0,
      discountPct,
      lineTotal,
    };
  });

  const periodTotal = rows.reduce((sum, r) => sum + (isFinite(r.lineTotal) ? r.lineTotal : 0), 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      {/* 제목 */}
      <div className="px-4 pt-3 text-sm font-semibold">문의 내역</div>

      {/* 테이블 (카운터 바 제거) */}
      <div className="border-t border-gray-100 overflow-x-auto" data-capture-scroll>
        <table className="min-w-[920px] text-[13px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="[&>th]:px-4 [&>th]:py-2">
              <th className="text-left">단지명</th>
              <th className="text-left">상품명</th>
              <th className="text-right">월광고료</th>
              <th className="text-right">광고기간</th>
              <th className="text-right">기준금액</th>
              <th className="text-right">할인율</th>
              <th className="text-right text-[#6C2DFF]">총광고료</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-4 [&>tr>td]:py-2">
            {rows.length ? (
              rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="font-medium text-gray-900">{r.aptName}</td>
                  <td className="truncate">{r.productName}</td>
                  <td className="text-right">{formatKRW(r.monthlyFee)}</td>
                  <td className="text-right">{r.periodLabel}</td>
                  <td className="text-right">{formatKRW(r.baseTotal)}</td>
                  <td className="text-right">{r.discountPct}</td>
                  <td className="text-right font-semibold text-[#6C2DFF]">{formatKRW(r.lineTotal)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-gray-500">
                  항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 합계 카드 */}
      <div className="px-4 py-4">
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F5FF]">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-600">총 광고료 합계(TOTAL)</span>
            <span className="text-sm font-bold text-[#6C2DFF]">{formatKRW(periodTotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-3">
            <span className="text-sm text-gray-600">부가세(VAT 10%)</span>
            <span className="text-sm font-bold text-red-500">{formatKRW(Math.round(periodTotal * 0.1))}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-4">
            <span className="text-[15px] font-semibold text-[#6C2DFF]">최종 광고료 (VAT 포함)</span>
            <span className="text-[20px] font-extrabold text-[#6C2DFF]">
              {formatKRW(Math.round(periodTotal * 1.1))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =======================================================================
 * 견적서 프리뷰(저장 시점에만 DOM에 붙임)
 *  - adaptQuoteItemsFromReceipt 사용
 *  - ELEVATOR TV는 곱연산, 그 외는 정책 기반
 * ======================================================================= */
function QuotePreviewSection({ data }: { data: ReceiptSeat }) {
  const rawItems: any[] =
    (data as any)?.form?.cart_snapshot?.items ??
    (data as any)?.cart_snapshot?.items ??
    (data as any)?.details?.items ??
    [];

  const items = adaptQuoteItemsFromReceipt(rawItems);

  // 같은 상품군 개수(사전보상 할인 판단용)
  const productKeyCounts = (() => {
    const m = new Map<string, number>();
    items.forEach((it) => {
      const name = (it.mediaName ?? it.productKeyHint ?? "") as string;
      const key = normPolicyKey(name);
      if (!key || key === "_NONE") return;
      m.set(key, (m.get(key) || 0) + 1);
    });
    return m;
  })();

  type Row = {
    apt: string;
    months: number;
    media: string;
    households?: number;
    residents?: number;
    impressions?: number;
    monitors?: number;
    baseMonthly: number;
    baseTotal: number;
    periodRate?: number;
    precompRate?: number;
    total: number;
  };

  const rows: Row[] = items.map((it) => {
    const apt = String(it.name ?? "-");
    const months = Number(it.months ?? 0) || 0;
    const media = String(it.mediaName ?? "-");
    const baseMonthly = Number(it.baseMonthly ?? 0) || 0;
    const baseTotal = baseMonthly * (months || 0);

    const key = normPolicyKey(media);
    const rules = key !== "_NONE" ? (DEFAULT_POLICY as any)[key] : undefined;

    let periodRate = 0;
    let precompRate = 0;
    if (key === "ELEVATOR TV") {
      precompRate = months < 3 ? 0.03 : 0.05;
      periodRate = months < 3 ? 0.1 : months < 6 ? 0.15 : 0.2;
    } else {
      periodRate = rateFromRanges(rules?.period, months) || 0;
      const sameCount = key && key !== "_NONE" ? (productKeyCounts.get(key) ?? 1) : 1;
      precompRate = rateFromRanges(rules?.precomp, sameCount) || 0;
    }

    const factor = (1 - precompRate) * (1 - periodRate);
    const total = Math.round((baseTotal || 0) * clamp01(factor));

    return {
      apt,
      months,
      media,
      households: (it as any).households,
      residents: (it as any).residents,
      impressions: (it as any).monthlyImpressions,
      monitors: (it as any).monitors,
      baseMonthly,
      baseTotal,
      periodRate,
      precompRate,
      total,
    };
  });

  const totalSum = rows.reduce((s, r) => s + (isFinite(r.total) ? r.total : 0), 0);

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white" data-capture-scroll>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm font-semibold">견적서 프리뷰</div>
        <div className="text-xs text-gray-500">(저장 시 함께 캡처됩니다)</div>
      </div>
      <div className="border-t border-gray-100 overflow-x-auto">
        <table className="min-w-[1100px] text-[13px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="[&>th]:px-4 [&>th]:py-2">
              <th className="text-left">단지명</th>
              <th className="text-center">광고기간</th>
              <th className="text-left">상품명</th>
              <th className="text-right">세대수</th>
              <th className="text-right">거주인원</th>
              <th className="text-right">월송출횟수</th>
              <th className="text-right">모니터 수량</th>
              <th className="text-right">월광고료(FMK=4주)</th>
              <th className="text-right">기준금액</th>
              <th className="text-right">기간할인</th>
              <th className="text-right">사전보상할인</th>
              <th className="text-right text-[#6C2DFF]">총광고료</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-4 [&>tr>td]:py-2">
            {rows.length ? (
              rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="font-medium text-gray-900">{r.apt}</td>
                  <td className="text-center">{r.months ? `${r.months}개월` : "-"}</td>
                  <td className="truncate">{r.media}</td>
                  <td className="text-right">{r.households ? r.households.toLocaleString() : "-"}</td>
                  <td className="text-right">{r.residents ? r.residents.toLocaleString() : "-"}</td>
                  <td className="text-right">{r.impressions ? r.impressions.toLocaleString() : "-"}</td>
                  <td className="text-right">{r.monitors ? r.monitors.toLocaleString() : "-"}</td>
                  <td className="text-right">{formatKRW(r.baseMonthly)}</td>
                  <td className="text-right">{formatKRW(r.baseTotal)}</td>
                  <td className="text-right">{r.periodRate ? `${Math.round(r.periodRate * 100)}%` : "-"}</td>
                  <td className="text-right">{r.precompRate ? `${Math.round(r.precompRate * 100)}%` : "-"}</td>
                  <td className="text-right font-semibold text-[#6C2DFF]">{formatKRW(r.total)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12} className="py-8 text-center text-xs text-gray-500">
                  표시할 항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-100 bg-gray-50">
              <td colSpan={11} className="px-4 py-3 text-right text-sm font-semibold">
                TOTAL
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold text-[#6C2DFF]">{formatKRW(totalSum)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* =======================================================================
 * 메인 모달
 * ======================================================================= */
function useIsDesktop() {
  const get = () =>
    typeof window === "undefined" || !window.matchMedia ? true : window.matchMedia("(min-width: 1024px)").matches;
  const [val, setVal] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setVal(e.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);
  return val;
}

export default function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  useBodyScrollLock(open);
  const isDesktop = useIsDesktop();

  // 저장선택(액션시트)
  const [pickerOpen, setPickerOpen] = useState(false);

  // 저장 직전 프리뷰 섹션을 DOM에 붙이기 위한 플래그
  const [exporting, setExporting] = useState(false);

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!open) return null;

  const settleNextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

  const handleSave = async (kind: "png" | "pdf") => {
    const root = document.getElementById("receipt-capture");
    if (!root) return;
    try {
      setExporting(true);
      await settleNextFrame(); // 프리뷰 섹션 렌더 안정화 대기
      const scrollContainers = Array.from(root.querySelectorAll<HTMLElement>("[data-capture-scroll]"));
      if (kind === "png") await saveFullContentAsPNG(root, `${data.ticketCode}_receipt`, scrollContainers);
      else await saveFullContentAsPDF(root, `${data.ticketCode}_receipt`, scrollContainers);
    } finally {
      setExporting(false);
    }
  };

  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

  const isSeat = isSeatReceipt(data);

  return createPortal(
    <AnimatePresence>
      <>
        {/* DIM */}
        <motion.div
          key="dim"
          className="fixed inset-0 z-[1200] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* 패널 */}
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            id="receipt-capture"
            key="panel"
            className="flex w-[1000px] max-w-[96vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            style={{ maxHeight: isDesktop ? "90vh" : "92vh" }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-6" data-capture-scroll>
              <div className="grid grid-cols-12 gap-6">
                {/* 좌측 */}
                <div className="col-span-12 lg:col-span-8 space-y-4">
                  <CustomerInquirySection data={data as ReceiptData} />
                  {isSeat && <SeatInquiryTable data={data as ReceiptSeat} />}

                  {/* 저장 시점에만 견적서 프리뷰를 DOM에 포함 */}
                  {isSeat && exporting && <QuotePreviewSection data={data as ReceiptSeat} />}
                </div>

                {/* 우측 */}
                <div className="col-span-12 lg:col-span-4 space-y-4">
                  <NextSteps />

                  <button
                    onClick={() => setPickerOpen(true)}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    문의 내용 저장
                  </button>

                  <div className="rounded-xl border border-gray-100 p-4">
                    <div className="text-sm font-semibold">더 많은 정보</div>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        onClick={() => openExternal(LINK_YT)}
                        className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                      >
                        <ExternalLink size={16} />
                        광고 소재 채널 바로가기
                      </button>
                      <button
                        onClick={() => openExternal(LINK_GUIDE)}
                        className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                      >
                        <ExternalLink size={16} />
                        제작 가이드 바로가기
                      </button>
                      <button
                        onClick={() => openExternal(LINK_TEAM)}
                        className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                      >
                        <ExternalLink size={16} />
                        오르카 구성원 확인하기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
              <button onClick={onClose} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>

        {/* 저장 액션시트 */}
        <AnimatePresence>
          {pickerOpen && (
            <>
              <motion.div
                key="picker-dim"
                className="fixed inset-0 z-[1202] bg-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPickerOpen(false)}
              />
              <motion.div
                key="picker-card"
                className="fixed left-1/2 top-1/2 z-[1203] w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <div className="text-sm font-semibold">문의 내용 저장</div>
                  <button
                    aria-label="close-picker"
                    className="rounded-full p-2 hover:bg-gray-50"
                    onClick={() => setPickerOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        await handleSave("png");
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      이미지(PNG)
                    </button>
                    <button
                      onClick={async () => {
                        await handleSave("pdf");
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      PDF(A4)
                    </button>
                  </div>
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="mt-4 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
                  >
                    닫기
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    </AnimatePresence>,
    document.body,
  );
}
