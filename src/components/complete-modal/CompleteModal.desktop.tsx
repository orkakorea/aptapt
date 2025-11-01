import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, ExternalLink, FileSignature, Mail, X, CheckCircle2 } from "lucide-react";

import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";

// 전체 저장(잘림 방지) 유틸은 그대로 사용
import { saveFullContentAsPNG, saveFullContentAsPDF } from "@/core/utils/capture";

const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/* ================== 공통 유틸 ================== */
const safeNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);
const fmtKRW = (n?: number | null) =>
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
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => (document.body.style.overflow = prev);
  }, [locked]);
}
function maskEmail(email?: string | null) {
  if (!email) return "";
  const str = String(email);
  const at = str.indexOf("@");
  if (at <= 0) return str.slice(0, 2) + "…";
  const local = str.slice(0, at);
  const domain = str.slice(at + 1);
  const shown = local.slice(0, 2);
  const masked = local.length > 2 ? "*".repeat(local.length - 2) : "";
  return `${shown}${masked}@${domain}`;
}

/* ================== (1)(2) 매핑 로직 보강에 필요한 보조 ================== */
type RangeRule = { min: number; max: number; rate: number };
type ProductRules = { precomp?: RangeRule[]; period: RangeRule[] };
type DiscountPolicy = Record<string, ProductRules>;

const POLICY: DiscountPolicy = {
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
};

const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");
const findRate = (rules: RangeRule[] | undefined, months: number) =>
  !rules || !Number.isFinite(months) ? 0 : (rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0);

function classifyForPolicy(productName?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  if (!pn) return undefined;
  if (/\btownbord[-_\s]?l\b/.test(pn) || pn.includes("townboard_l")) return "TOWNBORD_L";
  if (/\btownbord[-_\s]?s\b/.test(pn) || pn.includes("townboard_s") || pn.includes("townbord")) return "TOWNBORD_S";
  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) return "ELEVATOR TV";
  if (pn.includes("mediameet") || pn.includes("media-meet")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("space") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post")) return "HI-POST";
  return undefined;
}

const pick = (obj: any, keys: string[], fallback?: any) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
};

/* ================== 상단 헤더 ================== */
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

/* ================== 오른쪽: 다음 절차 ================== */
function NextSteps({ variant }: { variant: "SEAT" | "PACKAGE" }) {
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
            <b>{variant === "SEAT" ? "구좌(T.O) 확인 (1~2일 소요)" : "문의 내용 확인 (1~2일)"}</b>
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

/* ================== 좌: 고객 문의(항상 펼침) ================== */
function RowLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 text-sm text-gray-800 break-words">{value || "-"}</div>
    </div>
  );
}
function CustomerInquirySection({ data }: { data: ReceiptPackage | ReceiptSeat | ReceiptData }) {
  const c: any = (data as any).customer || {};
  const form: any = (data as any).form || {};
  const summary: any = (data as any).summary || {};
  const emailMasked = maskEmail(c.email ?? form.email ?? null) || (c.emailDomain ? `**${String(c.emailDomain)}` : "-");

  const campaignType =
    form.campaignType ??
    form.campaign_type ??
    summary.campaignType ??
    summary.campaign_type ??
    c.campaignType ??
    c.campaign_type;

  const preferredRaw =
    form.desiredDate ??
    form.hopeDate ??
    summary.desiredDate ??
    summary.hopeDate ??
    (data as any)?.meta?.desiredDate ??
    (data as any)?.meta?.startDate;
  const desiredValue =
    toYMD(preferredRaw) ??
    form.periodLabel ??
    form.period_label ??
    (typeof form.months === "number" ? `${form.months}개월` : undefined) ??
    summary.periodLabel ??
    summary.period_label ??
    (typeof summary.months === "number" ? `${summary.months}개월` : undefined);

  const promoCode =
    form.promotionCode ??
    form.promoCode ??
    form.promotion_code ??
    form.promo_code ??
    summary.promotionCode ??
    summary.promoCode ??
    summary.promo_code ??
    (data as any)?.meta?.promotionCode ??
    (data as any)?.meta?.promoCode;

  const inquiryText: string =
    form.request ??
    form.message ??
    form.memo ??
    form.note ??
    (data as any)?.meta?.note ??
    (data as any)?.customer?.note ??
    "";

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
          {inquiryText ? inquiryText : "-"}
        </div>
      </div>
    </div>
  );
}

/* ================== 좌: SEAT 전용 문의 내역 ================== */
/** ① 카운터 정상화 / ② 단지명·총광고료 매핑 보강 / ③ 하단 합계 박스 추가 */
function SeatInquiryTable({ data }: { data: ReceiptSeat }) {
  const vatRate = Number(pick((data as any)?.details, ["vatRate", "vat_rate"], 0.1)) || 0.1;

  const rawItems: any[] = (data as any)?.details?.items ?? (data as any)?.cart_snapshot?.items ?? [];

  const rows = (rawItems ?? []).map((it: any) => {
    // 2) 단지명 보강
    const aptName =
      pick(it, ["apt_name", "aptName", "name", "apt", "aptTitle", "complex_name", "complex", "title"], "-") || "-";
    const productName = pick(it, ["product_name", "productName", "mediaName"], "-");

    // 기간/월
    const monthsRaw = pick(it, ["months", "month", "period_months", "periodMonths"], undefined);
    const months = typeof monthsRaw === "number" ? monthsRaw : parseInt(monthsRaw, 10) || 0;
    const periodLabel = months ? `${months}개월` : "-";

    // 월 기준가/월 최종가
    const baseMonthly = Number(
      pick(it, ["baseMonthly", "base_monthly", "priceMonthly", "monthly", "monthly_price"], NaN),
    );
    const policyKey = classifyForPolicy(productName);
    const rule = policyKey ? POLICY[policyKey] : undefined;
    const periodRate = findRate(rule?.period, months);
    const precompRate = policyKey === "ELEVATOR TV" ? findRate(rule?.precomp, months) : 0;
    const monthlyAfter =
      Number(pick(it, ["monthlyAfter", "monthly_after", "priceMonthlyAfter"], NaN)) ||
      (Number.isFinite(baseMonthly) ? Math.round(baseMonthly * (1 - precompRate) * (1 - periodRate)) : NaN);

    // 기준금액(총)
    const baseTotal =
      Number(pick(it, ["baseTotal", "base_total", "total_base_won"], NaN)) ||
      (Number.isFinite(baseMonthly) && months ? baseMonthly * months : NaN);

    // 총 광고료(우선 스냅샷 값, 없으면 계산)
    const lineTotalRaw = pick(it, ["lineTotal", "item_total_won", "total_won", "line_total"], undefined);
    const lineTotal = Number(lineTotalRaw) || (Number.isFinite(monthlyAfter) && months ? monthlyAfter * months : 0);

    // 할인율(표기용)
    const discountRate =
      Number.isFinite(baseTotal) && baseTotal > 0
        ? Math.round((1 - lineTotal / baseTotal) * 100)
        : Number.isFinite(baseMonthly) && baseMonthly > 0 && Number.isFinite(monthlyAfter)
          ? Math.round((1 - monthlyAfter / baseMonthly) * 100)
          : undefined;

    // 카운터용(있으면 집계)
    const households = Number(pick(it, ["households", "household", "hh"], NaN));
    const residents = Number(pick(it, ["residents", "population"], NaN));
    const monthlyImpressions = Number(
      pick(it, ["monthlyImpressions", "monthly_impressions", "impressions", "plays"], NaN),
    );
    const monitors = Number(pick(it, ["monitors", "monitorCount", "monitor_count", "screens"], NaN));

    return {
      aptName,
      productName,
      months,
      periodLabel,
      baseMonthly: Number.isFinite(baseMonthly) ? baseMonthly : undefined,
      baseTotal: Number.isFinite(baseTotal) ? baseTotal : undefined,
      monthlyAfter: Number.isFinite(monthlyAfter) ? monthlyAfter : undefined,
      discountRate,
      lineTotal,
      households: Number.isFinite(households) ? households : 0,
      residents: Number.isFinite(residents) ? residents : 0,
      monthlyImpressions: Number.isFinite(monthlyImpressions) ? monthlyImpressions : 0,
      monitors: Number.isFinite(monitors) ? monitors : 0,
    };
  });

  // 1) 카운터
  const counters = rows.reduce(
    (acc, r) => {
      acc.count += 1;
      acc.households += r.households;
      acc.residents += r.residents;
      acc.monthlyImpressions += r.monthlyImpressions;
      acc.monitors += r.monitors;
      return acc;
    },
    { count: 0, households: 0, residents: 0, monthlyImpressions: 0, monitors: 0 },
  );

  // 금액 합계
  const subtotal = rows.reduce((s, r) => s + (Number.isFinite(r.lineTotal) ? r.lineTotal : 0), 0);
  const vat = Math.round(subtotal * vatRate);
  const total = subtotal + vat;

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      {/* 제목 + 카운터 */}
      <div className="px-4 pt-3">
        <div className="text-sm font-semibold">문의 내역</div>
        <div className="mt-1 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-medium">{`총 ${counters.count}개 단지`}</span>
          <span>
            · 세대수 <b>{counters.households.toLocaleString()}</b> 세대
          </span>
          <span>
            · 거주인원 <b>{counters.residents.toLocaleString()}</b> 명
          </span>
          <span>
            · 송출횟수 <b>{counters.monthlyImpressions.toLocaleString()}</b> 회
          </span>
          <span>
            · 모니터수량 <b>{counters.monitors.toLocaleString()}</b> 대
          </span>
        </div>
      </div>

      {/* 표: (2) 컬럼 재배치 — 단지명/상품명/월광고료/광고기간/기준금액/할인율/총광고료 */}
      <div className="border-t border-gray-100 overflow-x-auto whitespace-nowrap" data-capture-scroll>
        <table className="min-w-[860px] w-full text-[13px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="[&>th]:px-3 [&>th]:py-2">
              <th className="text-left">단지명</th>
              <th className="text-left">상품명</th>
              <th className="text-right">월광고료</th>
              <th className="text-right">광고기간</th>
              <th className="text-right">기준금액</th>
              <th className="text-right">할인율</th>
              <th className="text-right">총광고료</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
            {rows.length ? (
              rows.map((r, idx) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="text-left font-medium">{r.aptName}</td>
                  <td className="text-left">{r.productName}</td>
                  <td className="text-right">{r.monthlyAfter ? fmtKRW(r.monthlyAfter) : "—"}</td>
                  <td className="text-right">{r.periodLabel}</td>
                  <td className="text-right">{r.baseTotal ? fmtKRW(r.baseTotal) : "—"}</td>
                  <td className="text-right">{typeof r.discountRate === "number" ? `${r.discountRate}%` : "—"}</td>
                  <td className="text-right font-semibold text-[#6C2DFF]">{fmtKRW(r.lineTotal)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-gray-500">
                  항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 3) 하단 합계 박스 (TOTAL/부가세/최종) */}
      <div className="px-4 py-4">
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F5F1FF]">
          <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-700">
            <span className="font-medium">총 광고료 합계(TOTAL)</span>
            <span className="font-semibold text-[#6C2DFF]">{fmtKRW(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-3 text-sm">
            <span className="text-gray-600">부가세(VAT {(vatRate * 100).toFixed(0)}%)</span>
            <span className="font-bold text-red-500">{fmtKRW(vat)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-3">
            <span className="text-[15px] font-semibold text-[#6C2DFF]">최종 광고료 (VAT 포함)</span>
            <span className="text-[18px] font-bold text-[#6C2DFF]">{fmtKRW(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================== Main ================== */
export function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  useBodyScrollLock(open);

  const [pickerOpen, setPickerOpen] = useState(false);
  const isPkg = isPackageReceipt(data);
  const isSeat = isSeatReceipt(data);

  const openExternal = (url?: string) => url && window.open(url, "_blank", "noopener,noreferrer");
  if (!open) return null;

  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

  const handleSave = async (kind: "png" | "pdf") => {
    const root = document.getElementById("receipt-capture");
    if (!root) return;
    const scrollContainers = Array.from(root.querySelectorAll<HTMLElement>("[data-capture-scroll]"));
    if (kind === "png") await saveFullContentAsPNG(root, `${data.ticketCode}_receipt`, scrollContainers);
    else await saveFullContentAsPDF(root, `${data.ticketCode}_receipt`, scrollContainers);
  };

  return createPortal(
    <AnimatePresence>
      <>
        <motion.div
          key="dim"
          className="fixed inset-0 z-[1200] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* 4) 모달 하한선 + 최대 높이 + 내부 스크롤 */}
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            id="receipt-capture"
            key="panel"
            className="w-[960px] max-w-[94vw] min-h-[560px] max-h-[calc(100vh-80px)] overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Body: 내부 스크롤 영역 */}
            <div className="px-6 py-6 overflow-y-auto max-h-[calc(100vh-80px-64px-64px)]">
              <div className="grid grid-cols-12 gap-6">
                {/* 좌측 */}
                <div className="col-span-8 space-y-4">
                  <CustomerInquirySection data={data as any} />
                  {isSeat && <SeatInquiryTable data={data as ReceiptSeat} />}
                </div>

                {/* 우측 */}
                <div className="col-span-4 space-y-4">
                  <NextSteps variant={isSeat ? "SEAT" : "PACKAGE"} />
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

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
              <button onClick={onClose} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>

        {/* 저장 액션 시트 (PNG/PDF) */}
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

export default CompleteModalDesktop;
