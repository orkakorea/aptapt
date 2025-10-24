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

/* 스타일/유틸/서브 컴포넌트 — 이전 제공본과 동일 (생략) */
/* … */

/* 메인 컴포넌트 — named export + default export 동시 제공 */
export function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  /* … (이전 제공본과 동일한 본문) … */
  return (
    /* … */
    <></>
  );
}

export default CompleteModalDesktop;
