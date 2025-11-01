// src/components/complete-modal/CompleteModal.desktop.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  FileSignature,
  Mail,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";

import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";
import { saveNodeAsPNG, saveNodeAsPDF } from "@/core/utils/capture";

/* ============================================================
 * Constants
 * ============================================================ */
const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/* ============================================================
 * Small utils
 * ============================================================ */
const fmtWon = (n?: number | null) => (typeof n === "number" && isFinite(n) ? `${n.toLocaleString()}원` : "₩0");
const fmtNum = (n?: number | null, unit = "") =>
  typeof n === "number" && isFinite(n) ? `${n.toLocaleString()}${unit}` : "-";
const safe = (s?: string | null) => (s && s.trim().length ? s : "-");

function formatKST(iso?: string) {
  try {
    if (!iso) return "";
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

/* ============================================================
 * Header / Aside
 * ============================================================ */
function HeaderSuccess({ ticketCode, createdAtISO }: { ticketCode: string; createdAtISO: string }) {
  const ts = useMemo(() => formatKST(createdAtISO), [createdAtISO]);
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
          접수번호 {ticketCode} · {ts}
        </div>
      </div>
    </div>
  );
}

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

/* ============================================================
 * Customer section
 * ============================================================ */
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 text-sm text-gray-800 break-words">{value || "-"}</div>
    </div>
  );
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

  const c: any = (data as any).customer ?? {};
  const form: any = (data as any).form ?? {};
  const summary: any = (data as any).summary ?? {};

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
    summary.promo_code ??
    (data as any)?.meta?.promotionCode ??
    (data as any)?.meta?.promoCode ??
    (data as any)?.meta?.promo_code;

  const inquiryText: string =
    form.request ?? form.message ?? form.memo ?? form.note ?? (data as any)?.customer?.note ?? "";

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
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

/* ============================================================
 * Seat (문의 내역) section
 *  - 접기/펼치기 + 카운터 + 가로 스크롤 테이블 + 합계/부가세/최종
 * ============================================================ */
type SeatRow = {
  aptName: string;
  productName?: string;
  months?: number;
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
  baseMonthly?: number;
  baseTotal?: number;
  discountRate?: number;
  precompRate?: number;
  lineTotal?: number;
};
function val(obj: any, keys: string[], fb?: any) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fb;
}

function SeatInquirySection({ data }: { data: ReceiptSeat }) {
  const [open, setOpen] = useState(true);

  const { rows, totals, subtotal, vat, grand } = useMemo(() => {
    const items = (data as any)?.details?.items ?? [];
    const rows: SeatRow[] = (items ?? []).map((it: any) => {
      const months = Number(val(it, ["months", "month"], 0)) || 0;
      const baseMonthly = Number(val(it, ["baseMonthly", "base_monthly", "priceMonthly"], 0)) || 0;
      const monthlyAfter = Number(val(it, ["monthlyAfter", "monthly_after", "priceMonthlyAfter"], 0)) || 0;
      const baseTotal = baseMonthly * months || undefined;
      const _line = Number(val(it, ["lineTotal", "item_total_won", "total_won", "line_total"], NaN));
      const lineTotal = isFinite(_line) && _line > 0 ? _line : (monthlyAfter || baseMonthly) * (months || 0);

      const base = baseMonthly || undefined;
      const after = monthlyAfter || undefined;
      const discountRate = base && after ? Math.max(0, Math.min(1, 1 - after / base)) : undefined;

      return {
        aptName: val(it, ["aptName", "apt_name", "name"], "-"),
        productName: val(it, ["productName", "product_name", "mediaName"], "-"),
        months,
        households: Number(val(it, ["households"], NaN)) || undefined,
        residents: Number(val(it, ["residents"], NaN)) || undefined,
        monthlyImpressions: Number(val(it, ["monthlyImpressions"], NaN)) || undefined,
        monitors: Number(val(it, ["monitors", "monitorCount", "screens", "monitor_count"], NaN)) || undefined,
        baseMonthly: base,
        baseTotal,
        lineTotal: isFinite(lineTotal) ? Math.round(lineTotal) : 0,
        discountRate,
        precompRate: undefined,
      };
    });

    const sum = (xs: any[], key: keyof SeatRow) => xs.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

    const subtotal = sum(rows, "lineTotal");
    const vat = Math.round(subtotal * 0.1);
    const grand = subtotal + vat;

    const totals = {
      count: rows.length,
      households: sum(rows, "households"),
      residents: sum(rows, "residents"),
      monthlyImpressions: sum(rows, "monthlyImpressions"),
      monitors: sum(rows, "monitors"),
    };

    return { rows, totals, subtotal, vat, grand };
  }, [data]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      {/* Header (toggle) */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">문의 내역</span>
          <span className="text-xs text-gray-400">(단위 · 원 / VAT별도)</span>
        </div>
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
            {/* Counters */}
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
            </div>

            {/* Table (horizontal scroll allowed) */}
            <div className="px-4 pb-4 overflow-x-auto">
              <div className="min-w-[980px] rounded-xl border border-[#E5E7EB]">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-[#111827]">
                      <Th className="text-left">단지명</Th>
                      <Th>상품명</Th>
                      <Th>월광고료</Th>
                      <Th>광고기간</Th>
                      <Th>기준금액</Th>
                      <Th>할인율</Th>
                      <Th className="!text-[#111827]">총 광고료</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-[#6B7280]">
                          항목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r, idx) => (
                        <tr key={idx} className="border-t border-[#F3F4F6]">
                          <Td className="text-left font-medium text-black">{safe(r.aptName)}</Td>
                          <Td center>{safe(r.productName)}</Td>
                          <Td center>{fmtWon(r.baseMonthly)}</Td>
                          <Td center>{r.months ? `${r.months}개월` : "-"}</Td>
                          <Td center>{fmtWon(r.baseTotal)}</Td>
                          <Td center>
                            {typeof r.discountRate === "number" ? `${Math.round(r.discountRate * 100)}%` : "-"}
                          </Td>
                          <Td center className="font-semibold text-[#111827]">
                            {fmtWon(r.lineTotal)}
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#E5E7EB]">
                      <td colSpan={6} className="text-right px-4 py-3 bg-[#F7F5FF] text-[#6B7280] font-medium">
                        총 광고료 합계(TOTAL)
                      </td>
                      <td className="px-4 py-3 bg-[#F7F5FF] text-right font-bold text-[#6C2DFF]">{fmtWon(subtotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* VAT / FINAL */}
              <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-white">
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-[#6B7280]">부가세(VAT 10%)</span>
                  <span className="font-bold text-[#EF4444]">{fmtWon(vat)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#F3F4F6] px-4 py-3">
                  <span className="text-[15px] font-semibold text-[#6C2DFF]">최종 광고료 (VAT 포함)</span>
                  <span className="text-[18px] font-bold text-[#6C2DFF]">{fmtWon(grand)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
 * Table helpers
 * ============================================================ */
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-5 py-3 text-center text-sm font-bold border-b border-[#E5E7EB] ${className}`}>{children}</th>
  );
}
function Td({ children, className = "", center }: React.PropsWithChildren<{ className?: string; center?: boolean }>) {
  return (
    <td className={`px-5 py-3 align-middle ${center ? "text-center" : ""} text-[#111827] ${className}`}>{children}</td>
  );
}

/* ============================================================
 * Main
 * ============================================================ */
export function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false); // 저장 시 고객문의/문의내역 강제 펼침
  const isSeat = isSeatReceipt(data);

  // Body scroll lock + ESC
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

  const saveAll = (kind: "png" | "pdf") => {
    // 섹션을 강제로 펼친 뒤 전체 캡처
    setForceOpen(true);
    requestAnimationFrame(() => {
      setTimeout(async () => {
        const node = document.getElementById("receipt-capture");
        if (node) {
          if (kind === "png") await saveNodeAsPNG(node, `${data.ticketCode}_receipt`);
          else await saveNodeAsPDF(node, `${data.ticketCode}_receipt`);
        }
        setPickerOpen(false);
        // 필요하면 원복: setForceOpen(false);
      }, 80);
    });
  };

  return createPortal(
    <AnimatePresence>
      <>
        {/* Dim */}
        <motion.div
          key="dim"
          className="fixed inset-0 z-[1200] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        {/* Panel */}
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            id="receipt-capture"
            key="panel"
            className="w-[900px] max-w-[94vw] rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            style={{ maxHeight: "86vh" }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5 sticky top-0 bg-white rounded-t-2xl">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Body (inner scroll only) */}
            <div
              className="grid grid-cols-12 gap-6 px-6 py-6 overflow-y-auto"
              style={{ maxHeight: "calc(86vh - 120px)" }}
            >
              {/* Left */}
              <div className="col-span-8 space-y-4">
                <CustomerInquirySection data={data as any} forceOpen={forceOpen} />
                {isSeat && <SeatInquirySection data={data as ReceiptSeat} />}
              </div>

              {/* Right */}
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
                      onClick={() => window.open(LINK_YT, "_blank", "noopener,noreferrer")}
                      className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                    >
                      <ExternalLink size={16} />
                      광고 소재 채널 바로가기
                    </button>
                    <button
                      onClick={() => window.open(LINK_GUIDE, "_blank", "noopener,noreferrer")}
                      className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                    >
                      <ExternalLink size={16} />
                      제작 가이드 바로가기
                    </button>
                    <button
                      onClick={() => window.open(LINK_TEAM, "_blank", "noopener,noreferrer")}
                      className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                    >
                      <ExternalLink size={16} />
                      오르카 구성원 확인하기
                    </button>
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

        {/* Save sheet */}
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
                      onClick={() => saveAll("png")}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      이미지(PNG)
                    </button>
                    <button
                      onClick={() => saveAll("pdf")}
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

export default CompleteModalDesktop;
