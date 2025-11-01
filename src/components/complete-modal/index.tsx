// src/components/complete-modal/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import CompleteModalMobile from "./CompleteModal.mobile";
import CompleteModalDesktop from "./CompleteModal.desktop";
import type { CompleteModalProps } from "./types";

/** 데스크톱 브레이크포인트 */
const DESKTOP_QUERY = "(min-width: 1024px)";

function getIsDesktop(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia === "undefined") return true;
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => getIsDesktop());
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    if ("addEventListener" in mql) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    // 레거시
    // @ts-ignore
    mql.addListener?.(handler);
    // @ts-ignore
    return () => mql.removeListener?.(handler);
  }, []);
  return isDesktop;
}

/** 완료(접수) 모달: 뷰포트에 따라 모바일/데스크톱 자동 분기 */
export function CompleteModal(props: CompleteModalProps) {
  const isDesktop = useIsDesktop();
  const View = useMemo(() => (isDesktop ? CompleteModalDesktop : CompleteModalMobile), [isDesktop]);
  return <View {...props} />;
}

/** 기본 export */
export default CompleteModal;

/** Desktop/Mobile 컴포넌트도 named export로 함께 제공(호환용) */
export { default as CompleteModalDesktop } from "./CompleteModal.desktop";
export { default as CompleteModalMobile } from "./CompleteModal.mobile";

/** 타입/가드 전부 재노출 (named only) */
export type {
  InquiryKind,
  CurrencyCode,
  ReceiptLinks,
  ReceiptActions,
  ManagerInfo,
  CustomerSnapshot,
  SeatSummary,
  PackageSummary,
  SeatItem,
  PackageArea,
  ReceiptMeta,
  ReceiptBase,
  ReceiptSeat,
  ReceiptPackage,
  ReceiptData,
  CompleteModalProps as CompleteModalPropsType,
} from "./types";

export { isSeatReceipt, isPackageReceipt } from "./types";
