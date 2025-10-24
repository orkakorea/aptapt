// src/components/routing/MobileRedirectGuard.tsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

export default function MobileRedirectGuard() {
  const isMobile = useIsMobile();
  const loc = useLocation();

  // 모바일에서 PC 전용 경로로 들어오면 → /mobile로 강제 이동 (쿼리 그대로 유지)
  if (isMobile && loc.pathname === "/map") {
    return <Navigate to={`/mobile${loc.search || ""}`} replace />;
  }

  return null;
}
