import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { saveNodeAsPNG, saveNodeAsPDF } from "@/core/utils/capture";

/* =========================================================================
 * 스타일 토큰
 * ========================================================================= */
const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/* =========================================================================
 * 유틸
 * ========================================================================= */
const fmtWon = (n?: number | null) =>
  typeof n === "number" && Number.isFinite(n) ? `₩${n.toLocaleString("ko-KR")}` : "₩0";
const fmtNum = (n?: number | null, unit = "") =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}${unit}` : `0${unit}`;
const safe = (s?: string | null) => (s && s.trim() ? s : "—");

function formatKST(iso?: string) {
  if (!iso) return "";
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

/** product 분류 (기간/사전보상 룰 매칭용) */
type RangeRule = { min: number; max: number; rate: number };
type ProductRules = { precomp?: RangeRule[]; period?: RangeRule[] };
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
function classifyPolicyKey(productName?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  if (!pn) return undefined;

  if (
    pn.includes("townbord_l") ||
    pn.includes("townboard_l") ||
    /\btownbord[-_\s]?l\b/.test(pn) ||
    /\btownboard[-_\s]?l\b/.test(pn)
  )
    return "TOWNBORD_L";
  if (
    pn.includes("townbord_s") ||
    pn.includes("townboard_s") ||
    /\btownbord[-_\s]?s\b/.test(pn) ||
    /\btownboard[-_\s]?s\b/.test(pn)
  )
    return "TOWNBORD_S";

  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) return "ELEVATOR TV";
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "HI-POST";
  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) return "TOWNBORD_S";
  return undefined;
}
function findRate(rules: RangeRule[] | undefined, months: number) {
  if (!rules || !Number.isFinite(months)) return 0;
  return rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0;
}

/* =========================================================================
 * 공유 소구성요소
 * ========================================================================= */
function Box({
  children,
  className = "",
}: React.PropsWithChildren<{
  className?: string;
}>) {
  return <div className={`rounded-2xl border border-[#E5E7EB] bg-white ${className}`}>{children}</div>;
}

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div className="grid grid-cols-[140px_1fr] gap-3 px-5 py-3 border-t border-[#F3F4F6] text-sm">
    <div className="text-[#6B7280]">{label}</div>
    <div className="text-[#111827] break-words">{value ?? "—"}</div>
  </div>
);

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

/* =========================================================================
 * 고객 문의(접이식)
 * ========================================================================= */
function CustomerInquirySection({
  data,
  forceOpen,
}: {
  data: ReceiptPackage | ReceiptSeat | ReceiptData;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const c: any = (data as any).customer || {};
  const form: any = (data as any).form || {};
  const summary: any = (data as any).summary || {};
  const email = c.email ?? form.email ?? summary.email;
  const emailMasked = (() => {
    if (!email) return c.emailDomain ? `**${String(c.emailDomain)}` : "-";
    const str = String(email);
    const at = str.indexOf("@");
    if (at <= 0) return str.slice(0, 2) + "…";
    const local = str.slice(0, at);
    const domain = str.slice(at + 1);
    const shown = local.slice(0, 2);
    const masked = local.length > 2 ? "*".repeat(local.length - 2) : "";
    return `${shown}${masked}@${domain}`;
  })();

  const campaignType =
    form.campaignType ??
    form.campaign_type ??
    summary.campaignType ??
    summary.campaign_type ??
    c.campaignType ??
    c.campaign_type;

  const desiredValue =
    form.desiredDate ??
    summary.desiredDate ??
    (typeof form.months === "number" ? `${form.months}개월` : undefined) ??
    (typeof summary.months === "number" ? `${summary.months}개월` : undefined);

  const promoCode =
    form.promotionCode ??
    form.promoCode ??
    summary.promotionCode ??
    summary.promoCode ??
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
      {/* Header(토글) */}
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
              <Row label="상호명" value={safe(c.company ?? form.company)} />
              <Row label="담당자" value={safe(c.name ?? form.manager ?? form.contactName)} />
              <Row label="연락처" value={safe(c.phoneMasked ?? form.phoneMasked ?? form.phone)} />
              <Row label="이메일" value={emailMasked} />
              <Row label="캠페인 유형" value={safe(campaignType)} />
              <Row label="광고 송출 예정(희망)일" value={safe(desiredValue)} />
              <Row label="프로모션코드" value={safe(promoCode)} />
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

/* =========================================================================
 * SEAT 전용 문의 내역(접이식) + 카운터 + 표 + 합계
 * ========================================================================= */
function SeatInquiryTable({ data, forceOpen }: { data: ReceiptSeat; forceOpen: boolean }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const items: any[] = (data?.details as any)?.items ?? [];

  // 행 변환 + 할인/총액 계산
  const rows = useMemo(() => {
    return (items ?? []).map((it: any) => {
      const months = Number(it?.months ?? it?.month ?? 0) || 0;
      const productName = it?.productName ?? it?.product_name ?? it?.mediaName ?? "-";
      const baseMonthly = Number(it?.baseMonthly ?? it?.monthly ?? it?.monthlyFee ?? it?.monthly_fee ?? 0) || 0;

      const pk = classifyPolicyKey(productName);
      const rule = pk ? POLICY[pk] : undefined;
      const periodRate = findRate(rule?.period, months);
      const precompRate = pk === "ELEVATOR TV" ? findRate(rule?.precomp, months) : 0;

      const baseTotal = baseMonthly * months;
      const monthlyAfter = Math.round(baseMonthly * (1 - precompRate) * (1 - periodRate));
      const lineTotal = monthlyAfter * months;

      const aptName = it?.aptName ?? it?.apt_name ?? it?.name ?? "-";
      const households = Number(it?.households ?? it?.hh) || 0;
      const residents = Number(it?.residents ?? it?.pop) || 0;
      const monthlyImpressions = Number(it?.monthlyImpressions ?? it?.impressions) || 0;
      const monitors = Number(it?.monitors ?? it?.monitorCount ?? it?.monitor_count) || 0;

      return {
        aptName,
        productName,
        months,
        baseMonthly,
        baseTotal,
        periodRate,
        precompRate,
        discountRate: 1 - (1 - precompRate) * (1 - periodRate), // 합성
        lineTotal,
        households,
        residents,
        monthlyImpressions,
        monitors,
      };
    });
  }, [items]);

  // 카운터 / 합계
  const totals = useMemo(() => {
    const sum = (key: keyof (typeof rows)[number]) =>
      rows.reduce((acc, r) => acc + (Number.isFinite(r[key] as any) ? (r[key] as number) : 0), 0);

    return {
      count: rows.length,
      households: sum("households"),
      residents: sum("residents"),
      monthlyImpressions: sum("monthlyImpressions"),
      monitors: sum("monitors"),
      subtotal: sum("lineTotal"),
      vat: Math.round(sum("lineTotal") * 0.1),
      total: Math.round(sum("lineTotal") * 1.1),
    };
  }, [rows]);

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      {/* Header(토글) */}
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
            <div className="px-4 pt-1 pb-3 text-xs text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold">{`총 ${fmtNum(totals.count)}개 단지`}</span>
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

            {/* 표(가로 스크롤 허용) */}
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm border border-[#E5E7EB] rounded-xl overflow-hidden">
                <thead>
                  {/* 보조 안내행: 단위 */}
                  <tr>
                    <th colSpan={7} className="text-right text-xs text-[#9CA3AF] bg-white px-3 py-2">
                      (단위 · 원 / VAT별도)
                    </th>
                  </tr>
                  <tr className="bg-[#F9FAFB] text-[#111827] border-t border-[#E5E7EB]">
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
                        <Td center nowrap>
                          {safe(r.productName)}
                        </Td>
                        <Td center nowrap>
                          {fmtWon(r.baseMonthly)}
                        </Td>
                        <Td center nowrap>
                          {fmtNum(r.months, "개월")}
                        </Td>
                        <Td center nowrap>
                          {fmtWon(r.baseTotal)}
                        </Td>
                        <Td center nowrap>
                          {r.discountRate > 0 ? `${Math.round(r.discountRate * 100)}%` : "—"}
                        </Td>
                        <Td center nowrap className="text-right font-medium text-black">
                          {fmtWon(r.lineTotal)}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#E5E7EB]">
                    <td colSpan={6} className="text-right px-4 py-4 bg-[#F7F5FF] text-[#6B7280] font-medium">
                      총 광고료 합계(TOTAL)
                    </td>
                    <td className="px-4 py-4 bg-[#F7F5FF] text-right font-bold" style={{ color: BRAND }}>
                      {fmtWon(totals.subtotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 부가세/최종(가로 나란히) */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F7FF] p-4">
                  <div className="text-sm text-[#6B7280]">부가세(VAT 10%)</div>
                  <div className="mt-1 text-right text-[18px] font-bold text-[#EF4444]">{fmtWon(totals.vat)}</div>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F7FF] p-4">
                  <div className="text-sm text-[#6B7280]">최종 광고료 (VAT 포함)</div>
                  <div className="mt-1 text-right text-[20px] font-extrabold" style={{ color: BRAND }}>
                    {fmtWon(totals.total)}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================================================================
 * 메인
 * ========================================================================= */
export default function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false); // 저장 시 강제 펼침

  const isSeat = isSeatReceipt(data);
  const variant: "SEAT" | "PACKAGE" = isSeat ? "SEAT" : "PACKAGE";
  const captureId = "receipt-capture";

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

  // 저장(캡처) 공통: 강제 펼침 + overflow 해제 → 캡처 → 복구
  const withExpandAndCapture = async (doSave: (node: HTMLElement) => Promise<void>) => {
    const root = document.getElementById(captureId);
    if (!root) return;
    // 1) 펼침
    setForceOpen(true);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));

    // 2) overflow 임시 해제
    const prev = {
      overflow: root.style.overflow,
      maxHeight: (root.style as any).maxHeight,
      height: root.style.height,
    };
    root.style.overflow = "visible";
    (root.style as any).maxHeight = "none";
    root.style.height = "auto";
    window.scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));

    try {
      await doSave(root);
    } finally {
      // 3) 복구
      root.style.overflow = prev.overflow;
      (root.style as any).maxHeight = prev.maxHeight || "";
      root.style.height = prev.height || "";
      // forceOpen은 유지(유저가 펼친 상태로 계속 보도록). 필요하면 아래 한 줄을 해제
      // setForceOpen(false);
    }
  };

  const onSavePNG = () =>
    withExpandAndCapture(async (node) => {
      await saveNodeAsPNG(node, `${data.ticketCode}_receipt`);
    });
  const onSavePDF = () =>
    withExpandAndCapture(async (node) => {
      await saveNodeAsPDF(node, `${data.ticketCode}_receipt`);
    });

  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";
  const openExternal = (url?: string) => url && window.open(url, "_blank", "noopener,noreferrer");

  return createPortal(
    <AnimatePresence>
      <>
        {/* 딤드 */}
        <motion.div
          key="dim"
          className="fixed inset-0 z-[1200] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* 패널(wrap: 세로 스크롤 하한선) */}
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            id={captureId}
            key="panel"
            className="w-[980px] max-w-[94vw] max-h-[84vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5 sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="grid grid-cols-12 gap-6 px-6 py-6">
              {/* 좌측 */}
              <div className="col-span-8 space-y-4">
                <CustomerInquirySection data={data as any} forceOpen={forceOpen} />
                {isSeat && <SeatInquiryTable data={data as ReceiptSeat} forceOpen={forceOpen} />}
              </div>

              {/* 우측 */}
              <div className="col-span-4 space-y-4">
                <NextSteps variant={variant} />

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
                className="fixed left  -translate-x-1/2 top-1/2 z-[1203] w-[420px] max-w-[92vw] -translate-y-1/2 rounded-2xl bg-white shadow-2xl"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                style={{ left: "50%" }}
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
                        await onSavePNG();
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      PNG로 저장
                    </button>
                    <button
                      onClick={async () => {
                        await onSavePDF();
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      PDF로 저장(A4)
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

/* =========================================================================
 * 테이블 셀
 * ========================================================================= */
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-3 py-3 text-center text-sm font-bold border-b border-[#E5E7EB] ${className}`}>{children}</th>
  );
}
function Td({
  children,
  className = "",
  center,
  nowrap,
}: React.PropsWithChildren<{ className?: string; center?: boolean; nowrap?: boolean }>) {
  return (
    <td
      className={`px-3 py-3 align-middle text-[#111827] ${center ? "text-center" : ""} ${nowrap ? "whitespace-nowrap" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
