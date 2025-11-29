// src/components/QuoteModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import InquiryModal from "./InquiryModal";
import { DEFAULT_POLICY } from "@/core/pricing";
import type { DiscountPolicy, RangeRule } from "@/core/pricing";
import { useSubscriptionFlags } from "@/hooks/useSubscriptionFlags";
import { supabase } from "@/integrations/supabase/client";

/** HashRouter 사용 여부 (App.tsx와 동일) */
const USE_HASH = String(import.meta.env.VITE_USE_HASH_ROUTER ?? "true") === "true";

/** =========================
 *  외부에서 사용할 라인아이템 타입
 *  ========================= */
export type QuoteLineItem = {
  id: string;
  name: string; // 단지명
  months: number;
  startDate?: string;
  endDate?: string;

  mediaName?: string; // 상품명
  installLocation?: string; // 설치 위치
  households?: number;
  residents?: number;
  monthlyImpressions?: number;
  monitors?: number;
  baseMonthly?: number; // 월광고료(기준)

  productKeyHint?: keyof DiscountPolicy;
};

/** =========================
 *  할인 정책 / 유틸
 *  ========================= */

const norm = (s?: string) => (s ? s.replace(/\s+/g, "").toLowerCase() : "");

function findRate(rules: RangeRule[] | undefined, months: number): number {
  if (!rules || !Number.isFinite(months)) return 0;
  return rules.find((r) => months >= r.min && months <= r.max)?.rate ?? 0;
}

function classifyProductForPolicy(productName?: string): keyof DiscountPolicy | undefined {
  const pn = norm(productName);
  if (!pn) return undefined;

  if (
    pn.includes("townbord_l") ||
    pn.includes("townboard_l") ||
    /\btownbord[-_\s]?l\b/.test(pn) ||
    /\btownboard[-_\s]?l\b/.test(pn)
  )
    return "TOWNBORD_L";
  if (
    pn.includes("townbord_s") ||
    pn.includes("townboard_s") ||
    /\btownbord[-_\s]?s\b/.test(pn) ||
    /\btownboard[-_\s]?s\b/.test(pn)
  )
    return "TOWNBORD_S";

  if (pn.includes("elevatortv") || pn.includes("엘리베이터tv") || pn.includes("elevator")) return "ELEVATOR TV";
  if (pn.includes("mediameet") || pn.includes("media-meet") || pn.includes("미디어")) return "MEDIA MEET";
  if (pn.includes("spaceliving") || pn.includes("스페이스") || pn.includes("living")) return "SPACE LIVING";
  if (pn.includes("hipost") || pn.includes("hi-post") || pn.includes("하이포스트")) return "HI-POST";

  if (pn.includes("townbord") || pn.includes("townboard") || pn.includes("타운보드")) return "TOWNBORD_S";
  return undefined;
}

/** =========================
 *  포맷터
 *  ========================= */
const fmtWon = (n?: number) => (typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString()}원` : "—");
const fmtNum = (n?: number, unit = "") =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toLocaleString()}${unit ? unit : ""}` : "—";
const safe = (s?: string) => (s && s.trim().length > 0 ? s : "—");

/** 할인율 포맷 (카트 뱃지와 동일 규칙) */
const fmtDiscountRate = (rate?: number) => {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return "-";
  const rounded = Math.round(rate * 1000) / 10; // 소수 1자리 기준 반올림
  const text = rounded.toFixed(1).replace(/\.0$/, "");
  return `${text}%`;
};

/** =========================
 *  워터마크 유틸
 *  ========================= */
function buildWatermarkDataURL(text: string) {
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='220' height='90'>
  <style>
    @font-face { font-family: Pretendard; src: local('Pretendard'); }
    text { font-family: Pretendard, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans KR", sans-serif; }
  </style>
  <text x='0' y='18' font-size='12' fill='#6B7280' fill-opacity='0.3'>${text}</text>
  <text x='0' y='42' font-size='12' fill-opacity='0.3' fill='#6B7280'>${text}</text>
  <text x='0' y='66' font-size='12' fill-opacity='0.3' fill='#6B7280'>${text}</text>
</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** =========================
 *  CSV 유틸
 *  ========================= */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const v = String(value);
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** =========================
 *  컴포넌트 Props
 *  ========================= */
type QuoteModalProps = {
  open: boolean;
  items: QuoteLineItem[];
  vatRate?: number;
  onClose?: () => void;
  // 비구독자 구좌문의 버튼에서만 사용
  onSubmitInquiry?: (payload: { items: QuoteLineItem[]; subtotal: number; vat: number; total: number }) => void;
  title?: string;
  subtitle?: string;
};

/** =========================
 *  기본 내보내기: QuoteModal
 *  ========================= */
export default function QuoteModal({
  open,
  items,
  vatRate = 0.1,
  onClose,
  onSubmitInquiry,
  // 타이틀의 가운데 "-" 제거
  title = "응답하라 입주민이여",
  // 부제목 교체
  subtitle = "주식회사 오르카코리아 아파트 엘리베이터 광고 견적안",
}: QuoteModalProps) {
  if (typeof document === "undefined") return null;
  if (!open) return null;

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false); // (현재는 내부 InquiryModal 미사용)
  const { isSubscriber } = useSubscriptionFlags();
  const [hasSession, setHasSession] = useState(false);

  // 로그인 세션 여부 동기화
  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(!!session);
    };

    void syncSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setHasSession(!!session);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // 워터마크 스타일 (대각선, 작고 빽빽)
  const watermarkStyle = useMemo<React.CSSProperties>(() => {
    const text = "Copyright © 2025 ORKA KOREA. All rights reserved";
    return {
      position: "absolute",
      inset: 0,
      opacity: 0.16,
      transform: "rotate(-30deg) scale(1.4)",
      transformOrigin: "center",
      backgroundImage: buildWatermarkDataURL(text),
      backgroundRepeat: "repeat",
      backgroundSize: "260px 110px",
      pointerEvents: "none",
      zIndex: 5,
    };
  }, []);

  // Body 스크롤 잠금 + ESC 닫기
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const computed = useMemo(() => {
    const rows = (items ?? []).map((it) => {
      const productKey = it.productKeyHint || classifyProductForPolicy(it.mediaName);
      const rule = productKey ? DEFAULT_POLICY[productKey] : undefined;
      const periodRate = findRate(rule?.period, it.months);
      const precompRate = productKey === "ELEVATOR TV" ? findRate(rule?.precomp, it.months) : 0;

      const baseMonthly = it.baseMonthly ?? 0;
      const baseTotal = baseMonthly * it.months;
      const monthlyAfter = Math.round(baseMonthly * (1 - precompRate) * (1 - periodRate));
      const lineTotal = monthlyAfter * it.months;
      const combinedRate = 1 - (1 - precompRate) * (1 - periodRate); // 복합 할인율

      return {
        it,
        productKey,
        periodRate,
        precompRate,
        combinedRate,
        baseMonthly,
        baseTotal,
        monthlyAfter,
        lineTotal,
      };
    });

    const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);
    const vat = Math.round(subtotal * vatRate);
    const total = subtotal + vat;

    const sum = <T extends keyof QuoteLineItem>(key: T) =>
      (items ?? []).reduce((acc, cur) => {
        const v = cur[key] as unknown as number | undefined;
        return acc + (Number.isFinite(v) ? (v as number) : 0);
      }, 0);

    const totals = {
      households: sum("households"),
      residents: sum("residents"),
      monthlyImpressions: sum("monthlyImpressions"),
      monitors: sum("monitors"),
      count: items?.length ?? 0,
    };

    const baseAmountSum = rows.reduce((s, r) => s + r.baseTotal, 0);

    return { rows, subtotal, vat, total, totals, baseAmountSum };
  }, [items, vatRate]);

  // InquiryModal에 넘길 prefill 생성 (InquiryModal.pickCartTotal과 호환)
  const inquiryPrefill = useMemo(() => {
    const first = items?.[0];
    const monthsMax = Math.max(...(items.map((i) => i.months) as number[]), 0);

    const cart_snapshot = {
      months: monthsMax || undefined,
      cartTotal: computed.subtotal,
      items: (items ?? []).map((it) => {
        const productKey = it.productKeyHint || classifyProductForPolicy(it.mediaName);
        const rule = productKey ? DEFAULT_POLICY[productKey] : undefined;
        const periodRate = findRate(rule?.period, it.months);
        const precompRate = productKey === "ELEVATOR TV" ? findRate(rule?.precomp, it.months) : 0;

        const baseMonthly = it.baseMonthly ?? 0;
        const monthlyAfter = Math.round(baseMonthly * (1 - precompRate) * (1 - periodRate));
        const lineTotal = monthlyAfter * it.months;

        return {
          apt_name: it.name,
          product_name: it.mediaName,
          product_code: productKey,
          months: it.months,
          item_total_won: lineTotal,
          total_won: lineTotal,

          households: it.households ?? 0,
          residents: it.residents ?? 0,
          monthlyImpressions: it.monthlyImpressions ?? 0,
          monitors: it.monitors ?? 0,
        };
      }),
    };

    return {
      apt_id: null,
      apt_name: first?.name ?? null,
      product_code: undefined,
      product_name: first?.mediaName ?? null,
      cart_snapshot,
    };
  }, [items, computed.subtotal]);

  /** =========================
   *  계약서로 넘길 contractPrefill (옵션 B + 광고기간 + 단지 리스트)
   *  ========================= */
  const contractPrefill = useMemo(() => {
    if (!items || items.length === 0) return null;

    const first = items[0];
    const itemCount = items.length;

    const rawFirstName = first.mediaName?.trim() ?? "";
    const productNameOptionB = rawFirstName && itemCount > 1 ? `${rawFirstName} 외 ${itemCount - 1}건` : rawFirstName;

    const monthsList = items
      .map((i) => i.months)
      .filter((m) => typeof m === "number" && Number.isFinite(m) && m > 0) as number[];
    const adMonths = monthsList.length ? Math.max(...monthsList) : undefined;

    const baseAmount = computed.baseAmountSum;
    const contractAmount = computed.subtotal;
    const monitorCount = computed.totals.monitors;

    const productMap = new Map<string, string[]>();
    for (const it of items) {
      const key = (it.mediaName || "상품 미정").trim();
      const list = productMap.get(key) ?? [];
      list.push(it.name);
      productMap.set(key, list);
    }

    const contractAptLines: string[] = [];
    productMap.forEach((aptNames, prodName) => {
      const uniq = Array.from(new Set(aptNames));
      const line = `${prodName}: ${uniq.join(", ")}`;
      contractAptLines.push(line);
    });

    const limitedLines = contractAptLines.slice(0, 6);

    return {
      productName: productNameOptionB,
      baseAmount,
      contractAmount,
      monitorCount,
      contractAptLines: limitedLines,
      adMonths,
    };
  }, [items, computed.baseAmountSum, computed.subtotal, computed.totals.monitors]);

  /** 타이틀 클릭 / 계약서 버튼 → 계약서 작성 페이지를 새 창에서 열기 (HashRouter 대응) */
  const handleClickTitle = () => {
    if (!contractPrefill) return;
    if (typeof window === "undefined") return;

    // ✅ 1) 새 창 열기 전에 contractPrefill을 localStorage에 저장
    try {
      window.localStorage.setItem("orka:contractPrefill", JSON.stringify(contractPrefill));
    } catch {
      // 저장 실패해도 앱이 죽지는 않게 그냥 무시
    }

    // ✅ 2) 새 창 / 새 탭에서 계약서 페이지 열기
    const base = window.location.origin;
    const url = USE_HASH ? `${base}/#/contracts/new` : `${base}/contracts/new`;

    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) {
      win.opener = null;
    }
  };

  /** 로그인 모달 열기 이벤트 발사 */
  const handleOpenLogin = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("orca:open-login"));
  };

  /** 로그아웃 처리 */
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch {
      try {
        const key = Object.keys(localStorage).find(
          (k) => k.includes("auth-token") && k.includes("qislrfbqilfqzkvkuknn"),
        );
        if (key) localStorage.removeItem(key);
      } catch {
        // ignore
      }
    } finally {
      window.dispatchEvent(new CustomEvent("orca:plan", { detail: { plan: "free" } }));
    }
  };

  /** 견적 내보내기 핸들러: CSV(엑셀) 다운로드 (UTF-8 BOM 포함) */
  const handleExportQuote = () => {
    if (!items || items.length === 0) return;

    const headers = [
      "단지명",
      "상품명",
      "설치위치",
      "세대수",
      "거주인원",
      "모니터 수량",
      "월 송출 횟수",
      "월광고료(FMK=4주)",
      "광고기간(개월)",
      "기준금액",
      "할인율",
      "총광고료",
    ];

    const lines: string[] = [];
    lines.push(headers.map(csvEscape).join(","));

    for (const row of computed.rows) {
      const { it, combinedRate, baseMonthly, baseTotal, lineTotal } = row;

      const cells = [
        it.name ?? "",
        safe(it.mediaName),
        safe(it.installLocation),
        fmtNum(it.households, "세대"),
        fmtNum(it.residents, "명"),
        fmtNum(it.monitors, "대"),
        fmtNum(it.monthlyImpressions, "회"),
        fmtWon(baseMonthly),
        fmtNum(it.months, "개월"),
        fmtWon(baseTotal),
        fmtDiscountRate(combinedRate),
        fmtWon(lineTotal),
      ];

      lines.push(cells.map(csvEscape).join(","));
    }

    lines.push("");
    lines.push(
      ["", "", "", "", "", "", "", "", "", "소계(총광고료 합계)", "", fmtWon(computed.subtotal)]
        .map(csvEscape)
        .join(","),
    );
    lines.push(["", "", "", "", "", "", "", "", "", "부가세", "", fmtWon(computed.vat)].map(csvEscape).join(","));
    lines.push(
      ["", "", "", "", "", "", "", "", "", "최종광고료(VAT 포함)", "", fmtWon(computed.total)].map(csvEscape).join(","),
    );

    const csvContent = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `아파트엘리베이터_견적_${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999]">
        {/* 딤드 */}
        <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

        {/* 패널 컨테이너: 세로 스크롤만, 가로는 테이블에서만 */}
        <div className="absolute inset-0 flex items-start justify-center overflow-y-auto">
          <div
            ref={panelRef}
            className="relative w-full max-w-[1600px] mx-4 my-10 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 워터마크 오버레이 (대각선, 빽빽) */}
            <div aria-hidden="true" style={watermarkStyle} />

            {/* 실제 콘텐츠 래퍼 */}
            <div className="relative z-10">
              {/* 헤더 */}
              <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl">
                <div>
                  <div
                    className="text-lg font-bold text-black cursor-pointer hover:text-[#6C2DFF]"
                    onClick={handleClickTitle}
                  >
                    {title}
                  </div>
                  <div className="text-sm text-[#6B7280] mt-1">{subtitle}</div>
                </div>

                {/* 오른쪽: 로그인/로그아웃 + 닫기 버튼 */}
                <div className="flex items-center gap-2">
                  {hasSession ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="h-9 px-3 rounded-md border border-[#6C2DFF] text-xs text-[#6C2DFF] hover:bg-[#F4F0FB] whitespace-nowrap"
                    >
                      로그아웃
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenLogin}
                      className="h-9 px-3 rounded-md border border-[#6C2DFF] text-xs text-[#6C2DFF] hover:bg-[#F4F0FB] whitespace-nowrap"
                    >
                      로그인
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
                    aria-label="닫기"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                      <path d="M6 6L18 18M6 18L18 6" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 상단 카운터 + (단위) */}
              <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                <div className="text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-semibold">{`총 ${computed.totals.count}개 단지`}</span>
                  <span>
                    · 세대수 <b>{fmtNum(computed.totals.households)}</b> 세대
                  </span>
                  <span>
                    · 거주인원 <b>{fmtNum(computed.totals.residents)}</b> 명
                  </span>
                  <span>
                    · 월송출횟수 <b>{fmtNum(computed.totals.monthlyImpressions)}</b> 회
                  </span>
                  <span>
                    · 모니터수량 <b>{fmtNum(computed.totals.monitors)}</b> 대
                  </span>
                </div>
                <div className="text-xs text-[#9CA3AF] whitespace-nowrap">(단위 · 원 / VAT별도)</div>
              </div>

              {/* 테이블: 이 영역만 가로 스크롤 */}
              <div className="px-6 pb-4">
                <div className="rounded-xl border border-[#E5E7EB] overflow-x-auto">
                  <table className="w-full min-w-[1200px] text-sm">
                    <thead>
                      <tr className="bg-[#F9FAFB] text-[#111827]">
                        <Th className="text-left">단지명</Th>
                        <Th>상품명</Th>
                        <Th>설치위치</Th>
                        <Th>세대수</Th>
                        <Th>거주인원</Th>
                        <Th>모니터 수량</Th>
                        <Th>월 송출 횟수</Th>
                        <Th>월광고료(FMK=4주)</Th>
                        <Th>광고기간</Th>
                        <Th>기준금액</Th>
                        <Th>할인율</Th>
                        <Th className="!text-[#6C2DFF]">총광고료</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.rows.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-6 py-10 text-center text-[#6B7280] whitespace-nowrap">
                            담은 단지가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        computed.rows.map(({ it, combinedRate, baseMonthly, baseTotal, lineTotal }) => (
                          <tr key={it.id} className="border-t border-[#F3F4F6]">
                            <Td className="text-left font-medium text-black">{it.name}</Td>
                            <Td center>{safe(it.mediaName)}</Td>
                            <Td center>{safe(it.installLocation)}</Td>
                            <Td center>{fmtNum(it.households, "세대")}</Td>
                            <Td center>{fmtNum(it.residents, "명")}</Td>
                            <Td center>{fmtNum(it.monitors, "대")}</Td>
                            <Td center>{fmtNum(it.monthlyImpressions, "회")}</Td>
                            <Td center>{fmtWon(baseMonthly)}</Td>
                            <Td center>{fmtNum(it.months, "개월")}</Td>
                            <Td center>{fmtWon(baseTotal)}</Td>
                            <Td center>
                              {fmtDiscountRate(combinedRate) === "-" ? (
                                "-"
                              ) : (
                                <span className="inline-flex items-center rounded-md bg-[#F4F0FB] text-[#6C2DFF] text-[11px] font-semibold px-2 py-[2px] align-middle">
                                  {fmtDiscountRate(combinedRate)}할인
                                </span>
                              )}
                            </Td>

                            <Td center className="font-bold text-[#6C2DFF]">
                              {fmtWon(lineTotal)}
                            </Td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#E5E7EB]">
                        <td
                          colSpan={11}
                          className="text-right px-4 py-4 bg-[#F7F5FF] text-[#6B7280] font-medium whitespace-nowrap"
                        >
                          TOTAL
                        </td>
                        <td className="px-4 py-4 bg-[#F7F5FF] text-right font-bold text-[#6C2DFF] whitespace-nowrap">
                          {fmtWon(computed.subtotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* 부가세/최종 */}
              <div className="px-6 pb-6">
                <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F7FF] p-4">
                  <div className="flex items-center justify-between text-sm text-[#6B7280]">
                    <span>부가세</span>
                    <span className="text-black">{fmtWon(computed.vat)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[18px] text-[#6C2DFF] font-semibold">최종광고료</span>
                    <span className="text-[21px] font-bold text-[#6C2DFF] whitespace-nowrap">
                      {fmtWon(computed.total)} <span className="text-xs text-[#6B7280] font-medium">(VAT 포함)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA: 비구독자 / 구독자 분기 */}
              <div className="px-6 pb-6">
                {isSubscriber ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleExportQuote}
                      className="w-full sm:flex-1 h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95 whitespace-nowrap"
                    >
                      견적 내보내기(엑셀)
                    </button>

                    <button
                      type="button"
                      onClick={handleClickTitle}
                      disabled={!contractPrefill}
                      className="w-full sm:flex-1 h-12 rounded-xl border border-[#6C2DFF] text-[#6C2DFF] bg-white font-semibold hover:bg-[#F4F0FB] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      계약서 작성하기
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onSubmitInquiry?.({
                        items,
                        subtotal: computed.subtotal,
                        vat: computed.vat,
                        total: computed.total,
                      });
                    }}
                    className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95 whitespace-nowrap"
                  >
                    위 견적으로 구좌 (T.O.) 문의하기
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 구좌 문의 모달 (현재는 내부에서 직접 열지 않음) */}
      {inquiryOpen && (
        <InquiryModal
          open={inquiryOpen}
          onClose={() => setInquiryOpen(false)}
          prefill={inquiryPrefill as any}
          mode="SEAT"
        />
      )}
    </>,
    document.body,
  );
}

/** 헤더 셀: 가운데 정렬 + 내용과 동일한 크기(text-sm) + Bold */
function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-6 py-4 text-center text-sm font-bold border-b border-[#E5E7EB] whitespace-nowrap ${className}`}>
      {children}
    </th>
  );
}

/** 데이터 셀: 기본 가운데, 필요 시 text-left/nowrap 조합 사용 */
function Td({
  children,
  className = "",
  center,
  nowrap = true,
}: React.PropsWithChildren<{ className?: string; center?: boolean; nowrap?: boolean }>) {
  return (
    <td
      className={`px-6 py-4 align-middle text-[#111827] ${
        center ? "text-center" : ""
      } ${nowrap ? "whitespace-nowrap" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
