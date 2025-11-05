// src/pages/admin/InquiriesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

/**
 * InquiriesPage (관리자 전용)
 * - 목록/검색/필터/페이지네이션
 * - 인라인 수정: status, valid(—/유효/무효), assignee
 * - 상세 드로어: 광고주 최종확인(금액) 스냅샷 테이블
 *
 * ⚠️ 중요: admin 세션 확인 전에는 SELECT 금지
 */

/* =========================
 *  Zod Schemas (입력 검증)
 * ========================= */
const StatusSchema = z.enum(["new", "in_progress", "done", "canceled"]);
const ValidTriSchema = z.union([z.literal("-"), z.literal("valid"), z.literal("invalid")]);

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

  cart_snapshot?: any; // 문자열/JSON 둘 다 가능

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
  const [sessionReady, setSessionReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

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

  // 세션/role 확인
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const role = (session?.user as any)?.app_metadata?.role;
      if (mounted) {
        setIsAdmin(role === "admin");
        setSessionReady(true);
      }
    };
    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const role = (session?.user as any)?.app_metadata?.role;
      setIsAdmin(role === "admin");
      setSessionReady(true);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // 목록 로드
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
          setErr(e?.message || "데이터 로드 중 오류가 발생했습니다.");
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

  // 렌더
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
                        const parsed = StatusSchema.safeParse(e.target.value);
                        if (!parsed.success) {
                          e.currentTarget.value = prev;
                          return;
                        }
                        const next = parsed.data;
                        const { error } = await (supabase as any)
                          .from(TBL.main)
                          .update({ status: next })
                          .eq("id", r.id);
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
                        const parsed = ValidTriSchema.safeParse(e.target.value);
                        if (!parsed.success) {
                          e.currentTarget.value = prev;
                          return;
                        }
                        const v = parsed.data;
                        const payload =
                          v === "-" ? { valid: null } : v === "valid" ? { valid: true } : { valid: false };
                        const { error } = await (supabase as any).from(TBL.main).update(payload).eq("id", r.id);
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
                          .update({ assignee: sanitized })
                          .eq("id", r.id);
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

  /** cart_snapshot 안전 파싱 */
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

  /* ========= 숫자 유틸 ========= */
  function toNumSmart(v: any): number | null {
    if (v == null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!s) return null;
    const cleaned = s.replace(/[^0-9.-]/g, "");
    if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const firstNum = (...args: any[]) => {
    for (const a of args) {
      const n = toNumSmart(a);
      if (n != null) return n;
    }
    return null;
  };

  // cart_snapshot 폴백 (CSV용 간단 리스트)
  const snapshotSets = useMemo(() => {
    const items = (parsedSnap as any)?.items;
    if (!Array.isArray(items)) return [];
    return items.map((it: any) => ({
      apt_name: it.apt_name ?? it.name ?? "",
      months: firstNum(it.months, it.Months) ?? null,
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

  const deviceLabel = useMemo(() => deriveDeviceLabel(row), [row]);

  /* ========= 스냅샷 → 라인 정규화 ========= */
  type FinalLine = {
    apt_name: string;
    product_name: string;
    months: number;
    baseMonthly: number | null; // 정가 월가 (표시용)
    monthlyAfter: number | null; // 할인 후 월가(참고용)
    lineTotal: number; // 총광고료(할인 후)
    baseTotal?: number | null; // 정가 총액 = baseMonthly × months (가능하면 스냅샷 값 우선)
  };

  function normalizeSnapshotItems(snap: any): FinalLine[] {
    if (!snap) return [];

    const rootMonths = firstNum(snap?.months);
    const rootTotal = firstNum(
      snap?.cartTotal,
      snap?.cart_total,
      snap?.cartTotalWon,
      snap?.cart_total_won,
      snap?.grandTotal,
      snap?.grand_total,
      snap?.totalWon,
      snap?.total_won,
      snap?.total,
    );

    const candidates: any[] =
      (Array.isArray(snap?.items) && snap.items) ||
      (Array.isArray(snap?.computedCart) && snap.computedCart) ||
      (Array.isArray(snap?.cart?.items) && snap.cart.items) ||
      [];

    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    return candidates
      .map((it: any) => {
        const apt = it.apt_name ?? it.name ?? it.aptName ?? it.apt?.name ?? "";
        const product =
          it.product_name ??
          it.productName ??
          it.mediaName ??
          it.media_name ??
          it.media ??
          it.product ??
          it.product_code ??
          "";

        // 기간
        const months = firstNum(it.months, it.Months, it.period, it.duration) ?? rootMonths ?? 0;

        // 정가 월가(표시용) 후보 — 반드시 "할인 전" 값을 채택
        let baseMonthly = firstNum(
          it.baseMonthly,
          it.base_monthly,
          it.monthlyBefore,
          it.monthly_base,
          it.basePriceMonthly,
          it.base_price_monthly,
          it.priceMonthly,
          it.unit_before,
        );

        // 총액(할인 후)
        let lineTotal = firstNum(
          it.lineTotal,
          it.line_total,
          it.total,
          it.totalCost,
          it.line_total_after_discount,
          it.item_total,
          it.itemTotal,
          it.item_total_won,
          it.total_won,
        );
        if ((lineTotal == null || lineTotal === 0) && candidates.length === 1 && rootTotal != null) {
          lineTotal = rootTotal;
        }

        // 참고용 할인 후 월가
        let monthlyAfter = firstNum(
          it.monthlyAfter,
          it.monthly_after,
          it.computedMonthly,
          it.monthly_after_discount,
          it.unit_after,
          it.finalMonthly,
          it.final_monthly,
        );
        if ((monthlyAfter == null || monthlyAfter === 0) && months > 0 && lineTotal != null && lineTotal > 0) {
          monthlyAfter = lineTotal / months;
        }

        // 정가 총액
        let baseTotal = firstNum(
          it.baseTotal,
          it.base_total,
          it.total_before,
          it.total_before_discount,
          it.line_total_before_discount,
          it.regular_total,
        );
        if ((baseTotal == null || baseTotal === 0) && baseMonthly != null && months > 0) {
          baseTotal = baseMonthly * months;
        }
        // baseMonthly가 비었고 baseTotal만 있으면 역산
        if ((baseMonthly == null || baseMonthly === 0) && baseTotal != null && months > 0) {
          baseMonthly = baseTotal / months;
        }

        return {
          apt_name: String(apt || ""),
          product_name: String(product || ""),
          months: Math.max(0, Number(months || 0)),
          baseMonthly: baseMonthly ?? null,
          monthlyAfter: monthlyAfter ?? null,
          lineTotal: Math.max(0, Number(lineTotal ?? 0)),
          baseTotal: baseTotal ?? null,
        };
      })
      .filter((l) => l.apt_name || l.product_name || l.lineTotal > 0 || l.months > 0);
  }

  const finalLines = useMemo<FinalLine[]>(() => normalizeSnapshotItems(parsedSnap), [parsedSnap]);

  // 합계
  const totals = useMemo(() => {
    const total = finalLines.reduce((acc, l) => acc + (l.lineTotal || 0), 0);
    const vat = Math.round(total * 0.1);
    return { total, vat, grand: total + vat };
  }, [finalLines]);

  // 라인별 적용율(= 총광고료 ÷ 기준금액) — 퍼센트 표기
  function appliedRatePercent(l: FinalLine): number | null {
    const baseTotal = l.baseTotal ?? (l.baseMonthly != null && l.months > 0 ? l.baseMonthly * l.months : null);
    if (baseTotal == null || baseTotal <= 0) return null;
    const rate = l.lineTotal / baseTotal; // 0.8 -> 80%
    if (!isFinite(rate) || rate <= 0) return null;
    return rate;
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

    const itemsHeader = ["단지명", "광고기간(개월)", "상품명"].join(",");
    const itemsLines = listToRender
      .map((r) => [safeCSV(r.apt_name), safeCSV(r.months ?? ""), safeCSV(r.product_name)].join(","))
      .join("\n");

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
              {row.company || "브랜드명 없음"} <SourceBadge value={row.inquiry_kind} />
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
                <table className="w-full text-sm min-w-[880px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">단지명</th>
                      <th className="px-3 py-2 text-left">상품명</th>
                      <th className="px-3 py-2 text-right">월광고료</th>
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
                      const baseTotal =
                        l.baseTotal ?? (l.baseMonthly != null && l.months > 0 ? l.baseMonthly * l.months : null);
                      const rate = appliedRatePercent(l); // 0.8 -> 80%
                      const vat = Math.round(l.lineTotal * 0.1);
                      const grand = l.lineTotal + vat;
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{l.apt_name || "—"}</td>
                          <td className="px-3 py-2">{l.product_name || "—"}</td>
                          {/* 월광고료 = 정가 월가 그대로 */}
                          <td className="px-3 py-2 text-right">
                            {l.baseMonthly != null ? fmtWon(l.baseMonthly) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">{l.months?.toLocaleString?.() ?? "—"}</td>
                          {/* 기준금액 = 월광고료 × 광고기간 */}
                          <td className="px-3 py-2 text-right">{baseTotal != null ? fmtWon(baseTotal) : "—"}</td>
                          {/* 할인율 = 총광고료 ÷ 기준금액 (퍼센트) */}
                          <td className="px-3 py-2 text-right">{rate != null ? fmtPercent(rate) : "—"}</td>
                          <td className="px-3 py-2 text-right">{fmtWon(l.lineTotal)}</td>
                          <td className="px-3 py-2 text-right">{fmtWon(vat)}</td>
                          <td className="px-3 py-2 text-right">{fmtWon(grand)}</td>
                        </tr>
                      );
                    })}
                    {/* 합계 */}
                    <tr className="border-t bg-gray-50 font-medium">
                      <td className="px-3 py-2 text-right" colSpan={6}>
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

/* ===== 디바이스 표기 ===== */
function deriveDeviceLabel(row: InquiryRow): string {
  const raw = (row.device ?? "").toString().toLowerCase();
  if (raw) {
    if (/(mobile|mobi|phone)/.test(raw)) return "모바일";
    if (/(pc|desktop)/.test(raw)) return "PC";
  }
  const meta = row.meta || (row as any)?.cart_snapshot?.meta || {};
  if (typeof meta?.isMobile === "boolean") return meta.isMobile ? "모바일" : "PC";
  const ua = String(meta?.ua ?? meta?.userAgent ?? "");
  if (ua) return /Mobile/i.test(ua) ? "모바일" : "PC";

  const sp = (row.source_page ?? "").toString().toLowerCase();
  if (sp.includes("/mobile")) return "모바일";
  if (sp.includes("/map") || sp.includes("/admin") || sp.includes("/desktop")) return "PC";

  const step = (row.extra?.step_ui ?? "").toString().toLowerCase();
  if (step.startsWith("mobile")) return "모바일";
  return "—";
}
function fmtWon(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "—";
  return v.toLocaleString() + "원";
}
function fmtPercent(r: number | null | undefined): string {
  if (r == null || !isFinite(r)) return "—";
  return Math.round(r * 1000) / 10 + "%";
}
