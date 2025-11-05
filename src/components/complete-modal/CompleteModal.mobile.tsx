// src/components/complete-modal/CompleteModal.mobile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  ExternalLink,
  FileSignature,
  Mail,
  X,
  CheckCircle2,
  Download,
  Copy,
  Link as LinkIcon,
} from "lucide-react";

import type { CompleteModalProps, ReceiptData, ReceiptSeat } from "./types";
import { isSeatReceipt } from "./types";

// 저장(전체 캡처)
import { saveFullContentAsPNG, saveFullContentAsPDF } from "@/core/utils/capture";
// 정책 유틸 (PC 버전과 동일 로직)
import { calcMonthlyWithPolicy, normPolicyKey, DEFAULT_POLICY, rateFromRanges } from "@/core/pricing";
// Supabase (링크 공유용 Edge Function 호출)
import { supabase } from "@/integrations/supabase/client";

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

/** 이메일을 **ster@domain 형태로 마스킹(표시 용도만) */
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
 * Seat rows 추출(표/CSV/공유 공통 사용) — PII 없음
 * ========================================================================= */
type SeatRow = {
  aptName: string;
  productName: string;
  monthlyFee: number;
  periodLabel: string;
  baseTotal: number;
  discountPct: string | number;
  lineTotal: number;
};

function buildSeatRows(data: ReceiptSeat): { rows: SeatRow[]; periodTotal: number } {
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

    // 기준 월가/기준 총액
    const baseMonthlyRaw = Number(
      getVal(primary, ["baseMonthly", "priceMonthly"], getVal(shadow, ["baseMonthly", "priceMonthly"], NaN)),
    );
    const baseTotalRaw =
      Number(getVal(primary, ["baseTotal"], NaN)) ||
      (isFinite(baseMonthlyRaw) && months ? baseMonthlyRaw * months : NaN);
    let baseTotal = isFinite(baseTotalRaw) ? baseTotalRaw : 0;

    // 총광고료(일반 로직)
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
    let discountPct: string | number = "-";
    if (isFinite(baseTotal) && baseTotal > 0 && isFinite(lineTotal)) {
      const rate = clamp01(1 - lineTotal / baseTotal);
      discountPct = `${Math.round(rate * 100)}%`;
    }

    // ELEVATOR TV 강제 규칙
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
      monthlyFee: isFinite(baseMonthlyEff) ? baseMonthlyEff : 0,
      periodLabel,
      baseTotal: isFinite(baseTotal) ? baseTotal : 0,
      discountPct,
      lineTotal,
    } as SeatRow;
  });

  const periodTotal = rows.reduce((sum, r) => sum + (isFinite(r.lineTotal) ? r.lineTotal : 0), 0);
  return { rows, periodTotal };
}

/* =========================================================================
 * CSV/Markdown 생성 (PII 없음)
 * ========================================================================= */
function toCSV(rows: SeatRow[]) {
  const headers = ["단지명", "상품명", "월광고료", "광고기간", "기준금액", "할인율", "총광고료"];
  const escape = (v: any) => {
    let s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.aptName, r.productName, r.monthlyFee, r.periodLabel, r.baseTotal, r.discountPct, r.lineTotal]
        .map(escape)
        .join(","),
    ),
  ];
  return "\ufeff" + lines.join("\n"); // BOM 포함(엑셀 호환)
}

function toMarkdown(rows: SeatRow[]) {
  const head = ["단지명", "상품명", "월광고료", "광고기간", "기준금액", "할인율", "총광고료"];
  const hdr = `| ${head.join(" | ")} |\n| ${head.map(() => "---").join(" | ")} |`;
  const body = rows
    .map(
      (r) =>
        `| ${r.aptName} | ${r.productName} | ${formatWon(r.monthlyFee)} | ${r.periodLabel} | ${formatWon(
          r.baseTotal,
        )} | ${r.discountPct} | ${formatWon(r.lineTotal)} |`,
    )
    .join("\n");
  return `${hdr}\n${body}`;
}

async function downloadTextAsFile(text: string, filename: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}

/* =========================================================================
 * 헤더(성공)
 * ========================================================================= */
function HeaderSuccess({ ticketCode, createdAtISO }: { ticketCode: string; createdAtISO: string }) {
  const kst = useMemo(() => formatKST(createdAtISO), [createdAtISO]);
  return (
    <div className="flex items-center gap-3">
      <motion.div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_LIGHT }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <CheckCircle2 size={24} color={BRAND} />
      </motion.div>
      <div>
        <div className="text-base font-semibold">문의가 접수됐어요!</div>
        <div className="mt-0.5 text-xs text-gray-500">
          접수번호 {ticketCode} · {kst}
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 오른쪽: 다음 절차 카드
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
            <b>구좌(T.O) 확인</b>
            <span> (1~2일 소요)</span>
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
 * 고객 정보(표시용, 마스킹 적용)
 * ========================================================================= */
function RowLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 break-words whitespace-pre-wrap text-sm text-gray-800">{value || "-"}</div>
    </div>
  );
}

function CustomerInquirySection({ data }: { data: ReceiptData }) {
  const c: any = (data as any).customer || {};
  const form: any = (data as any).form || {};
  const summary: any = (data as any).summary || {};
  const meta: any = (data as any).meta || {};

  // 이메일 선택(여러 위치 탐색) → 마스킹
  const emailRaw = pickEmailLike(c, form, summary, meta) ?? pickEmailLike(form?.values) ?? undefined;
  let emailMasked = "-";
  const chosenEmail = emailRaw ?? c.email ?? form.email;
  if (chosenEmail) {
    emailMasked = maskEmail(chosenEmail);
  } else if (c.emailDomain) {
    emailMasked = `**@${String(c.emailDomain).replace(/^@/, "")}`;
  }

  // 캠페인 유형
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

  // 희망일/기간
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

  // 프로모션코드
  const promoCode =
    pickFirstString(
      [form, summary, meta, form?.values],
      ["promotionCode", "promoCode", "promotion_code", "promo_code"],
    ) || "-";

  // 문의내용(여러 키 후보)
  const inquiryText: string = pickInquiryText(form, summary, meta, c) ?? ("-" as string);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold">고객 정보</span>
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
 * 좌: SEAT 문의 내역(테이블)
 * ========================================================================= */
function SeatInquiryTable({ data }: { data: ReceiptSeat }) {
  const { rows, periodTotal } = buildSeatRows(data);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="px-4 pt-3 mb-2 text-sm font-semibold">문의 내역</div>
      <div className="border-t border-gray-100 overflow-x-auto" data-capture-scroll>
        <table className="min-w-[880px] text-[12px]">
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
                <tr key={i} className="border-t border-gray-100 bg-white align-top">
                  <td className="font-medium text-gray-900 whitespace-pre-wrap break-words">{r.aptName}</td>
                  <td className="whitespace-pre-wrap break-words">{r.productName}</td>
                  <td className="text-right">{formatWon(r.monthlyFee)}</td>
                  <td className="text-right">{r.periodLabel}</td>
                  <td className="text-right">{formatWon(r.baseTotal)}</td>
                  <td className="text-right">
                    {typeof r.discountPct === "number" ? `${r.discountPct}%` : r.discountPct}
                  </td>
                  <td className="text-right font-semibold text-[#6C2DFF]">{formatWon(r.lineTotal)}</td>
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

      {/* 합계 카드 (모바일 폭) */}
      <div className="px-4 py-3">
        <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F5FF]">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm text-gray-600">TOTAL</span>
            <span className="text-sm font-bold text-[#6C2DFF]">{formatWon(periodTotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-2">
            <span className="text-sm text-gray-600">부가세</span>
            <span className="text-sm font-bold text-red-500">{formatWon(Math.round(periodTotal * 0.1))}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#E5E7EB] px-4 py-3">
            <span className="text-[14px] font-semibold text-[#6C2DFF]">최종 광고료 (VAT 포함)</span>
            <span className="text-[18px] font-extrabold text-[#6C2DFF]">
              {formatWon(Math.round(periodTotal * 1.1))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
 * 메인 모달 (모바일) + 내보내기/공유
 * ========================================================================= */
export default function CompleteModalMobile({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  useBodyScrollLock(open);

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const isSeat = isSeatReceipt(data);
  const exportDisabled = !isSeat;

  // Export/Share UI 상태
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSave = async (kind: "png" | "pdf") => {
    const root = document.getElementById("receipt-capture-mobile");
    if (!root) return;
    const scrollContainers = Array.from(root.querySelectorAll<HTMLElement>("[data-capture-scroll]"));
    if (kind === "png") await saveFullContentAsPNG(root, `${data.ticketCode}_receipt`, scrollContainers);
    else await saveFullContentAsPDF(root, `${data.ticketCode}_receipt`, scrollContainers);
  };

  const handleCSV = async () => {
    if (exportDisabled) return;
    const { rows } = buildSeatRows(data as ReceiptSeat);
    const csv = toCSV(rows);
    const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
    await downloadTextAsFile(csv, `${data.ticketCode}_inquiry_${ts}.csv`, "text/csv;charset=utf-8");
    setExportMsg("CSV 파일을 다운로드했어요.");
  };

  const handleCopyText = async () => {
    if (exportDisabled) return;
    const { rows } = buildSeatRows(data as ReceiptSeat);
    const md = toMarkdown(rows);
    try {
      await navigator.clipboard.writeText(md);
      setExportMsg("표를 클립보드에 복사했어요.");
    } catch {
      await downloadTextAsFile(md, `${data.ticketCode}_inquiry.txt`, "text/plain;charset=utf-8");
      setExportMsg("클립보드 접근이 차단되어 TXT로 저장했어요.");
    }
  };

  const handleShareLink = async () => {
    if (exportDisabled) return;
    setBusy(true);
    setExportMsg(null);
    setShareUrl(null);

    try {
      const { rows, periodTotal } = buildSeatRows(data as ReceiptSeat);

      // 🔒 PII 없는 스냅샷(표 데이터만)
      const snapshot = {
        version: "v1",
        kind: "SEAT",
        ticketCode: (data as any).ticketCode,
        createdAtISO: (data as any).createdAtISO,
        table: {
          headers: ["단지명", "상품명", "월광고료", "광고기간", "기준금액", "할인율", "총광고료"],
          rows: rows.map((r) => [
            r.aptName,
            r.productName,
            r.monthlyFee,
            r.periodLabel,
            r.baseTotal,
            r.discountPct,
            r.lineTotal,
          ]),
          totals: { periodTotal, vat10: Math.round(periodTotal * 0.1), grandTotal: Math.round(periodTotal * 1.1) },
          currency: "KRW",
        },
      };

      // ① Edge Function 우선
      const { data: fnData, error: fnErr } = await supabase.functions.invoke("publish-inquiry-snapshot", {
        body: { snapshot, ttl_hours: 24 * 7 }, // 7일 만료 제안
      });

      if (fnErr) throw fnErr;
      const url = (fnData && (fnData.url || fnData.signed_url || fnData.short_url)) as string | undefined;
      if (!url) throw new Error("공유 URL 생성에 실패했습니다.");

      setShareUrl(url);

      // 모바일/지원 브라우저: 시스템 공유 시트
      if ((navigator as any).share) {
        try {
          await (navigator as any).share({
            title: "오르카 문의내역",
            text: "문의 내역 표를 확인하세요.",
            url,
          });
          setExportMsg("시스템 공유 시트를 열었어요.");
        } catch {
          // 사용자가 취소해도 무시
        }
      } else {
        await navigator.clipboard.writeText(url);
        setExportMsg("공유 링크를 클립보드에 복사했어요.");
      }
    } catch (e: any) {
      setExportMsg("공유 링크 생성에 실패했습니다. 관리자에게 문의해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

  return createPortal(
    <AnimatePresence>
      <>
        {/* DIM */}
        <motion.div
          key="dim"
          className="fixed inset-0 z-[1250] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* PANEL */}
        <div className="fixed inset-0 z-[1251] flex items-center justify-center">
          <motion.div
            id="receipt-capture-mobile"
            key="panel"
            className="flex w-[720px] max-w-[96vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            style={{ maxHeight: "92vh" }}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <HeaderSuccess ticketCode={(data as any).ticketCode} createdAtISO={(data as any).createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-5" data-capture-scroll>
              <div className="space-y-4">
                {/* 고객 정보 */}
                <CustomerInquirySection data={data as ReceiptData} />

                {/* 다음 절차/저장/링크 */}
                <div className="grid grid-cols-1 gap-4">
                  <NextSteps />

                  {/* ✅ 이미지 저장(전체 캡처) */}
                  <button
                    onClick={async () => {
                      await handleSave("png");
                    }}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    이미지로 문의 내용 저장하기
                  </button>
                  <p className="mt-1 text-xs text-red-500">
                    저장 시 이 화면 전체가 이미지로 저장됩니다. 문의 내역이 길어도 모두 포함돼요.
                  </p>

                  {/* ✅ 표 데이터 내보내기/공유 (PII 없음) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleCSV}
                      disabled={exportDisabled || busy}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                        exportDisabled || busy ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                      }`}
                      title={exportDisabled ? "SEAT 문의에서만 제공" : "CSV로 다운로드"}
                    >
                      <Download size={16} />
                      CSV 다운로드
                    </button>
                    <button
                      onClick={handleCopyText}
                      disabled={exportDisabled || busy}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                        exportDisabled || busy ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                      }`}
                      title={exportDisabled ? "SEAT 문의에서만 제공" : "텍스트로 복사"}
                    >
                      <Copy size={16} />
                      텍스트 복사
                    </button>
                    <button
                      onClick={handleShareLink}
                      disabled={exportDisabled || busy}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                        exportDisabled || busy ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                      }`}
                      title={exportDisabled ? "SEAT 문의에서만 제공" : "링크로 공유"}
                    >
                      <LinkIcon size={16} />
                      링크로 공유
                    </button>
                  </div>

                  {/* 메시지 / 공유 URL 표시 */}
                  {(exportMsg || shareUrl) && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      {exportMsg && <div className="text-[12px] text-gray-700">{exportMsg}</div>}
                      {shareUrl && (
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            readOnly
                            value={shareUrl}
                            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-[12px] text-gray-800"
                          />
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(shareUrl);
                                setExportMsg("공유 링크를 복사했어요.");
                              } catch {}
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium hover:bg-gray-50"
                          >
                            <Copy size={14} />
                            복사
                          </button>
                          <button
                            onClick={() => openExternal(shareUrl)}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium hover:bg-gray-50"
                          >
                            <ExternalLink size={14} />
                            열기
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 참고 링크 */}
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

                {/* 문의 내역(테이블+합계) */}
                {isSeat && <SeatInquiryTable data={data as ReceiptSeat} />}
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex items-center justify-end border-t border-gray-100 px-5 py-3">
              <button onClick={onClose} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      </>
    </AnimatePresence>,
    document.body,
  );
}
