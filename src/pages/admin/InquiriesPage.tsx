// src/pages/admin/InquiriesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type InquiryStatus = "new" | "pending" | "in_progress" | "done" | "canceled";
type Validity = "valid" | "invalid";

type InquiryRow = {
  id: string;
  created_at: string;
  status?: InquiryStatus | null;
  valid?: boolean | null;

  brand_name?: string | null;
  campaign_type?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  start_at_wish?: string | null;
  request_note?: string | null;
};

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "new", label: "신규" },
  { value: "pending", label: "대기" },
  { value: "in_progress", label: "진행중" },
  { value: "done", label: "완료" },
  { value: "canceled", label: "취소" },
] as const;

const VALIDITY_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "valid", label: "유효" },
  { value: "invalid", label: "무효" },
] as const;

const TBL = {
  main: "inquiries",
  apartments: "inquiry_apartments",
} as const;

const COL = {
  createdAt: "created_at",
  status: "status",
  valid: "valid",
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
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");
  const [validity, setValidity] =
    useState<(typeof VALIDITY_OPTIONS)[number]["value"]>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

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

        if (from) base = base.gte(COL.createdAt, `${from}T00:00:00`);
        if (to) base = base.lte(COL.createdAt, `${to}T23:59:59.999`);

        const { data, error, count } = await base.range(
          range.fromIdx,
          range.toIdx
        );
        if (error) throw error;

        const mapped: InquiryRow[] = (data || []).map((d: any) => ({
          id: String(d.id ?? ""),
          created_at: d[COL.createdAt] ?? new Date().toISOString(),
          status: d[COL.status] ?? null,
          valid: d[COL.valid] ?? null,
          brand_name: d[COL.brand],
          campaign_type: d[COL.campaignType],
          contact_name: d[COL.contactName],
          phone: d[COL.phone],
          email: d[COL.email],
          start_at_wish: d[COL.startWish],
          request_note: d[COL.requestNote],
        }));

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
          setTotal(count ?? filtered.length);
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
  }, [query, status, validity, from, to, range.fromIdx, range.toIdx]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">문의상세 관리</h2>
      </header>

      {/* 테이블 */}
      {!loading && (
        <section className="rounded-2xl bg-white border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <Th>날짜</Th>
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
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <Td>{formatDateTime(r.created_at)}</Td>
                    <Td>
                      <button
                        className="text-left text-gray-900 hover:text-[#6C2DFF] font-medium"
                        onClick={() => setSelected(r)}
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
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
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

      {selected && (
        <DetailDrawer row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default InquiriesPage;

/* =============== 프레젠테이션 컴포넌트 =============== */

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
}) => <td className={"px-4 py-3 " + (className ?? "")}>{children}</td>;

const StatusBadge: React.FC<{ value: InquiryStatus }> = ({ value }) => {
  const map: Record<InquiryStatus, { label: string; cn: string }> = {
    new: { label: "신규", cn: "bg-purple-50 text-purple-700" },
    pending: { label: "대기", cn: "bg-yellow-50 text-yellow-700" },
    in_progress: { label: "진행중", cn: "bg-blue-50 text-blue-700" },
    done: { label: "완료", cn: "bg-green-50 text-green-700" },
    canceled: { label: "취소", cn: "bg-gray-100 text-gray-600" },
  };
  const { label, cn } = map[value] ?? map.pending;
  return (
    <span className={"inline-flex px-2 py-0.5 rounded-full text-xs " + cn}>
      {label}
    </span>
  );
};

const ValidityBadge: React.FC<{ value: Validity }> = ({ value }) => (
  <span
    className={
      "inline-flex px-2 py-0.5 rounded-full text-xs " +
      (value === "valid"
        ? "bg-green-50 text-green-700"
        : "bg-red-50 text-red-700")
    }
  >
    {value === "valid" ? "유효" : "무효"}
  </span>
);

/* =============== 상세 드로어 =============== */
const DetailDrawer: React.FC<{ row: InquiryRow; onClose: () => void }> = ({
  row,
  onClose,
}) => {
  const [aptItems, setAptItems] = useState<
    { apt_name: string; product_name: string }[]
  >([]);
  const [aptLoading, setAptLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const loadApts = async () => {
      setAptLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from(TBL.apartments)
          .select(`${APT_COL.aptName}, ${APT_COL.productName}`)
          .eq(APT_COL.inquiryId, row.id)
          .order(APT_COL.aptName, { ascending: true });
        if (error) throw error;
        if (!ignore) {
          setAptItems(
            (data || []).map((d: any) => ({
              apt_name: d[APT_COL.aptName],
              product_name: d[APT_COL.productName],
            }))
          );
        }
      } catch (e) {
        if (!ignore) setAptItems([]);
      } finally {
        if (!ignore) setAptLoading(false);
      }
    };
    loadApts();
    return () => {
      ignore = true;
    };
  }, [row.id]);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-sm text-gray-500">브랜드</div>
            <div className="text-lg font-semibold">
              {row.brand_name || "브랜드명 없음"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            닫기
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto h-[calc(100%-56px)]">
          <InfoItem label="문의일시" value={formatDateTime(row.created_at)} />
          <InfoItem label="캠페인 유형" value={row.campaign_type || "—"} />
          <InfoItem label="연락처" value={row.phone || "—"} />
          <InfoItem label="이메일" value={row.email || "—"} />
          <InfoItem
            label="송출개시희망일"
            value={row.start_at_wish ? formatDateTime(row.start_at_wish) : "—"}
          />
          <InfoItem label="요청사항" value={row.request_note || "—"} />

          {/* 단지/상품 리스트 */}
          <section>
            <div className="text-sm font-medium mb-2">제안 단지 / 상품</div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">단지명</th>
                    <th className="px-3 py-2 text-left">상품명</th>
                  </tr>
                </thead>
                <tbody>
                  {aptLoading && (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-gray-500">
                        불러오는 중…
                      </td>
                    </tr>
                  )}
                  {!aptLoading && aptItems.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-gray-400">
                        등록된 단지/상품 정보가 없습니다.
                      </td>
                    </tr>
                  )}
                  {aptItems.map((it, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{it.apt_name || "—"}</td>
                      <td className="px-3 py-2">{it.product_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-0.5 text-sm text-gray-800">{value}</div>
  </div>
);

/* =============== 유틸 =============== */
function toValidity(valid?: boolean | null): Validity {
  return valid ? "valid" : "invalid";
}
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
