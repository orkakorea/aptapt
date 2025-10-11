import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileLayout from "./MobileLayout";

/**
 * ResponsiveLayoutGate
 * - 화면 크기에 따라 모바일/데스크톱 레이아웃을 자동으로 전환
 * - 모바일: MobileLayout (하단 탭 내비게이션)
 * - 데스크톱: 기본 레이아웃 (최대 너비 제한)
 */
export default function ResponsiveLayoutGate() {
  const isMobile = useIsMobile();

  // 모바일: MobileLayout (Outlet 포함)
  if (isMobile) {
    return <MobileLayout />;
  }

  // 데스크톱: 기본 컨테이너로 감싸기
  return (
    <div className="mx-auto min-h-screen max-w-[1400px] bg-background">
      <Outlet />
    </div>
  );
}
