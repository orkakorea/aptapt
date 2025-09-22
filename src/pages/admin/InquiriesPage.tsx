import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InquiriesPage (서버사이드 필터 + 상세 드로어 단지/상품 세트)
 * - 목록: 상태/유효성/담당자 인라인 수정
 * - 서버사이드 필터/검색/페이지네이션 (count 정확)
 * - 상세 드로어: inquiry_apartments → 없으면 cart_snapshot.fallback 사용
 */

/* =========================
 *  Types & Constants
 * ========================= */
type SourceType = "SEAT" | "PACKAGE";
type InquiryStatus = "new" | "pending" | "assigned" | "contract";
type Validity = "valid" | "invalid";

type InquiryRow = {
  id: string;
  created_at: string;
  brand_name?: string | null;
  campaign_type?: string | null;
  status?: InquiryStatus | null;
  valid?: boolean | null;
  manager_name?: string | null;
  source_type?: SourceType | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  start_at_wish?: string | null;
  request_note?: string | null;
  cart_snapshot?: any; // 상세 드로어 fallback 용
};

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: "new", label: "신규" },
  { value: "pending", label: "대기" },
  { value: "assigned", label: "배정" },
  { value: "contract", label: "계약" },
];

const VALIDITY_OPTIONS: { value: Validity; label: string }[] = [
  { value: "valid", label: "유효" },
  { value: "invalid", label: "무효" },
];

const SOURCE_OPTIONS: { value: "all" | SourceType; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "SEAT", label: "SEAT" },
  { value: "PACKAGE", label: "PACKAGE" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const COL = {
  createdAt: "created_at",
  brand: "brand_name",
  campaignType: "campaign_type",
  status: "status",
  valid: "valid",
  manager: "manager_name",
  sourceType: "source_type",
  contactName: "contact_name",
  phone: "phone",
  email: "email",
  startWish: "start_at_wish",
  requestNote: "request_note",
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
  const [validity, setValidity] = useState<"all" | Validity>("all");
  const [sourceType, setSourceType] = useState<"all" | SourceType>("all");

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
        const sb: any = supabase;

        let q = sb
          .from(TBL.main)
          .select("*", { count: "exact" })
          .order(COL.createdAt, { ascending: false });

        // 서버사이드 필터
        if (status !== "all") q = q.eq(COL.status, status);
        if (validity !== "all") q = q.eq(COL.valid, validity === "valid");
        if (sourceType !== "all") q = q.eq(COL.sourceType, sourceType);
        if (query.trim()) {
          const k = query.trim();
          // brand_name, campaign_type, manager_name 에 대한 부분 검색
          q = q.or(
            `${COL.brand}.ilike.%${k}%,${COL.campaignType}.ilike.%${k}%,${COL.manager}.ilike.%${k}%`
          );
        }

        const { data, error, count } = await q.range(fromIdx, toIdx);
        if (error) throw error;

        const mapped: InquiryRow[] = (data || []).map((d: any) => ({
          id: String(d.id),
          created_at: d[COL.createdAt],
          brand_name: d[COL.brand],
          campaign_type: d[COL.campaignType],
          status: d[COL.status],
          valid: d[COL.valid],
          manager_name: d[COL.manager],
          source_type: d[COL.sourceType],
          contact_name: d[COL.contactName],
          phone: d[COL.phone],
          email: d[COL.email],
          start_at_wish: d[COL.startWish],
          request_note: d[COL.requestNote],
          cart_snapshot: d.cart_snapshot,
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
  }, [page, pageSize, query, status, validity, sourceType, fromIdx, toIdx]);

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
          placeholder="브랜드/캠페인/담당자 검색"
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
          value={validity}
          onChange={(e) => {
            setPage(1);
            setValidity(e.target.value as any);
          }}
          className="h-9 px-2 rounded-md border text-sm"
        >
          <option value="all">전체 유효성</option>
          {VALIDITY_OPTIONS.map((o) => (
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
                    <SourceBadge value={r.source_type} />
                  </Td>
                  <Td>
                    <button
                      className="text-left text-gray-900 hover:text-[#6C2DFF] font-medium"
                      onClick={() => setSelected(r)}
                    >
                      {r.brand_name || "—"}
                    </button>
                  </Td>
                  <Td>{r.campaign_type || "—"}</Td>
                  <Td>
                    <select
                      value={r.status ?? "new"}
                      onChange={async (e) => {
                        const sb: any = supabase;
                        const next = e.target.value as InquiryStatus;
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.status]: next })
                          .eq("id", r.id);
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
                  <Td>
                    <select
                      value={r.valid ? "valid" : "invalid"}
                      onChange={async (e) => {
                        const sb: any = supabase;
                        const next = e.target.value === "valid";
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.valid]: next })
                          .eq("id", r.id);
                        if (!error) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === r.id ? { ...row, valid: next } : row
                            )
                          );
                        }
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      {VALIDITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Td>
                  <Td>
                    <input
                      type="text"
                      defaultValue={r.manager_name || ""}
                      onBlur={async (e) => {
                        const sb: any = supabase;
                        const val = e.target.value;
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.manager]: val })
                          .eq("id", r.id);
                        if (!error) {
                          setRows((prev) =>
                            prev.map((row) =>
                              row.id === r.id
                                ? { ...row, manager_name: val }
                                : row
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
        const { data, error } = await supabase
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

  // cart_snapshot fallback
  const fallbackFromSnapshot = useMemo(() => {
    const items = (row as any)?.cart_snapshot?.items;
    if (!Array.isArray(items)) return [];
    return items.map((it: any) => ({
      apt_name: it.apt_name ?? it.name ?? "",
      product_name: it.mediaName ?? it.product_name ?? "",
    }));
  }, [row]);

  const listToRender =
    aptRows && aptRows.length > 0 ? aptRows : fallbackFromSnapshot;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm text-gray-500">브랜드</div>
            <div className="text-lg font-semibold flex items-center gap-2">
              {row.brand_name || "브랜드명 없음"}
              <SourceBadge value={row.source_type} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto h-[calc(100%-56px)]">
          <InfoItem label="문의일시" value={formatDateTime(row.created_at)} />
          <InfoItem label="캠페인 유형" value={row.campaign_type || "—"} />
          <InfoItem label="담당자명(광고주)" value={row.contact_name || "—"} />
          <InfoItem label="연락처" value={row.phone || "—"} />
          <InfoItem label="이메일주소" value={row.email || "—"} />
          <InfoItem
            label="송출개시희망일"
            value={row.start_at_wish ? formatDateTime(row.start_at_wish) : "—"}
          />
          <InfoItem label="요청사항" value={row.request_note || "—"} />

          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm font-medium mb-2">선택 단지/상품</div>

            {aptLoading ? (
              <div className="text-sm text-gray-500">불러오는 중…</div>
            ) : listToRender.length === 0 ? (
              <div className="text-sm text-gray-500">데이터 없음</div>
            ) : (
              <div className="max-h-52 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">단지명</th>
                      <th className="px-3 py-2 text-left">상품명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listToRender.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{it.apt_name || "—"}</td>
                        <td className="px-3 py-2">
                          {it.product_name || "—"}
                        </td>
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

const SourceBadge: React.FC<{ value?: SourceType | null }> = ({ value }) => {
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
