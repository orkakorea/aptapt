// src/components/layout/NavBar.tsx
import React, { useEffect, useState } from "react";
import LoginModal from "@/components/LoginModal";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const ENABLE_ADMIN = String(import.meta.env.VITE_FEATURE_ADMIN ?? "false") === "true";

export default function NavBar() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  // ✅ DB RPC로만 관리자 여부 판단
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const { data: ok, error } = await supabase.rpc("is_admin");
        if (!mounted) return;
        setIsAdmin(Boolean(ok) && !error);
      } catch {
        if (!mounted) return;
        setIsAdmin(false);
      } finally {
        if (!mounted) return;
        setChecking(false);
      }
    };

    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setChecking(true);
      void check();
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="mx-auto max-w-[960px] h-14 px-6 flex items-center">
        {/* 타이틀 + 로그인 버튼을 '바로 옆'에 배치 */}
        <div className="flex items-center gap-3">
          {/* ⛳️ 해시 라우터에서도 안전하게 이동하려면 a/href 대신 Link/to 사용 */}
          <Link
            to="/"
            className="text-[16px] leading-[24px] font-semibold tracking-[-0.01em] text-[#0A0A0A]"
            title="홈으로"
          >
            응답하라 입주민이여
          </Link>

          {/* 타이틀 바로 옆 로그인 버튼(모달 포함) */}
          <LoginModal />
        </div>

        {/* 오른쪽 영역 */}
        <div className="ml-auto flex items-center gap-2">
          {/* ✅ 플래그 ON && 관리자일 때만 Admin 버튼 보임
              HashRouter일 때 Link가 #/admin 으로 올바르게 이동시킵니다. */}
          {ENABLE_ADMIN && !checking && isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
              title="관리자 대시보드"
            >
              Admin
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
