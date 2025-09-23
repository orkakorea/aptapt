import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InquiriesPage
 * - 목록: 상태/유효성/담당자 인라인 수정 (유효성은 —/유효/무효의 tri-state, 기본 —)
 * - 서버사이드 검색/필터/페이지네이션
 * - 상세 드로어: inquiry_apartments → 없으면 cart_snapshot(items) fallback
 * - 드로어 우상단: CSV(엑셀) 내보내기 (메타 + 항목표 전부)
 * - NEW 뱃지: status='new'이며 아직 클릭 안 한 행에만 1회성 표시(브랜드명 좌측, 클릭 시 사라짐)
 *
 * ✅ 컬럼 매핑(확정)
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
type ValidTri = "-" | "valid" | "invalid";

type InquiryRow = {
  id: string;
  created_at: string;
  // 리스트 표시/편집 필드
  company?: string | null;
  campaign_type?: string | null;
  status?: InquiryStatus | null;
  valid?: boolean | null; // null=—(미지정)
  assignee?: string | null;
  inquiry_kind?: InquiryKind | null;
  // 상세 표시 필드
  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  memo?: string | null; // 요청사항
  cart_snapshot?: any;
};

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: "new",         label: "신규" },
  { value: "in_progress", label: "진행중" },
  { value: "done",        label: "완료" },
  { value: "canceled",    label: "취소" },
];

const SOURCE_OPTIONS: { value: "all" | InquiryKind; label: string }[] = [
  { value: "all",     label: "전체" },
  { value: "SEAT",    label: "SEAT" },
  { value: "PACKAGE", label: "PACKAGE" },
];

const VALIDITY_OPTIONS: { value: ValidTri; label: string }[] = [
  { value: "-",       label: "—" },
  { value: "valid",   label: "유효" },
  { value: "invalid", label: "무효" },
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
 *  NEW 배지 1회성 관리 (localStorage)
 * ========================= */
const SEEN_KEY = "inquiries_seen_v1";

function getSeenSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const arr = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function addSeen(id: string) {
  if (typeof window === "undefined") return;
  const set = getSeenSet();
  if (!set.has(id)) {
    set.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set)));
  }
}

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

  // NEW 배지(1회성) 체크용
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSeenIds(getSeenSet());
  }, []);

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
        const sb: any = supabase;

        let q = sb
          .from(TBL.main)
          .select("*", { count: "exact" })
          .order(COL.createdAt, { ascending: false });

        if (status !== "all") q = q.eq(COL.status, status);
        if (sourceType !== "all") q = q.eq(COL.inquiryKind, sourceType);
        if (query.trim()) {
          const k = query.trim();
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
      {/* 상단 문구 제거, 바로 타이틀 */}
      <h2 className="text-2xl font-bold">문의상세 관리</h2>

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
          <button
            onClick={() => setPage(1)}
            className="h-9 px-3 rounded-md border text-sm"
            disabled={loading}
          >
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
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

                  {/* 브랜드명 + NEW 뱃지(1회성) */}
                  <Td>
                    <div className="flex items-center gap-2">
                      {(r.status === "new" && !seenIds.has(r.id)) && (
                        <span className="text-[10px] uppercase font-semibold text-violet-600">
                          new
                        </span>
                      )}
                      <button
                        className="text-left text-gray-900 hover:text-[#6C2DFF] font-medium"
                        onClick={() => {
                          addSeen(r.id);
                          setSeenIds(new Set([...Array.from(seenIds), r.id]));
                          setSelected(r);
                        }}
                      >
                        {r.company || "—"}
                      </button>
                    </div>
                  </Td>

                  <Td>{r.campaign_type || "—"}</Td>

                  {/* 진행상황: 알록달록 pill select */}
                  <Td>
                    <select
                      value={r.status ?? "new"}
                      onChange={async (e) => {
                        const sb: any = supabase;
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
                      className={
                        "border rounded-full px-2 py-1 text-sm " +
                        pillClassForStatus(r.status ?? "new")
                      }
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Td>

                  {/* 유효성: tri-state —/유효/무효 + 알록달록 */}
                  <Td>
                    <select
                      value={validToTri(r.valid)}
                      onChange={async (e) => {
                        const sb: any = supabase;
                        const v = e.target.value as ValidTri;
                        const payload =
                          v === "-" ? { [COL.valid]: null } :
                          v === "valid" ? { [COL.valid]: true } :
                          { [COL.valid]: false };
                        const { error } = await sb
                          .from(TBL.main)
                          .update(payload)
                          .eq(COL.id, r.id);
                        if (!error) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === r.id
                                ? { ...row, valid: v === "-" ? null : v === "valid" }
                                : row
                            )
                          );
                        }
                      }}
                      className={
                        "border rounded-full px-2 py-1 text-sm " +
                        pillClassForValid(validToTri(r.valid))
                      }
                    >
                      {VALIDITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Td>

                  {/* 담당자(영업담당자) 인라인 수정 */}
                  <Td>
                    <input
                      type="text"
                      defaultValue={r.assignee || ""}
                      onBlur={async (e) => {
                        const sb: any = supabase;
                        const val = e.target.value;
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.assignee]: val || null })
                          .eq(COL.id, r.id);
                        if (!error) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === r.id ? { ...row, assignee: val || null } : row
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

  // inquiry_apartments 조회
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

  // cart_snapshot → [단지명/개월/상품명] 세트 (폭넓은 폴백)
  const snapshotSets = useMemo(() => {
    const items = (row as any)?.cart_snapshot?.items;
    if (!Array.isArray(items)) return [];
    return items.map((it: any) => ({
      apt_name: it.apt_name ?? it.name ?? "",
      months: Number(it.months ?? it.Months ?? 0) || null,
      product_name:
        it.product_name ??
        it.productName ??
        it.mediaName ??
        it.media_name ??
        it.media ??
        it.product ??
        it.product_code ??
        "",
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

  // CSV(엑셀) 내보내기: 메타 + 빈줄 + 항목 표
  function exportCSV() {
    const metaPairs: [string, any][] = [
      ["브랜드", row.company ?? ""],
      ["문의일시", formatDateTime(row.created_at)],
      ["유입경로", row.inquiry_kind ?? ""],
      ["캠페인 유형", row.campaign_type ?? ""],
      ["담당자명(광고주)", row.customer_name ?? ""],
      ["연락처", row.phone ?? ""],
      ["이메일주소", row.email ?? ""],
      ["요청사항", row.memo ?? ""],
    ];

    const metaLines = [
      ["항목", "값"].join(","),
      ...metaPairs.map(([k, v]) => [safeCSV(k), safeCSV(v)].join(",")),
    ].join("\n");

    const itemsHeader = ["단지명", "광고기간(개월)", "상품명"].join(",");
    const itemsLines = listToRender.map((r) =>
      [safeCSV(r.apt_name), safeCSV(r.months ?? ""), safeCSV(r.product_name)].join(",")
    ).join("\n");

    const full = metaLines + "\n\n" + itemsHeader + "\n" + itemsLines;

    const blob = new Blob(["\uFEFF" + full], { type: "text/csv;charset=utf-8" });
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
  if (/[,"\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 유효성: boolean|null → tri-state */
function validToTri(v: boolean | null | undefined): ValidTri {
  if (v === true) return "valid";
  if (v === false) return "invalid";
  return "-";
}

/** 상태/유효성 pill 스타일 */
function pillClassForStatus(v: InquiryStatus): string {
  switch (v) {
    case "new":         return "bg-violet-50 text-violet-700";
    case "in_progress": return "bg-blue-50 text-blue-700";
    case "done":        return "bg-emerald-50 text-emerald-700";
    case "canceled":    return "bg-gray-200 text-gray-700";
    default:            return "bg-gray-100 text-gray-600";
  }
}
function pillClassForValid(v: ValidTri): string {
  switch (v) {
    case "valid":   return "bg-emerald-50 text-emerald-700";
    case "invalid": return "bg-rose-50 text-rose-700";
    default:        return "bg-gray-100 text-gray-600";
  }
}
