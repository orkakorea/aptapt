import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * InquiriesPage
 * - 관리자용 문의 목록/검색/필터/상세보기 골격
 * - Supabase 'inquiries' 테이블 기준으로 작성 (컬럼은 일부 optional)
 * - 뒤에서 실제 스키마에 맞춰 컬럼명만 교체하면 바로 동작하도록 방어적으로 구성
 */

type InquiryStatus = "new" | "pending" | "in_progress" | "done" | "canceled";
type Validity = "valid" | "invalid";

type InquiryRow = {
  id: string;
  created_at: string;
  status?: InquiryStatus | null;
  valid?: boolean | null;
  // 이하 필드는 스키마에 없으면 null로 들어옵니다(방어적 처리)
  campaign_name?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  promo_code?: string | null;
  apt_name?: string | null;
  // 기타 확장 필드들
  memo?: string | null;
  extra?: any | null;
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

const InquiriesPage: React.FC = () => {
  // ====== 필터/검색 상태 ======
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>(
    "all"
  );
  const [validity, setValidity] =
    useState<(typeof VALIDITY_OPTIONS)[number]["value"]>("all");
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
        // 1) 총 개수 집계 (count=true)
        let base = supabase
          .from("inquiries")
          .select(
            // 필요한 컬럼만 지정. 존재하지 않는 컬럼은 null로 들어오므로 타입은 optional
            "id, created_at, status, valid, campaign_name, contact_name, phone, promo_code, apt_name, memo, extra",
            { count: "exact", head: false }
          );

        // 검색 (여러 컬럼 대상으로 or)
        if (query.trim()) {
          const q = query.trim();
          base = base.or(
            [
              `campaign_name.ilike.%${q}%`,
              `contact_name.ilike.%${q}%`,
              `phone.ilike.%${q}%`,
              `promo_code.ilike.%${q}%`,
              `apt_name.ilike.%${q}%`,
              `id.ilike.%${q}%`,
            ].join(",")
          );
        }

        // 상태 필터
        if (status !== "all") {
          base = base.eq("status", status);
        }

        // 유효성 필터
        if (validity !== "all") {
          base = base.eq("valid", validity === "valid");
        }

        // 날짜 범위 (created_at)
        if (from) base = base.gte("created_at", `${from}T00:00:00`);
        if (to) base = base.lte("created_at", `${to}T23:59:59.999`);

        // 정렬
        base = base.order("created_at", { ascending: false });

        // 페이지 범위
        const { data, error, count } = await base.range(
          range.fromIdx,
          range.toIdx
        );

        if (error) throw error;
        if (ignore) return;

        setRows((data as any as InquiryRow[]) ?? []);
        setTotal(count ?? 0);
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
        <div className="p-4 md:p-5 grid gap-3 md:grid-cols-[1fr_160px_160px]">
          <div className="flex items-center gap-2">
            <div className="text-gray-400">🔎</div>
            <input
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="캠페인명, 담당자명, 연락처, 프로모션코드, 단지명…"
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
            <table className="min-w-[920px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <Th>날짜</Th>
                  <Th>캠페인명</Th>
                  <Th>담당자</Th>
                  <Th>연락처</Th>
                  <Th>프로모션코드</Th>
                  <Th className="text-center">진행상황</Th>
                  <Th className="text-center">유효성</Th>
                  <Th className="text-center">단지정보</Th>
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
                    <Td>{formatDate(r.created_at)}</Td>
                    <Td className="max-w-[220px]">
                      <span className="line-clamp-1">
                        {r.campaign_name || "—"}
                      </span>
                    </Td>
                    <Td>{r.contact_name || "—"}</Td>
                    <Td>{r.phone || "—"}</Td>
                    <Td>
                      {r.promo_code ? (
                        <code className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                          {r.promo_code}
                        </code>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-center">
                      <StatusBadge value={(r.status as any) || "pending"} />
                    </Td>
                    <Td className="text-center">
                      <ValidityBadge value={toValidity(r.valid)} />
                    </Td>
                    <Td className="text-center">
                      <button
                        className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                        title={r.apt_name || "단지정보"}
                      >
                        👁️ <span className="hidden sm:inline">상세보기</span>
                      </button>
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
            // 상태 변경 (간단 구현: 성공 시 로컬 상태 반영 + 재조회)
            const { error } = await supabase
              .from("inquiries")
              .update({ status: next })
              .eq("id", selected.id);
            if (!error) {
              setSelected({ ...selected, status: next });
              // 최신 상태 반영 위해 현재 페이지 재조회
              // (간단하게 page 상태를 트리거)
              setPage((p) => p);
            }
            return !error;
          }}
          onValidityToggle={async () => {
            const nextValid = !(selected.valid ?? false);
            const { error } = await supabase
              .from("inquiries")
              .update({ valid: nextValid })
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
        (isValid
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700")
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

const DetailDrawer: React.FC<{
  row: InquiryRow;
  onClose: () => void;
  onStatusChange: (s: InquiryStatus) => Promise<boolean>;
  onValidityToggle: () => Promise<boolean>;
}> = ({ row, onClose, onStatusChange, onValidityToggle }) => {
  const [busy, setBusy] = useState<"status" | "valid" | null>(null);

  return (
    <div className="fixed inset-0 z-40">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => (busy ? null : onClose())}
      />
      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm text-gray-500">문의 상세</div>
            <div className="text-lg font-semibold">{row.campaign_name || "캠페인명 없음"}</div>
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
            <InfoItem label="문의 ID" value={row.id} mono />
            <InfoItem label="문의일시" value={formatDateTime(row.created_at)} />
            <InfoItem label="담당자" value={row.contact_name || "—"} />
            <InfoItem label="연락처" value={row.phone || "—"} />
            <InfoItem label="프로모션코드" value={row.promo_code || "—"} />
            <InfoItem label="단지명" value={row.apt_name || "—"} />
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

          {/* 메모/부가 */}
          {(row.memo || row.extra) && (
            <section className="space-y-3">
              {row.memo && (
                <div>
                  <div className="text-sm font-medium mb-1">메모</div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                    {row.memo}
                  </div>
                </div>
              )}
              {row.extra && (
                <div>
                  <div className="text-sm font-medium mb-1">추가 데이터</div>
                  <pre className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs overflow-auto">
                    {JSON.stringify(row.extra, null, 2)}
                  </pre>
                </div>
              )}
            </section>
          )}
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

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return iso;
  }
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
