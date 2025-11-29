import * as React from "react";

const BREAKPOINT = 768;

export function useIsMobile() {
  const compute = () => {
    if (typeof window === "undefined") return false;

    const ua = navigator.userAgent || "";

    // ✅ 태블릿 UA 패턴: iPad, Tablet 등
    const isTabletUA = /iPad|Tablet/i.test(ua);

    // ✅ 폰 UA만 모바일로 취급 (태블릿은 제외)
    const isPhoneUA = !isTabletUA && /Mobi|Android(?!.*Tablet)|iPhone|iPod/i.test(ua);

    // ✅ 화면 너비 기준 모바일 판정
    const widthMobile = window.innerWidth < BREAKPOINT;

    // 👉 폰이거나, 화면이 충분히 좁을 때만 "모바일"로 취급
    return isPhoneUA || widthMobile;
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
