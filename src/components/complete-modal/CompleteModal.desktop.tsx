import React, { useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  ExternalLink,
  FileSignature,
  Mail,
  X,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";
import { createPortal } from "react-dom";

const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/* =========================================================
 * 공통 유틸
 * ======================================================= */
const fmtWon = (n?: number | null) => (typeof n === "number" && isFinite(n) ? `₩${n.toLocaleString("ko-KR")}` : "₩0");
const fmtNum = (n?: number | null, unit = "") =>
  typeof n === "number" && isFinite(n) ? `${n.toLocaleString("ko-KR")}${unit}` : "-";
const safe = (s?: string | null) => (s && String(s).trim().length ? String(s) : "-");

function formatKST(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return (
      new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d) + " KST"
    );
  } catch {
    return "";
  }
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

/* =========================================================
 * 우측 고정 박스: 다음 절차
 * ======================================================= */
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

/* =========================================================
 * 좌측 상단: 고객 문의 섹션(접이식)
 * ======================================================= */
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 text-sm text-gray-800 break-words">{value || "-"}</div>
    </div>
  );
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

function CustomerInquirySection({
  data,
  forceOpen = false,
}: {
  data: ReceiptPackage | ReceiptSeat | ReceiptData;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

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

  const desiredValue =
    form.periodLabel ??
    form.period_label ??
    summary.periodLabel ??
    summary.period_label ??
    (typeof form.months === "number" ? `${form.months}개월` : undefined) ??
    (typeof summary.months === "number" ? `${summary.months}개월` : undefined);

  const promoCode =
    form.promotionCode ??
    form.promoCode ??
    form.promotion_code ??
    form.promo_code ??
    summary.promotionCode ??
    summary.promoCode ??
    summary.promotion_code ??
    summary.promo_code;

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
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold">고객 문의</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="customer-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4">
              <Row label="상호명" value={c.company ?? form.company} />
              <Row label="담당자" value={c.name ?? form.manager ?? form.contactName} />
              <Row label="연락처" value={c.phoneMasked ?? form.phoneMasked ?? form.phone} />
              <Row label="이메일" value={emailMasked} />
              <Row label="캠페인 유형" value={campaignType} />
              <Row label="광고 송출 예정(희망)일" value={desiredValue} />
              <Row label="프로모션코드" value={promoCode} />
            </div>

            {/* 문의내용 */}
            <div className="mt-2 border-t border-gray-100 px-4 py-3">
              <div className="mb-2 text-xs text-gray-500">문의내용</div>
              <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-3 text-sm">
                {inquiryText ? inquiryText : "-"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================
 * 좌측 하단: SEAT 전용 “문의 내역” (접이식 + 카운터 + 테이블)
 *  - 가로 스크롤 허용, 합계/VAT/최종은 고정 박스 영역에서 유지
 *  - 값이 비어있을 때도 최대한 유연하게 별칭 키를 흡수
 * ======================================================= */
function SeatInquiryBox({
  data,
  forceOpen = false,
  vatRate = 0.1,
}: {
  data: ReceiptSeat;
  forceOpen?: boolean;
  vatRate?: number;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const itemsRaw: any[] = ((data as any)?.details?.items ?? []) as any[];

  // 별칭 키 흡수 헬퍼
  const getVal = (obj: any, keys: string[], fb?: any) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return fb;
  };

  // 행 변환
  const rows = useMemo(() => {
    return (itemsRaw ?? []).map((it) => {
      const name = getVal(it, ["name", "aptName", "apt_name"], "-");
      const product = getVal(it, ["mediaName", "productName", "product_name", "product_code"], "-");

      const monthsRaw = getVal(it, ["months", "month", "period_months"], null);
      const months = Number.isFinite(Number(monthsRaw)) ? Number(monthsRaw) : null;

      const baseMonthly = Number(getVal(it, ["baseMonthly", "base_monthly", "base"], null)) || null;
      const monthlyAfter = Number(getVal(it, ["monthlyAfter", "monthly_after", "priceMonthlyAfter"], null)) || null;
      const lineTotalRaw = Number(getVal(it, ["lineTotal", "item_total_won", "total_won", "line_total"], null)) || null;

      const households = Number(getVal(it, ["households"], null)) || null;
      const residents = Number(getVal(it, ["residents"], null)) || null;
      const monthlyImpressions = Number(getVal(it, ["monthlyImpressions"], null)) || null;
      const monitors = Number(getVal(it, ["monitors", "monitorCount", "monitor_count", "screens"], null)) || null;

      const monthly =
        monthlyAfter && Number.isFinite(monthlyAfter)
          ? Math.round(monthlyAfter)
          : months && lineTotalRaw
            ? Math.round(lineTotalRaw / months)
            : null;

      const baseTotal = baseMonthly && months ? Math.round(baseMonthly * months) : null;

      const lineTotal =
        lineTotalRaw ??
        (months && (monthlyAfter || baseMonthly) ? Math.round((monthlyAfter || baseMonthly!) * months) : null);

      let discountRate: number | null = null;
      if (baseMonthly && (monthly || (lineTotal && months))) {
        const monthAfter = monthly ?? (lineTotal && months ? Math.round(lineTotal / months) : null);
        if (monthAfter && baseMonthly > 0) {
          const r = 1 - monthAfter / baseMonthly;
          if (r > -0.01 && r < 0.95) discountRate = r;
        }
      }

      return {
        name,
        product,
        months,
        monthly,
        baseTotal,
        discountRate,
        lineTotal,
        households,
        residents,
        monthlyImpressions,
        monitors,
      };
    });
  }, [itemsRaw]);

  // 카운터 + 합계
  const totals = useMemo(() => {
    const sum = (key: keyof (typeof rows)[number]) =>
      rows.reduce((acc, r: any) => acc + (Number.isFinite(r[key] as any) ? Number(r[key] as any) : 0), 0);

    const count = rows.length;
    const households = sum("households");
    const residents = sum("residents");
    const monthlyImpressions = sum("monthlyImpressions");
    const monitors = sum("monitors");

    const subtotal = rows.reduce((acc, r) => acc + (Number.isFinite(r.lineTotal) ? Number(r.lineTotal) : 0), 0);
    const vat = Math.round(subtotal * vatRate);
    const total = subtotal + vat;

    return { count, households, residents, monthlyImpressions, monitors, subtotal, vat, total };
  }, [rows, vatRate]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold">문의 내역</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="seat-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* 카운터 */}
            <div className="px-4 pt-1 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-medium">{`총 ${totals.count}개 단지`}</span>
              <span>
                · 세대수 <b>{fmtNum(totals.households)}</b> 세대
              </span>
              <span>
                · 거주인원 <b>{fmtNum(totals.residents)}</b> 명
              </span>
              <span>
                · 송출횟수 <b>{fmtNum(totals.monthlyImpressions)}</b> 회
              </span>
              <span>
                · 모니터수량 <b>{fmtNum(totals.monitors)}</b> 대
              </span>
              <span className="text-xs text-[#9CA3AF] ml-auto">(단위 · 원 / VAT별도)</span>
            </div>

            {/* 테이블 (가로 스크롤 허용) */}
            <div className="px-4 pb-4">
              <div className="rounded-xl border border-[#E5E7EB] overflow-x-auto">
                <table className="w-full min-w-[1100px] text-[13px] whitespace-nowrap">
                  <thead className="bg-[#F9FAFB] text-[#111827]">
                    <tr className="[&>th]:px-4 [&>th]:py-2 text-center">
                      <th className="text-left">단지명</th>
                      <th>상품명</th>
                      <th>월광고료</th>
                      <th>광고기간</th>
                      <th>기준금액</th>
                      <th>할인율</th>
                      <th className="!text-[#6C2DFF]">총 광고료</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr>td]:px-4 [&>tr>td]:py-2">
                    {rows.length ? (
                      rows.map((r, i) => (
                        <tr key={`${r.name}-${i}`} className="border-t border-[#F3F4F6]">
                          <td className="text-left font-medium text-black">{safe(r.name)}</td>
                          <td className="text-center">{safe(r.product)}</td>
                          <td className="text-center">{fmtWon(r.monthly ?? null)}</td>
                          <td className="text-center">{r.months ? `${r.months}개월` : "-"}</td>
                          <td className="text-center">{fmtWon(r.baseTotal ?? null)}</td>
                          <td className="text-center">
                            {typeof r.discountRate === "number" ? `${Math.round(r.discountRate * 100)}%` : "—"}
                          </td>
                          {/* 각 행의 총광고료는 검은색 */}
                          <td className="text-center font-semibold text-[#111827]">{fmtWon(r.lineTotal ?? null)}</td>
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
                  <tfoot className="bg-[#F9FAFB]">
                    <tr className="[&>td]:px-4 [&>td]:py-3 border-t border-[#E5E7EB]">
                      <td colSpan={6} className="text-right text-[#6B7280] font-medium">
                        총 광고료 합계(TOTAL)
                      </td>
                      {/* 합계는 보라색 */}
                      <td className="text-right font-bold text-[#6C2DFF]">{fmtWon(totals.subtotal)}</td>
                    </tr>
                    <tr className="[&>td]:px-4 [&>td]:py-3">
                      <td colSpan={6} className="text-right text-[#6B7280] font-medium">
                        부가세(VAT 10%)
                      </td>
                      {/* 부가세는 빨간색 + 볼드 */}
                      <td className="text-right font-bold text-red-500">{fmtWon(totals.vat)}</td>
                    </tr>
                    <tr className="[&>td]:px-4 [&>td]:py-3">
                      <td colSpan={6} className="text-right text-[#6B7280] font-medium">
                        최종 광고료 (VAT 포함)
                      </td>
                      {/* 최종은 보라색 + 볼드 */}
                      <td className="text-right font-bold text-[#6C2DFF]">{fmtWon(totals.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================
 * 메인 모달
 *  - 모달 자체에 min-height를 주어 하한선 확보(많이 담아도 내부 스크롤)
 * ======================================================= */
export function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  useBodyScrollLock(open);

  const isPkg = isPackageReceipt(data);
  const isSeat = isSeatReceipt(data);

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!open) return null;

  // PC 고정 링크
  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

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
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            key="panel"
            className="w-[980px] max-w-[94vw] rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            // 하한선 + 내부 스크롤
            style={{ maxHeight: "86vh", display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Body (세로 스크롤 영역) */}
            <div className="grid grid-cols-12 gap-6 px-6 py-6 overflow-y-auto">
              {/* 좌측 */}
              <div className="col-span-12 lg:col-span-8 space-y-4">
                <CustomerInquirySection data={data as any} />
                {isSeat && <SeatInquiryBox data={data as ReceiptSeat} />}
              </div>

              {/* 우측 */}
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <NextSteps variant={isSeat ? "SEAT" : "PACKAGE"} />

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

            {/* Footer (고정) */}
            <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
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

export default CompleteModalDesktop;
import React, { useEffect, useMemo, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  ExternalLink,
  FileSignature,
  Mail,
  X,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";
import { createPortal } from "react-dom";

const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/* =========================================================
 * 공통 유틸
 * ======================================================= */
const fmtWon = (n?: number | null) => (typeof n === "number" && isFinite(n) ? `₩${n.toLocaleString("ko-KR")}` : "₩0");
const fmtNum = (n?: number | null, unit = "") =>
  typeof n === "number" && isFinite(n) ? `${n.toLocaleString("ko-KR")}${unit}` : "-";
const safe = (s?: string | null) => (s && String(s).trim().length ? String(s) : "-");

function formatKST(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return (
      new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d) + " KST"
    );
  } catch {
    return "";
  }
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

/* =========================================================
 * 우측 고정 박스: 다음 절차
 * ======================================================= */
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

/* =========================================================
 * 좌측 상단: 고객 문의 섹션(접이식)
 * ======================================================= */
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 text-sm text-gray-800 break-words">{value || "-"}</div>
    </div>
  );
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

function CustomerInquirySection({
  data,
  forceOpen = false,
}: {
  data: ReceiptPackage | ReceiptSeat | ReceiptData;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

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

  const desiredValue =
    form.periodLabel ??
    form.period_label ??
    summary.periodLabel ??
    summary.period_label ??
    (typeof form.months === "number" ? `${form.months}개월` : undefined) ??
    (typeof summary.months === "number" ? `${summary.months}개월` : undefined);

  const promoCode =
    form.promotionCode ??
    form.promoCode ??
    form.promotion_code ??
    form.promo_code ??
    summary.promotionCode ??
    summary.promoCode ??
    summary.promotion_code ??
    summary.promo_code;

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
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold">고객 문의</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="customer-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4">
              <Row label="상호명" value={c.company ?? form.company} />
              <Row label="담당자" value={c.name ?? form.manager ?? form.contactName} />
              <Row label="연락처" value={c.phoneMasked ?? form.phoneMasked ?? form.phone} />
              <Row label="이메일" value={emailMasked} />
              <Row label="캠페인 유형" value={campaignType} />
              <Row label="광고 송출 예정(희망)일" value={desiredValue} />
              <Row label="프로모션코드" value={promoCode} />
            </div>

            {/* 문의내용 */}
            <div className="mt-2 border-t border-gray-100 px-4 py-3">
              <div className="mb-2 text-xs text-gray-500">문의내용</div>
              <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-3 text-sm">
                {inquiryText ? inquiryText : "-"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================
 * 좌측 하단: SEAT 전용 “문의 내역” (접이식 + 카운터 + 테이블)
 *  - 가로 스크롤 허용, 합계/VAT/최종은 고정 박스 영역에서 유지
 *  - 값이 비어있을 때도 최대한 유연하게 별칭 키를 흡수
 * ======================================================= */
function SeatInquiryBox({
  data,
  forceOpen = false,
  vatRate = 0.1,
}: {
  data: ReceiptSeat;
  forceOpen?: boolean;
  vatRate?: number;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const itemsRaw: any[] = ((data as any)?.details?.items ?? []) as any[];

  // 별칭 키 흡수 헬퍼
  const getVal = (obj: any, keys: string[], fb?: any) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return fb;
  };

  // 행 변환
  const rows = useMemo(() => {
    return (itemsRaw ?? []).map((it) => {
      const name = getVal(it, ["name", "aptName", "apt_name"], "-");
      const product = getVal(it, ["mediaName", "productName", "product_name", "product_code"], "-");

      const monthsRaw = getVal(it, ["months", "month", "period_months"], null);
      const months = Number.isFinite(Number(monthsRaw)) ? Number(monthsRaw) : null;

      const baseMonthly = Number(getVal(it, ["baseMonthly", "base_monthly", "base"], null)) || null;
      const monthlyAfter = Number(getVal(it, ["monthlyAfter", "monthly_after", "priceMonthlyAfter"], null)) || null;
      const lineTotalRaw = Number(getVal(it, ["lineTotal", "item_total_won", "total_won", "line_total"], null)) || null;

      const households = Number(getVal(it, ["households"], null)) || null;
      const residents = Number(getVal(it, ["residents"], null)) || null;
      const monthlyImpressions = Number(getVal(it, ["monthlyImpressions"], null)) || null;
      const monitors = Number(getVal(it, ["monitors", "monitorCount", "monitor_count", "screens"], null)) || null;

      const monthly =
        monthlyAfter && Number.isFinite(monthlyAfter)
          ? Math.round(monthlyAfter)
          : months && lineTotalRaw
            ? Math.round(lineTotalRaw / months)
            : null;

      const baseTotal = baseMonthly && months ? Math.round(baseMonthly * months) : null;

      const lineTotal =
        lineTotalRaw ??
        (months && (monthlyAfter || baseMonthly) ? Math.round((monthlyAfter || baseMonthly!) * months) : null);

      let discountRate: number | null = null;
      if (baseMonthly && (monthly || (lineTotal && months))) {
        const monthAfter = monthly ?? (lineTotal && months ? Math.round(lineTotal / months) : null);
        if (monthAfter && baseMonthly > 0) {
          const r = 1 - monthAfter / baseMonthly;
          if (r > -0.01 && r < 0.95) discountRate = r;
        }
      }

      return {
        name,
        product,
        months,
        monthly,
        baseTotal,
        discountRate,
        lineTotal,
        households,
        residents,
        monthlyImpressions,
        monitors,
      };
    });
  }, [itemsRaw]);

  // 카운터 + 합계
  const totals = useMemo(() => {
    const sum = (key: keyof (typeof rows)[number]) =>
      rows.reduce((acc, r: any) => acc + (Number.isFinite(r[key] as any) ? Number(r[key] as any) : 0), 0);

    const count = rows.length;
    const households = sum("households");
    const residents = sum("residents");
    const monthlyImpressions = sum("monthlyImpressions");
    const monitors = sum("monitors");

    const subtotal = rows.reduce((acc, r) => acc + (Number.isFinite(r.lineTotal) ? Number(r.lineTotal) : 0), 0);
    const vat = Math.round(subtotal * vatRate);
    const total = subtotal + vat;

    return { count, households, residents, monthlyImpressions, monitors, subtotal, vat, total };
  }, [rows, vatRate]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold">문의 내역</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="seat-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* 카운터 */}
            <div className="px-4 pt-1 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-medium">{`총 ${totals.count}개 단지`}</span>
              <span>
                · 세대수 <b>{fmtNum(totals.households)}</b> 세대
              </span>
              <span>
                · 거주인원 <b>{fmtNum(totals.residents)}</b> 명
              </span>
              <span>
                · 송출횟수 <b>{fmtNum(totals.monthlyImpressions)}</b> 회
              </span>
              <span>
                · 모니터수량 <b>{fmtNum(totals.monitors)}</b> 대
              </span>
              <span className="text-xs text-[#9CA3AF] ml-auto">(단위 · 원 / VAT별도)</span>
            </div>

            {/* 테이블 (가로 스크롤 허용) */}
            <div className="px-4 pb-4">
              <div className="rounded-xl border border-[#E5E7EB] overflow-x-auto">
                <table className="w-full min-w-[1100px] text-[13px] whitespace-nowrap">
                  <thead className="bg-[#F9FAFB] text-[#111827]">
                    <tr className="[&>th]:px-4 [&>th]:py-2 text-center">
                      <th className="text-left">단지명</th>
                      <th>상품명</th>
                      <th>월광고료</th>
                      <th>광고기간</th>
                      <th>기준금액</th>
                      <th>할인율</th>
                      <th className="!text-[#6C2DFF]">총 광고료</th>
                    </tr>
                  </thead>
                  <tbody className="[&>tr>td]:px-4 [&>tr>td]:py-2">
                    {rows.length ? (
                      rows.map((r, i) => (
                        <tr key={`${r.name}-${i}`} className="border-t border-[#F3F4F6]">
                          <td className="text-left font-medium text-black">{safe(r.name)}</td>
                          <td className="text-center">{safe(r.product)}</td>
                          <td className="text-center">{fmtWon(r.monthly ?? null)}</td>
                          <td className="text-center">{r.months ? `${r.months}개월` : "-"}</td>
                          <td className="text-center">{fmtWon(r.baseTotal ?? null)}</td>
                          <td className="text-center">
                            {typeof r.discountRate === "number" ? `${Math.round(r.discountRate * 100)}%` : "—"}
                          </td>
                          {/* 각 행의 총광고료는 검은색 */}
                          <td className="text-center font-semibold text-[#111827]">{fmtWon(r.lineTotal ?? null)}</td>
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
                  <tfoot className="bg-[#F9FAFB]">
                    <tr className="[&>td]:px-4 [&>td]:py-3 border-t border-[#E5E7EB]">
                      <td colSpan={6} className="text-right text-[#6B7280] font-medium">
                        총 광고료 합계(TOTAL)
                      </td>
                      {/* 합계는 보라색 */}
                      <td className="text-right font-bold text-[#6C2DFF]">{fmtWon(totals.subtotal)}</td>
                    </tr>
                    <tr className="[&>td]:px-4 [&>td]:py-3">
                      <td colSpan={6} className="text-right text-[#6B7280] font-medium">
                        부가세(VAT 10%)
                      </td>
                      {/* 부가세는 빨간색 + 볼드 */}
                      <td className="text-right font-bold text-red-500">{fmtWon(totals.vat)}</td>
                    </tr>
                    <tr className="[&>td]:px-4 [&>td]:py-3">
                      <td colSpan={6} className="text-right text-[#6B7280] font-medium">
                        최종 광고료 (VAT 포함)
                      </td>
                      {/* 최종은 보라색 + 볼드 */}
                      <td className="text-right font-bold text-[#6C2DFF]">{fmtWon(totals.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================
 * 메인 모달
 *  - 모달 자체에 min-height를 주어 하한선 확보(많이 담아도 내부 스크롤)
 * ======================================================= */
export function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  useBodyScrollLock(open);

  const isPkg = isPackageReceipt(data);
  const isSeat = isSeatReceipt(data);

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!open) return null;

  // PC 고정 링크
  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

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
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            key="panel"
            className="w-[980px] max-w-[94vw] rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            // 하한선 + 내부 스크롤
            style={{ maxHeight: "86vh", display: "flex", flexDirection: "column" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Body (세로 스크롤 영역) */}
            <div className="grid grid-cols-12 gap-6 px-6 py-6 overflow-y-auto">
              {/* 좌측 */}
              <div className="col-span-12 lg:col-span-8 space-y-4">
                <CustomerInquirySection data={data as any} />
                {isSeat && <SeatInquiryBox data={data as ReceiptSeat} />}
              </div>

              {/* 우측 */}
              <div className="col-span-12 lg:col-span-4 space-y-4">
                <NextSteps variant={isSeat ? "SEAT" : "PACKAGE"} />

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

            {/* Footer (고정) */}
            <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
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

export default CompleteModalDesktop;
