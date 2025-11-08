// src/pages/admin/InquiriesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

/* === 추가: 완료모달과 동일한 계산 유틸 임포트 (정책/월가 계산) === */
import { calcMonthlyWithPolicy, normPolicyKey, DEFAULT_POLICY, rateFromRanges } from "@/core/pricing";

/**
 * InquiriesPage (관리자 전용)
 * - 목록/검색/필터/페이지네이션
 * - 인라인 수정: status, valid(—/유효/무효), assignee
 * - 상세 드로어: 광고주 최종확인(금액) 스냅샷 테이블
 *
 * ⚠️ 중요: admin 세션 확인이 끝난 뒤에만 SELECT 수행
 */

/* =========================
 *  Zod Schemas (입력 검증)
 * ========================= */
const StatusSchema = z.enum(["new", "in_progress", "done", "canceled"]);
const ValidTriSchema = z.union([z.literal("-"), z.literal("valid"), z.literal("invalid")]);
// assignee: 태그 제거 → trim → 길이 최대 80, 공백이면 null
function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, "");
}
function sanitizeAssignee(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = stripTags(input).trim();
  if (!cleaned) return null;
  return cleaned.length > 80 ? cleaned.slice(0, 80) : cleaned;
}

type InquiryKind = "SEAT" | "PACKAGE";
type InquiryStatus = "new" | "in_progress" | "done" | "canceled";
type ValidTri = "-" | "valid" | "invalid";

type InquiryRow = {
  id: string;
  created_at: string;
  company?: string | null;
  campaign_type?: string | null;
  status?: InquiryStatus | null;
  valid?: boolean | null;
  assignee?: string | null;
  inquiry_kind?: InquiryKind | null;

  customer_name?: string | null;
  phone?: string | null;
  email?: string | null;
  memo?: string | null;

  /** 최종 확인 스냅샷(문자열/JSON 둘 다 허용) */
  cart_snapshot?: any;

  /** 디바이스 판정 보조 필드(있으면 사용) */
  device?: string | null;
  meta?: any;
  source_page?: string | null;
  extra?: any;
};

const STATUS_OPTIONS: { value: InquiryStatus; label: string }[] = [
  { value: "new", label: "신규" },
  { value: "in_progress", label: "진행중" },
  { value: "done", label: "완료" },
  { value: "canceled", label: "취소" },
];

const SOURCE_OPTIONS: { value: "all" | InquiryKind; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "SEAT", label: "SEAT" },
  { value: "PACKAGE", label: "PACKAGE" },
];

const VALIDITY_OPTIONS: { value: ValidTri; label: string }[] = [
  { value: "-", label: "—" },
  { value: "valid", label: "유효" },
  { value: "invalid", label: "무효" },
];

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** DB 컬럼 매핑 */
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

  /** 추가 (있으면 사용) */
  device: "device",
  meta: "meta",
  sourcePage: "source_page",
  extra: "extra",
} as const;

const TBL = { main: "inquiries", apartments: "inquiry_apartments" } as const;

const APT_COL = {
  inquiryId: "inquiry_id",
  aptName: "apt_name",
  productName: "product_name",
} as const;

/* =========================
 *  NEW 배지 1회성 관리
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
  // ----- admin 가드 준비 상태 -----
  const [sessionReady, setSessionReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 목록 상태
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [selected, setSelected] = useState<InquiryRow | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);
  const [total, setTotal] = useState(0);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | InquiryStatus>("all");
  const [sourceType, setSourceType] = useState<"all" | InquiryKind>("all");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  useEffect(() => setSeenIds(getSeenSet()), []);

  const { fromIdx, toIdx } = useMemo(() => {
    const fromIdx = (page - 1) * pageSize;
    return { fromIdx, toIdx: fromIdx + pageSize - 1 };
  }, [page, pageSize]);

  // ----- 세션/role 확인 -----
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted) {
        setIsAdmin(role === "admin");
        setSessionReady(true);
      }
    };
    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const role = (session?.user as any)?.app_metadata?.role;
      setSessionReady(true);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // ----- 서버사이드 로드 -----
  useEffect(() => {
    if (!sessionReady || !isAdmin) return;

    let ignore = false;
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const sb: any = supabase;

        let q = sb.from(TBL.main).select("*", { count: "exact" }).order(COL.createdAt, { ascending: false });

        if (status !== "all") q = q.eq(COL.status, status);
        if (sourceType !== "all") q = q.eq(COL.inquiryKind, sourceType);
        if (query.trim()) {
          const k = query.trim();
          q = q.or(`${COL.company}.ilike.%${k}%,${COL.campaignType}.ilike.%${k}%,${COL.customerName}.ilike.%${k}%`);
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

          // 추가 필드(있으면 사용)
          device: d[COL.device],
          meta: d[COL.meta],
          source_page: d[COL.sourcePage],
          extra: d[COL.extra],
        }));

        if (!ignore) {
          setRows(mapped);
          setTotal(typeof count === "number" ? count : mapped.length);
        }
      } catch (e: any) {
        if (!ignore) {
          const msg = e?.message || "데이터 로드 중 오류가 발생했습니다.";
          setErr(msg);
          console.error("[InquiriesPage] load error:", e);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [sessionReady, isAdmin, page, pageSize, query, status, sourceType, fromIdx, toIdx]);

  // ----- 렌더 -----
  if (!sessionReady) {
    return (
      <div className="p-6">
        <div className="rounded-md border bg-white p-4 text-sm text-gray-500">관리자 세션 확인 중…</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          관리자 권한이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
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
          <button onClick={() => setPage(1)} className="h-9 px-3 rounded-md border text-sm" disabled={loading}>
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
      </div>

      {/* 오류 */}
      {err && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700 text-sm">{err}</div>}

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
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <Td>{formatDateTime(r.created_at)}</Td>
                  <Td className="text-center">
                    <SourceBadge value={r.inquiry_kind} />
                  </Td>

                  {/* 브랜드명 + NEW 배지 */}
                  <Td>
                    <div className="flex items-center gap-2">
                      {r.status === "new" && !seenIds.has(r.id) && (
                        <span className="text-[10px] uppercase font-semibold text-violet-600">new</span>
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

                  {/* 진행상황 인라인 수정 */}
                  <Td>
                    <select
                      value={r.status ?? "new"}
                      onChange={async (e) => {
                        const prev = r.status ?? "new";
                        const nextRaw = e.target.value as string;
                        const parsed = StatusSchema.safeParse(nextRaw);
                        if (!parsed.success) {
                          e.currentTarget.value = prev;
                          return;
                        }
                        const next = parsed.data;

                        const { error } = await (supabase as any)
                          .from(TBL.main)
                          .update({ [COL.status]: next })
                          .eq(COL.id, r.id);

                        if (!error) {
                          setRows((prevRows) =>
                            prevRows.map((row) => (row.id === r.id ? { ...row, status: next } : row)),
                          );
                        } else {
                          setErr(error.message || "진행상황 저장 실패");
                          e.currentTarget.value = prev;
                        }
                      }}
                      className={"border rounded-full px-2 py-1 text-sm " + pillClassForStatus(r.status ?? "new")}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Td>

                  {/* 유효성 인라인 수정 */}
                  <Td>
                    <select
                      value={validToTri(r.valid)}
                      onChange={async (e) => {
                        const prev = validToTri(r.valid);
                        const raw = e.target.value as string;
                        const parsed = ValidTriSchema.safeParse(raw);
                        if (!parsed.success) {
                          e.currentTarget.value = prev;
                          return;
                        }
                        const v = parsed.data;

                        const payload =
                          v === "-"
                            ? { [COL.valid]: null }
                            : v === "valid"
                              ? { [COL.valid]: true }
                              : { [COL.valid]: false };

                        const { error } = await (supabase as any).from(TBL.main).update(payload).eq(COL.id, r.id);
                        if (!error) {
                          setRows((prevRows) =>
                            prevRows.map((row) =>
                              row.id === r.id ? { ...row, valid: v === "-" ? null : v === "valid" } : row,
                            ),
                          );
                        } else {
                          setErr(error.message || "유효성 저장 실패");
                          e.currentTarget.value = prev;
                        }
                      }}
                      className={"border rounded-full px-2 py-1 text-sm " + pillClassForValid(validToTri(r.valid))}
                    >
                      {VALIDITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Td>

                  {/* 담당자 인라인 수정 */}
                  <Td>
                    <input
                      type="text"
                      defaultValue={r.assignee || ""}
                      onBlur={async (e) => {
                        const prev = r.assignee || "";
                        const sanitized = sanitizeAssignee(e.target.value);
                        e.currentTarget.value = sanitized ?? "";
                        const { error } = await (supabase as any)
                          .from(TBL.main)
                          .update({ [COL.assignee]: sanitized })
                          .eq(COL.id, r.id);
                        if (!error) {
                          setRows((prevRows) =>
                            prevRows.map((row) => (row.id === r.id ? { ...row, assignee: sanitized } : row)),
                          );
                        } else {
                          setErr(error.message || "담당자 저장 실패");
                          e.currentTarget.value = prev;
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

        {/* 페이징 */}
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
              onClick={() => setPage((p) => (p * pageSize < Math.max(1, total) ? p + 1 : p))}
              disabled={loading || page * pageSize >= Math.max(1, total)}
            >
              다음
            </button>
          </div>
        </div>
      </section>

      {/* 상세 드로어 */}
      {selected && <DetailDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default InquiriesPage;

/* =========================
 *  Detail Drawer
 * ========================= */
const DetailDrawer: React.FC<{ row: InquiryRow; onClose: () => void }> = ({ row, onClose }) => {
  const [aptRows, setAptRows] = useState<{ apt_name: string; product_name: string }[]>([]);
  const [aptLoading, setAptLoading] = useState(false);

  // inquiry_apartments 조회 (CSV 내보내기에서만 사용)
  useEffect(() => {
    let ignore = false;
    (async () => {
      setAptLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from(TBL.apartments)
          .select(`${APT_COL.aptName}, ${APT_COL.productName}`)
          .eq(APT_COL.inquiryId, row.id);

        if (!ignore) setAptRows(error ? [] : ((data as any) ?? []));
      } finally {
        if (!ignore) setAptLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [row.id]);

  /** cart_snapshot 문자열/JSON 안전 파서 */
  const parsedSnap = useMemo(() => {
    const snap = (row as any)?.cart_snapshot;
    if (!snap) return null;
    if (typeof snap === "string") {
      try {
        const trimmed = snap.trim();
        if (trimmed === "null" || trimmed === "") return null;
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
    if (typeof snap === "object") return snap;
    return null;
  }, [row]);

  // cart_snapshot 폴백 (표시 전용 단순 리스트 / CSV용)
  const snapshotSets = useMemo(() => {
    const items = (parsedSnap as any)?.items;
    if (!Array.isArray(items)) return [];
    return items.map((it: any) => ({
      apt_name: it.apt_name ?? it.name ?? it.aptName ?? it.apt?.name ?? "",
      months: Number(it.months ?? it.Months ?? it.period ?? it.duration ?? 0) || null,
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
  }, [parsedSnap]);

  // 표시 리스트(단지/개월/상품명) — 화면 표시는 제거, CSV 생성에만 사용
  const listToRender: { apt_name: string; months: number | null; product_name: string }[] = useMemo(() => {
    if (aptRows.length === 0 && snapshotSets.length > 0) return snapshotSets;

    if (aptRows.length > 0) {
      return aptRows.map((ap) => {
        const found = snapshotSets.find(
          (s) =>
            (s.apt_name || "").trim() === (ap.apt_name || "").trim() &&
            (s.product_name || "").trim() === (ap.product_name || "").trim(),
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

  // ====== 디바이스 표기 ======
  const deviceLabel = useMemo(() => deriveDeviceLabel(row), [row]);

  // ====== 최종 확인(금액) 스냅샷 파싱 ======
  type FinalLine = {
    apt_name: string;
    product_name: string;
    months: number;
    baseMonthly: number | null; // 할인 전 월가(기준)
    monthlyAfter: number | null; // 할인 후 월가
    lineTotal: number; // 총광고료(할인 후 월×개월)
  };

  // 내부 유틸
  const toNum = (v: any): number | null => {
    const n = Number(v);
    return isFinite(n) && !isNaN(n) ? n : null;
  };
  const pick = (o: any, keys: string[]) => {
    for (const k of keys) {
      const v = o?.[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  };

  /** === 핵심: 완료모달 로직과 동일한 정규화 파서 === */
  function normalizeSnapshotItems(snap: any): FinalLine[] {
    if (!snap) return [];

    // ① 항목 배열 우선순위 (DB 스냅샷 신뢰 경로)
    const candidates: any[] =
      (Array.isArray(snap?.receipt_v1?.items) && snap.receipt_v1.items) ||
      (Array.isArray(snap?.items) && snap.items) ||
      (Array.isArray(snap?.computedCart) && snap.computedCart) ||
      (Array.isArray(snap?.cart?.items) && snap.cart.items) ||
      [];

    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    // 상단 라벨 폴백
    const topAptFallback: string =
      typeof snap?.summary?.topAptLabel === "string" ? String(snap.summary.topAptLabel).replace(/\s*외.*$/, "") : "";

    const lines: FinalLine[] = candidates.map((it: any) => {
      // months 추출(문자/단위 혼입 대비)
      const parseMonths = (value: any): number => {
        if (value == null) return 0;
        if (typeof value === "number" && isFinite(value)) return Math.max(0, Math.floor(value));
        if (typeof value === "string") {
          const num = parseInt(value.replace(/[^\d]/g, ""), 10);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      };

      const months =
        parseMonths(
          pick(it, ["months", "month", "Months", "period", "duration"]) ?? pick(it, ["Months", "Period", "Duration"]),
        ) || 0;

      // 기준 월가 후보 / 기준 총액 후보
      const baseMonthlyRaw = toNum(
        pick(it, ["baseMonthly", "base_monthly", "monthlyBefore", "basePriceMonthly", "priceMonthly"]),
      );

      const baseTotalField = toNum(pick(it, ["baseTotal", "base_total"]));
      let baseTotal =
        baseTotalField != null
          ? baseTotalField
          : baseMonthlyRaw != null && months > 0
            ? Math.round(baseMonthlyRaw * months)
            : 0;

      // 할인후 월가 후보
      let monthlyAfter: number | null =
        toNum(
          pick(it, [
            "monthlyAfter",
            "monthly_after",
            "priceMonthlyAfter",
            "discountedMonthly",
            "discounted_monthly",
            "finalMonthly",
            "final_monthly",
            "price_monthly",
            "monthly",
            "monthlyFee",
          ]),
        ) ?? null;

      // 라인 합계 후보
      let lineTotal: number =
        toNum(
          pick(it, [
            "lineTotal",
            "line_total",
            "total",
            "totalCost",
            "final_total",
            "subtotal",
            "item_total_won",
            "total_won",
          ]),
        ) ?? 0;

      // 역산 로직(모달 동일)
      if ((!lineTotal || lineTotal <= 0) && months > 0 && monthlyAfter != null && monthlyAfter > 0) {
        lineTotal = Math.round(monthlyAfter * months);
      }
      if ((!lineTotal || lineTotal <= 0) && months > 0 && baseMonthlyRaw != null && baseMonthlyRaw > 0) {
        lineTotal = Math.round(baseMonthlyRaw * months);
      }

      // 표시용 기준 월가
      const baseMonthlyEff =
        baseMonthlyRaw != null && baseMonthlyRaw > 0
          ? baseMonthlyRaw
          : months > 0 && baseTotal > 0
            ? Math.round(baseTotal / months)
            : null;

      // ───────────────────────────────────────────────────────────
      // ELEVATOR TV 전용 규칙 강제 적용 (모달과 동일)
      //   총액 = 기준금액 × (1-기간할인) × (1-사전보상할인[개월기준])
      //   할인후월가 = 총액/개월
      // ───────────────────────────────────────────────────────────
      const productName =
        String(
          pick(it, ["product_name", "productName", "mediaName", "media_name", "media", "product", "product_code"]) ??
            "",
        ) || "";
      const key = normPolicyKey(productName);

      if (key === "ELEVATOR TV" && months > 0) {
        if (!baseTotal || baseTotal <= 0) {
          baseTotal = baseMonthlyEff != null && months > 0 ? baseMonthlyEff * months : 0;
        }
        const periodRate = rateFromRanges(DEFAULT_POLICY["ELEVATOR TV"].period, months);
        const precompRate = months < 3 ? 0.03 : 0.05;
        const tvTotal = Math.round((baseTotal || 0) * (1 - periodRate) * (1 - precompRate));
        lineTotal = tvTotal;
        monthlyAfter = months > 0 ? Math.round(tvTotal / months) : monthlyAfter;
      } else {
        // 비 TV 상품: 정책 폴백
        const looksZeroDiscount = (() => {
          if (!baseTotal || baseTotal <= 0 || !lineTotal || lineTotal <= 0) return true;
          const r = 1 - lineTotal / baseTotal;
          return !isFinite(r) || Math.abs(r) < 0.01;
        })();

        if (looksZeroDiscount && baseMonthlyEff != null && baseMonthlyEff > 0 && months > 0) {
          const { monthly } = calcMonthlyWithPolicy(productName, months, baseMonthlyEff, undefined, 1);
          if (monthly > 0 && monthly <= baseMonthlyEff) {
            monthlyAfter = monthly;
            lineTotal = Math.round(monthly * months);
          }
        }
      }

      return {
        apt_name:
          String(
            pick(it, ["apt_name", "aptName", "name", "apt", "title", "apt_title"]) ??
              (topAptFallback ? topAptFallback : ""),
          ) || "",
        product_name: productName,
        months: Math.max(0, months || 0),
        baseMonthly: baseMonthlyEff ?? null,
        monthlyAfter: monthlyAfter ?? (months > 0 && lineTotal > 0 ? Math.round(lineTotal / months) : null),
        lineTotal: Math.max(0, lineTotal || 0),
      };
    });

    return lines.filter((l) => l.apt_name || l.product_name || l.lineTotal > 0 || l.months > 0);
  }

  const finalLines = useMemo<FinalLine[]>(() => normalizeSnapshotItems(parsedSnap), [parsedSnap]);

  const totals = useMemo(() => {
    const sum = finalLines.reduce(
      (acc, l) => {
        acc.total += l.lineTotal || 0;
        return acc;
      },
      { total: 0 },
    );
    const vat = Math.round(sum.total * 0.1);
    const grand = sum.total + vat;
    return { total: sum.total, vat, grand };
  }, [finalLines]);

  function discountRate(baseMonthly: number | null, monthlyAfter: number | null): number | null {
    if (baseMonthly == null || monthlyAfter == null) return null;
    if (baseMonthly <= 0) return null;
    const r = (baseMonthly - monthlyAfter) / baseMonthly;
    if (!isFinite(r)) return null;
    const clamped = Math.max(0, Math.min(1, r));
    return clamped;
  }

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

    const metaLines = [["항목", "값"].join(","), ...metaPairs.map(([k, v]) => [safeCSV(k), safeCSV(v)].join(","))].join(
      "\n",
    );

    const header = ["단지명", "상품명", "광고기간(개월)", "월가(기준)", "월가(할인후)", "총광고료"].join(",");
    const rws = finalLines
      .map((l) =>
        [
          safeCSV(l.apt_name),
          safeCSV(l.product_name),
          safeCSV(l.months),
          safeCSV(l.baseMonthly ?? ""),
          safeCSV(l.monthlyAfter ?? ""),
          safeCSV(l.lineTotal),
        ].join(","),
      )
      .join("\n");

    const full = metaLines + "\n\n" + header + "\n" + rws;
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
          <InfoItem label="캠페인 유형" value={row.campaign_type || (row.extra?.campaign_type ?? "—")} />
          {/* 추가: 유입경로, 디바이스 */}
          <InfoItem label="유입경로" value={<SourceBadge value={row.inquiry_kind} />} />
          <InfoItem label="디바이스" value={deviceLabel} />
          <InfoItem label="담당자명(광고주)" value={row.customer_name || "—"} />
          <InfoItem label="연락처" value={row.phone || "—"} />
          <InfoItem label="이메일주소" value={row.email || "—"} />
          <InfoItem label="요청사항" value={row.memo || "—"} />

          {/* ===== 광고주 최종 확인(금액) ===== */}
          <div className="border-t border-gray-100 pt-4">
            <div className="text-sm font-medium mb-2">광고주 최종 확인(금액)</div>
            {finalLines.length === 0 ? (
              <div className="text-sm text-gray-500">스냅샷 데이터 없음</div>
            ) : (
              <div className="overflow-auto rounded-md border">
                <table className="w-full text-sm min-w-[920px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">단지명</th>
                      <th className="px-3 py-2 text-left">상품명</th>
                      <th className="px-3 py-2 text-right">월광고료(기준)</th>
                      <th className="px-3 py-2 text-right">월광고료(할인후)</th>
                      <th className="px-3 py-2 text-right">광고기간</th>
                      <th className="px-3 py-2 text-right">기준금액</th>
                      <th className="px-3 py-2 text-right">할인율</th>
                      <th className="px-3 py-2 text-right">총광고료 TOTAL</th>
                      <th className="px-3 py-2 text-right">부가세</th>
                      <th className="px-3 py-2 text-right">최종광고료(VAT포함)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalLines.map((l, i) => {
                      const baseTotal = (l.baseMonthly ?? 0) * (l.months ?? 0);
                      const rate = discountRate(l.baseMonthly, l.monthlyAfter);
                      const vat = Math.round(l.lineTotal * 0.1);
                      const grand = l.lineTotal + vat;
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{l.apt_name || "—"}</td>
                          <td className="px-3 py-2">{l.product_name || "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {l.baseMonthly != null ? fmtWon(l.baseMonthly) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {l.monthlyAfter != null ? fmtWon(l.monthlyAfter) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">{l.months?.toLocaleString?.() ?? "—"}</td>
                          <td className="px-3 py-2 text-right">{l.baseMonthly != null ? fmtWon(baseTotal) : "—"}</td>
                          <td className="px-3 py-2 text-right">{rate != null ? fmtPercent(rate) : "—"}</td>
                          <td className="px-3 py-2 text-right">{fmtWon(l.lineTotal)}</td>
                          <td className="px-3 py-2 text-right">{fmtWon(vat)}</td>
                          <td className="px-3 py-2 text-right">{fmtWon(grand)}</td>
                        </tr>
                      );
                    })}
                    {/* 합계 */}
                    <tr className="border-t bg-gray-50 font-medium">
                      <td className="px-3 py-2 text-right" colSpan={7}>
                        합계
                      </td>
                      <td className="px-3 py-2 text-right">{fmtWon(totals.total)}</td>
                      <td className="px-3 py-2 text-right">{fmtWon(totals.vat)}</td>
                      <td className="px-3 py-2 text-right">{fmtWon(totals.grand)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* ===== /추가 ===== */}
        </div>
      </div>
    </div>
  );
};

/* =========================
 *  Small Components & Utils
 * ========================= */
const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="mt-0.5 text-sm text-gray-800">{value}</div>
  </div>
);

const Th: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <th className={"px-4 py-3 text-left font-medium " + (className ?? "")}>{children}</th>
);

const Td: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <td className={"px-4 py-3 align-middle " + (className ?? "")}>{children}</td>
);

const SourceBadge: React.FC<{ value?: InquiryKind | null }> = ({ value }) => {
  if (!value)
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">—</span>
    );
  return (
    <span
      className={
        "inline-flex items-center px-2 py-0.5 text-xs rounded-full " +
        (value === "SEAT" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700")
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

function safeCSV(val: any) {
  const s = String(val ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function validToTri(v: boolean | null | undefined): ValidTri {
  if (v === true) return "valid";
  if (v === false) return "invalid";
  return "-";
}

function pillClassForStatus(v: InquiryStatus): string {
  switch (v) {
    case "new":
      return "bg-violet-50 text-violet-700";
    case "in_progress":
      return "bg-blue-50 text-blue-700";
    case "done":
      return "bg-emerald-50 text-emerald-700";
    case "canceled":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
function pillClassForValid(v: ValidTri): string {
  switch (v) {
    case "valid":
      return "bg-emerald-50 text-emerald-700";
    case "invalid":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/* ===== 추가 유틸: 디바이스 표기/포맷 ===== */
function deriveDeviceLabel(row: InquiryRow): string {
  // 1) device 필드 우선
  const raw = (row.device ?? "").toString().toLowerCase();
  if (raw) {
    if (/(mobile|mobi|phone)/.test(raw)) return "모바일";
    if (/(pc|desktop)/.test(raw)) return "PC";
  }
  // 2) meta / cart_snapshot.meta
  const meta = row.meta || (row as any)?.cart_snapshot?.meta || {};
  if (typeof meta?.isMobile === "boolean") return meta.isMobile ? "모바일" : "PC";
  const ua = String(meta?.ua ?? meta?.userAgent ?? "");
  if (ua) return /Mobile/i.test(ua) ? "모바일" : "PC";

  // 3) source_page / extra 기반 추론
  const sp = (row.source_page ?? "").toString().toLowerCase();
  if (sp.includes("/mobile")) return "모바일";
  if (sp.includes("/map") || sp.includes("/admin") || sp.includes("/desktop")) return "PC";

  const step = (row.extra?.step_ui ?? "").toString().toLowerCase();
  if (step.startsWith("mobile")) return "모바일";

  // 4) 알 수 없음
  return "—";
}
function fmtWon(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "—";
  return v.toLocaleString("ko-KR") + "원";
}
function fmtPercent(r: number | null | undefined): string {
  if (r == null || !isFinite(r)) return "—";
  return Math.round(r * 1000) / 10 + "%";
}
