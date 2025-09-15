import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LoginModal from "@/components/LoginModal";

/**
 * LoginModal
 * - 화면 우상단 등에 "로그인" 버튼이 생기고, 클릭 시 중앙 모달 오픈
 * - 이메일/패스워드로 Supabase 로그인
 * - 성공 시:
 *   1) app_metadata.role === 'admin' -> /admin 으로 이동
 *   2) app_metadata.plan === 'pro' (또는 user_metadata.plan === 'pro') -> 유료회원 플래그 저장 및 토스트
 *   3) 그 외 -> 일반 로그인
 *
 * 사용법:
 *   <LoginModal />
 * 를 레이아웃/헤더에 넣어두면 /, /map 어디서든 동일하게 노출됨.
 */

type Plan = "free" | "pro";

const overlayRootId = "modal-root";

function ensureOverlayRoot() {
  let root = document.getElementById(overlayRootId);
  if (!root) {
    root = document.createElement("div");
    root.id = overlayRootId;
    document.body.appendChild(root);
  }
  return root;
}

const LoginModal: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 현재 로그인 상태를 UI 상단에서 쉽게 표시하고 싶을 때 사용
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [isAdmin, setIsAdmin] = useState(false);

  // 세션 변화를 감지해서 헤더 뱃지 갱신
  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        const user = session.user as any;
        const appMeta = (user?.app_metadata ?? {}) as Record<string, any>;
        const userMeta = (user?.user_metadata ?? {}) as Record<string, any>;
        const is_adm = appMeta?.role === "admin";
        const planVal =
          (appMeta?.plan as Plan) || (userMeta?.plan as Plan) || "free";
        setDisplayName(user.email ?? "로그인됨");
        setPlan((planVal === "pro" ? "pro" : "free") as Plan);
        setIsAdmin(!!is_adm);
      } else {
        setDisplayName(null);
        setPlan("free");
        setIsAdmin(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (session?.user) {
        const user = session.user as any;
        const appMeta = (user?.app_metadata ?? {}) as Record<string, any>;
        const userMeta = (user?.user_metadata ?? {}) as Record<string, any>;
        const is_adm = appMeta?.role === "admin";
        const planVal =
          (appMeta?.plan as Plan) || (userMeta?.plan as Plan) || "free";
        setDisplayName(user.email ?? "로그인됨");
        setPlan((planVal === "pro" ? "pro" : "free") as Plan);
        setIsAdmin(!!is_adm);
      } else {
        setDisplayName(null);
        setPlan("free");
        setIsAdmin(false);
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pw,
      });
      if (error) throw error;

      const user = data.user as any;
      const appMeta = (user?.app_metadata ?? {}) as Record<string, any>;
      const userMeta = (user?.user_metadata ?? {}) as Record<string, any>;
      const role = appMeta?.role;
      const planVal =
        (appMeta?.plan as Plan) || (userMeta?.plan as Plan) || "free";

      // 유료회원 상태를 프론트에서 기억 (간단히 localStorage + 커스텀 이벤트)
      const isPro = planVal === "pro";
      localStorage.setItem("orca.plan", isPro ? "pro" : "free");
      window.dispatchEvent(
        new CustomEvent("orca:plan", { detail: { plan: isPro ? "pro" : "free" } })
      );

      // 관리자면 /admin 으로 직행
      if (role === "admin") {
        navigate("/admin");
      } else {
        // 현재 페이지가 / 또는 /map 이면 그대로 두고, 필요 시 토스트
        // 원하면 성공 후 모달 닫기
        setOpen(false);
      }
    } catch (e: any) {
      setErr(e?.message ?? "로그인에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setErr(null);
    await supabase.auth.signOut();
    localStorage.setItem("orca.plan", "free");
    window.dispatchEvent(new CustomEvent("orca:plan", { detail: { plan: "free" } }));
    // 관리자 페이지에서 로그아웃하면 홈으로 돌려보냄
    if (location.pathname.startsWith("/admin")) {
      navigate("/");
    }
  };

  // 유저 상태 라벨
  const badge = useMemo(() => {
    if (isAdmin) return "관리자";
    if (plan === "pro") return "유료회원";
    return "게스트";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, plan, displayName]);

  // 모달 루트 보장
  ensureOverlayRoot();

  return (
    <>
      {/* 우상단 로그인/프로필 버튼 (원하는 위치에 배치되는 버튼) */}
      <div className="flex items-center gap-2">
        {displayName ? (
          <>
            <span
              className="hidden sm:inline-block px-2 py-1 text-xs rounded-full bg-[#F4F0FB] text-[#6C2DFF] border border-[#E3D8FF]"
              title={displayName}
            >
              {badge}
            </span>
            <button
              className="h-9 px-3 rounded-md border border-[#6C2DFF] text-sm text-[#6C2DFF] hover:bg-[#F4F0FB]"
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </>
        ) : (
          <button
            className="h-9 px-3 rounded-md border border-[#6C2DFF] text-sm text-[#6C2DFF] hover:bg-[#F4F0FB]"
            onClick={() => setOpen(true)}
          >
            로그인
          </button>
        )}
      </div>

      {/* 포털 모달 */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center"
            aria-modal="true"
            role="dialog"
          >
            {/* Dim */}
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            {/* Panel */}
            <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white shadow-xl p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold">로그인</h2>
                <p className="text-sm text-gray-500 mt-1">
                  이메일과 비밀번호로 로그인하세요.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">이메일</label>
                  <input
                    type="email"
                    required
                    className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#6C2DFF]"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">비밀번호</label>
                  <input
                    type="password"
                    required
                    className="w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#6C2DFF]"
                    placeholder="••••••••"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                  />
                </div>

                {err && (
                  <div className="text-sm text-red-600">
                    {err}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    className="h-9 px-3 rounded-md border text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-md bg-[#6C2DFF] text-white text-sm hover:bg-[#5a1fff]"
                    disabled={loading}
                  >
                    {loading ? "로그인 중..." : "로그인"}
                  </button>
                </div>
              </form>

              <div className="mt-4 text-xs text-gray-500">
                <p>• 관리자 로그인: 로그인 즉시 관리자 페이지로 이동해요.</p>
                <p>• 유료회원 로그인: 프론트에서 추가 기능이 활성화돼요.</p>
              </div>
            </div>
          </div>,
          document.getElementById(overlayRootId)!
        )}
    </>
  );
};

export default LoginModal;
