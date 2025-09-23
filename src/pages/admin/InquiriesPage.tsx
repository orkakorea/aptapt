import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InquiriesPage
 * - 목록: 상태/담당자 인라인 수정 (유효성 칼럼은 '—' 고정 표시)
 * - 서버사이드 필터/검색/페이지네이션 (count 정확)
 * - 상세 드로어: inquiry_apartments → 없으면 cart_snapshot(items) fallback
 * - 드로어 우상단: CSV(엑셀) 내보내기
 *
 * ✅ 컬럼 매핑(사용자 지정 고정)
 *   유입경로: inquiry_kind
 *   브랜드명: company
 *   캠페인유형: campaign_type
 *   담당자명: customer_name
 *   연락처: phone
 *   이메일: email
 *   요청사항: memo
 *   진행상태: status
 *   단지명: apt_name
 *   상품명: product_name
 */

/* =========================
 *  Types & Constants
 * ========================= */
type InquiryKind = "SEAT" | "PACKAGE";
type InquiryStatus = "new" | "in_progress" | "done" | "canceled";

type InquiryRow = {
  id: string;
  created_at: string;
  // 리스트 표시/편집 필드
  company?: string | null;          // 브랜드명
  campaign_type?: string | null;    // 캠페인유형
  status?: InquiryStatus | null;    // 진행상태
  valid?: boolean | null;           // 유효성(표시는 '—'로 고정)
  assignee?: string | null;         // 영업담당자(내부)
  inquiry_kind?: InquiryKind | null;// 유입경로(= 문의유형)
  // 상세 표시 필드
  customer_name?: string | null;    // 담당자명(광고주)
  phone?: string | null;
  email?: string | null;
  memo?: string | null;             // 요청사항
  cart_snapshot?: any;              // 상세 드로어 fallback 용
};

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: "new",         label: "신규" },
  { value: "in_progress", label: "진행중" },
  { value: "done",        label: "완료" },
  { value: "canceled",    label: "취소" },
];

const SOURCE_OPTIONS: { value: "all" | InquiryKind; label: string }[] = [
  { value: "all",    label: "전체" },
  { value: "SEAT",   label: "SEAT" },
  { value: "PACKAGE",label: "PACKAGE" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** 실제 DB 컬럼 키(매핑 상수) */
const COL = {
  id: "id",
  createdAt: "created_at",
  inquiryKind: "inquiry_kind",
  company: "company",
  campaignType: "campaign_type",
  status: "status",
  valid: "valid",
  assignee: "assignee",
  customerName: "customer_name",
  phone: "phone",
  email: "email",
  memo: "memo",
  cartSnapshot: "cart_snapshot",
} as const;

const TBL = {
  main: "inquiries",
  apartments: "inquiry_apartments",
} as const;

const APT_COL = {
  inquiryId: "inquiry_id",
  aptName: "apt_name",
  productName: "product_name",
} as const;

/* =========================
 *  Page
 * ========================= */
const InquiriesPage: React.FC = () => {
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [selected, setSelected] = useState<InquiryRow | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);
  const [total, setTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | InquiryStatus>("all");
  const [sourceType, setSourceType] = useState<"all" | InquiryKind>("all");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { fromIdx, toIdx } = useMemo(() => {
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    return { fromIdx, toIdx };
  }, [page, pageSize]);

  /* -------------------------
   * 서버사이드 로드
   * ------------------------- */
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const sb: any = supabase; // ✅ 타입 캐스팅(프로젝트 타입 미정의 테이블 회피)

        let q = sb
          .from(TBL.main)
          .select("*", { count: "exact" })
          .order(COL.createdAt, { ascending: false });

        // 서버사이드 필터
        if (status !== "all") q = q.eq(COL.status, status);
        if (sourceType !== "all") q = q.eq(COL.inquiryKind, sourceType);
        if (query.trim()) {
          const k = query.trim();
          // company, campaign_type, customer_name 에 대한 부분 검색
          q = q.or(
            `${COL.company}.ilike.%${k}%,${COL.campaignType}.ilike.%${k}%,${COL.customerName}.ilike.%${k}%`
          );
        }

        const { data, error, count } = await q.range(fromIdx, toIdx);
        if (error) throw error;

        const mapped: InquiryRow[] = (data || []).map((d: any) => ({
          id: String(d[COL.id]),
          created_at: d[COL.createdAt],
          company: d[COL.company],
          campaign_type: d[COL.campaignType],
          status: d[COL.status],
          valid: d[COL.valid],
          assignee: d[COL.assignee],
          inquiry_kind: d[COL.inquiryKind],
          customer_name: d[COL.customerName],
          phone: d[COL.phone],
          email: d[COL.email],
          memo: d[COL.memo],
          cart_snapshot: d[COL.cartSnapshot],
        }));

        if (!ignore) {
          setRows(mapped);
          setTotal(typeof count === "number" ? count : mapped.length);
        }
      } catch (e: any) {
        if (!ignore) setErr(e?.message || "데이터 로드 중 오류가 발생했습니다.");
        console.error("[InquiriesPage] load error:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, query, status, sourceType, fromIdx, toIdx]);

  /* -------------------------
   * 렌더
   * ------------------------- */
  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-gray-500">관리 전용 페이지</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(1)}
            className="h-9 px-3 rounded-md border text-sm"
            disabled={loading}
          >
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      </div>

      <h2 className="text-xl font-semibold">문의상세 관리</h2>

      {/* 필터 바 */}
      <div className="rounded-xl border bg-white p-4 flex flex-wrap items-center gap-2">
        <input
          placeholder="브랜드/캠페인/담당자(광고주) 검색"
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          className="h-9 w-64 px-3 rounded-md border text-sm"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as any);
          }}
          className="h-9 px-2 rounded-md border text-sm"
        >
          <option value="all">전체 상태</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={sourceType}
          onChange={(e) => {
            setPage(1);
            setSourceType(e.target.value as any);
          }}
          className="h-9 px-2 rounded-md border text-sm"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-500">페이지당</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPage(1);
              setPageSize(Number(e.target.value) as any);
            }}
            className="h-9 px-2 rounded-md border text-sm"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 오류 */}
      {err && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700 text-sm">
          {err}
        </div>
      )}

      {/* 테이블 */}
      <section className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <Th>날짜</Th>
                <Th className="text-center">유입경로</Th>
                <Th>브랜드명</Th>
                <Th>캠페인 유형</Th>
                <Th>진행상황</Th>
                <Th>유효성</Th>
                <Th>담당자</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <Td>{formatDateTime(r.created_at)}</Td>
                  <Td className="text-center">
                    <SourceBadge value={r.inquiry_kind} />
                  </Td>
                  <Td>
                    <button
                      className="text-left text-gray-900 hover:text-[#6C2DFF] font-medium"
                      onClick={() => setSelected(r)}
                    >
                      {r.company || "—"}
                    </button>
                  </Td>
                  <Td>{r.campaign_type || "—"}</Td>
                  <Td>
                    <select
                      value={r.status ?? "new"}
                      onChange={async (e) => {
                        const sb: any = supabase; // ✅ any 캐스팅
                        const next = e.target.value as InquiryStatus;
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.status]: next })
                          .eq(COL.id, r.id);
                        if (!error) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === r.id ? { ...row, status: next } : row
                            )
                          );
                        }
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Td>

                  {/* 유효성: '—' 고정 표시 (편집 없음) */}
                  <Td>—</Td>

                  {/* 담당자(영업담당자) 인라인 수정 */}
                  <Td>
                    <input
                      type="text"
                      defaultValue={r.assignee || ""}
                      onBlur={async (e) => {
                        const sb: any = supabase; // ✅ any 캐스팅
                        const val = e.target.value;
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.assignee]: val })
                          .eq(COL.id, r.id);
                        if (!error) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === r.id ? { ...row, assignee: val } : row
                            )
                          );
                        }
                      }}
                      className="border rounded px-2 py-1 text-sm w-full"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 하단 페이저 */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
          <div className="text-xs text-gray-500">
            총 {total.toLocaleString()}건 / {page}페이지
          </div>
          <div className="flex gap-2">
            <button
              className="h-8 px-3 rounded-md border text-sm disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={loading || page <= 1}
            >
              이전
            </button>
            <button
              className="h-8 px-3 rounded-md border text-sm disabled:opacity-50"
              onClick={() =>
                setPage((p) =>
                  p * pageSize < Math.max(1, total) ? p + 1 : p
                )
              }
              disabled={loading || page * pageSize >= Math.max(1, total)}
            >
              다음
            </button>
          </div>
        </div>
      </section>

      {/* 상세 드로어 */}
      {selected && (
        <DetailDrawer
          row={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default InquiriesPage;

/* =========================
 *  Detail Drawer
 * ========================= */
const DetailDrawer: React.FC<{
  row: InquiryRow;
  onClose: () => void;
}> = ({ row, onClose }) => {
  const [aptRows, setAptRows] = useState<
    { apt_name: string; product_name: string }[]
  >([]);
  const [aptLoading, setAptLoading] = useState(false);

  // inquiry_apartments 조회 (있으면 우선 사용: months 정보는 없으니 스냅샷에서 매칭 보강)
  useEffect(() => {
    let ignore = false;
    (async () => {
      setAptLoading(true);
      try {
        const sb: any = supabase;
        const { data, error } = await sb
          .from(TBL.apartments)
          .select(`${APT_COL.aptName}, ${APT_COL.productName}`)
          .eq(APT_COL.inquiryId, row.id);

        if (!ignore) {
          setAptRows(error ? [] : ((data as any) ?? []));
        }
      } finally {
        if (!ignore) setAptLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [row.id]);

  // cart_snapshot → [단지명/개월/상품명] 세트
  const snapshotSets = useMemo(() => {
    const items = (row as any)?.cart_snapshot?.items;
    if (!Array.isArray(items)) return [];
    return items.map((it: any) => ({
      apt_name: it.apt_name ?? it.name ?? "",
      months: Number(it.months ?? 0) || null,
      product_name: it.product_name ?? it.mediaName ?? (it.product_code ?? ""),
    }));
  }, [row]);

  // apartments 결과가 있으면 우선 사용하되, months는 snapshot과 이름 매칭해 보강
  const listToRender: { apt_name: string; months: number | null; product_name: string }[] =
    useMemo(() => {
      if (aptRows.length === 0 && snapshotSets.length > 0) return snapshotSets;

      if (aptRows.length > 0) {
        return aptRows.map((ap) => {
          const found = snapshotSets.find(
            (s) =>
              (s.apt_name || "").trim() === (ap.apt_name || "").trim() &&
              (s.product_name || "").trim() === (ap.product_name || "").trim()
          );
          return {
            apt_name: ap.apt_name || "",
            product_name: ap.product_name || "",
            months: found ? found.months : null,
          };
        });
      }
      return [];
    }, [aptRows, snapshotSets]);

  // CSV(엑셀) 내보내기
  function exportCSV() {
    const header = ["단지명", "광고기간(개월)", "상품명"];
    const lines = [
      header.join(","),
      ...listToRender.map((r) =>
        [safeCSV(r.apt_name), safeCSV(r.months ?? ""), safeCSV(r.product_name)].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + lines], { type: "text/csv;charset=utf-8" }); // UTF-8 BOM
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inquiry_${row.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[600px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">브랜드</div>
            <div className="text-lg font-semibold flex items-center gap-2 truncate">
              {row.company || "브랜드명 없음"}
              <SourceBadge value={row.inquiry_kind} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              엑셀로 내보내기
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto h-[calc(100%-56px)]">
          <InfoItem label="문의일시" value={formatDateTime(row.created_at)} />
          <InfoItem label="캠페인 유형" value={row.campaign_type || "—"} />
          <InfoItem label="담당자명(광고주)" value={row.customer_name || "—"} />
          <InfoItem label="연락처" value={row.phone || "—"} />
          <InfoItem label="이메일주소" value={row.email || "—"} />
          <InfoItem label="요청사항" value={row.memo || "—"} />

          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm font-medium mb-2">선택 단지/광고기간/상품</div>

            {aptLoading ? (
              <div className="text-sm text-gray-500">불러오는 중…</div>
            ) : listToRender.length === 0 ? (
              <div className="text-sm text-gray-500">데이터 없음</div>
            ) : (
              <div className="max-h-60 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">단지명</th>
                      <th className="px-3 py-2 text-left">광고기간(개월)</th>
                      <th className="px-3 py-2 text-left">상품명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listToRender.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{it.apt_name || "—"}</td>
                        <td className="px-3 py-2">{it.months ?? "—"}</td>
                        <td className="px-3 py-2">{it.product_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================
 *  Small Components & Utils
 * ========================= */
const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-0.5 text-sm text-gray-800">{value}</div>
  </div>
);

const Th: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <th className={"px-4 py-3 text-left font-medium " + (className ?? "")}>
    {children}
  </th>
);

const Td: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  className,
  children,
}) => (
  <td className={"px-4 py-3 align-middle " + (className ?? "")}>{children}</td>
);

const SourceBadge: React.FC<{ value?: InquiryKind | null }> = ({ value }) => {
  if (!value)
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
        —
      </span>
    );
  return (
    <span
      className={
        "inline-flex items-center px-2 py-0.5 text-xs rounded-full " +
        (value === "SEAT"
          ? "bg-blue-50 text-blue-700"
          : "bg-violet-50 text-violet-700")
      }
    >
      {value}
    </span>
  );
};

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

/** CSV 안전 변환 */
function safeCSV(val: any) {
  const s = String(val ?? "");
  // 쉼표/따옴표/개행 포함 시 따옴표로 래핑 후 내부 따옴표 이스케이프
  if (/[,"\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
