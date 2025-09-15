// @ts-nocheck
// src/pages/admin/InquiriesPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// --- Helpers ---------------------------------------------------------------
const formatDate = (v?: string | null) => {
  if (!v) return "-";
  try {
    const d = new Date(v);
    return d.toLocaleString();
  } catch {
    return String(v);
  }
};

const STATUS_LABEL: Record<string, string> = {
  new: "신규",
  in_progress: "진행중",
  done: "완료",
};

const normalizeStatus = (v?: string | null) => {
  if (!v) return "new";
  const x = String(v).toLowerCase();
  if (x === "new" || x === "in_progress" || x === "done") return x;
  if (x === "inprogress") return "in_progress"; // legacy safety
  return x;
};

// --- Types (light, runtime driven) ----------------------------------------
export type Inquiry = {
  id: string;
  created_at: string;
  inquiry_kind?: string | null; // SEAT | PACKAGE
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  apt_name?: string | null;
  product_name?: string | null;
  product_code?: string | null;
  campaign_type?: string | null; // 기업/공공/병원/소상공인/대행사
  status?: string | null; // new | in_progress | done | NEW(legacy)
  admin_memo?: string | null;
  assignee?: string | null;
  processed_at?: string | null;
  cart_snapshot?: any;
  extra?: any;
  utm?: any;
  source_page?: string | null;
};

export type AuditLog = {
  id: number;
  inquiry_id: string;
  actor?: string | null;
  action: "status_change" | "assign_change" | "memo_update";
  from_value?: string | null;
  to_value?: string | null;
  created_at: string;
};

// --- Main Page -------------------------------------------------------------
const PAGE_SIZE = 50;

const InquiriesPage: React.FC = () => {
  const [rows, setRows] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [campaignFilter, setCampaignFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const searchRef = useRef<number | null>(null);

  // selection / detail
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [saving, setSaving] = useState(false);

  // pagination (simple client-side for now)
  const [page, setPage] = useState(1);

  const debouncedSetSearch = (v: string) => {
    if (searchRef.current) window.clearTimeout(searchRef.current);
    searchRef.current = window.setTimeout(() => setSearch(v), 300);
  };

  // Fetch list
  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("inquiries")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(500); // enough for admin browsing; can switch to range-based later

      if (statusFilter) q = q.eq("status", statusFilter);
      if (campaignFilter) q = q.eq("campaign_type", campaignFilter);
      if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      if (search.trim()) {
        const s = search.trim().replace(/%/g, "");
        q = q.or(
          `apt_name.ilike.%${s}%,customer_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;

      setRows((data || []) as Inquiry[]);
      setPage(1);
      console.log("[Inquiries] fetched rows:", (data || []).length);
    } catch (e: any) {
      console.error("[Inquiries] fetch error:", e);
      setError(e?.message || "Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, campaignFilter, dateFrom, dateTo, search]);

  const uniqueCampaigns = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.campaign_type) set.add(r.campaign_type); });
    return Array.from(set).sort();
  }, [rows]);

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  // Detail panel actions ----------------------------------------------------
  const openDetail = async (row: Inquiry) => {
    setSelected(row);
    const { data, error } = await supabase
      .from("inquiry_audit_logs")
      .select("*")
      .eq("inquiry_id", row.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setLogs((data || []) as AuditLog[]);
  };

  const closeDetail = () => { setSelected(null); setLogs([]); };

  const updateSelected = async (patch: Partial<Inquiry>) => {
    if (!selected) return;
    setSaving(true);
    try {
      const next = { ...selected, ...patch } as Inquiry;
      const { error } = await supabase.from("inquiries").update(patch).eq("id", selected.id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)));
      setSelected(next);
      const { data: logsData } = await supabase
        .from("inquiry_audit_logs")
        .select("*")
        .eq("inquiry_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (logsData) setLogs(logsData as AuditLog[]);
    } catch (e) {
      console.error("[Inquiries] update error:", e);
      alert(e?.message || "업데이트 실패");
    } finally { setSaving(false); }
  };

  const exportCSV = () => {
    const cols = [
      "id","created_at","inquiry_kind","campaign_type","apt_name","product_name",
      "customer_name","phone","email","status","assignee","processed_at","source_page",
    ];
    const header = cols.join(",");
    const lines = rows.map((r) =>
      cols.map((k) => {
          const v = (r as any)[k];
          const s = v == null ? "" : String(v).replaceAll('"', '""');
          return `"${s}` + `"`;
        }).join(",")
    );
    const csv = "﻿" + [header, ...lines].join("
");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inquiries_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // UI ---------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          데이터 로드 오류: {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">상태</label>
          <select className="h-9 rounded-md border px-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">전체</option>
            <option value="new">신규</option>
            <option value="in_progress">진행중</option>
            <option value="done">완료</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">캠페인 타입</label>
          <select className="h-9 rounded-md border px-2 min-w-[160px]" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)}>
            <option value="">전체</option>
            {uniqueCampaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">시작일</label>
          <input type="date" className="h-9 rounded-md border px-2" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">종료일</label>
          <input type="date" className="h-9 rounded-md border px-2" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        <div className="grow min-w-[220px]">
          <label className="block text-xs text-gray-500 mb-1">검색 (아파트/이름/전화/이메일)</label>
          <input type="text" className="h-9 w-full rounded-md border px-2" placeholder="e.g. 자이, 홍길동, 010-..." onChange={(e) => debouncedSetSearch(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button className="h-9 px-3 rounded-md border text-sm hover:bg-gray-50" onClick={() => {
            setStatusFilter(""); setCampaignFilter(""); setDateFrom(""); setDateTo(""); setSearch("");
          }}>초기화</button>
          <button className="h-9 px-3 rounded-md border text-sm hover:bg-gray-50" onClick={fetchRows}>새로고침</button>
          <button className="h-9 px-3 rounded-md bg-[#6C2DFF] text-white text-sm hover:bg-[#5a1fff]" onClick={exportCSV}>CSV 다운로드</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left w-[170px]">접수일시</th>
              <th className="px-3 py-2 text-left">문의종류</th>
              <th className="px-3 py-2 text-left">캠페인</th>
              <th className="px-3 py-2 text-left">아파트 / 상품</th>
              <th className="px-3 py-2 text-left">신청자</th>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">담당자</th>
              <th className="px-3 py-2 text-right w-[100px]">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-500">로딩 중…</td>
              </tr>
            )}
            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-gray-400">결과가 없습니다.</td>
              </tr>
            )}
            {!loading && paged.map((r) => {
              const st = normalizeStatus(r.status);
              return (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2">{r.inquiry_kind || "-"}</td>
                  <td className="px-3 py-2">{r.campaign_type || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.apt_name || "-"}</div>
                    <div className="text-xs text-gray-500">{r.product_name || "-"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{r.customer_name || "-"}</div>
                    <div className="text-xs text-gray-500">{r.phone || r.email || ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs border " +
                      (st === "done"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : st === "in_progress"
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : "bg-violet-50 text-violet-700 border-violet-200")
                    } title={r.status || ""}>
                      {STATUS_LABEL[st] || st}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.assignee || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="h-8 px-3 rounded-md border text-xs hover:bg-gray-50" onClick={() => openDetail(r)}>상세</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-gray-500">총 {rows.length}건 / 페이지 {page} / {Math.ceil(rows.length / PAGE_SIZE)}</div>
          <div className="flex items-center gap-2">
            <button className="h-8 px-3 rounded-md border text-xs disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>이전</button>
            <button className="h-8 px-3 rounded-md border text-xs disabled:opacity-50" onClick={() => setPage((p) => (p * PAGE_SIZE >= rows.length ? p : p + 1))} disabled={page * PAGE_SIZE >= rows.length}>다음</button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/30" onClick={closeDetail} />
          <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl p-5 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">문의 상세</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={closeDetail}>닫기</button>
            </div>

            {/* Overview */}
            <section className="space-y-1 mb-5">
              <div className="text-sm text-gray-500">ID</div>
              <div className="font-mono text-xs break-all">{selected.id}</div>
              <div className="text-sm text-gray-500">접수일</div>
              <div>{formatDate(selected.created_at)}</div>
            </section>

            <section className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <div className="text-sm text-gray-500">문의종류</div>
                <div className="font-medium">{selected.inquiry_kind || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">캠페인 타입</div>
                <div className="font-medium">{selected.campaign_type || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">아파트</div>
                <div className="font-medium">{selected.apt_name || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">상품</div>
                <div className="font-medium">{selected.product_name || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">신청자</div>
                <div className="font-medium">{selected.customer_name || "-"}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">연락처</div>
                <div className="font-medium">{selected.phone || selected.email || "-"}</div>
              </div>
            </section>

            {/* Admin Controls */}
            <section className="space-y-3 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상태</label>
                  <select className="h-9 w-full rounded-md border px-2" value={normalizeStatus(selected.status)} onChange={(e) => updateSelected({ status: e.target.value })} disabled={saving}>
                    <option value="new">신규</option>
                    <option value="in_progress">진행중</option>
                    <option value="done">완료</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">담당자</label>
                  <input className="h-9 w-full rounded-md border px-2" value={selected.assignee || ""} onChange={(e) => updateSelected({ assignee: e.target.value })} placeholder="name@company.com" disabled={saving} />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">내부 메모 (고객 비공개)</label>
                <textarea className="w-full min-h-[96px] rounded-md border p-2 text-sm" placeholder="상담 내용, 다음 액션 등" value={selected.admin_memo || ""} onChange={(e) => updateSelected({ admin_memo: e.target.value })} disabled={saving} />
              </div>

              <div className="text-xs text-gray-500 mt-1">완료 처리 시점: {formatDate(selected.processed_at)}</div>
            </section>

            {/* JSON blocks */}
            <section className="mb-6">
              <h4 className="font-medium mb-2">원본 카트 / 추가정보</h4>
              <div className="grid grid-cols-1 gap-3">
                <pre className="bg-gray-50 rounded-lg p-3 overflow-auto text-[11px] leading-[1.3]">{JSON.stringify(selected.cart_snapshot, null, 2)}</pre>
                <pre className="bg-gray-50 rounded-lg p-3 overflow-auto text-[11px] leading-[1.3]">{JSON.stringify(selected.extra || selected.utm, null, 2)}</pre>
              </div>
            </section>

            {/* Activity log */}
            <section className="mb-10">
              <h4 className="font-medium mb-2">활동 로그</h4>
              <div className="space-y-2">
                {logs.length === 0 && (<div className="text-sm text-gray-400">기록 없음</div>)}
                {logs.map((l) => (
                  <div key={l.id} className="text-sm">
                    <div className="text-gray-500">{formatDate(l.created_at)}</div>
                    <div>
                      <span className="inline-block min-w-[96px] text-xs mr-2 px-2 py-0.5 rounded-full border bg-gray-50">{l.action}</span>
                      <span className="text-gray-800">{l.from_value} → {l.to_value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default InquiriesPage;

