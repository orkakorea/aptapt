// src/components/complete-modal/CompleteModal.desktop.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, ExternalLink, FileSignature, Mail, X, CheckCircle2 } from "lucide-react";

import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";

// 전체 내용 캡처(스크롤 해제 포함)
import { saveFullContentAsPNG, saveFullContentAsPDF } from "@/core/utils/capture";

const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/* ================== Utils ================== */
function formatKRW(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "-";
  return "₩" + Number(n).toLocaleString("ko-KR");
}
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
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
function maskEmail(email?: string | null) {
  if (!email) return "";
  const str = String(email);
  const at = str.indexOf("@");
  if (at <= 0) {
    return str.startsWith("@") ? `**${str}` : str.slice(0, 2) + "…";
  }
  const local = str.slice(0, at);
  const domain = str.slice(at + 1);
  const shown = local.slice(0, 2);
  const masked = local.length > 2 ? "*".repeat(local.length - 2) : "";
  return `${shown}${masked}@${domain}`;
}
const safeNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : 0);

/* ================== Shared Sub Components ================== */
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

/* ================== 오른쪽: 다음 절차(공통) ================== */
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

/* ================== 좌측: 고객 문의 (항상 펼침) ================== */
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

  // 광고 송출 예정(희망)일
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
    (typeof summary.months === "number" ? `${summary.months}개월` : undefined);

  // 프로모션 코드
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

      {/* 본문 */}
      <div className="px-4">
        <RowLine label="상호명" value={c.company ?? form.company} />
        <RowLine label="담당자" value={c.name ?? form.manager ?? form.contactName} />
        <RowLine label="연락처" value={c.phoneMasked ?? form.phoneMasked ?? form.phone} />
        <RowLine label="이메일" value={emailMasked} />
        <RowLine label="캠페인 유형" value={campaignType} />
        <RowLine label="광고 송출 예정(희망)일" value={desiredValue} />
        <RowLine label="프로모션코드" value={promoCode} />
      </div>

      {/* 문의내용: 스크롤 영역 → 전체 저장 시 임시 해제용 data-capture-scroll */}
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

/* ============ 좌측: SEAT 전용 “문의 내역” (카운터 + 이름 매핑 보강) ============ */
function SeatInquiryTable({ data }: { data: ReceiptSeat }) {
  const items: any[] = (data?.details as any)?.items ?? [];

  const getVal = (obj: any, keys: string[], fallback?: any) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return fallback;
  };

  // 이름 매핑 폴백
  const summary = (data as any)?.summary || {};
  const summaryTop = typeof summary?.topAptLabel === "string" ? String(summary.topAptLabel) : "";
  const topFallback = summaryTop ? summaryTop.replace(/\s*외.*$/, "") : "-";

  const rows = (items ?? []).map((it: any) => {
    const aptName =
      getVal(it, ["apt_name", "aptName", "name", "apt", "aptTitle", "complex_name", "complex", "title"], null) ??
      topFallback ??
      "-";

    const months = getVal(it, ["months", "month"], undefined);
    const periodLabel = typeof months === "number" ? `${months}개월` : (months ?? "-");
    const productName = getVal(it, ["productName", "product_name", "mediaName"], "-");

    const households = Number(getVal(it, ["households", "household", "hh"], 0));
    const residents = Number(getVal(it, ["residents", "population"], 0));
    const monthlyImpressions = Number(
      getVal(it, ["monthlyImpressions", "monthly_impressions", "impressions", "plays"], 0),
    );
    const monitors = Number(getVal(it, ["monitors", "monitorCount", "monitor_count", "screens"], 0));

    // 총광고료 역산
    const lineTotalRaw = getVal(it, ["lineTotal", "item_total_won", "total_won", "line_total"], undefined);
    let lineTotal = Number(lineTotalRaw);
    if (!Number.isFinite(lineTotal)) {
      const monthlyAfter = Number(getVal(it, ["monthlyAfter", "monthly_after", "priceMonthlyAfter"], NaN));
      const baseMonthly = Number(getVal(it, ["baseMonthly", "base_monthly", "priceMonthly"], NaN));
      const m = typeof months === "number" ? months : parseInt(months, 10) || 0;
      if (Number.isFinite(monthlyAfter) && m > 0) lineTotal = monthlyAfter * m;
      else if (Number.isFinite(baseMonthly) && m > 0) lineTotal = baseMonthly * m;
      else lineTotal = 0;
    }

    return {
      aptName,
      periodLabel,
      productName,
      households,
      residents,
      monthlyImpressions,
      monitors,
      lineTotal,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.households += safeNum(r.households);
      acc.residents += safeNum(r.residents);
      acc.monthlyImpressions += safeNum(r.monthlyImpressions);
      acc.monitors += safeNum(r.monitors);
      return acc;
    },
    { households: 0, residents: 0, monthlyImpressions: 0, monitors: 0 },
  );
  const count = rows.length;

  const periodTotal =
    (data as any)?.details?.periodTotalKRW ??
    rows.reduce((acc: number, r: any) => acc + (Number.isFinite(r.lineTotal) ? r.lineTotal : 0), 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="px-4 py-3 text-sm font-semibold">문의 내역</div>

      {/* 카운터 바 */}
      <div className="px-4 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
        <span className="font-semibold">{`총 ${count}개 단지`}</span>
        <span>
          · 세대수 <b>{totals.households.toLocaleString()}</b> 세대
        </span>
        <span>
          · 거주인원 <b>{totals.residents.toLocaleString()}</b> 명
        </span>
        <span>
          · 송출횟수 <b>{totals.monthlyImpressions.toLocaleString()}</b> 회
        </span>
        <span>
          · 모니터수량 <b>{totals.monitors.toLocaleString()}</b> 대
        </span>
      </div>

      {/* 테이블: 가로 스크롤 허용 */}
      <div className="border-t border-gray-100 overflow-x-auto whitespace-nowrap" data-capture-scroll>
        <table className="text-[13px] min-w-[760px]">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="[&>th]:px-3 [&>th]:py-2">
              <th className="text-left">단지명</th>
              <th className="text-right">광고기간</th>
              <th className="text-left">상품명</th>
              <th className="text-right">모니터수량</th>
              <th className="text-right">총광고료</th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
            {rows.length ? (
              rows.map((r: any, idx: number) => (
                <tr key={idx} className="border-t border-gray-100">
                  <td className="font-medium">{r.aptName}</td>
                  <td className="text-right">{r.periodLabel}</td>
                  <td className="truncate">{r.productName}</td>
                  <td className="text-right">
                    {Number.isFinite(r.monitors) ? r.monitors.toLocaleString() : r.monitors}
                  </td>
                  <td className="text-right">{formatKRW(r.lineTotal)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-6 text-center text-xs text-gray-500">
                  항목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr className="[&>td]:px-3 [&>td]:py-3">
              <td colSpan={4} className="text-right text-gray-600">
                총 광고료 합계
              </td>
              <td className="text-right font-semibold" style={{ color: BRAND }}>
                {formatKRW(periodTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
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

  // ★ SSR 가드: 마운트 이후에만 포털/DOM 접근
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  // SSR/프리렌더 환경 보호
  if (!open || !mounted || typeof document === "undefined") return null;

  const saveButtonLabel = "문의 내용 저장";
  const sheetTitle = saveButtonLabel;

  // PC 고정 링크
  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

  // 저장(잘림 없이): 루트/스크롤 컨테이너 찾아 전체 캡처
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

        {/* 중앙 정렬 컨테이너 */}
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            id="receipt-capture"
            key="panel"
            className="w-[900px] max-w-[94vw] rounded-2xl bg-white shadow-2xl"
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

            {/* Body */}
            <div className="grid grid-cols-12 gap-6 px-6 py-6">
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
                  {saveButtonLabel}
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

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
              <button onClick={onClose} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>

        {/* 저장 액션 시트 */}
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
                  <div className="text-sm font-semibold">{sheetTitle}</div>
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

export default CompleteModalDesktop;
