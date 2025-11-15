// src/components/routing/MobileRedirectGuard.tsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export default function MobileRedirectGuard() {
  const isMobile = useIsMobile();
  const loc = useLocation();

  // ✅ 처음 진입했을 때의 모드만 한 번 기억 (이후 창 크기 변화와 무관)
  const initialModeRef = React.useRef<"mobile" | "pc" | null>(null);
  if (initialModeRef.current === null) {
    initialModeRef.current = isMobile ? "mobile" : "pc";
  }
  const initialMode = initialModeRef.current;

  // ✅ "모바일로 시작한 경우"에만 /map → /mobile 리다이렉트
  //    (PC로 시작했다가 창을 줄여도 더 이상 /mobile로 튀지 않음)
  if (initialMode === "mobile" && loc.pathname === "/map") {
    return <Navigate to={`/mobile${loc.search || ""}`} replace />;
  }

  return null;
}
