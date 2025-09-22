import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type InquiryStatus = "new" | "pending" | "in_progress" | "done" | "canceled";
type Validity = "valid" | "invalid";
type SourceType = "SEAT" | "PACKAGE";

type InquiryRow = {
  id: string;
  created_at: string;
  status?: InquiryStatus | null;
  valid?: boolean | null;
  source_type?: SourceType | null;

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
  sourceType: "source_type", // ✅ 추가됨
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
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [selected, setSelected] = useState<InquiryRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);
  const [total, setTotal] = useState<number>(0);
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
        const { data, error, count } = await supabase
          .from(TBL.main)
          .select("*", { count: "exact" })
          .order(COL.createdAt, { ascending: false })
          .range(range.fromIdx, range.toIdx);

        if (error) throw error;

        const mapped: InquiryRow[] = (data || []).map((d: any) => ({
          id: String(d.id ?? ""),
          created_at: d[COL.createdAt] ?? new Date().toISOString(),
          status: d[COL.status],
          valid: d[COL.valid],
          source_type: d[COL.sourceType],
          brand_name: d[COL.brand],
          campaign_type: d[COL.campaignType],
          contact_name: d[COL.contactName],
          phone: d[COL.phone],
          email: d[COL.email],
          start_at_wish: d[COL.startWish],
          request_note: d[COL.requestNote],
        }));

        if (!ignore) {
          setRows(mapped);
          setTotal(count ?? mapped.length);
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
  }, [range.fromIdx, range.toIdx]);

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
                <Th className="text-center">유입경로</Th> {/* ✅ 추가 */}
                <Th>브랜드명</Th>
                <Th>캠페인 유형</Th>
                <Th>진행상황</Th>
                <Th>유효성</Th>
                <Th>상세</Th>
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

      {selected && (
        <DetailDrawer row={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
};

export default InquiriesPage;

/* =========================
 *  프레젠테이션 컴포넌트
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

/* =========================
 *  상세 드로어
 * ========================= */
const DetailDrawer: React.FC<{ row: InquiryRow; onClose: () => void }> = ({
  row,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm text-gray-500">브랜드</div>
            <div className="text-lg font-semibold flex items-center gap-2">
              {row.brand_name || "브랜드명 없음"}
              <SourceBadge value={row.source_type} /> {/* ✅ 상세에도 표시 */}
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
          <InfoItem label="연락처" value={row.phone || "—"} />
          <InfoItem label="이메일" value={row.email || "—"} />
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

/* =========================
 *  유틸
 * ========================= */
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
