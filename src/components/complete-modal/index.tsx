import React, { useEffect, useMemo, useState } from "react";
import type { CompleteModalProps } from "./types";
import CompleteModalMobile from "./CompleteModal.mobile";
import CompleteModalDesktop from "./CompleteModal.desktop";

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
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    // @ts-ignore (레거시)
    mql.addListener?.(handler);
    // @ts-ignore
    return () => mql.removeListener?.(handler);
  }, []);
  return isDesktop;
}

/** 이름 있는 export */
export function CompleteModal(props: CompleteModalProps) {
  const isDesktop = useIsDesktop();
  const View = useMemo(() => (isDesktop ? CompleteModalDesktop : CompleteModalMobile), [isDesktop]);
  return <View {...props} />;
}

/** 기본 export도 함께 제공(둘 다 사용 가능) */
export default CompleteModal;

/** 타입/가드 재노출 (타입은 type-only로) */
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
