// src/components/complete-modal/CompleteModal.desktop.tsx
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReceiptData } from "./types";
import { saveNodeAsPNG, saveNodeAsPDF } from "@/core/utils/capture";

/* ─────────────────────────────
 *  작은 유틸
 * ───────────────────────────── */
const fmtWon = (n?: number | null) => (typeof n === "number" && isFinite(n) ? `${n.toLocaleString()}원` : "—");
const safeTxt = (s?: string | null) => (s && s.trim().length ? s : "—");

/** KST 기준 “YYYY. MM. DD. 오후 HH:MM KST” */
function fmtKST(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const ko = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    // 2025. 10. 31. 오후 7:05 → 2025. 10. 31. 오후 07:05 KST
    const withPad = ko.replace(/(\s)(\d:)/, (_m, sp, h) => `${sp}0${h}`);
    return `${withPad} KST`;
  } catch {
    return "—";
  }
}

/* ─────────────────────────────
 *  레이아웃 공통 컴포넌트
 * ───────────────────────────── */
const Card = ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`rounded-2xl border border-[#E5E7EB] bg-white ${className}`}>{children}</div>
);

const SectionHeaderBtn = ({ open, onToggle, title }: { open: boolean; onToggle: () => void; title: string }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full px-5 py-4 flex items-center justify-between"
    aria-expanded={open}
  >
    <span className="text-[15px] md:text-base font-semibold">{title}</span>
    <svg width="18" height="18" viewBox="0 0 24 24" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  </button>
);

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div className="grid grid-cols-[140px_1fr] gap-3 px-5 py-3 border-t border-[#F3F4F6] text-sm">
    <div className="text-[#6B7280]">{label}</div>
    <div className="text-[#111827] break-words">{value ?? "—"}</div>
  </div>
);

function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-6 py-3 text-center text-sm font-bold border-b border-[#E5E7EB] ${className}`}>{children}</th>
  );
}
function Td({
  children,
  className = "",
  center,
  nowrap,
}: React.PropsWithChildren<{ className?: string; center?: boolean; nowrap?: boolean }>) {
  return (
    <td
      className={`px-6 py-3 align-middle text-[#111827] ${center ? "text-center" : ""} ${
        nowrap ? "whitespace-nowrap" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/* ─────────────────────────────
 *  Seat 아이템 정규화/계산
 * ───────────────────────────── */
type SeatItemLike = {
  aptName?: string | null;
  productName?: string | null;
  months?: number | null;
  baseMonthly?: number | null; // 정가(월)
  monthlyAfter?: number | null; // 실제청구(월)
  lineTotal?: number | null; // 총액
  monitors?: number | null;
  households?: number | null;
  residents?: number | null;
  monthlyImpressions?: number | null;
  [k: string]: any;
};

function nOrNull(v: any): number | null {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function normalizeItem(raw: any): Required<SeatItemLike> {
  const aptName = raw?.aptName ?? raw?.apt_name ?? raw?.name ?? "-";
  const productName = raw?.productName ?? raw?.product_name ?? raw?.mediaName ?? raw?.product_code ?? "-";
  const months = nOrNull(raw?.months ?? raw?.month);

  const baseMonthly = nOrNull(raw?.baseMonthly ?? raw?.base_monthly ?? raw?.priceMonthly);
  const monthlyAfter = nOrNull(raw?.monthlyAfter ?? raw?.monthly_after ?? raw?.priceMonthlyAfter);
  let lineTotal = nOrNull(raw?.lineTotal ?? raw?.item_total_won ?? raw?.total_won) ?? null;
  if (lineTotal == null && months && (monthlyAfter ?? baseMonthly)) {
    lineTotal = Math.round((monthlyAfter ?? (baseMonthly as number)) * (months as number));
  }

  const monitors = nOrNull(raw?.monitors ?? raw?.monitorCount ?? raw?.monitor_count ?? raw?.screens);
  const households = nOrNull(raw?.households);
  const residents = nOrNull(raw?.residents);
  const monthlyImpressions = nOrNull(raw?.monthlyImpressions);

  return {
    aptName,
    productName,
    months,
    baseMonthly,
    monthlyAfter,
    lineTotal,
    monitors,
    households,
    residents,
    monthlyImpressions,
  };
}

function sum(items: SeatItemLike[], key: keyof SeatItemLike) {
  return items.reduce((acc, it) => {
    const v = Number((it as any)[key]);
    return acc + (isFinite(v) ? v : 0);
  }, 0);
}

/* ─────────────────────────────
 *  메인 컴포넌트
 * ───────────────────────────── */
export function CompleteModalDesktop({
  open,
  onClose,
  data,
  confirmLabel = "확인",
}: {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  confirmLabel?: string;
}) {
  const [customerOpen, setCustomerOpen] = useState(true);
  const [seatOpen, setSeatOpen] = useState(true);
  const [forceCustomerOpen, setForceCustomerOpen] = useState(false);
  const [forceSeatOpen, setForceSeatOpen] = useState(false);

  // 좌측(고객문의+문의내역) 컨텐츠만 캡처
  const captureId = "receipt-capture";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isSeat = data.mode === "SEAT";

  // Seat rows & counters
  const seatRows: SeatItemLike[] = useMemo(() => {
    if (!isSeat) return [];
    const raw = (data.details as any)?.items ?? [];
    return (Array.isArray(raw) ? raw : []).map(normalizeItem);
  }, [data, isSeat]);

  const counters = useMemo(() => {
    const count = seatRows.length;
    const households = sum(seatRows, "households");
    const residents = sum(seatRows, "residents");
    const monthlyImpressions = sum(seatRows, "monthlyImpressions");
    const monitors = sum(seatRows, "monitors");
    return { count, households, residents, monthlyImpressions, monitors };
  }, [seatRows]);

  const seatTotal = useMemo(() => sum(seatRows, "lineTotal"), [seatRows]);

  // 저장 시 두 섹션 강제 펼침 후 캡처
  const runWithForcedOpen = async (fn: () => void) => {
    const prevCustomer = customerOpen;
    const prevSeat = seatOpen;
    setForceCustomerOpen(true);
    setForceSeatOpen(true);
    setCustomerOpen(true);
    setSeatOpen(true);
    await new Promise((r) => setTimeout(r, 80));
    fn();
    // 원복
    setForceCustomerOpen(false);
    setForceSeatOpen(false);
    setCustomerOpen(prevCustomer);
    setSeatOpen(prevSeat);
  };

  // 할인율(%) 계산: baseMonthly 대비 monthlyAfter
  const percent = (after?: number | null, base?: number | null) => {
    if (!(after && base && base > 0)) return "—";
    const rate = 1 - after / base;
    const p = Math.round(rate * 100);
    return `${p}%`;
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute inset-0 overflow-auto">
        <div className="relative max-w-[1200px] mx-auto my-8 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] overflow-hidden">
          {/* Header (예전 스타일) */}
          <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-[2px] h-7 w-7 rounded-full bg-[#EDE9FE] flex items-center justify-center">
                {/* check icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#EDE9FE" />
                  <path
                    d="M7 12.5l3.2 3.2L17 9"
                    stroke="#6C2DFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-black">문의가 접수됐어요!</div>
                <div className="text-sm text-[#6B7280] mt-1">
                  접수번호 {data.ticketCode} · {fmtKST(data.createdAtISO)}
                </div>
              </div>
            </div>

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

          {/* Body 2열 (예전 레이아웃) */}
          <div className="grid grid-cols-12 gap-6 p-6">
            {/* LEFT: 고객 문의 + 문의 내역 (캡처 타겟) */}
            <div id="receipt-capture" className="col-span-12 lg:col-span-8 space-y-6">
              {/* 고객 문의 */}
              <Card>
                <SectionHeaderBtn
                  open={forceCustomerOpen || customerOpen}
                  onToggle={() => setCustomerOpen((v) => !v)}
                  title="고객 문의"
                />
                <AnimatePresence initial={false}>
                  {(forceCustomerOpen || customerOpen) && (
                    <motion.div
                      key="customer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-2">
                        <Row label="상호명" value={safeTxt(data.customer?.company)} />
                        <Row label="담당자" value={safeTxt(data.customer?.name)} />
                        <Row label="연락처" value={safeTxt((data.customer as any)?.phoneMasked)} />
                        <Row label="이메일" value={safeTxt((data.customer as any)?.emailDomain)} />
                        <Row label="캠페인 유형" value={safeTxt((data.customer as any)?.campaignType)} />
                        <Row label="광고 송출 예정(희망)일" value={safeTxt((data as any)?.form?.desiredDate)} />
                        <Row label="프로모션코드" value={safeTxt((data as any)?.form?.promotionCode)} />
                        <Row label="문의내용" value={safeTxt(data.customer?.note)} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* 문의 내역 (SEAT 전용) */}
              {isSeat && (
                <Card>
                  <SectionHeaderBtn
                    open={forceSeatOpen || seatOpen}
                    onToggle={() => setSeatOpen((v) => !v)}
                    title="문의 내역"
                  />
                  <AnimatePresence initial={false}>
                    {(forceSeatOpen || seatOpen) && (
                      <motion.div
                        key="seat"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        {/* 카운터 바 */}
                        <div className="px-5 pt-1 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
                          <span className="font-medium">{`총 ${counters.count}개 단지`}</span>
                          {counters.households > 0 && (
                            <span>
                              · 세대수 <b>{counters.households.toLocaleString()}</b> 세대
                            </span>
                          )}
                          {counters.residents > 0 && (
                            <span>
                              · 거주인원 <b>{counters.residents.toLocaleString()}</b> 명
                            </span>
                          )}
                          {counters.monthlyImpressions > 0 && (
                            <span>
                              · 송출횟수 <b>{counters.monthlyImpressions.toLocaleString()}</b> 회
                            </span>
                          )}
                          {counters.monitors > 0 && (
                            <span>
                              · 모니터수량 <b>{counters.monitors.toLocaleString()}</b> 대
                            </span>
                          )}
                        </div>

                        {/* 테이블 (요청한 컬럼 순서) */}
                        <div className="px-5 pb-4">
                          <div className="rounded-xl border border-[#E5E7EB] overflow-x-auto">
                            <table className="w-full min-w-[820px] text-sm whitespace-nowrap">
                              <thead>
                                <tr className="bg-[#F9FAFB] text-[#111827]">
                                  <Th className="text-left">단지명</Th>
                                  <Th>상품명</Th>
                                  <Th>월광고료</Th>
                                  <Th>광고기간</Th>
                                  <Th>기준금액</Th>
                                  <Th>할인율</Th>
                                  <Th className="!text-[#6C2DFF]">총 광고료</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {seatRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-[#6B7280]">
                                      문의 내역이 없습니다.
                                    </td>
                                  </tr>
                                ) : (
                                  seatRows.map((it, idx) => {
                                    const monthly = it.monthlyAfter ?? it.baseMonthly ?? null;
                                    const baseTotal =
                                      it.baseMonthly && it.months
                                        ? Math.round((it.baseMonthly as number) * (it.months as number))
                                        : null;
                                    return (
                                      <tr key={idx} className="border-t border-[#F3F4F6]">
                                        <Td className="text-left font-medium text-black">{safeTxt(it.aptName)}</Td>
                                        <Td center>{safeTxt(it.productName)}</Td>
                                        <Td center>{fmtWon(monthly)}</Td>
                                        <Td center>{it.months ? `${it.months}개월` : "—"}</Td>
                                        <Td center>{fmtWon(baseTotal)}</Td>
                                        <Td center>{percent(it.monthlyAfter, it.baseMonthly)}</Td>
                                        <Td center className="font-bold text-[#6C2DFF]">
                                          {fmtWon(it.lineTotal)}
                                        </Td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-[#E5E7EB]">
                                  <td
                                    colSpan={6}
                                    className="text-right px-4 py-4 bg-[#F7F5FF] text-[#6B7280] font-medium"
                                  >
                                    TOTAL
                                  </td>
                                  <td className="px-4 py-4 bg-[#F7F5FF] text-right font-bold text-[#6C2DFF]">
                                    {fmtWon(seatTotal)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}
            </div>

            {/* RIGHT: 다음 절차 + 더 많은 정보 */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* 다음 절차 + 저장 버튼 (보라색) */}
              <Card>
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="text-[15px] md:text-base font-semibold">다음 절차</div>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <Step icon="1" title={isSeat ? "구좌(T.O) 확인 (1~2일 소요)" : "문의 내용 확인 (1~2일)"}>
                    {isSeat
                      ? "담당자가 운영사와 구좌 현황(수량/일정)을 빠르게 확인합니다."
                      : "담당자가 문의 내용을 확인하고 범위를 정리합니다."}
                  </Step>
                  <Step icon="2" title="맞춤 견적 전달 (이메일,전화)">
                    집행 가능 조건과 견적을 이메일/전화로 안내드립니다.
                  </Step>
                  <Step icon="3" title="상담/계약 (전자 계약)">
                    일정 확정 후 소재 접수 → 송출 테스트 → 집행 시작.
                  </Step>
                </div>

                <div className="px-5 pb-5">
                  <button
                    type="button"
                    className="w-full h-11 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
                    onClick={() =>
                      runWithForcedOpen(() => {
                        const node = document.getElementById(captureId);
                        if (node) saveNodeAsPNG(node as HTMLElement, `${data.ticketCode}_receipt`);
                      })
                    }
                  >
                    문의 내용 저장
                  </button>
                </div>
              </Card>

              {/* 더 많은 정보 */}
              <Card>
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="text-[15px] md:text-base font-semibold">더 많은 정보</div>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <a
                    href="https://www.youtube.com/@ORKA_KOREA"
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[#E5E7EB] px-4 py-3 hover:bg-[#F9FAFB]"
                  >
                    광고 소재 채널 바로가기
                  </a>
                  <a
                    href="https://orka.co.kr/ELAVATOR_CONTENTS"
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[#E5E7EB] px-4 py-3 hover:bg-[#F9FAFB]"
                  >
                    제작 가이드 바로가기
                  </a>
                  <a
                    href="https://orka.co.kr/orka_members"
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[#E5E7EB] px-4 py-3 hover:bg-[#F9FAFB]"
                  >
                    오르카 구성원 확인하기
                  </a>
                </div>
              </Card>

              {/* 확인 버튼 */}
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
                >
                  {confirmLabel}
                </button>
                <div className="mt-3 text-center">
                  <button
                    className="h-10 px-4 rounded-xl border border-[#E5E7EB] text-sm hover:bg-[#F9FAFB]"
                    onClick={() =>
                      runWithForcedOpen(() => {
                        const node = document.getElementById(captureId);
                        if (node) saveNodeAsPDF(node as HTMLElement, `${data.ticketCode}_receipt`);
                      })
                    }
                  >
                    PDF로 저장하기
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* /Body */}
        </div>
      </div>
    </div>
  );
}

/* 보조: Step 아이템 */
function Step({ icon, title, children }: React.PropsWithChildren<{ icon: string; title: string }>) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-6 w-6 rounded-full border border-[#E5E7EB] flex items-center justify-center text-xs text-[#6B7280]">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-[#111827]">{title}</div>
        <div className="text-[#6B7280]">{children}</div>
      </div>
    </div>
  );
}

export default CompleteModalDesktop;
// src/components/complete-modal/CompleteModal.desktop.tsx
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReceiptData } from "./types";
import { saveNodeAsPNG, saveNodeAsPDF } from "@/core/utils/capture";

/* ─────────────────────────────
 *  작은 유틸
 * ───────────────────────────── */
const fmtWon = (n?: number | null) => (typeof n === "number" && isFinite(n) ? `${n.toLocaleString()}원` : "—");
const safeTxt = (s?: string | null) => (s && s.trim().length ? s : "—");

/** KST 기준 “YYYY. MM. DD. 오후 HH:MM KST” */
function fmtKST(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const ko = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    // 2025. 10. 31. 오후 7:05 → 2025. 10. 31. 오후 07:05 KST
    const withPad = ko.replace(/(\s)(\d:)/, (_m, sp, h) => `${sp}0${h}`);
    return `${withPad} KST`;
  } catch {
    return "—";
  }
}

/* ─────────────────────────────
 *  레이아웃 공통 컴포넌트
 * ───────────────────────────── */
const Card = ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`rounded-2xl border border-[#E5E7EB] bg-white ${className}`}>{children}</div>
);

const SectionHeaderBtn = ({ open, onToggle, title }: { open: boolean; onToggle: () => void; title: string }) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full px-5 py-4 flex items-center justify-between"
    aria-expanded={open}
  >
    <span className="text-[15px] md:text-base font-semibold">{title}</span>
    <svg width="18" height="18" viewBox="0 0 24 24" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" stroke="#111827" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  </button>
);

const Row = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div className="grid grid-cols-[140px_1fr] gap-3 px-5 py-3 border-t border-[#F3F4F6] text-sm">
    <div className="text-[#6B7280]">{label}</div>
    <div className="text-[#111827] break-words">{value ?? "—"}</div>
  </div>
);

function Th({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <th className={`px-6 py-3 text-center text-sm font-bold border-b border-[#E5E7EB] ${className}`}>{children}</th>
  );
}
function Td({
  children,
  className = "",
  center,
  nowrap,
}: React.PropsWithChildren<{ className?: string; center?: boolean; nowrap?: boolean }>) {
  return (
    <td
      className={`px-6 py-3 align-middle text-[#111827] ${center ? "text-center" : ""} ${
        nowrap ? "whitespace-nowrap" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

/* ─────────────────────────────
 *  Seat 아이템 정규화/계산
 * ───────────────────────────── */
type SeatItemLike = {
  aptName?: string | null;
  productName?: string | null;
  months?: number | null;
  baseMonthly?: number | null; // 정가(월)
  monthlyAfter?: number | null; // 실제청구(월)
  lineTotal?: number | null; // 총액
  monitors?: number | null;
  households?: number | null;
  residents?: number | null;
  monthlyImpressions?: number | null;
  [k: string]: any;
};

function nOrNull(v: any): number | null {
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function normalizeItem(raw: any): Required<SeatItemLike> {
  const aptName = raw?.aptName ?? raw?.apt_name ?? raw?.name ?? "-";
  const productName = raw?.productName ?? raw?.product_name ?? raw?.mediaName ?? raw?.product_code ?? "-";
  const months = nOrNull(raw?.months ?? raw?.month);

  const baseMonthly = nOrNull(raw?.baseMonthly ?? raw?.base_monthly ?? raw?.priceMonthly);
  const monthlyAfter = nOrNull(raw?.monthlyAfter ?? raw?.monthly_after ?? raw?.priceMonthlyAfter);
  let lineTotal = nOrNull(raw?.lineTotal ?? raw?.item_total_won ?? raw?.total_won) ?? null;
  if (lineTotal == null && months && (monthlyAfter ?? baseMonthly)) {
    lineTotal = Math.round((monthlyAfter ?? (baseMonthly as number)) * (months as number));
  }

  const monitors = nOrNull(raw?.monitors ?? raw?.monitorCount ?? raw?.monitor_count ?? raw?.screens);
  const households = nOrNull(raw?.households);
  const residents = nOrNull(raw?.residents);
  const monthlyImpressions = nOrNull(raw?.monthlyImpressions);

  return {
    aptName,
    productName,
    months,
    baseMonthly,
    monthlyAfter,
    lineTotal,
    monitors,
    households,
    residents,
    monthlyImpressions,
  };
}

function sum(items: SeatItemLike[], key: keyof SeatItemLike) {
  return items.reduce((acc, it) => {
    const v = Number((it as any)[key]);
    return acc + (isFinite(v) ? v : 0);
  }, 0);
}

/* ─────────────────────────────
 *  메인 컴포넌트
 * ───────────────────────────── */
export function CompleteModalDesktop({
  open,
  onClose,
  data,
  confirmLabel = "확인",
}: {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  confirmLabel?: string;
}) {
  const [customerOpen, setCustomerOpen] = useState(true);
  const [seatOpen, setSeatOpen] = useState(true);
  const [forceCustomerOpen, setForceCustomerOpen] = useState(false);
  const [forceSeatOpen, setForceSeatOpen] = useState(false);

  // 좌측(고객문의+문의내역) 컨텐츠만 캡처
  const captureId = "receipt-capture";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const isSeat = data.mode === "SEAT";

  // Seat rows & counters
  const seatRows: SeatItemLike[] = useMemo(() => {
    if (!isSeat) return [];
    const raw = (data.details as any)?.items ?? [];
    return (Array.isArray(raw) ? raw : []).map(normalizeItem);
  }, [data, isSeat]);

  const counters = useMemo(() => {
    const count = seatRows.length;
    const households = sum(seatRows, "households");
    const residents = sum(seatRows, "residents");
    const monthlyImpressions = sum(seatRows, "monthlyImpressions");
    const monitors = sum(seatRows, "monitors");
    return { count, households, residents, monthlyImpressions, monitors };
  }, [seatRows]);

  const seatTotal = useMemo(() => sum(seatRows, "lineTotal"), [seatRows]);

  // 저장 시 두 섹션 강제 펼침 후 캡처
  const runWithForcedOpen = async (fn: () => void) => {
    const prevCustomer = customerOpen;
    const prevSeat = seatOpen;
    setForceCustomerOpen(true);
    setForceSeatOpen(true);
    setCustomerOpen(true);
    setSeatOpen(true);
    await new Promise((r) => setTimeout(r, 80));
    fn();
    // 원복
    setForceCustomerOpen(false);
    setForceSeatOpen(false);
    setCustomerOpen(prevCustomer);
    setSeatOpen(prevSeat);
  };

  // 할인율(%) 계산: baseMonthly 대비 monthlyAfter
  const percent = (after?: number | null, base?: number | null) => {
    if (!(after && base && base > 0)) return "—";
    const rate = 1 - after / base;
    const p = Math.round(rate * 100);
    return `${p}%`;
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute inset-0 overflow-auto">
        <div className="relative max-w-[1200px] mx-auto my-8 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] overflow-hidden">
          {/* Header (예전 스타일) */}
          <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl">
            <div className="flex items-start gap-3">
              <div className="mt-[2px] h-7 w-7 rounded-full bg-[#EDE9FE] flex items-center justify-center">
                {/* check icon */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#EDE9FE" />
                  <path
                    d="M7 12.5l3.2 3.2L17 9"
                    stroke="#6C2DFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-black">문의가 접수됐어요!</div>
                <div className="text-sm text-[#6B7280] mt-1">
                  접수번호 {data.ticketCode} · {fmtKST(data.createdAtISO)}
                </div>
              </div>
            </div>

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

          {/* Body 2열 (예전 레이아웃) */}
          <div className="grid grid-cols-12 gap-6 p-6">
            {/* LEFT: 고객 문의 + 문의 내역 (캡처 타겟) */}
            <div id="receipt-capture" className="col-span-12 lg:col-span-8 space-y-6">
              {/* 고객 문의 */}
              <Card>
                <SectionHeaderBtn
                  open={forceCustomerOpen || customerOpen}
                  onToggle={() => setCustomerOpen((v) => !v)}
                  title="고객 문의"
                />
                <AnimatePresence initial={false}>
                  {(forceCustomerOpen || customerOpen) && (
                    <motion.div
                      key="customer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="pb-2">
                        <Row label="상호명" value={safeTxt(data.customer?.company)} />
                        <Row label="담당자" value={safeTxt(data.customer?.name)} />
                        <Row label="연락처" value={safeTxt((data.customer as any)?.phoneMasked)} />
                        <Row label="이메일" value={safeTxt((data.customer as any)?.emailDomain)} />
                        <Row label="캠페인 유형" value={safeTxt((data.customer as any)?.campaignType)} />
                        <Row label="광고 송출 예정(희망)일" value={safeTxt((data as any)?.form?.desiredDate)} />
                        <Row label="프로모션코드" value={safeTxt((data as any)?.form?.promotionCode)} />
                        <Row label="문의내용" value={safeTxt(data.customer?.note)} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>

              {/* 문의 내역 (SEAT 전용) */}
              {isSeat && (
                <Card>
                  <SectionHeaderBtn
                    open={forceSeatOpen || seatOpen}
                    onToggle={() => setSeatOpen((v) => !v)}
                    title="문의 내역"
                  />
                  <AnimatePresence initial={false}>
                    {(forceSeatOpen || seatOpen) && (
                      <motion.div
                        key="seat"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        {/* 카운터 바 */}
                        <div className="px-5 pt-1 pb-2 text-sm text-[#4B5563] flex flex-wrap gap-x-4 gap-y-1">
                          <span className="font-medium">{`총 ${counters.count}개 단지`}</span>
                          {counters.households > 0 && (
                            <span>
                              · 세대수 <b>{counters.households.toLocaleString()}</b> 세대
                            </span>
                          )}
                          {counters.residents > 0 && (
                            <span>
                              · 거주인원 <b>{counters.residents.toLocaleString()}</b> 명
                            </span>
                          )}
                          {counters.monthlyImpressions > 0 && (
                            <span>
                              · 송출횟수 <b>{counters.monthlyImpressions.toLocaleString()}</b> 회
                            </span>
                          )}
                          {counters.monitors > 0 && (
                            <span>
                              · 모니터수량 <b>{counters.monitors.toLocaleString()}</b> 대
                            </span>
                          )}
                        </div>

                        {/* 테이블 (요청한 컬럼 순서) */}
                        <div className="px-5 pb-4">
                          <div className="rounded-xl border border-[#E5E7EB] overflow-x-auto">
                            <table className="w-full min-w-[820px] text-sm whitespace-nowrap">
                              <thead>
                                <tr className="bg-[#F9FAFB] text-[#111827]">
                                  <Th className="text-left">단지명</Th>
                                  <Th>상품명</Th>
                                  <Th>월광고료</Th>
                                  <Th>광고기간</Th>
                                  <Th>기준금액</Th>
                                  <Th>할인율</Th>
                                  <Th className="!text-[#6C2DFF]">총 광고료</Th>
                                </tr>
                              </thead>
                              <tbody>
                                {seatRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-[#6B7280]">
                                      문의 내역이 없습니다.
                                    </td>
                                  </tr>
                                ) : (
                                  seatRows.map((it, idx) => {
                                    const monthly = it.monthlyAfter ?? it.baseMonthly ?? null;
                                    const baseTotal =
                                      it.baseMonthly && it.months
                                        ? Math.round((it.baseMonthly as number) * (it.months as number))
                                        : null;
                                    return (
                                      <tr key={idx} className="border-t border-[#F3F4F6]">
                                        <Td className="text-left font-medium text-black">{safeTxt(it.aptName)}</Td>
                                        <Td center>{safeTxt(it.productName)}</Td>
                                        <Td center>{fmtWon(monthly)}</Td>
                                        <Td center>{it.months ? `${it.months}개월` : "—"}</Td>
                                        <Td center>{fmtWon(baseTotal)}</Td>
                                        <Td center>{percent(it.monthlyAfter, it.baseMonthly)}</Td>
                                        <Td center className="font-bold text-[#6C2DFF]">
                                          {fmtWon(it.lineTotal)}
                                        </Td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-[#E5E7EB]">
                                  <td
                                    colSpan={6}
                                    className="text-right px-4 py-4 bg-[#F7F5FF] text-[#6B7280] font-medium"
                                  >
                                    TOTAL
                                  </td>
                                  <td className="px-4 py-4 bg-[#F7F5FF] text-right font-bold text-[#6C2DFF]">
                                    {fmtWon(seatTotal)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              )}
            </div>

            {/* RIGHT: 다음 절차 + 더 많은 정보 */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* 다음 절차 + 저장 버튼 (보라색) */}
              <Card>
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="text-[15px] md:text-base font-semibold">다음 절차</div>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <Step icon="1" title={isSeat ? "구좌(T.O) 확인 (1~2일 소요)" : "문의 내용 확인 (1~2일)"}>
                    {isSeat
                      ? "담당자가 운영사와 구좌 현황(수량/일정)을 빠르게 확인합니다."
                      : "담당자가 문의 내용을 확인하고 범위를 정리합니다."}
                  </Step>
                  <Step icon="2" title="맞춤 견적 전달 (이메일,전화)">
                    집행 가능 조건과 견적을 이메일/전화로 안내드립니다.
                  </Step>
                  <Step icon="3" title="상담/계약 (전자 계약)">
                    일정 확정 후 소재 접수 → 송출 테스트 → 집행 시작.
                  </Step>
                </div>

                <div className="px-5 pb-5">
                  <button
                    type="button"
                    className="w-full h-11 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
                    onClick={() =>
                      runWithForcedOpen(() => {
                        const node = document.getElementById(captureId);
                        if (node) saveNodeAsPNG(node as HTMLElement, `${data.ticketCode}_receipt`);
                      })
                    }
                  >
                    문의 내용 저장
                  </button>
                </div>
              </Card>

              {/* 더 많은 정보 */}
              <Card>
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="text-[15px] md:text-base font-semibold">더 많은 정보</div>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm">
                  <a
                    href="https://www.youtube.com/@ORKA_KOREA"
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[#E5E7EB] px-4 py-3 hover:bg-[#F9FAFB]"
                  >
                    광고 소재 채널 바로가기
                  </a>
                  <a
                    href="https://orka.co.kr/ELAVATOR_CONTENTS"
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[#E5E7EB] px-4 py-3 hover:bg-[#F9FAFB]"
                  >
                    제작 가이드 바로가기
                  </a>
                  <a
                    href="https://orka.co.kr/orka_members"
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-[#E5E7EB] px-4 py-3 hover:bg-[#F9FAFB]"
                  >
                    오르카 구성원 확인하기
                  </a>
                </div>
              </Card>

              {/* 확인 버튼 */}
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
                >
                  {confirmLabel}
                </button>
                <div className="mt-3 text-center">
                  <button
                    className="h-10 px-4 rounded-xl border border-[#E5E7EB] text-sm hover:bg-[#F9FAFB]"
                    onClick={() =>
                      runWithForcedOpen(() => {
                        const node = document.getElementById(captureId);
                        if (node) saveNodeAsPDF(node as HTMLElement, `${data.ticketCode}_receipt`);
                      })
                    }
                  >
                    PDF로 저장하기
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* /Body */}
        </div>
      </div>
    </div>
  );
}

/* 보조: Step 아이템 */
function Step({ icon, title, children }: React.PropsWithChildren<{ icon: string; title: string }>) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-6 w-6 rounded-full border border-[#E5E7EB] flex items-center justify-center text-xs text-[#6B7280]">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-[#111827]">{title}</div>
        <div className="text-[#6B7280]">{children}</div>
      </div>
    </div>
  );
}

export default CompleteModalDesktop;
