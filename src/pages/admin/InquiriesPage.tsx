// src/pages/admin/InquiriesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InquiriesPage (브랜드명/분단위 날짜 + 상세 드로어에 단지/상품 리스트)
 * - inquiries: 광고문의 본문
 * - inquiry_apartments: (A안) 문의별 단지/상품 목록
 *
 * 스키마(요지)
 *   - inquiries(id uuid pk, created_at timestamptz, brand_name text,
 *               campaign_type text, contact_name text, phone text, email text,
 *               start_at_wish timestamptz, request_note text,
 *               status text, valid boolean,
 *               inquiry_kind text  -- 'SEAT' | 'PACKAGE'
 *   )
 *   - inquiry_apartments(id uuid pk, inquiry_id uuid fk, apt_name text, product_name text)
 */

type InquiryStatus = "new" | "pending" | "in_progress" | "done" | "canceled";
type Validity = "valid" | "invalid";
type InquiryKind = "SEAT" | "PACKAGE";

type InquiryRow = {
  id: string;
  created_at: string;
  status?: InquiryStatus | null;
  valid?: boolean | null;

  // 유입경로
  inquiry_kind?: InquiryKind | null;

  // 광고주 입력/표시 필드
  brand_name?: string | null;
  campaign_type?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  start_at_wish?: string | null;
  request_note?: string | null;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const STATUS_OPTIONS: { value: "all" | InquiryStatus; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "new", label: "신규" },
  { value: "pending", label: "대기" },
  { value: "in_progress", label: "진행중" },
  { value: "done", label: "완료" },
  { value: "canceled", label: "취소" },
];

const VALIDITY_OPTIONS: { value: "all" | Validity; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "valid", label: "유효" },
  { value: "invalid", label: "무효" },
];

const KIND_OPTIONS: { value: "all" | InquiryKind; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "SEAT", label: "구좌(SEAT)" },
  { value: "PACKAGE", label: "패키지(PACKAGE)" },
];

// 실제 컬럼명이 다르면 여기만 고치면 됨.
const TBL = {
  main: "inquiries",
  apartments: "inquiry_apartments",
} as const;

const COL = {
  createdAt: "created_at",
  status: "status",
  valid: "valid",
  kind: "inquiry_kind", // ✅ 유입경로
  brand: "brand_name",
  campaignType: "campaign_type",
  contactName: "contact_name",
  phone: "phone",
  email: "email",
  startWish: "start_at_wish",
  requestNote: "request_note",
} as const;

const APT_COL = {
  inquiryId: "inquiry_id",
  aptName: "apt_name",
  productName: "product_name",
} as const;

const InquiriesPage: React.FC = () => {
  // ====== 필터/검색 상태 ======
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>(
    "all"
  );
  const [validity, setValidity] =
    useState<(typeof VALIDITY_OPTIONS)[number]["value"]>("all");
  const [kind, setKind] =
    useState<(typeof KIND_OPTIONS)[number]["value"]>("all"); // ✅ 유입경로 필터
  const [from, setFrom] = useState<string>(""); // YYYY-MM-DD
  const [to, setTo] = useState<string>(""); // YYYY-MM-DD

  // ====== 페이지네이션 ======
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

  // ====== 데이터 상태 ======
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<InquiryRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    return { fromIdx, toIdx };
  }, [page, pageSize]);

  // ====== 데이터 로딩 ======
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const sb: any = supabase;

        let base = sb
          .from(TBL.main)
          .select("*", { count: "exact" })
          .order(COL.createdAt, { ascending: false });

        // 서버 필터(있는 범위만)
        if (from) base = base.gte(COL.createdAt, `${from}T00:00:00`);
        if (to) base = base.lte(COL.createdAt, `${to}T23:59:59.999`);
        if (kind !== "all") base = base.eq(COL.kind, kind); // ✅ 유입경로 서버 필터

        // 페이지 범위
        const { data, error, count } = await base.range(
          range.fromIdx,
          range.toIdx
        );
        if (error) throw error;

        // 매핑
        const mapped: InquiryRow[] = (data || []).map((d: any) => ({
          id: String(d.id ?? ""),
          created_at: d[COL.createdAt] ?? new Date().toISOString(),
          status: (d[COL.status] as InquiryStatus) ?? null,
          valid: typeof d[COL.valid] === "boolean" ? d[COL.valid] : null,
          inquiry_kind: normalizeKind(d[COL.kind]),
          brand_name: d[COL.brand] ?? null,
          campaign_type: d[COL.campaignType] ?? null,
          contact_name: d[COL.contactName] ?? null,
          phone: d[COL.phone] ?? null,
          email: d[COL.email] ?? null,
          start_at_wish: d[COL.startWish] ?? null,
          request_note: d[COL.requestNote] ?? null,
        }));

        // 클라이언트 필터 (status/validity/query)
        const filtered = mapped.filter((r) => {
          if (status !== "all" && r.status !== status) return false;
          if (validity !== "all") {
            const v = r.valid ? "valid" : "invalid";
            if (v !== validity) return false;
          }
          if (query.trim()) {
            const q = query.trim().toLowerCase();
            const hay = [
              r.brand_name,
              r.campaign_type,
              r.contact_name,
              r.phone,
              r.email,
              r.request_note,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        });

        if (!ignore) {
          setRows(filtered);
          setTotal(typeof count === "number" ? count : filtered.length);
        }
      } catch (e: any) {
        if (!ignore) setError(e?.message ?? "데이터 로딩 실패");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [query, status, validity, kind, from, to, range.fromIdx, range.toIdx]);

  // 페이지 수 계산
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // 페이지 변경 시 스크롤 상단으로
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <header>
        <h2 className="text-xl font-semibold">문의상세 관리</h2>
        <p className="text-sm text-gray-500">
          광고 문의 내역 조회 및 관리 (검색·필터·상세)
        </p>
      </header>

      {/* 필터/검색 */}
      <section className="rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="p-4 md:p-5 grid gap-3 md:grid-cols-[1fr_240px_160px]">
          <div className="flex items-center gap-2">
            <div className="text-gray-400">🔎</div>
            <input
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="브랜드명, 담당자명, 연락처, 이메일, 요청사항…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C2DFF]/40"
            />
          </div>

          <div className="flex gap-2">
            <Select
              value={kind}
              onChange={(v) => {
                setPage(1);
                setKind(v as any);
              }}
              options={KIND_OPTIONS}
            />
            <Select
              value={status}
              onChange={(v) => {
                setPage(1);
                setStatus(v as any);
              }}
              options={STATUS_OPTIONS}
            />
            <Select
              value={validity}
              onChange={(v) => {
                setPage(1);
                setValidity(v as any);
              }}
              options={VALIDITY_OPTIONS}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="w-[50%] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C2DFF]/40"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="w-[50%] rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6C2DFF]/40"
            />
          </div>
        </div>

        <div className="px-4 pb-4 md:px-5 md:pb-5 flex items-center justify-between gap-3 text-sm">
          <div className="text-gray-500">
            총 <b className="text-gray-800">{total}</b>건 / 페이지{" "}
            <b className="text-gray-800">{page}</b> / {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-gray-200 px-2 py-1"
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value) as any);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}개씩
                </option>
              ))}
            </select>

            <div className="flex gap-1">
              <button
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                이전
              </button>
              <button
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                다음
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 에러/로딩 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          로딩 오류: {error}
        </div>
      )}
      {loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="animate-pulse text-gray-500 text-sm">
            데이터를 불러오는 중…
          </div>
        </div>
      )}

      {/* 테이블 */}
      {!loading && (
        <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1030px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <Th>날짜</Th>
                  <Th>유입경로</Th> {/* ✅ 추가 */}
                  <Th>브랜드명</Th>
                  <Th>담당자</Th>
                  <Th>연락처</Th>
                  <Th>이메일</Th>
                  <Th className="text-center">진행상황</Th>
                  <Th className="text-center">유효성</Th>
                  <Th className="text-center">상세</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-gray-500">
                      조건에 해당하는 데이터가 없습니다.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <Td>{formatDateTime(r.created_at)}</Td>
                    <Td>
                      <KindBadge value={r.inquiry_kind ?? null} />
                    </Td>
                    <Td className="max-w-[240px]">
                      <button
                        className="text-left text-gray-900 hover:text-[#6C2DFF] font-medium line-clamp-1"
                        onClick={() => setSelected(r)}
                        title={r.brand_name || undefined}
                      >
                        {r.brand_name || "—"}
                      </button>
                    </Td>
                    <Td>{r.contact_name || "—"}</Td>
                    <Td>{r.phone || "—"}</Td>
                    <Td>{r.email || "—"}</Td>
                    <Td className="text-center">
                      <StatusBadge value={(r.status as any) || "pending"} />
                    </Td>
                    <Td className="text-center">
                      <ValidityBadge value={toValidity(r.valid)} />
                    </Td>
                    <Td className="text-center">
                      <button
                        onClick={() => setSelected(r)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50"
                      >
                        🔍 상세
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 상세 드로어 */}
      {selected && (
        <DetailDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onStatusChange={async (next) => {
            const sb: any = supabase;
            const { error } = await sb
              .from(TBL.main)
              .update({ [COL.status]: next })
              .eq("id", selected.id);
            if (!error) {
              setSelected({ ...selected, status: next });
              setPage((p) => p); // 재조회 트리거
            }
            return !error;
          }}
          onValidityToggle={async () => {
            const sb: any = supabase;
            const nextValid = !(selected.valid ?? false);
            const { error } = await sb
              .from(TBL.main)
              .update({ [COL.valid]: nextValid })
              .eq("id", selected.id);
            if (!error) {
              setSelected({ ...selected, valid: nextValid });
              setPage((p) => p);
            }
            return !error;
          }}
        />
      )}
    </div>
  );
};

export default InquiriesPage;

/* =========================
 *  작은 프레젠테이션 컴포넌트들
 * ========================= */

const Th: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <th
    className={
      "px-4 py-3 text-left font-medium tracking-tight " + (className ?? "")
    }
  >
    {children}
  </th>
);

const Td: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <td className={"px-4 py-3 align-middle " + (className ?? "")}>{children}</td>
);

const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => {
  return (
    <select
