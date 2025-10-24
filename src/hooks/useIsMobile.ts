import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const compute = () => {
    if (typeof window === "undefined") return false;

    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const isBySize = shortSide < MOBILE_BREAKPOINT;

    const coarse = typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)").matches : false;

    const ua = (navigator.userAgent || navigator.vendor || "").toLowerCase();
    const isUA = /android|iphone|ipad|ipod|mobile|samsungbrowser/.test(ua);

    return isBySize || coarse || isUA;
  };

  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return compute();
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(compute());

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update as any);

    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === "function") {
      mql = window.matchMedia("(pointer: coarse)");
      if (mql.addEventListener) mql.addEventListener("change", update);
      else if ((mql as any).addListener) (mql as any).addListener(update);
    }

    update();
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update as any);
      if (mql) {
        if (mql.removeEventListener) mql.removeEventListener("change", update);
        else if ((mql as any).removeListener) (mql as any).removeListener(update);
      }
    };
  }, []);

  return isMobile;
}
