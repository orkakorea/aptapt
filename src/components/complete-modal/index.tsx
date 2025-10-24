import React, { useEffect, useMemo, useState } from "react";
import { CompleteModalMobile } from "./CompleteModal.mobile";
import { CompleteModalDesktop } from "./CompleteModal.desktop";

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
    // 레거시 호환
    // @ts-ignore
    mql.addListener?.(handler);
    // @ts-ignore
    return () => mql.removeListener?.(handler);
  }, []);
  return isDesktop;
}

/** 완료(접수) 모달: 뷰포트에 따라 모바일/데스크톱 자동 분기 */
export function CompleteModal(props: any) {
  const isDesktop = useIsDesktop();
  const View = useMemo(() => (isDesktop ? CompleteModalDesktop : CompleteModalMobile), [isDesktop]);
  return <View {...props} />;
}

/** 기본 export도 함께 제공 */
export default CompleteModal;

/** 타입/가드 등은 전부 재노출 (개별 이름 나열 없이 안전) */
export * from "./types";
