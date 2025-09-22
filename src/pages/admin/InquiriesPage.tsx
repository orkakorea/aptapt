import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InquiriesPage (+ 유입경로 칼럼/필터)
 * - inquiries: 광고문의 본문
 * - inquiry_apartments: 문의별 단지/상품 목록
 *
 * 스키마(요약)
 *   - inquiries(
 *       id uuid pk, created_at timestamptz,
 *       inquiry_kind text,            // "SEAT" | "PACKAGE"
 *       brand_name text, campaign_type text,
 *       contact_name text, phone text, email text,
 *       start_at_wish timestamptz, request_note text,
 *       status text, valid boolean
 *     )
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
  { value: "all", label: "전체 경로" },
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
  kind: "inquiry_kind",

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
    useState<(typeof KIND_OPTIONS)[number]["value"]>("all");
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

    // PostgREST .or() 문자열에서 쉼표/퍼센트를 안전하게 만드는 헬퍼
    const esc = (s: string) =>
      s.replaceAll(",", "\\,").replaceAll("%", "\\%").replaceAll("'", "''");

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const sb: any = supabase;

        let base = sb
          .from(TBL.main)
          .select("*", { count: "exact" })
          .order(COL.createdAt, { ascending: false });

        // 서버 필터
        if (from) base = base.gte(COL.createdAt, `${from}T00:00:00`);
        if (to) base = base.lte(COL.createdAt, `${to}T23:59:59.999`);
        if (status !== "all") base = base.eq(COL.status, status);
        if (validity !== "all")
          base = base.eq(COL.valid, validity === "valid");
        if (kind !== "all") base = base.eq(COL.kind, kind);

        // 서버 쿼리 텍스트 검색 (부분일치)
        const q = query.trim();
        if (q) {
          const like = `%${esc(q)}%`;
          // brand_name, campaign_type, contact_name, phone, email, request_note
          base = base.or(
            [
              `${COL.brand}.ilike.${like}`,
              `${COL.campaignType}.ilike.${like}`,
              `${COL.contactName}.ilike.${like}`,
              `${COL.phone}.ilike.${like}`,
              `${COL.email}.ilike.${like}`,
              `${COL.requestNote}.ilike.${like}`,
            ].join(",")
          );
        }

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
          inquiry_kind: (d[COL.kind] as InquiryKind) ?? null,
          brand_name: d[COL.brand] ?? null,
          campaign_type: d[COL.campaignType] ?? null,
          contact_name: d[COL.contactName] ?? null,
          phone: d[COL.phone] ?? null,
          email: d[COL.email] ?? null,
          start_at_wish: d[COL.startWish] ?? null,
          request_note: d[COL.requestNote] ?? null,
        }));

        if (!ignore) {
          setRows(mapped);
          setTotal(count ?? mapped.length);
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
        <div className="p-4 md:p-5 grid gap-3 md:grid-cols-[1fr_160px_160px_160px]">
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
            <Select
              value={kind}
              onChange={(v) => {
                setPage(1);
                setKind(v as any);
              }}
              options={KIND_OPTIONS}
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
            <table className="min-w-[1060px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <Th>날짜</Th>
                  <Th>유입경로</Th>
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
                      <KindBadge value={r.inquiry_kind ?? "SEAT"} />
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
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6C2DFF]/40"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

const StatusBadge: React.FC<{ value: InquiryStatus }> = ({ value }) => {
  const map: Record<
    InquiryStatus,
    { label: string; cn: string; dot: string }
  > = {
    new: {
      label: "신규",
      cn: "bg-[#F4F0FB] text-[#6C2DFF]",
      dot: "bg-[#6C2DFF]",
    },
    pending: {
      label: "대기",
      cn: "bg-yellow-50 text-yellow-700",
      dot: "bg-yellow-500",
    },
    in_progress: {
      label: "진행중",
      cn: "bg-blue-50 text-blue-700",
      dot: "bg-blue-500",
    },
    done: {
      label: "완료",
      cn: "bg-green-50 text-green-700",
      dot: "bg-green-500",
    },
    canceled: {
      label: "취소",
      cn: "bg-gray-100 text-gray-600",
      dot: "bg-gray-400",
    },
  };
  const { label, cn, dot } = map[value] ?? map.pending;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs " +
        cn
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + dot} />
      {label}
    </span>
  );
};

const ValidityBadge: React.FC<{ value: Validity }> = ({ value }) => {
  const isValid = value === "valid";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs " +
        (isValid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")
      }
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " +
          (isValid ? "bg-green-500" : "bg-red-500")
        }
      />
      {isValid ? "유효" : "무효"}
    </span>
  );
};

const KindBadge: React.FC<{ value: InquiryKind }> = ({ value }) => {
  const isSeat = value === "SEAT";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs " +
        (isSeat ? "bg-indigo-50 text-indigo-700" : "bg-amber-50 text-amber-700")
      }
      title={isSeat ? "구좌(SEAT)" : "패키지(PACKAGE)"}
    >
      <span
        className={
          "h-1.5 w-1.5 rounded-full " + (isSeat ? "bg-indigo-500" : "bg-amber-500")
        }
      />
      {isSeat ? "구좌" : "패키지"}
    </span>
  );
};

/* =========================
 *  상세 드로어
 * ========================= */

const DetailDrawer: React.FC<{
  row: InquiryRow;
  onClose: () => void;
  onStatusChange: (s: InquiryStatus) => Promise<boolean>;
  onValidityToggle: () => Promise<boolean>;
}> = ({ row, onClose, onStatusChange, onValidityToggle }) => {
  const [busy, setBusy] = useState<"status" | "valid" | null>(null);

  // A안: 단지/상품 목록
  const [aptItems, setAptItems] = useState<
    { apt_name: string; product_name: string }[]
  >([]);
  const [aptLoading, setAptLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const loadApts = async () => {
      setAptLoading(true);
      try {
        const sb: any = supabase;
        const { data, error } = await sb
          .from("inquiry_apartments")
          .select(`${APT_COL.aptName}, ${APT_COL.productName}`)
          .eq(APT_COL.inquiryId, row.id)
          .order(APT_COL.aptName, { ascending: true });

        if (error) throw error;
        if (!ignore) {
          setAptItems(
            (data || []).map((d: any) => ({
              apt_name: d[APT_COL.aptName] ?? "",
              product_name: d[APT_COL.productName] ?? "",
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
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => (busy ? null : onClose())}
      />
      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm text-gray-500">브랜드</div>
            <div className="text-lg font-semibold">
              {row.brand_name || "브랜드명 없음"}
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
          {/* 기본 정보 */}
          <section className="grid grid-cols-2 gap-3">
            <InfoItem label="문의일시" value={formatDateTime(row.created_at)} />
            <InfoItem
              label="유입경로"
              value={<KindBadge value={(row.inquiry_kind ?? "SEAT") as InquiryKind} />}
            />
            <InfoItem label="캠페인유형" value={row.campaign_type || "—"} />
            <InfoItem label="담당자명" value={row.contact_name || "—"} />
            <InfoItem label="연락처" value={row.phone || "—"} />
            <InfoItem label="이메일주소" value={row.email || "—"} />
            <InfoItem
              label="송출개시희망일"
              value={
                row.start_at_wish ? formatDateTime(row.start_at_wish) : "—"
              }
            />
          </section>

          {/* 요청사항 */}
          <section>
            <div className="text-sm font-medium mb-1">요청사항</div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm min-h-[48px]">
              {row.request_note || "—"}
            </div>
          </section>

          {/* 상태/유효성 제어 */}
          <section className="rounded-xl border border-gray-100 p-4">
            <div className="text-sm font-medium mb-3">처리 상태</div>
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_OPTIONS.filter((s) => s.value !== "all").map((opt) => (
                <button
                  key={opt.value}
                  disabled={busy === "status"}
                  onClick={async () => {
                    setBusy("status");
                    await onStatusChange(opt.value as InquiryStatus);
                    setBusy(null);
                  }}
                  className={
                    "rounded-full px-3 py-1.5 text-xs border " +
                    (row.status === opt.value
                      ? "border-[#6C2DFF] text-[#6C2DFF] bg-[#F4F0FB]"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm">유효성</div>
              <button
                disabled={busy === "valid"}
                onClick={async () => {
                  setBusy("valid");
                  await onValidityToggle();
                  setBusy(null);
                }}
                className={
                  "rounded-lg px-3 py-1.5 text-xs border " +
                  ((row.valid ?? false)
                    ? "border-green-300 text-green-700 bg-green-50"
                    : "border-red-300 text-red-700 bg-red-50")
                }
              >
                {(row.valid ?? false) ? "유효 → 무효로 전환" : "무효 → 유효로 전환"}
              </button>
            </div>
          </section>

          {/* 단지/상품 리스트 */}
          <section>
            <div className="text-sm font-medium mb-2">제안 단지 / 상품</div>
            <div className="rounded-lg border border-gray-100 overflow-hidden">
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
                    <tr key={idx} className="border-t border-gray-100">
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

const InfoItem: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ label, value, mono }) => {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={
          "mt-0.5 text-sm " + (mono ? "font-mono text-gray-700" : "text-gray-800")
        }
      >
        {value}
      </div>
    </div>
  );
};

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

