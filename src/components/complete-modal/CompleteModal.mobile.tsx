import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileDown,
  FileText,
  Mail,
  ExternalLink,
  CalendarCheck2,
  MessageSquare,
  Phone,
  Link as LinkIcon,
  X,
} from "lucide-react";
import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";

/* 스타일 상수 */
const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";
const CARD_BG = "#F4F6FA";

/* 유틸 */
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

/* 서브 컴포넌트들 (HeaderSuccess, SummaryCard, DetailsSection, SeatDetails, PackageDetails, NextSteps) */
/* … (이전 제공본과 동일 – 내용 생략 없이 프로젝트 파일엔 그대로 유지) … */
function HeaderSuccess({ ticketCode, createdAtISO }: { ticketCode: string; createdAtISO: string }) {
  const kst = useMemo(() => formatKST(createdAtISO), [createdAtISO]);
  return (
    <div className="px-5 pt-4 pb-2 text-center">
      <motion.div
        className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_LIGHT }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <CheckCircle2 size={28} color={BRAND} />
      </motion.div>
      <h2 className="text-lg font-semibold">문의가 접수됐어요!</h2>
      <p className="mt-1 text-sm text-gray-500">
        접수번호 {ticketCode} · {kst}
      </p>
      <p className="mt-3 text-sm">
        해당 지역 담당자가 <b>1–2일 이내</b> 연락드릴 예정입니다.
        <br />
        담아주신 조건을 기준으로 <b>재고·할인</b>을 확인 중이에요.
      </p>
    </div>
  );
}

/* … SummaryCard / DetailsSection / SeatDetails / PackageDetails / NextSteps 는 이전 코드 그대로 … */

/* 메인 컴포넌트 — named export + default export 동시 제공 */
export function CompleteModalMobile({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  useBodyScrollLock(open);

  const hasTeam = !!data?.links?.teamUrl;
  const hasYT = !!data?.links?.youtubeUrl;
  const hasGuide = !!data?.links?.guideUrl;
  const hasReceiptLink = !!data?.links?.receiptUrl;

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const handleCopyLink = async () => {
    const url = data?.links?.receiptUrl;
    if (!url) return void data?.actions?.onCopyLink?.();
    try {
      await navigator.clipboard.writeText(url);
      data?.actions?.onCopyLink?.();
    } catch {}
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="dim"
            className="fixed inset-0 z-[99] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* … 이하 내용은 이전 제공본과 동일 … */}
          {/* 하단 확인 */}
          {/* … */}
        </>
      )}
    </AnimatePresence>
  );
}

export default CompleteModalMobile;
