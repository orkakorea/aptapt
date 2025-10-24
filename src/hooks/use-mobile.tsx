// src/hooks/use-mobile.tsx
import * as React from "react";

const MOBILE_BREAKPOINT = 768; // < 768px 를 모바일로 간주

export function useIsMobile() {
  // SSR 안전: 서버에선 false로 시작, 클라이언트에서 즉시 보정
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") {
      return window.matchMedia(`(max-width:${MOBILE_BREAKPOINT - 1}px)`).matches;
    }
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let mql: MediaQueryList | null = null;

    const compute = () => {
      if (typeof window.matchMedia === "function") {
        if (!mql) mql = window.matchMedia(`(max-width:${MOBILE_BREAKPOINT - 1}px)`);
        return mql.matches;
      }
      return window.innerWidth < MOBILE_BREAKPOINT;
    };

    const update = () => setIsMobile(compute());

    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia(`(max-width:${MOBILE_BREAKPOINT - 1}px)`);
      // Safari 구버전 호환(addListener/removeListener)
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", update);
      } else if (typeof (mql as any).addListener === "function") {
        (mql as any).addListener(update);
      }
      update(); // 초기 동기화
    } else {
      // matchMedia 미지원 폴백
      window.addEventListener("resize", update);
      window.addEventListener("orientationchange", update as any);
      update();
    }

    return () => {
      if (mql) {
        if (typeof mql.removeEventListener === "function") {
          mql.removeEventListener("change", update);
        } else if (typeof (mql as any).removeListener === "function") {
          (mql as any).removeListener(update);
        }
      } else {
        window.removeEventListener("resize", update);
        window.removeEventListener("orientationchange", update as any);
      }
    };
  }, []);

  return isMobile;
}

export default useIsMobile;
