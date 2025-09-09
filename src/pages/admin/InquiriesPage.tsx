import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Inquiry = {
  id: string;
  created_at: string;
  inquiry_kind: "SEAT" | "PACKAGE";
  customer_name: string | null;
  phone: string | null;
  company: string | null;
  email: string | null;
  status: string;
  source_page: string | null;
};

export default function InquiriesPage() {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  // 초기 로드 (관리자만 SELECT 허용해둔 RLS에 맞음)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select("id, created_at, inquiry_kind, customer_name, phone, company, email, status, source_page")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!error && data) setRows(data as Inquiry[]);
      setLoading(false);
    })();
  }, []);

  // Realtime 구독: 새 문의 INSERT 시 맨 위에 추가
  useEffect(() => {
    const channel = supabase
      .channel("inquiries-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload: any) => {
          setRows(prev => [payload.new as Inquiry, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiries" },
        (payload: any) => {
          setRows(prev => prev.map(r => (r.id === payload.new.id ? payload.new as Inquiry : r)));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="p-6">불러오는 중…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-bold">문의 접수 (실시간)</div>
      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2">시간</th>
              <th className="p-2">종류</th>
              <th className="p-2">이름</th>
              <th className="p-2">연락처</th>
              <th className="p-2">회사</th>
              <th className="p-2">이메일</th>
              <th className="p-2">상태</th>
              <th className="p-2">경로</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2">{r.inquiry_kind}</td>
                <td className="p-2">{r.customer_name ?? "—"}</td>
                <td className="p-2">{r.phone ?? "—"}</td>
                <td className="p-2">{r.company ?? "—"}</td>
                <td className="p-2">{r.email ?? "—"}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.source_page ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
