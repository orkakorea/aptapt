import React, { useEffect, useMemo, useState } from "react";
import type { CompleteModalProps } from "./types";
import CompleteModalMobile from "./CompleteModal.mobile";
import CompleteModalDesktop from "./CompleteModal.desktop";

/** 뷰포트 기준: 데스크톱 임계값 */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** 현재 환경이 데스크톱 뷰포트인지 판별 */
function getIsDesktop(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia === "undefined") {
    // SSR 또는 matchMedia 미지원: 데스크톱으로 가정
    return true;
  }
  return window.matchMedia(DESKTOP_QUERY).matches;
}

/** 뷰포트 반응 훅 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => getIsDesktop());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia === "undefined") return;

    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

    // 최신 브라우저
    if (typeof mql.addEventListener === "function") {
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
export default function CompleteModal(props: CompleteModalProps) {
  const isDesktop = useIsDesktop();

  // 렌더 스위치(초기 SSR-CSR 불일치 최소화를 위해 useMemo)
  const View = useMemo(() => (isDesktop ? CompleteModalDesktop : CompleteModalMobile), [isDesktop]);

  return <View {...props} />;
}

/** 타입 재노출(외부에서 import 편의) */
export * from "./types";
