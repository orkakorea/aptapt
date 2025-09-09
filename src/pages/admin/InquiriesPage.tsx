// src/pages/admin/InquiriesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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

      {/* 탭 */}
      <div className="flex items-center gap-2">
        {(["ALL","SEAT","PACKAGE"] as const).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-9 rounded-md px-3 text-sm border
              ${tab===k ? "border-[#6C2DFF] text-[#6C2DFF] bg-[#F4F0FB]" : "border-[#E5E7EB]"}`}
          >
            {k==="ALL" ? "전체" : k==="SEAT" ? "구좌 문의" : "패키지 문의"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left w-44">시간</th>
              <th className="p-2 text-left w-28">종류</th>
              <th className="p-2 text-left w-32">이름</th>
              <th className="p-2 text-left w-40">연락처</th>
              <th className="p-2 text-left w-40">회사</th>
              <th className="p-2 text-left w-56">이메일</th>
              <th className="p-2 text-left w-32">상태</th>
              <th className="p-2 text-left">경로</th>
              <th className="p-2 text-right w-28">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-4" colSpan={9}>불러오는 중…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td className="p-4" colSpan={9}>데이터가 없습니다.</td></tr>
            ) : (
              filtered.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">{r.inquiry_kind === "SEAT" ? "구좌" : "패키지"}</td>
                  <td className="p-2">{r.customer_name ?? "—"}</td>
                  <td className="p-2">{r.phone ?? "—"}</td>
                  <td className="p-2">{r.company ?? "—"}</td>
                  <td className="p-2">{r.email ?? "—"}</td>
                  <td className="p-2">{r.status ?? "NEW"}</td>
                  <td className="p-2">{r.source_page ?? "—"}</td>
                  <td className="p-2 text-right">
                    <select
                      className="h-8 rounded-md border border-[#E5E7EB] px-2"
                      value={r.status ?? "NEW"}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                    >
                      <option value="NEW">NEW</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="DONE">DONE</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
