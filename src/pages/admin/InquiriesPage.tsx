// src/pages/admin/InquiriesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js"; // ✅ 추가



type InquiryKind = "SEAT" | "PACKAGE";
type Inquiry = {
  id: string;
  created_at: string;
  inquiry_kind: InquiryKind;
  customer_name: string | null;
  phone: string | null;
  company: string | null;
  email: string | null;
  status: string | null;        // NEW / IN_PROGRESS / DONE 등
  source_page: string | null;
};

export default function InquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"ALL" | InquiryKind>("ALL");
// ✅ 관리자 로그인 상태 보관
const [session, setSession] = useState<Session | null>(null);

// ✅ 매직링크로 돌아왔을 때 코드 교환 + 세션 구독
useEffect(() => {
  // 해시에 code/access_token 들어오면 세션으로 교환 (실패해도 무시)
  // @ts-expect-error 타입경고 무시 가능 (문자열 전달 허용)
  supabase.auth.exchangeCodeForSession(window.location.hash).catch(() => {});
  // 현재 세션 불러오기 + 변경 구독
  supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
  const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
  return () => sub.subscription.unsubscribe();
}, []);

  // 필터링된 목록
  const filtered = useMemo(
    () => (tab === "ALL" ? rows : rows.filter(r => r.inquiry_kind === tab)),
    [rows, tab]
  );

  // 초기 로드
  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("inquiries")
        .select("id,created_at,inquiry_kind,customer_name,phone,company,email,status,source_page")
        .order("created_at", { ascending: false })
        .limit(200);

      if (tab !== "ALL") q = q.eq("inquiry_kind", tab);

      const { data, error } = await q;
      if (error) {
        console.error(error);
      } else {
        setRows((data || []) as Inquiry[]);
      }
      setLoading(false);
    })();
  }, [tab]);

  // Realtime (INSERT/UPDATE)
  useEffect(() => {
    const ch = supabase
      .channel("inquiries-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload: any) => {
          const row = payload.new as Inquiry;
          setRows(prev => [row, ...prev]); // 전체 상태 기준으로 추가 (탭 필터는 위에서 적용)
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiries" },
        (payload: any) => {
          const row = payload.new as Inquiry;
          setRows(prev => prev.map(r => (r.id === row.id ? row : r)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("inquiries").update({ status }).eq("id", id);
    if (error) console.error(error);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-bold">문의 접수 (실시간)</div>

<div className="flex items-center justify-between">
  <div className="text-xl font-bold">문의 접수 (실시간)</div>
  <div className="flex items-center gap-2">
    {session ? (
      <button
        className="h-8 px-3 border rounded-md"
        onClick={async () => { await supabase.auth.signOut(); location.reload(); }}
      >
        로그아웃
      </button>
    ) : (
      <button
        className="h-8 px-3 border rounded-md"
        onClick={async () => {
          const email = prompt("관리자 이메일을 입력하세요");
          if (!email) return;
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: window.location.origin + "/admin/inquiries" },
          });
          if (error) alert(error.message);
          else alert("메일의 매직링크로 로그인하세요.");
        }}
      >
        관리자 로그인(메일 링크)
      </button>
    )}
  </div>
</div>
