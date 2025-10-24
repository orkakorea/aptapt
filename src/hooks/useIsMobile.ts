// src/hooks/useIsMobile.ts
import * as React from "react";

const BREAKPOINT = 768;

export function useIsMobile() {
  const compute = () => {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent || "";
    const uaMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const widthMobile = window.innerWidth < BREAKPOINT;
    return uaMobile || widthMobile;
  };

  const [isMobile, setIsMobile] = React.useState<boolean>(compute());

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(compute());

    // 초기 동기화 + 리스너 등록
    onChange();
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);

    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return isMobile;
}
