import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { ReceiptData } from "./types";
import { saveNodeAsPNG, saveNodeAsPDF } from "@/core/utils/capture";

// 재사용: 문의 내역 테이블 & 카운터(견적 테이블 축약판)
import QuoteMiniTable, { QuoteMiniCounters } from "@/components/quote/QuoteMiniTable";
// receipt 유틸: receipt.details.items → QuoteLineItemCompat 변환기
import { adaptQuoteItemsFromReceipt } from "@/core/utils/receipt";

/* ---------- 작은 UI 유틸 ---------- */
const Box = ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`rounded-2xl border border-[#E5E7EB] bg-white ${className}`}>{children}</div>
);

const SectionTitleBtn = ({
  open,
  onToggle,
  children,
}: React.PropsWithChildren<{ open: boolean; onToggle: () => void }>) => (
  <button type="button" onClick={onToggle} className="w-full px-5 py-4 flex items-center justify-between">
    <span className="text-[15px] md:text-base font-semibold">{children}</span>
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

const safeTxt = (s?: string | null) => (s && s.trim().length ? s : "—");

/* ---------- 본 컴포넌트 ---------- */
type Props = {
  open: boolean;
  onClose: () => void;
  data: ReceiptData;
  confirmLabel?: string;
};

function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const captureId = "receipt-capture";

  // 좌측 섹션 접기/펼치기 (저장 시 강제 펼침 지원)
  const [customerOpen, setCustomerOpen] = useState(true);
  const [seatOpen, setSeatOpen] = useState(true);
  const [forceCustomerOpen, setForceCustomerOpen] = useState(false);
  const [forceSeatOpen, setForceSeatOpen] = useState(false);

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

  // 문의 내역 아이템(견적 호환 포맷으로 변환)
  const quoteItems = useMemo(() => {
    if (!isSeat) return [];
    const raw = (data as any)?.details?.items ?? [];
    return adaptQuoteItemsFromReceipt(raw);
  }, [data, isSeat]);

  // 저장 버튼: 두 섹션 강제 펼침 후 캡처 실행
  const runWithForcedOpen = async (fn: () => void) => {
    setForceCustomerOpen(true);
    setForceSeatOpen(true);
    setCustomerOpen(true);
    setSeatOpen(true);
    await new Promise((r) => setTimeout(r, 80)); // 레이아웃 안정화
    fn();
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* 백드롭 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 패널 */}
      <div className="absolute inset-0 overflow-auto">
        <div
          ref={panelRef}
          className="relative max-w-[1200px] mx-auto my-8 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 캡처 영역 */}
          <div id={captureId} className="relative">
            {/* 헤더 */}
            <div className="px-6 py-5 border-b border-[#E5E7EB] flex items-start justify-between sticky top-0 bg-white/95 backdrop-blur rounded-t-2xl">
              <div>
                <div className="text-lg font-bold text-black">응답하라 입주민이여</div>
                <div className="text-sm text-[#6B7280] mt-1">
                  {isSeat ? "구좌(T.O) 문의 접수증" : "시·군·구/동 단위 패키지 문의 접수증"}
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

            {/* 2열 레이아웃 */}
            <div className="grid grid-cols-12 gap-6 p-6">
              {/* 좌측: 고객 문의 + 문의 내역 */}
              <div className="col-span-12 lg:col-span-8 space-y-6">
                {/* 고객 문의 */}
                <Box>
                  <SectionTitleBtn open={forceCustomerOpen || customerOpen} onToggle={() => setCustomerOpen((v) => !v)}>
                    고객 문의
                  </SectionTitleBtn>

                  <AnimatePresence initial={false}>
                    {(forceCustomerOpen || customerOpen) && (
                      <motion.div
                        key="customer-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <div className="pb-2">
                          <Row label="브랜드명" value={safeTxt(data.customer?.company)} />
                          <Row label="캠페인유형" value={safeTxt((data.customer as any)?.campaignType)} />
                          <Row label="담당자명" value={safeTxt(data.customer?.name)} />
                          <Row label="연락처" value={safeTxt((data.customer as any)?.phoneMasked)} />
                          {/* 이메일은 도메인만 노출(요청 이력 반영) */}
                          <Row label="이메일" value={safeTxt((data.customer as any)?.emailDomain)} />
                          <Row label="광고 송출 예정(희망)일" value={safeTxt((data as any)?.form?.desiredDate)} />
                          <Row label="프로모션 코드" value={safeTxt((data as any)?.form?.promotionCode)} />
                          <Row label="요청사항" value={safeTxt(data.customer?.note)} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>

                {/* 문의 내역 (SEAT 전용) */}
                {isSeat && (
                  <Box>
                    <SectionTitleBtn open={forceSeatOpen || seatOpen} onToggle={() => setSeatOpen((v) => !v)}>
                      문의 내역
                    </SectionTitleBtn>

                    <AnimatePresence initial={false}>
                      {(forceSeatOpen || seatOpen) && (
                        <motion.div
                          key="seat-body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          {/* 카운터 바 */}
                          <QuoteMiniCounters items={quoteItems} />

                          {/* 테이블: 열 순서 = 단지명/상품명/월광고료/광고기간/기준금액/할인율/총 광고료 */}
                          <div className="px-5 pb-4">
                            <QuoteMiniTable items={quoteItems} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Box>
                )}
              </div>

              {/* 우측: 다음 절차 / 저장 / 더 많은 정보 / 확인 */}
              <div className="col-span-12 lg:col-span-4 space-y-6">
                {/* 다음 절차 */}
                <Box>
                  <div className="px-5 py-4 border-b border-[#F3F4F6]">
                    <div className="text-[15px] md:text-base font-semibold">다음 절차</div>
                  </div>
                  <div className="px-5 py-4 space-y-3 text-sm">
                    <Step icon="1" title={isSeat ? "구좌(T.O) 확인 (1~2일 소요)" : "문의 내역 확인"}>
                      {isSeat
                        ? "담당자가 운영사와 구좌 현황(수량/일정)을 빠르게 확인합니다."
                        : "담당자가 문의 내용을 확인하고 범위를 정리합니다."}
                    </Step>
                    <Step icon="2" title="제안/견적 발송">
                      집행 가능 조건과 견적을 이메일/전화로 안내드립니다.
                    </Step>
                    <Step icon="3" title="집행 확정 및 진행">
                      일정 확정 후 소재 접수 → 송출 테스트 → 집행 시작.
                    </Step>
                  </div>
                </Box>

                {/* 문의 내용 저장 (보라색 버튼) */}
                <Box>
                  <div className="px-5 py-4 border-b border-[#F3F4F6]">
                    <div className="text-[15px] md:text-base font-semibold">문의 내용 저장</div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <button
                      type="button"
                      className="w-full h-10 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
                      onClick={() =>
                        runWithForcedOpen(() => {
                          const node = document.getElementById(captureId);
                          if (node) saveNodeAsPNG(node as HTMLElement, `${data.ticketCode}_receipt`);
                        })
                      }
                    >
                      이미지로 저장하기 (PNG)
                    </button>
                    <button
                      type="button"
                      className="w-full h-10 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
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
                </Box>

                {/* 더 많은 정보 (링크 좌측 정렬) */}
                <Box>
                  <div className="px-5 py-4 border-b border-[#F3F4F6]">
                    <div className="text-[15px] md:text-base font-semibold">더 많은 정보</div>
                  </div>
                  <div className="px-5 py-4 space-y-2 text-sm">
                    <a
                      href="https://www.youtube.com/@ORKA_KOREA"
                      target="_blank"
                      rel="noreferrer"
                      className="block underline text-[#111827]"
                    >
                      광고 소재 채널 바로가기
                    </a>
                    <a
                      href="https://orka.co.kr/ELAVATOR_CONTENTS"
                      target="_blank"
                      rel="noreferrer"
                      className="block underline text-[#111827]"
                    >
                      제작 가이드 바로가기
                    </a>
                    <a
                      href="https://orka.co.kr/orka_members"
                      target="_blank"
                      rel="noreferrer"
                      className="block underline text-[#111827]"
                    >
                      오르카 구성원 확인하기
                    </a>
                  </div>
                </Box>

                {/* 확인 버튼 */}
                <div className="pt-2">
                  <button
                    onClick={onClose}
                    className="w-full h-12 rounded-xl bg-[#6C2DFF] text-white font-semibold hover:opacity-95"
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* 캡처 영역 끝 */}
        </div>
      </div>
    </div>
  );
}

/* ---------- 보조 컴포넌트 ---------- */
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
export { CompleteModalDesktop };
