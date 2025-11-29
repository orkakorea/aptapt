// src/components/LoginModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * LoginModal
 * - 이메일/패스워드 로그인 모달
 * - ✅ 관리자 분기: JWT 메타데이터(role) 사용 금지, DB RPC(is_admin) 결과만 사용
 * - 유료 플랜(plan)은 메타데이터 참고(표시/UX용), 권한 통제와 무관
 * - ✅ 구독회원 여부: DB RPC(is_subscriber) 결과 사용
 */

type Plan = "free" | "pro";

const ENABLE_ADMIN = String(import.meta.env.VITE_FEATURE_ADMIN ?? "false") === "true";
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

  // 헤더 표시용 상태
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);

  // 세션 변화 감지 → 표시 정보/관리자 여부/구독 여부 동기화
  useEffect(() => {
    let mounted = true;

    const syncFromSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        const user = session.user as any;
        const appMeta = (user?.app_metadata ?? {}) as Record<string, any>;
        const userMeta = (user?.user_metadata ?? {}) as Record<string, any>;

        const planVal = (appMeta?.plan as Plan) || (userMeta?.plan as Plan) || "free";
        setDisplayName(user.email ?? "로그인됨");
        setPlan(planVal === "pro" ? "pro" : "free");

        // ✅ 관리자 여부는 DB 기준
        try {
          const { data: ok, error } = await (supabase as any).rpc("is_admin");
          if (!mounted) return;
          const nextAdmin = Boolean(ok) && !error;
          setIsAdmin(nextAdmin);
        } catch {
          if (!mounted) return;
          setIsAdmin(false);
        }

        // ✅ 구독회원 여부는 DB 기준
        try {
          const { data: subOk, error: subErr } = await (supabase as any).rpc("is_subscriber");
          if (!mounted) return;
          const nextSub = Boolean(subOk) && !subErr;
          setIsSubscriber(nextSub);
          try {
            localStorage.setItem("orca.subscriber", nextSub ? "true" : "false");
            window.dispatchEvent(new CustomEvent("orca:subscriber", { detail: { isSubscriber: nextSub } }));
          } catch {
            // localStorage / 이벤트 실패는 무시
          }
        } catch {
          if (!mounted) return;
          setIsSubscriber(false);
          try {
            localStorage.setItem("orca.subscriber", "false");
            window.dispatchEvent(new CustomEvent("orca:subscriber", { detail: { isSubscriber: false } }));
          } catch {
            // 무시
          }
        }
      } else {
        setDisplayName(null);
        setPlan("free");
        setIsAdmin(false);
        setIsSubscriber(false);
        try {
          localStorage.setItem("orca.subscriber", "false");
          window.dispatchEvent(new CustomEvent("orca:subscriber", { detail: { isSubscriber: false } }));
        } catch {
          // 무시
        }
      }
    };

    void syncFromSession();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void syncFromSession();
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

      // UX용 플랜 로컬 저장
      const user = data.user as any;
      const appMeta = (user?.app_metadata ?? {}) as Record<string, any>;
      const userMeta = (user?.user_metadata ?? {}) as Record<string, any>;
      const planVal: Plan = ((appMeta?.plan as Plan) || (userMeta?.plan as Plan) || "free") as Plan;
      const isPro = planVal === "pro";
      localStorage.setItem("orca.plan", isPro ? "pro" : "free");
      window.dispatchEvent(new CustomEvent("orca:plan", { detail: { plan: isPro ? "pro" : "free" } }));

      // ✅ 권한 분기: DB RPC 기반 (관리자)
      let admin = false;
      try {
        const { data: ok } = await (supabase as any).rpc("is_admin");
        admin = ok === true;
      } catch {
        admin = false;
      }
      setIsAdmin(admin);

      // ✅ 구독회원 여부: DB RPC 기반
      let subscriber = false;
      try {
        const { data: subOk } = await (supabase as any).rpc("is_subscriber");
        subscriber = subOk === true;
      } catch {
        subscriber = false;
      }
      setIsSubscriber(subscriber);
      try {
        localStorage.setItem("orca.subscriber", subscriber ? "true" : "false");
        window.dispatchEvent(new CustomEvent("orca:subscriber", { detail: { isSubscriber: subscriber } }));
      } catch {
        // 무시
      }

      setOpen(false); // 성공 시 모달 닫기

      if (admin && ENABLE_ADMIN) {
        navigate("/admin");
      } else {
        // /, /map 등은 그대로; 필요시 리다이렉트 없음
      }
    } catch (e: any) {
      setErr(e?.message ?? "로그인에 실패했어요.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setErr(null);
    try {
      const { error } = await supabase.auth.signOut(); // global
      if (error) {
        await supabase.auth.signOut({ scope: "local" }); // 폴백
      }
    } catch {
      try {
        const key = Object.keys(localStorage).find(
          (k) => k.includes("auth-token") && k.includes("qislrfbqilfqzkvkuknn"),
        );
        if (key) localStorage.removeItem(key);
      } catch {
        // 무시
      }
    } finally {
      setDisplayName(null);
      setPlan("free");
      setIsAdmin(false);
      setIsSubscriber(false);
      localStorage.setItem("orca.plan", "free");
      window.dispatchEvent(new CustomEvent("orca:plan", { detail: { plan: "free" } }));
      try {
        localStorage.setItem("orca.subscriber", "false");
        window.dispatchEvent(new CustomEvent("orca:subscriber", { detail: { isSubscriber: false } }));
      } catch {
        // 무시
      }
      if (location.pathname.startsWith("/admin")) {
        navigate("/");
      }
    }
  };

  const badge = useMemo(() => {
    if (isAdmin) return "관리자";
    if (isSubscriber) return "구독회원";
    if (plan === "pro") return "유료회원";
    return "게스트";
  }, [isAdmin, isSubscriber, plan]);

  ensureOverlayRoot();

  return (
    <>
      {/* 우상단 로그인/프로필 버튼 */}
      <div className="flex items-center gap-2 justify-end ml-auto">
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
          <div className="fixed inset-0 z-[1000] flex items-center justify-center" aria-modal="true" role="dialog">
            {/* Dim */}
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            {/* Panel */}
            <div className="relative z-10 w-full max-w-[420px] rounded-2xl bg-white shadow-xl p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold">로그인</h2>
                <p className="text-sm text-gray-500 mt-1">이메일과 비밀번호로 로그인하세요.</p>
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

                {err && <div className="text-sm text-red-600">{err}</div>}

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
                <p>• 관리자 로그인: 권한 확인 후 관리자 페이지로 이동해요.</p>
                <p>• 유료회원/구독회원 로그인: 프론트에서 추가 기능이 활성화돼요.</p>
              </div>
            </div>
          </div>,
          document.getElementById(overlayRootId)!,
        )}
    </>
  );
};

export default LoginModal;
