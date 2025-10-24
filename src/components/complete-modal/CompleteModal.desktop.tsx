// src/components/complete-modal/CompleteModal.desktop.tsx
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
import { createPortal } from "react-dom";

const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

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

/* ================== Sub Components ================== */
function HeaderSuccess({ ticketCode, createdAtISO }: { ticketCode: string; createdAtISO: string }) {
  const kst = useMemo(() => formatKST(createdAtISO), [createdAtISO]);
  return (
    <div className="flex items-center gap-3">
      <motion.div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_LIGHT }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
      >
        <CheckCircle2 size={28} color={BRAND} />
      </motion.div>
      <div>
        <div className="text-lg font-semibold">문의가 접수됐어요!</div>
        <div className="mt-0.5 text-sm text-gray-500">
          접수번호 {ticketCode} · {kst}
        </div>
      </div>
    </div>
  );
}
function SummaryCard({ data }: { data: ReceiptData }) {
  const customerLine = useMemo(() => {
    const c = data.customer || {};
    const parts: string[] = [];
    if (c.company) parts.push(c.company);
    if (c.name) parts.push(c.name);
    if (c.phoneMasked) parts.push(c.phoneMasked);
    if (c.emailDomain) parts.push(c.emailDomain);
    return parts.join(" · ");
  }, [data.customer]);
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
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500">고객 · 문의 요약</div>
          <div className="mt-1 truncate text-sm font-medium">{customerLine || "-"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">장바구니/범위</div>
          <div className="mt-1 truncate text-sm text-gray-700">{cartLine || "-"}</div>
        </div>
      </div>
    </div>
  );
}
function DetailsSection({ data }: { data: ReceiptData }) {
  const [open, setOpen] = useState(true);
  const vatNote = data?.meta?.vatNote ?? "표시된 금액은 부가세 별도이며, 운영사 정책/재고에 따라 변동될 수 있습니다.";
  return (
    <div className="rounded-xl border border-gray-100">
      <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => setOpen((v) => !v)}>
        <span className="text-sm font-semibold">자세히 보기</span>
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
            <div className="max-h-[40vh] overflow-auto border-t border-gray-100">
              {isSeatReceipt(data) ? <SeatTable data={data as ReceiptSeat} /> : null}
              {isPackageReceipt(data) ? <PackageList data={data as ReceiptPackage} /> : null}
            </div>
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{vatNote}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function SeatTable({ data }: { data: ReceiptSeat }) {
  const { items } = data.details || { items: [] };
  return (
    <table className="min-w-full text-[13px]">
      <thead className="sticky top-0 bg-gray-50 text-gray-600">
        <tr className="[&>th]:px-3 [&>th]:py-2">
          <th className="text-left w-[26%]">단지명</th>
          <th className="text-left w-[18%]">상품</th>
          <th className="text-right w-[8%]">개월</th>
          <th className="text-right w-[16%]">월가(정가)</th>
          <th className="text-right w-[16%]">월예상</th>
          <th className="text-right w-[16%]">기간합계</th>
        </tr>
      </thead>
      <tbody className="[&>tr>td]:px-3 [&>tr>td]:py-2">
        {items?.length ? (
          items.map((it, idx) => (
            <tr key={idx} className="border-t border-gray-100">
              <td className="font-medium">{it.aptName}</td>
              <td className="truncate">{it.productName ?? "-"}</td>
              <td className="text-right">{it.months ?? "-"}</td>
              <td className="text-right">{formatKRW(it.baseMonthly)}</td>
              <td className="text-right">{formatKRW(it.monthlyAfter)}</td>
              <td className="text-right">{formatKRW(it.lineTotal)}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="py-6 text-center text-xs text-gray-500">
              항목이 없습니다.
            </td>
          </tr>
        )}
      </tbody>
      <tfoot className="bg-gray-50">
        <tr className="[&>td]:px-3 [&>td]:py-3">
          <td colSpan={3} />
          <td className="text-right text-gray-600">월 예상 합계</td>
          <td className="text-right font-semibold">{formatKRW(data.details.monthlyTotalKRW)}</td>
          <td className="text-right font-semibold">{formatKRW(data.details.periodTotalKRW)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
function PackageList({ data }: { data: ReceiptPackage }) {
  const { areas = [] } = data.details || { areas: [] };
  return (
    <div className="p-4">
      <div className="mb-2 text-[12px] text-gray-500">선택한 행정구역</div>
      {areas.length ? (
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {areas.map((a) => (
            <li key={a.code} className="truncate rounded-lg bg-gray-50 px-3 py-2">
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
function NextSteps() {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="mb-2 text-sm font-semibold">다음 절차</div>
      <ol className="space-y-3">
        <li className="flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full"
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
            className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full"
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
            className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full"
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
  );
}

/* ================== Main ================== */
export function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  useBodyScrollLock(open);

  const [pickerOpen, setPickerOpen] = useState(false);
  const hasTeam = !!data?.links?.teamUrl;
  const hasYT = !!data?.links?.youtubeUrl;
  const hasGuide = !!data?.links?.guideUrl;
  const hasReceiptLink = !!data?.links?.receiptUrl;

  const openExternal = (url?: string) => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const handleCopyLink = async () => {
    const url = data?.links?.receiptUrl;
    if (!url) return void data?.actions?.onCopyLink?.();
    try {
      await navigator.clipboard.writeText(url);
      data?.actions?.onCopyLink?.();
    } catch {}
  };

  if (!open) return null;

  // ✅ body 포털 + flex 중앙정렬 래퍼 (정중앙 보장)
  return createPortal(
    <AnimatePresence>
      <>
        <motion.div
          key="dim"
          className="fixed inset-0 z-[1200] bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* 👉 중앙정렬 래퍼 */}
        <div className="fixed inset-0 z-[1201] flex items-center justify-center">
          <motion.div
            id="receipt-capture"
            key="panel"
            className="w-[840px] max-w-[94vw] rounded-2xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5">
              <HeaderSuccess ticketCode={data.ticketCode} createdAtISO={data.createdAtISO} />
              <button aria-label="close" className="rounded-full p-2 hover:bg-gray-50" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="grid grid-cols-12 gap-6 px-6 py-6">
              <div className="col-span-8 space-y-4">
                <SummaryCard data={data} />
                <DetailsSection data={data} />
              </div>
              <div className="col-span-4 space-y-4">
                <NextSteps />
                <div className="rounded-xl border border-gray-100 p-4">
                  <div className="text-sm font-semibold">다음 액션</div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setPickerOpen(true)}
                      className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                      style={{ backgroundColor: BRAND }}
                    >
                      접수증 저장
                    </button>

                    {data?.actions?.onBookMeeting ? (
                      <button
                        onClick={data.actions.onBookMeeting}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                      >
                        상담 일정 잡기
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (data?.links?.guideUrl) openExternal(data.links.guideUrl);
                          data?.actions?.onDownloadGuide?.();
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                      >
                        <FileText size={16} />
                        제작 가이드 보기
                      </button>
                    )}
                  </div>

                  {(hasTeam || hasYT || hasGuide) && (
                    <>
                      <div className="mt-4 h-px w-full bg-gray-100" />
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        {hasTeam && (
                          <button
                            onClick={() => openExternal(data.links!.teamUrl)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                          >
                            <ExternalLink size={14} /> 오르카의 얼굴들
                          </button>
                        )}
                        {hasYT && (
                          <button
                            onClick={() => openExternal(data.links!.youtubeUrl)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                          >
                            <ExternalLink size={14} /> 영상소재 템플릿
                          </button>
                        )}
                        {hasGuide && (
                          <button
                            onClick={() => openExternal(data.links!.guideUrl)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                          >
                            <ExternalLink size={14} /> 제작 가이드
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-dashed border-gray-200 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">급하시면 지금 전화 주세요</span>
                    <a
                      href="tel:03115510810"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5"
                    >
                      <Phone size={14} /> 031-1551-0810
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
              {hasReceiptLink ? (
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs"
                >
                  <LinkIcon size={14} /> 접수증 링크 복사
                </button>
              ) : (
                <span />
              )}

              <button onClick={onClose} className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white">
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>

        {/* 저장 액션 시트 */}
        <AnimatePresence>
          {pickerOpen && (
            <>
              <motion.div
                key="picker-dim"
                className="fixed inset-0 z-[1202] bg-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPickerOpen(false)}
              />
              <motion.div
                key="picker-card"
                className="fixed left-1/2 top-1/2 z-[1203] w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
                  <div className="text-sm font-semibold">접수증 저장</div>
                  <button
                    aria-label="close-picker"
                    className="rounded-full p-2 hover:bg-gray-50"
                    onClick={() => setPickerOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        data?.actions?.onSaveImage?.();
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      <FileDown size={16} /> 이미지(PNG)
                    </button>
                    <button
                      onClick={() => {
                        data?.actions?.onSavePDF?.();
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      <FileText size={16} /> PDF(A4)
                    </button>
                    <button
                      onClick={() => {
                        handleCopyLink();
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      <Copy size={16} /> 링크 복사
                    </button>
                    <button
                      onClick={() => {
                        data?.actions?.onSendEmail?.();
                        setPickerOpen(false);
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                    >
                      <Mail size={16} /> 이메일로 보내기
                    </button>
                  </div>
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="mt-4 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
                  >
                    닫기
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    </AnimatePresence>,
    document.body,
  );
}

export default CompleteModalDesktop;
