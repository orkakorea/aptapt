// src/components/layout/NavBar.tsx
import React, { useEffect, useState } from "react";
import LoginModal from "@/components/LoginModal";
import { supabase } from "@/integrations/supabase/client";

const ENABLE_ADMIN = String(import.meta.env.VITE_FEATURE_ADMIN ?? "false") === "true";

export default function NavBar() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  // ✅ UI에서도 JWT 메타데이터 대신 DB 함수로만 관리자 여부 판단
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
      // 세션 변경 시 재확인
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
          <a
            href="/"
            className="text-[16px] leading-[24px] font-semibold tracking-[-0.01em] text-[#0A0A0A]"
            title="홈으로"
          >
            응답하라 입주민이여
          </a>

          {/* 타이틀 바로 옆 로그인 버튼(모달 포함) */}
          <LoginModal />
        </div>

        {/* 오른쪽 공간 */}
        <div className="ml-auto flex items-center gap-2">
          {/* ✅ 관리자 링크: 프로덕션 플래그가 켜져 있고, DB 기준으로 관리자일 때만 노출 */}
          {ENABLE_ADMIN && !checking && isAdmin && (
            <a
              href="/admin"
              className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
              title="관리자 대시보드"
            >
              Admin
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
