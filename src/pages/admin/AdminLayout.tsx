// src/pages/admin/AdminLayout.tsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * AdminLayout
 * - /admin 하위 공통 레이아웃(사이드바 + 메인)
 * - ✅ 관리자 가드: DB RPC(is_admin) 결과가 true일 때만 children 렌더
 * - 초기 진입이 /admin 루트면 기본 경로로 리다이렉트
 *
 * 중요:
 *  - 가드가 끝나기 전까지 Outlet을 렌더하지 않아야
 *    anon 토큰으로 SELECT가 먼저 나가 401/403이 나는 문제를 막을 수 있음.
 *  - 화면 표시 가드(app_metadata.role)는 제거하고, DB를 단일 진실원장으로 사용
 */
const DEFAULT_ADMIN_ENTRY = "/admin/dashboard";

type NavItem = { label: string; to: string; emoji?: string; disabled?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "MAIN", to: "/admin/dashboard", emoji: "🏠" },
  { label: "문의상세", to: "/admin/inquiries", emoji: "🗂️" },
  { label: "기간별 통계", to: "/admin/stats", emoji: "📈", disabled: true },
  { label: "계약서 확인", to: "/admin/contracts", emoji: "📄", disabled: true },
];

const AdminLayout: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();

  // 가드 상태
  const [checking, setChecking] = useState(true); // 세션/권한 확인 중
  const [allowed, setAllowed] = useState(false); // 관리자 통과 여부

  const [sidebarOpen, setSidebarOpen] = useState(true);

  // 현재 경로가 /admin 루트인지
  const isAdminRoot = useMemo(() => loc.pathname === "/admin", [loc.pathname]);

  // ----- 관리자 가드 -----
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setChecking(true);

        // 1) 세션 확보
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr) {
          // 세션 조회 오류 시 안전 기본값(미허용)
          if (mounted) {
            setAllowed(false);
            nav("/", { replace: true });
          }
          return;
        }

        // 미로그인 → 접근 불가
        if (!session) {
          if (mounted) {
            setAllowed(false);
            nav("/", { replace: true });
          }
          return;
        }

        // 2) DB 기반 역할 확인 (SSOT: user_roles → SECURITY DEFINER 함수 is_admin())
        const { data: isAdminRpc, error: rpcError } = await (supabase as any).rpc("is_admin");

        // RPC 오류 혹은 false/null → 비허용
        const isAdmin = isAdminRpc === true && !rpcError;

        if (mounted) {
          setAllowed(isAdmin);

          // 관리자가 아니면 홈으로
          if (!isAdmin) {
            nav("/", { replace: true });
            return;
          }

          // 관리자이면서 /admin 루트로 들어오면 기본 페이지로 1회 리다이렉트
          if (isAdmin && isAdminRoot) {
            nav(DEFAULT_ADMIN_ENTRY, { replace: true });
          }
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    // 최초 실행
    void run();

    // 세션 변경(로그인/로그아웃/토큰 갱신) 시 재검사
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // 상태 변화 시마다 DB 기준으로 재평가
      void run();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminRoot]);

  // ----- 가드 화면 -----
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

  // ----- 레이아웃 -----
  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <div className="mx-auto max-w-[1280px] px-4 py-6">
        <div className="grid grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
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
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-400">soon</span>
                  </div>
                ) : (
                  <SidebarLink key={item.to} to={item.to} emoji={item.emoji}>
                    {item.label}
                  </SidebarLink>
                ),
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

          {/* Main */}
          <main className="min-w-0">
            <header className="mb-6">
              <h1 className="text-2xl font-bold">Admin</h1>
              <p className="text-sm text-gray-500">관리 전용 페이지</p>
            </header>

            <div className="rounded-2xl">
              {/* ✅ 가드 통과 후에만 Outlet 렌더 */}
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

const SidebarLink: React.FC<React.PropsWithChildren<{ to: string; emoji?: string }>> = ({ to, emoji, children }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg",
          isActive ? "bg-[#F4F0FB] text-[#6C2DFF] font-medium" : "text-gray-700 hover:bg-gray-50",
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
      <p className="text-gray-500 text-sm">관리자 계정으로 로그인 후 다시 시도해 주세요.</p>
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
