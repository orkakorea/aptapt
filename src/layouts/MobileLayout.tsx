import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Map as MapIcon, Package, Heart, User, Search } from "lucide-react";

/**
 * MobileLayout
 * - 상단 헤더 + 스크롤 본문 + 하단 탭 내비게이션
 * - iOS safe-area 대응, 100dvh로 모바일 주소창 변동에도 안정적 높이
 *
 * 사용: 라우터에서 <Route element={<MobileLayout/>}>로 감싸면
 *       자식 라우트가 <Outlet/> 위치에 렌더링됩니다.
 */

type MobileLayoutProps = {
  title?: string;
  showHeader?: boolean;
  showBottomNav?: boolean;
  rightAction?: React.ReactNode; // 예: <button>알림</button>
};

export default function MobileLayout({
  title = "ORKA",
  showHeader = true,
  showBottomNav = true,
  rightAction,
}: MobileLayoutProps) {
  const location = useLocation();

  return (
    <div className="mx-auto flex h-[100dvh] max-w-[800px] flex-col bg-white text-gray-900">
      {showHeader && <MobileHeader title={title} rightAction={rightAction} />}

      {/* 본문: 하단 탭바 높이 + 안전영역만큼 패딩을 둬서 가려지지 않게 */}
      <main className="flex-1 overflow-y-auto overscroll-contain pb-[calc(56px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      {showBottomNav && <BottomNav currentPath={location.pathname} />}
    </div>
  );
}

/* -------------------------------------------------------
 * Header
 * ----------------------------------------------------- */
function MobileHeader({ title, rightAction }: { title: string; rightAction?: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-gray-100 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      {/* iOS notch 대응 */}
      <div className="h-[env(safe-area-inset-top)]" />
      <div className="flex h-14 items-center justify-between px-4">
        {/* 좌측: 타이틀(탭 홈으로 이동) */}
        <button
          type="button"
          onClick={() => navigate("/")}
          className="shrink-0 select-none rounded-xl px-2 py-1 text-base font-semibold tracking-tight"
        >
          {title}
        </button>

        {/* 중앙: 검색 트리거(추후 /search 라우트 연결) */}
        <button
          type="button"
          onClick={() => navigate("/search")}
          className="flex min-w-0 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-500"
        >
          <Search className="h-4 w-4" />
          <span className="truncate">단지·주소·상품 검색</span>
        </button>

        {/* 우측: 커스텀 액션 슬롯(없으면 공간만 확보) */}
        <div className="shrink-0 pl-2">{rightAction ?? <div className="w-6" />}</div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------
 * Bottom Navigation
 * ----------------------------------------------------- */
const tabs: Array<{
  path: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  matchStart?: boolean; // 상세 경로 포함 활성화 여부
}> = [
  { path: "/", label: "홈", icon: Home, matchStart: false },
  { path: "/map", label: "지도", icon: MapIcon, matchStart: true },
  { path: "/packages", label: "패키지", icon: Package, matchStart: true },
  { path: "/saved", label: "담기", icon: Heart, matchStart: true },
  { path: "/account", label: "내정보", icon: User, matchStart: true },
];

function BottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav
      className="sticky bottom-0 z-30 w-full border-t border-gray-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75"
      role="navigation"
      aria-label="하단 탭"
    >
      <div className="h-[env(safe-area-inset-bottom)]" />
      <ul className="grid h-14 grid-cols-5">
        {tabs.map((t) => {
          const isActive = t.matchStart
            ? currentPath === t.path || currentPath.startsWith(`${t.path}/`)
            : currentPath === t.path;

          const Icon = t.icon;
          return (
            <li key={t.path} className="contents">
              <NavLink
                to={t.path}
                className="flex flex-col items-center justify-center gap-1 text-xs"
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`h-6 w-6 ${isActive ? "opacity-100" : "opacity-60"}`} />
                <span
                  className={`leading-none ${isActive ? "font-semibold" : "font-medium text-gray-500"} text-[11px]`}
                >
                  {t.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
