import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * AdminLayout
 * - /admin 하위 라우트의 공통 레이아웃(사이드바 + 메인)
 * - 관리자(role=admin) 가드
 * - /admin 진입 시 기본 경로로 1회 리다이렉트
 *
 * ⚠️ 기본 경로는 당분간 /admin/inquiries 로 유지
 *    (대시보드 페이지가 생기면 '/admin/dashboard' 로 바꾸자)
 */
const DEFAULT_ADMIN_ENTRY = "/admin/dashboard";

type NavItem = { label: string; to: string; emoji?: string; disabled?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "MAIN", to: "/admin/dashboard", emoji: "🏠" },
  { label: "문의상세", to: "/admin/inquiries", emoji: "🗂️" },
  { label: "기간별 통계", to: "/admin/stats", emoji: "📈", disabled: true }, // TODO
  { label: "계약서 확인", to: "/admin/contracts", emoji: "📄", disabled: true }, // TODO
];

const AdminLayout: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null); // null = 미확인
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 현재 경로가 /admin "루트" 인지 판정
  const isAdminRoot = useMemo(() => loc.pathname === "/admin", [loc.pathname]);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const role = (session?.user as any)?.app_metadata?.role;
        const isAdmin = role === "admin";

        if (!mounted) return;

        setAllowed(isAdmin);

        // 최초 진입 시에만 루트 리다이렉트 수행(중복 네비 방지)
        if (isAdmin && isAdminRoot) {
          nav(DEFAULT_ADMIN_ENTRY, { replace: true });
        }
        if (!isAdmin) {
          nav("/", { replace: true });
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    check();

    // 세션 변경 감지(로그인/로그아웃/토큰갱신)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const role = (session?.user as any)?.app_metadata?.role;
      const isAdmin = role === "admin";
      setAllowed(isAdmin);

      if (isAdmin && isAdminRoot) {
        nav(DEFAULT_ADMIN_ENTRY, { replace: true });
      }
      if (!isAdmin) {
        nav("/", { replace: true });
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminRoot]);

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">관리자 권한 확인 중…</div>
      </div>
    );
  }

  if (!allowed) {
    return <NoAccess />;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <div className="mx-auto max-w-[1280px] px-4 py-6">
        <div className="grid grid-cols-[240px_1fr] gap-6">
          {/* === Sidebar === */}
          <aside className="rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="px-4 py-4 border-b border-gray-100">
              <div className="text-sm text-gray-500">관리자 대시보드</div>
              <div className="mt-1 font-semibold">광고 문의 관리 시스템</div>
            </div>

            <nav className="p-2">
              {NAV_ITEMS.map((item) =>
                item.disabled ? (
                  <div
                    key={item.to}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-400 rounded-lg cursor-not-allowed"
                    title="준비 중입니다"
                  >
                    <span className="w-5 text-center">{item.emoji}</span>
                    <span>{item.label}</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-400">
                      soon
                    </span>
                  </div>
                ) : (
                  <SidebarLink key={item.to} to={item.to} emoji={item.emoji}>
                    {item.label}
                  </SidebarLink>
                )
              )}
            </nav>

            <div className="mt-2 px-2 pb-3">
              <button
                onClick={() => setSidebarOpen((v) => !v)}
                className="w-full text-xs text-gray-500 border border-gray-200 rounded-lg py-2 hover:bg-gray-50"
                title="사이드바 접기/펼치기"
              >
                {sidebarOpen ? "사이드바 접기" : "사이드바 펼치기"}
              </button>
            </div>
          </aside>

          {/* === Main === */}
          <main className="min-w-0">
            {/* 상단 헤더(간단 버전). 각 페이지가 자체 헤더를 가질 수 있으니 과도하게 중복하지 않음 */}
            <header className="mb-6">
              <h1 className="text-2xl font-bold">Admin</h1>
              <p className="text-sm text-gray-500">관리 전용 페이지</p>
            </header>

            <div className="rounded-2xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const SidebarLink: React.FC<
  React.PropsWithChildren<{ to: string; emoji?: string }>
> = ({ to, emoji, children }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg",
          isActive
            ? "bg-[#F4F0FB] text-[#6C2DFF] font-medium"
            : "text-gray-700 hover:bg-gray-50",
        ].join(" ")
      }
    >
      <span className="w-5 text-center">{emoji}</span>
      <span className="truncate">{children}</span>
    </NavLink>
  );
};

const NoAccess: React.FC = () => {
  const nav = useNavigate();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="text-xl font-semibold">접근 권한이 없습니다</div>
      <p className="text-gray-500 text-sm">
        관리자 계정으로 로그인 후 다시 시도해 주세요.
      </p>
      <button
        onClick={() => nav("/", { replace: true })}
        className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-sm"
      >
        홈으로 이동
      </button>
    </div>
  );
};

export default AdminLayout;

