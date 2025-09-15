import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * AdminLayout
 * - /admin 하위 라우트의 "부모" 레이아웃
 * - 관리자(role=admin) 가드 + /admin 진입 시 /admin/inquiries로 기본 리다이렉트
 * - 비관리자/비로그인: "/"로 이동 (홈에서 로그인 모달을 띄우는 정책과 궁합)
 */
const AdminLayout: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        // 현재 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        const role = (session?.user as any)?.app_metadata?.role;
        const isAdmin = role === "admin";

        if (!mounted) return;

        if (!isAdmin) {
          // 비관리자/비로그인 → 홈으로 보냄
          nav("/", { replace: true });
          setAllowed(false);
        } else {
          setAllowed(true);
          // /admin 루트로 들어온 경우 → /admin/inquiries 로 기본 이동
          if (loc.pathname === "/admin") {
            nav("/admin/inquiries", { replace: true });
          }
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    check();

    // 세션 변화도 감지 (토큰 갱신/로그아웃 등)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const role = (session?.user as any)?.app_metadata?.role;
      const isAdmin = role === "admin";

      if (!isAdmin) {
        setAllowed(false);
        nav("/", { replace: true });
      } else {
        setAllowed(true);
        if (loc.pathname === "/admin") {
          nav("/admin/inquiries", { replace: true });
        }
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname]);

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Checking admin access…</div>
      </div>
    );
  }

  if (!allowed) {
    // 네비게이션으로 이미 "/"로 나갔을 것. 안전 차원에서 빈 상태 반환.
    return null;
  }

  // 이 아래에 공통 어드민 레이아웃(사이드바/헤더 등)을 추후 추가 가능
  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <div className="mx-auto max-w-[1280px] px-4 py-6">
        {/* 섹션 헤더 예시 */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-gray-500">관리 전용 페이지</p>
        </header>

        {/* 자식 라우트 출력 */}
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
