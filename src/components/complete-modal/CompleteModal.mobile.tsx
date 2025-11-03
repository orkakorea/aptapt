import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, ExternalLink, FileSignature, Mail, X, CheckCircle2 } from "lucide-react";

import type { CompleteModalProps, ReceiptData, ReceiptSeat } from "./types";
import { isSeatReceipt } from "./types";

// 저장(전체 캡처)
import { saveFullContentAsPNG, saveFullContentAsPDF } from "@/core/utils/capture";
// 정책 유틸
import { calcMonthlyWithPolicy, normPolicyKey, DEFAULT_POLICY, rateFromRanges } from "@/core/pricing";

/* =========================================================================
 * 공통 상수/유틸
 * ========================================================================= */
const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/** 숫자를 '1,234원' 형태로 표기 */
const formatWon = (n?: number | null) =>
  n == null || !isFinite(Number(n)) ? "0원" : `${Number(n).toLocaleString("ko-KR")}원`;

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

/** 이메일을 **ster@domain 형태로 마스킹 */
function maskEmail(email?: string | null) {
  if (!email) return "-";
  const s = String(email).trim();
  const at = s.indexOf("@");
  if (at <= 0) return "**";
  const local = s.slice(0, at);
  const domain = s
    .slice(at + 1)
    .replace(/\s+/g, "")
    .toLowerCase();
  const maskedLocal = local.length <= 2 ? "**" : `**${local.slice(2)}`;
  return `${maskedLocal}@${domain.replace(/^@/, "")}`;
}

/** 얕은 객체 여러 개에서 첫 번째 일치 값 반환 */
function pickFirstString(objs: any[], keys: string[]): string | undefined {
  for (const obj of objs) {
    if (!obj || typeof obj !== "object") continue;
    for (const k of keys) {
      const v = obj?.[k];
      if (v != null && String(v).trim() !== "") return String(v);
    }
  }
  return undefined;
}

/** email처럼 보이는 값을 다양한 키에서 찾아 반환 */
function pickEmailLike(...objs: any[]): string | undefined {
  const byKey = pickFirstString(objs, [
    "email",
    "eMail",
    "Email",
    "contactEmail",
    "contact_email",
    "managerEmail",
    "manager_email",
  ]);
  const looksEmail = (v: string) => /\S+@\S+\.\S+/.test(v);
  if (byKey && looksEmail(byKey)) return byKey;

  for (const obj of objs) {
    if (!obj || typeof obj !== "object") continue;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string" && looksEmail(v)) return v;
    }
  }
  return undefined;
}

/** 문의내용으로 보이는 문자열을 폭넓게 탐색 */
function pickInquiryText(...objs: any[]): string | undefined {
  const keys = ["request", "message", "memo", "note", "content", "inquiry", "description", "request_text", "body"];
  const v1 = pickFirstString(objs, keys);
  if (v1) return v1;
  for (const o of objs) {
    const values = o?.values;
    if (values && typeof values === "object") {
      const v2 = pickFirstString([values], keys);
      if (v2) return v2;
    }
  }
  return undefined;
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

/* =========================================================================
 * 헤더(성공)
 * ========================================================================= */
function HeaderSuccess({ ticketCode, createdAtISO }: { ticketCode: string; createdAtISO: string }) {
  const kst = useMemo(() => formatKST(createdAtISO), [createdAtISO]);
  return (
    <div className="flex items-center gap-3">
      <motion.div
        className="flex h-10 w-10 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_LIGHT }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <CheckCircle2 size={24} color={BRAND} />
      </motion.div>
      <div>
        <div className="text-[15px] font-semibold">문의가 접수됐어요!</div>
        <div className="mt-0.5 text-xs text-gray-500">
          접수번호 {ticketCode} · {kst}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 다음 절차 카드(모바일)
 * ========================================================================= */
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
            <b>구좌(T.O) 확인</b> (1~2일 소요)
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

/* =========================================================================
 * 고객 정보(항상 펼침)
 * ========================================================================= */
function RowLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-1.5">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 break-words text-sm text-gray-800">{value || "-"}</div>
    </div>
  );
}

function CustomerInquirySection({ data }: { data: ReceiptData }) {
  const c: any = (data as any).customer || {};
  const form: any = (data as any).form || {};
  const summary: any = (data as any).summary || {};
  const meta: any = (data as any).meta || {};

  const emailRaw = pickEmailLike(c, form, summary, meta) ?? pickEmailLike(form?.values) ?? undefined;
  let emailMasked = "-";
  const chosenEmail = emailRaw ?? c.email ?? form.email;
  if (chosenEmail) {
    emailMasked = maskEmail(chosenEmail);
  } else if (c.emailDomain) {
    emailMasked = `**@${String(c.emailDomain).replace(/^@/, "")}`;
  }

  const campaignType =
    pickFirstString(
      [form, summary, c, meta],
      [
        "campaignType",
        "campaign_type",
        "campaign",
        "campaign_kind",
        "campaignTypeLabel",
        "campaign_type_label",
        "campaignLabel",
        "campaign_label",
      ],
    ) ||
    pickFirstString([form?.values], ["campaignType", "campaign_type", "campaign", "campaign_kind"]) ||
    "-";

  const preferredRaw =
    form.desiredDate ??
    form.hopeDate ??
    summary.desiredDate ??
    summary.hopeDate ??
    meta.desiredDate ??
    meta.startDate ??
    meta.start_date ??
    form?.values?.desiredDate ??
    form?.values?.hopeDate;

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
    pickFirstString([form, summary, meta], ["promotionCode", "promoCode", "promotion_code", "promo_code"]) || "-";

  const inquiryText: string = pickInquiryText(form, summary, meta, c) ?? ("-" as string);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="px-4 py-3 text-sm font-semibold">고객 정보</div>
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
          className="min-h-[120px] whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-3 text-sm"
          data-capture-scroll
        >
          {inquiryText}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * SEAT 문의 내역: 모바일 카드형 리스트
 *  - 계산 로직은 데스크톱 SeatInquiryTable과 동일
 * ========================================================================= */
function SeatInquiryCards({ data }: { data: ReceiptSeat }) {
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
    let baseTotal = isFinite(baseTotalRaw) ? baseTotalRaw : 0;

    let lineTotal = Number(
      getVal(
        primary,
        ["lineTotal", "item_total_won", "total_won"],
        getVal(shadow, ["lineTotal", "item_total_won", "total_won"], NaN),
      ),
    );
    if (!isFinite(lineTotal)) {
      const monthlyAfterFallback = Number(
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
      if (isFinite(monthlyAfterFallback) && months) lineTotal = Math.round(monthlyAfterFallback * months);
      else if (isFinite(baseMonthlyRaw) && months) lineTotal = Math.round(baseMonthlyRaw * months);
      else lineTotal = 0;
    }

    const baseMonthlyEff =
      (isFinite(baseMonthlyRaw) && baseMonthlyRaw > 0 ? baseMonthlyRaw : NaN) ||
      (isFinite(baseTotal) && months ? Math.round(baseTotal / months) : NaN);

    const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
    let discountPct = "-";
    if (isFinite(baseTotal) && baseTotal > 0 && isFinite(lineTotal)) {
      const rate = clamp01(1 - lineTotal / baseTotal);
      discountPct = `${Math.round(rate * 100)}%`;
    }

    const key = normPolicyKey(String(productName));
    if (key === "ELEVATOR TV" && months > 0) {
      if (!isFinite(baseTotal) || baseTotal <= 0) {
        baseTotal = isFinite(baseMonthlyEff) && months ? baseMonthlyEff * months : 0;
      }
      const periodRate = rateFromRanges(DEFAULT_POLICY["ELEVATOR TV"].period, months);
      const precompRate = months < 3 ? 0.03 : 0.05;
      const tvTotal = Math.round(baseTotal * (1 - periodRate) * (1 - precompRate));
      lineTotal = tvTotal;
      const eff = baseTotal > 0 ? clamp01(1 - tvTotal / baseTotal) : 0;
      discountPct = `${Math.round(eff * 100)}%`;
    } else {
      const pctNum = Number(String(discountPct).replace("%", ""));
      const looksZero = !isFinite(pctNum) || Math.abs(pctNum) < 1;
      if (looksZero && isFinite(baseMonthlyEff) && baseMonthlyEff > 0 && months > 0) {
        const { monthly } = calcMonthlyWithPolicy(String(productName), months, baseMonthlyEff, undefined, 1);
        if (monthly > 0 && monthly <= baseMonthlyEff) {
          const r = clamp01(1 - monthly / baseMonthlyEff);
          discountPct = `${Math.round(r * 100)}%`;
          lineTotal = Math.round(monthly * months);
        }
      }
    }

    return {
      aptName,
      productName,
      monthlyFee: isFinite(baseMonthlyEff) ? baseMonthlyEff : 0, // 표시는 기준 월가(FMK=4주)
      periodLabel,
      baseTotal: isFinite(baseTotal) ? baseTotal : 0,
      discountPct,
      lineTotal,
    };
  });

  const periodTotal = rows.reduce((sum, r) => sum + (isFinite(r.lineTotal) ? r.lineTotal : 0), 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="px-4 py-3 text-sm font-semibold">문의 내역</div>

      {/* 카드 리스트 */}
      <div className="px-4 pb-4 space-y-3" data-capture-scroll>
        {rows.length ? (
          rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3">
              <div className="text-[15px] font-bold text-gray-900">{r.aptName}</div>
              <div className="mt-1 text-xs text-gray-500">{r.productName}</div>

              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="text-gray-500">월광고료</div>
                <div className="text-right">{formatWon(r.monthlyFee)}</div>

                <div className="text-gray-500">광고기간</div>
                <div className="text-right">{r.periodLabel}</div>

                <div className="text-gray-500">기준금액</div>
                <div className="text-right">{formatWon(r.baseTotal)}</div>

                <div className="text-gray-500">할인율</div>
                <div className="text-right">{r.discountPct}</div>

                <div className="col-span-2 mt-1 flex items-center justify-between border-t pt-2">
                  <span className="text-[13px] text-gray-600">총광고료</span>
                  <span className="text-[16px] font-extrabold" style={{ color: BRAND }}>
                    {formatWon(r.lineTotal)}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-xs text-gray-500">항목이 없습니다.</div>
        )}
      </div>

      {/* 합계 카드 */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F5FF]">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-gray-600">TOTAL</span>
            <span className="text-sm font-bold text-[#6C2DFF]">{formatWon(periodTotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-3">
            <span className="text-sm text-gray-600">부가세</span>
            <span className="text-sm font-bold text-red-500">{formatWon(Math.round(periodTotal * 0.1))}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-4">
            <span className="text-[15px] font-semibold text-[#6C2DFF]">최종 광고료 (VAT 포함)</span>
            <span className="text-[20px] font-extrabold text-[#6C2DFF]">
              {formatWon(Math.round(periodTotal * 1.1))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 메인: Mobile Complete Modal (바텀시트)
 * ========================================================================= */
export default function CompleteModalMobile({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  useBodyScrollLock(open);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!open) return null;

  const handleSave = async (kind: "png" | "pdf") => {
    const root = document.getElementById("receipt-capture");
    if (!root) return;
    const scrollContainers = Array.from(root.querySelectorAll<HTMLElement>("[data-capture-scroll]"));
    if (kind === "png") await saveFullContentAsPNG(root, `${data.ticketCode}_receipt`, scrollContainers);
    else await saveFullContentAsPDF(root, `${data.ticketCode}_receipt`, scrollContainers);
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
          className="fixed inset-0 z-[1500] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* SHEET */}
        <motion.div
          id="receipt-capture"
          key="sheet"
          className="fixed inset-x-0 bottom-0 z-[1501] w-full max-h-[92vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl"
          role="dialog"
          aria-modal="true"
          initial={{ y: "100%", opacity: 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
            <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* 본문(스크롤) */}
          <div className="max-h-[calc(92vh-56px-56px)] overflow-y-auto px-5 py-5 space-y-4" data-capture-scroll>
            {/* 고객 정보 */}
            <CustomerInquirySection data={data as ReceiptData} />

            {/* 다음 절차 / 저장 / 링크 */}
            <NextSteps />

            <button
              onClick={() => setPickerOpen(true)}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: BRAND }}
            >
              문의 내용 저장
            </button>
            <p className="text-xs text-red-500">정확한 상담을 위해 문의 내용을 반드시 저장 해두세요</p>

            <div className="grid grid-cols-1 gap-2">
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

            {/* 문의 내역(Seat일 때만) */}
            {isSeat && <SeatInquiryCards data={data as ReceiptSeat} />}
          </div>

          {/* 푸터 */}
          <div className="flex items-center justify-end border-t border-gray-100 px-5 py-3">
            <button onClick={onClose} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">
              {confirmLabel}
            </button>
          </div>
        </motion.div>

        {/* 저장 액션시트 */}
        <AnimatePresence>
          {pickerOpen && (
            <>
              <motion.div
                key="picker-dim"
                className="fixed inset-0 z-[1600] bg-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPickerOpen(false)}
              />
              <motion.div
                key="picker-card"
                className="fixed left-1/2 bottom-0 z-[1601] w-[520px] max-w-[94vw] -translate-x-1/2 rounded-t-2xl bg-white shadow-2xl"
                initial={{ y: "100%", opacity: 1 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 26 }}
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
