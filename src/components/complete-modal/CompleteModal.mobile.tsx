import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileDown,
  FileText,
  Mail,
  ExternalLink,
  CalendarCheck2,
  MessageSquare,
  Phone,
  Link as LinkIcon,
  X,
} from "lucide-react";
import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";

/* =========================================================================
 * 스타일 상수
 * ========================================================================= */
const BRAND = "#6F4BF2"; // COLOR_PRIMARY
const BRAND_LIGHT = "#EEE8FF";
const CARD_BG = "#F4F6FA";

/* =========================================================================
 * 유틸
 * ========================================================================= */
function formatKRW(n?: number | null) {
  if (n == null || !isFinite(Number(n))) return "-";
  return "₩" + Number(n).toLocaleString("ko-KR");
}

function formatKST(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const f = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return f.format(d) + " KST";
  } catch {
    return "";
  }
}

/** 모바일 바텀시트 열렸을 때 바디 스크롤 잠금 */
function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/* =========================================================================
 * 서브 컴포넌트
 * ========================================================================= */

function HeaderSuccess({ ticketCode, createdAtISO }: { ticketCode: string; createdAtISO: string }) {
  const kst = useMemo(() => formatKST(createdAtISO), [createdAtISO]);
  return (
    <div className="px-5 pt-4 pb-2 text-center">
      {/* 성공 아이콘 (간단 애니메이션) */}
      <motion.div
        className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_LIGHT }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <CheckCircle2 size={28} color={BRAND} />
      </motion.div>

      <h2 className="text-lg font-semibold">문의가 접수됐어요!</h2>

      <p className="mt-1 text-sm text-gray-500">
        접수번호 {ticketCode} · {kst}
      </p>

      <p className="mt-3 text-sm">
        해당 지역 담당자가 <b>1–2일 이내</b> 연락드릴 예정입니다.
        <br />
        담아주신 조건을 기준으로 <b>재고·할인</b>을 확인 중이에요.
      </p>
    </div>
  );
}

function SummaryCard({ data }: { data: ReceiptData }) {
  // 공통 고객 요약
  const customerLine = useMemo(() => {
    const c = data.customer || {};
    const parts: string[] = [];
    if (c.company) parts.push(c.company);
    if (c.name) parts.push(c.name);
    if (c.phoneMasked) parts.push(c.phoneMasked);
    if (c.emailDomain) parts.push(c.emailDomain);
    return parts.join(" · ");
  }, [data.customer]);

  // 장바구니/범위 요약
  const cartLine = useMemo(() => {
    if (isSeatReceipt(data)) {
      const s = (data as ReceiptSeat).summary;
      const left = `담은 단지 ${s.aptCount}곳`;
      const right = typeof s.monthlyTotalKRW === "number" ? `예상 월액 ${formatKRW(s.monthlyTotalKRW)}` : undefined;
      return right ? `${left} · ${right}` : left;
    }
    if (isPackageReceipt(data)) {
      const p = (data as ReceiptPackage).summary;
      const left = p.scopeLabel || "영역 선택";
      const mid = p.areaCount ? ` · ${p.areaCount}개 영역` : "";
      const tail = p.budgetRangeText ? ` · ${p.budgetRangeText}` : "";
      return `${left}${mid}${tail}`;
    }
    return "";
  }, [data]);

  return (
    <div className="px-5">
      <div className="rounded-xl p-4" style={{ background: CARD_BG }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-gray-500">고객 · 문의 요약</p>
            <p className="mt-0.5 truncate text-sm font-medium">{customerLine || "-"}</p>
            <p className="mt-0.5 truncate text-sm text-gray-700">{cartLine || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeatDetails({ data }: { data: ReceiptSeat }) {
  const { items } = data.details || { items: [] };

  return (
    <div className="divide-y divide-gray-100">
      {/* 헤더 */}
      <div className="grid grid-cols-7 gap-2 px-3 py-2 text-[11px] text-gray-500">
        <div className="col-span-2">단지명</div>
        <div>상품</div>
        <div className="text-right">개월</div>
        <div className="text-right">월가(정가)</div>
        <div className="text-right">월예상</div>
        <div className="text-right">기간합계</div>
      </div>

      {/* 라인아이템 */}
      {items?.length ? (
        items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-7 gap-2 px-3 py-2 text-[12px]">
            <div className="col-span-2 truncate font-medium">{it.aptName}</div>
            <div className="truncate">{it.productName ?? "-"}</div>
            <div className="text-right">{it.months ?? "-"}</div>
            <div className="text-right">{formatKRW(it.baseMonthly)}</div>
            <div className="text-right">{formatKRW(it.monthlyAfter)}</div>
            <div className="text-right">{formatKRW(it.lineTotal)}</div>
          </div>
        ))
      ) : (
        <div className="px-3 py-4 text-center text-xs text-gray-500">항목이 없습니다.</div>
      )}

      {/* 합계 */}
      <div className="flex items-center justify-end gap-4 px-3 py-3 text-sm">
        <div className="text-gray-600">월 예상 합계</div>
        <div className="font-semibold">{formatKRW(data.details.monthlyTotalKRW)}</div>
        <div className="ml-4 text-gray-600">총합(기간)</div>
        <div className="font-semibold">{formatKRW(data.details.periodTotalKRW)}</div>
      </div>
    </div>
  );
}

function PackageDetails({ data }: { data: ReceiptPackage }) {
  const { areas = [] } = data.details || { areas: [] };
  return (
    <div className="px-3 py-2">
      <div className="mb-2 text-[12px] text-gray-500">선택한 행정구역</div>
      {areas.length ? (
        <ul className="grid grid-cols-1 gap-2 text-sm">
          {areas.map((a) => (
            <li key={a.code} className="rounded-lg bg-gray-50 px-3 py-2">
              {a.label}
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-4 text-center text-xs text-gray-500">선택한 영역이 없습니다.</div>
      )}
    </div>
  );
}

function DetailsSection({ data }: { data: ReceiptData }) {
  const [open, setOpen] = useState(false);
  const vatNote = data?.meta?.vatNote ?? "표시된 금액은 부가세 별도이며, 운영사 정책/재고에 따라 변동될 수 있습니다.";

  return (
    <div className="px-5">
      <button
        className="mt-4 inline-flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-semibold">자세히 보기</span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-gray-100">
              {isSeatReceipt(data) ? <SeatDetails data={data as ReceiptSeat} /> : null}
              {isPackageReceipt(data) ? <PackageDetails data={data as ReceiptPackage} /> : null}
            </div>

            <p className="mt-2 text-xs text-gray-500">{vatNote}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NextSteps() {
  return (
    <div className="px-5">
      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold">다음 절차</h3>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND_LIGHT }}
            >
              <CheckCircle2 size={16} color={BRAND} />
            </span>
            <div className="text-sm">
              <b>데이터/재고 확인</b> (5–10분)
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND_LIGHT }}
            >
              <MessageSquare size={16} color={BRAND} />
            </span>
            <div className="text-sm">
              <b>맞춤 견적 전달</b> (이메일/전화)
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full"
              style={{ backgroundColor: BRAND_LIGHT }}
            >
              <CalendarCheck2 size={16} color={BRAND} />
            </span>
            <div className="text-sm">
              <b>미팅/확정</b> — 전자계약·세금계산서
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}

/* =========================================================================
 * 메인: 모바일 완료 모달 (Bottom Sheet)
 * ========================================================================= */
export function CompleteModalMobile({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  const [pickerOpen, setPickerOpen] = useState(false); // 접수증 저장 선택지
  useBodyScrollLock(open);

  const hasTeam = !!data?.links?.teamUrl;
  const hasYT = !!data?.links?.youtubeUrl;
  const hasGuide = !!data?.links?.guideUrl;
  const hasReceiptLink = !!data?.links?.receiptUrl;

  const openExternal = (url?: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    const url = data?.links?.receiptUrl;
    if (!url) {
      data?.actions?.onCopyLink?.();
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      data?.actions?.onCopyLink?.();
      // 프로젝트 공용 토스트가 있다면 여기서 호출하세요.
    } catch {
      // 실패 토스트
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dim (InquiryModal보다 위) */}
          <motion.div
            key="dim"
            className="fixed inset-0 z-[1200] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            id="receipt-capture"
            key="sheet"
            className="fixed inset-x-0 bottom-0 z-[1201] max-h[88vh] max-h-[88vh] overflow-hidden rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            role="dialog"
            aria-modal="true"
          >
            {/* Drag handle + close */}
            <div className="relative">
              <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-200" />
              <button
                aria-label="close"
                className="absolute right-2 top-2 rounded-full p-2 hover:bg-gray-50"
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="max-h-[calc(88vh-48px)] overflow-y-auto pb-2">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />

              {/* 요약 카드 */}
              <SummaryCard data={data} />

              {/* 자세히 보기 */}
              <DetailsSection data={data} />

              {/* 다음 절차 */}
              <NextSteps />

              {/* CTA 영역 */}
              <div className="px-5">
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    접수증 저장
                  </button>

                  {data?.actions?.onBookMeeting ? (
                    <button
                      onClick={data.actions.onBookMeeting}
                      className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      상담 일정 잡기
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (data?.links?.guideUrl) openExternal(data.links.guideUrl);
                        data?.actions?.onDownloadGuide?.();
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      <FileText size={16} />
                      제작 가이드 보기
                    </button>
                  )}
                </div>

                {/* 더보기 링크 */}
                {(hasTeam || hasYT || hasGuide) && (
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    {hasTeam && (
                      <button
                        onClick={() => openExternal(data.links!.teamUrl)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <ExternalLink size={14} />
                        오르카의 얼굴들
                      </button>
                    )}
                    {hasYT && (
                      <button
                        onClick={() => openExternal(data.links!.youtubeUrl)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <ExternalLink size={14} />
                        영상소재 템플릿
                      </button>
                    )}
                    {hasGuide && (
                      <button
                        onClick={() => openExternal(data.links!.guideUrl)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <ExternalLink size={14} />
                        제작 가이드
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 신뢰/연락 섹션 */}
              <div className="px-5">
                <div className="mt-6 rounded-xl border border-dashed border-gray-200 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">급하시면 지금 전화 주세요</span>
                    <a
                      href="tel:03115510810"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5"
                    >
                      <Phone size={14} />
                      031-1551-0810
                    </a>
                  </div>
                </div>
              </div>

              {/* 하단 확인 */}
              <div className="px-5 pt-4 pb-6">
                <div className="flex items-center justify-between">
                  {hasReceiptLink ? (
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs"
                    >
                      <LinkIcon size={14} />
                      접수증 링크 복사
                    </button>
                  ) : (
                    <span />
                  )}

                  <button
                    onClick={onClose}
                    className="ml-auto rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
                  >
                    {confirmLabel}
                  </button>
                </div>

                {/* 공간 확보 */}
                <div className="h-1" />
              </div>
            </div>

            {/* 접수증 저장 선택지(액션시트) */}
            <AnimatePresence>
              {pickerOpen && (
                <>
                  <motion.div
                    key="sheet-dim"
                    className="fixed inset-0 z-[1210] bg-black/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setPickerOpen(false)}
                  />
                  <motion.div
                    key="picker"
                    className="fixed inset-x-0 bottom-0 z-[1211] rounded-t-2xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  >
                    <div className="px-5 pt-4 pb-2 text-center">
                      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-gray-200" />
                      <div className="text-sm font-semibold">접수증 저장</div>
                      <div className="mt-1 text-xs text-gray-500">원하는 방식으로 저장/공유하세요</div>
                    </div>
                    <div className="px-5 pb-5">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            data?.actions?.onSaveImage?.();
                            setPickerOpen(false);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                        >
                          <FileDown size={16} />
                          이미지(PNG)
                        </button>
                        <button
                          onClick={() => {
                            data?.actions?.onSavePDF?.();
                            setPickerOpen(false);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                        >
                          <FileText size={16} />
                          PDF(A4)
                        </button>
                        <button
                          onClick={() => {
                            handleCopyLink();
                            setPickerOpen(false);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                        >
                          <Copy size={16} />
                          링크 복사
                        </button>
                        <button
                          onClick={() => {
                            data?.actions?.onSendEmail?.();
                            setPickerOpen(false);
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                        >
                          <Mail size={16} />
                          이메일로 보내기
                        </button>
                      </div>
                      <button
                        onClick={() => setPickerOpen(false)}
                        className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
                      >
                        닫기
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CompleteModalMobile;
