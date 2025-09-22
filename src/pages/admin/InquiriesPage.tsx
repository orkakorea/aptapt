import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InquiriesPage
 * - 유입경로(SEAT/PACKAGE) 컬럼 추가
 * - 상세 드로어 상단에도 유입경로 배지 표시
 * - 진행상황/유효성/담당자는 목록 테이블에서 드롭다운/인풋으로 수정 가능
 */

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

  const range = useMemo(() => {
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;
    return { fromIdx, toIdx };
  }, [page, pageSize]);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoading(true);
      try {
        const sb: any = supabase;
        let base = sb
          .from(TBL.main)
          .select("*", { count: "exact" })
          .order(COL.createdAt, { ascending: false })
          .range(range.fromIdx, range.toIdx);

        const { data, error, count } = await base;
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
        }));

        // 클라이언트 필터
        const filtered = mapped.filter((r) => {
          if (status !== "all" && r.status !== status) return false;
          if (validity !== "all") {
            const v = r.valid ? "valid" : "invalid";
            if (v !== validity) return false;
          }
          if (sourceType !== "all" && r.source_type !== sourceType) return false;
          if (query.trim()) {
            const q = query.trim().toLowerCase();
            const hay = [r.brand_name, r.campaign_type, r.manager_name]
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
      } catch (e) {
        console.error(e);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [page, pageSize, query, status, validity, sourceType, range.fromIdx, range.toIdx]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">문의상세 관리</h2>
      </header>

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
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.status]: e.target.value })
                          .eq("id", r.id);
                        if (!error) setRows((prev) =>
                          prev.map((row) =>
                            row.id === r.id ? { ...row, status: e.target.value as InquiryStatus } : row
                          )
                        );
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
                        if (!error) setRows((prev) =>
                          prev.map((row) =>
                            row.id === r.id ? { ...row, valid: next } : row
                          )
                        );
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
                        const { error } = await sb
                          .from(TBL.main)
                          .update({ [COL.manager]: e.target.value })
                          .eq("id", r.id);
                        if (!error) setRows((prev) =>
                          prev.map((row) =>
                            row.id === r.id ? { ...row, manager_name: e.target.value } : row
                          )
                        );
                      }}
                      className="border rounded px-2 py-1 text-sm w-full"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 상세 드로어 */}
      {selected && (
        <DetailDrawer row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default InquiriesPage;

/* ====== Detail Drawer ====== */
const DetailDrawer: React.FC<{
  row: InquiryRow;
  onClose: () => void;
}> = ({ row, onClose }) => {
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm text-gray-500">브랜드</div>
            <div className="text-lg font-semibold flex items-center gap-2">
              {row.brand_name || "브랜드명 없음"}
              <SourceBadge value={row.source_type} /> {/* ⬅️ 유입경로 표시 */}
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

/* ====== 작은 컴포넌트 ====== */
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

/* ====== 유틸 ====== */
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
