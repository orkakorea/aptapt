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
  X,
  ClipboardList,
  FileSignature,
} from "lucide-react";
import type { CompleteModalProps, ReceiptData, ReceiptSeat, ReceiptPackage } from "./types";
import { isSeatReceipt, isPackageReceipt } from "./types";
import { createPortal } from "react-dom";

const BRAND = "#6F4BF2";
const BRAND_LIGHT = "#EEE8FF";

/* ================== Utils ================== */
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
/** 이메일: 로컬파트 앞 2글자만 노출, 나머지는 * 처리. 도메인은 그대로. */
function maskEmail(email?: string | null) {
  if (!email) return "";
  const str = String(email);
  const at = str.indexOf("@");
  if (at <= 0) {
    return str.startsWith("@") ? `**${str}` : str.slice(0, 2) + "…";
  }
  const local = str.slice(0, at);
  const domain = str.slice(at + 1);
  const shown = local.slice(0, 2);
  const masked = local.length > 2 ? "*".repeat(local.length - 2) : "";
  return `${shown}${masked}@${domain}`;
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

/* ---------- SEAT 전용(좌측) ---------- */
function SummaryCard({ data }: { data: ReceiptData }) {
  const customerLine = useMemo(() => {
    const c: any = data.customer || {};
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
function DetailsSection({ data }: { data: ReceiptData }) {
  const [open, setOpen] = useState(true);
  const vatNote =
    (data as any)?.meta?.vatNote ?? "표시된 금액은 부가세 별도이며, 운영사 정책/재고에 따라 변동될 수 있습니다.";

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
            </div>
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">{vatNote}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- PACKAGE 전용 “고객 문의” 섹션 (좌측) ---------- */
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-3 items-start gap-3 py-2">
      <div className="col-span-1 text-xs text-gray-500">{label}</div>
      <div className="col-span-2 text-sm text-gray-800 break-words">{value || "-"}</div>
    </div>
  );
}
function CustomerInquirySection({ data }: { data: ReceiptPackage | ReceiptData }) {
  const c: any = (data as any).customer || {};
  const form: any = (data as any).form || (data as any).request || (data as any).fields || (data as any).payload || {};
  const summary: any = (data as any).summary || {};

  const emailMasked = maskEmail(c.email ?? form.email ?? null) || (c.emailDomain ? `**${String(c.emailDomain)}` : "-");

  // ▶ 캠페인유형: 여러 위치/케이스에서 조회
  const campaignType =
    form.campaignType ??
    form.campaign_type ??
    summary.campaignType ??
    summary.campaign_type ??
    c.campaignType ??
    c.campaign_type;

  // ▶ 기간: '광고 송출 예정(희망)일'을 최우선으로 표시 + 다양한 키 대응
  const toYMD = (input?: any): string | undefined => {
    if (input == null || input === "") return undefined;
    const v = typeof input === "string" ? input.trim() : input;
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    return typeof v === "string" ? v : undefined;
  };

  const preferredRaw =
    form.desiredDate ??
    form.desired_date ??
    form.desiredAt ??
    form.desired_at ??
    form.preferredDate ??
    form.preferred_date ??
    form.preferredStartDate ??
    form.preferred_start_date ??
    form.hopeDate ??
    form.hope_date ??
    form.hopedDate ??
    form.hoped_date ??
    form.startDate ??
    form.start_date ??
    form.startAt ??
    form.start_at ??
    form.scheduleDate ??
    form.schedule_date ??
    summary.desiredDate ??
    summary.desired_date ??
    summary.preferredDate ??
    summary.preferred_date ??
    summary.preferredStartDate ??
    summary.preferred_start_date ??
    summary.startDate ??
    summary.start_date ??
    summary.startAt ??
    summary.start_at ??
    summary.scheduleDate ??
    summary.schedule_date ??
    c.desiredDate ??
    c.desired_date ??
    c.preferredDate ??
    c.preferred_date ??
    (data as any)?.meta?.desiredDate ??
    (data as any)?.meta?.startDate ??
    (data as any)?.meta?.start_date;

  const periodValue =
    toYMD(preferredRaw) ??
    form.periodLabel ??
    form.period_label ??
    (typeof form.months === "number" ? `${form.months}개월` : undefined) ??
    summary.periodLabel ??
    summary.period_label ??
    (typeof summary.months === "number" ? `${summary.months}개월` : undefined);

  // ▶ 프로모션코드: 다양한 입력 키 대응
  const promoCode =
    form.promotionCode ??
    form.promoCode ??
    form.promotion_code ??
    form.promo_code ??
    form.couponCode ??
    form.coupon_code ??
    form.coupon ??
    form.referralCode ??
    form.referral_code ??
    form.refCode ??
    form.ref_code ??
    form.eventCode ??
    form.event_code ??
    summary.promotionCode ??
    summary.promoCode ??
    summary.promotion_code ??
    summary.promo_code ??
    summary.couponCode ??
    summary.coupon_code ??
    summary.referralCode ??
    summary.referral_code ??
    summary.refCode ??
    summary.ref_code ??
    summary.eventCode ??
    summary.event_code ??
    c.promotionCode ??
    c.promoCode ??
    c.promotion_code ??
    c.promo_code ??
    (data as any)?.meta?.promotionCode ??
    (data as any)?.meta?.promoCode ??
    (data as any)?.meta?.promo_code;

  const inquiryText: string =
    form.request ??
    form.message ??
    form.memo ??
    form.note ??
    (data as any)?.meta?.note ??
    (data as any)?.customer?.note ??
    "";

  return (
    <div className="rounded-xl border border-gray-100 bg-white">
      <div className="px-4 py-3 text-sm font-semibold">고객 문의</div>
      <div className="px-4">
        <Row label="상호명" value={c.company ?? form.company} />
        <Row label="담당자" value={c.name ?? form.manager ?? form.contactName} />
        <Row label="연락처" value={c.phoneMasked ?? form.phoneMasked ?? form.phone} />
        <Row label="이메일" value={emailMasked} />
        <Row label="캠페인 유형" value={campaignType} />
        {/* 예산 행 삭제 */}
        <Row label="기간" value={periodValue} />
        <Row label="프로모션코드" value={promoCode} />
        <Row label="광고 범위" value={form.scopeLabel ?? summary.scopeLabel} />
      </div>

      {/* 문의내용 (스크롤 가능) */}
      <div className="mt-2 border-t border-gray-100 px-4 py-3">
        <div className="mb-2 text-xs text-gray-500">문의내용</div>
        <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-50 px-3 py-3 text-sm">
          {inquiryText ? inquiryText : "-"}
        </div>
      </div>
    </div>
  );
}

/* ---------- 오른쪽 카드: “다음 절차”(정렬 개선) ---------- */
function StepItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[28px_1fr] items-start gap-3">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full"
        style={{ backgroundColor: BRAND_LIGHT }}
      >
        {icon}
      </span>
      <div className="text-sm leading-6">{children}</div>
    </li>
  );
}
function NextStepsSeat() {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="mb-2 text-sm font-semibold">다음 절차</div>
      <ol className="space-y-3">
        <StepItem icon={<CheckCircle2 size={16} color={BRAND} />}>
          <b>데이터/재고 확인</b> (5–10분)
        </StepItem>
        <StepItem icon={<MessageSquare size={16} color={BRAND} />}>
          <b>맞춤 견적 전달</b> (이메일/전화)
        </StepItem>
        <StepItem icon={<CalendarCheck2 size={16} color={BRAND} />}>
          <b>미팅/확정</b> — 전자계약·세금계산서
        </StepItem>
      </ol>
    </div>
  );
}
function NextStepsPackage() {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="mb-2 text-sm font-semibold">다음 절차</div>
      <ol className="space-y-3">
        <StepItem icon={<ClipboardList size={16} color={BRAND} />}>
          <b>문의 내용 확인</b> (1~2일)
        </StepItem>
        <StepItem icon={<Mail size={16} color={BRAND} />}>
          <b>맞춤 견적 전달</b> (이메일,전화)
        </StepItem>
        <StepItem icon={<FileSignature size={16} color={BRAND} />}>
          <b>상담/계약</b> (전자 계약)
        </StepItem>
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

  const isPackage = isPackageReceipt(data);

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

  const saveButtonLabel = isPackage ? "문의 내용 저장" : "접수증 저장";
  const sheetTitle = saveButtonLabel;

  // PACKAGE 고정 링크(PC 전용)
  const LINK_YT = "https://www.youtube.com/@ORKA_KOREA";
  const LINK_GUIDE = "https://orka.co.kr/ELAVATOR_CONTENTS";
  const LINK_TEAM = "https://orka.co.kr/orka_members";

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

        {/* 중앙 정렬 컨테이너 */}
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
                {/* PACKAGE: 고객 정보만 노출 */}
                {isPackage ? (
                  <CustomerInquirySection data={data as ReceiptPackage} />
                ) : (
                  <>
                    <SummaryCard data={data} />
                    <DetailsSection data={data} />
                  </>
                )}
              </div>

              <div className="col-span-4 space-y-4">
                {/* 다음 절차 */}
                {isPackage ? <NextStepsPackage /> : <NextStepsSeat />}

                {/* (PACKAGE 전용) “문의 내용 저장” 버튼 */}
                {isPackage && (
                  <button
                    onClick={() => setPickerOpen(true)}
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    {saveButtonLabel}
                  </button>
                )}

                {/* 오른쪽 카드 - PACKAGE: “더 많은 정보”, SEAT: 기존 동작 유지 */}
                {isPackage ? (
                  <div className="rounded-xl border border-gray-100 p-4">
                    <div className="text-sm font-semibold">더 많은 정보</div>
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button
                        onClick={() => openExternal(LINK_YT)}
                        className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                      >
                        <ExternalLink size={16} />
                        광고 소재 채널 바로가기
                      </button>
                      <button
                        onClick={() => openExternal(LINK_GUIDE)}
                        className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                      >
                        <ExternalLink size={16} />
                        제작 가이드 바로가기
                      </button>
                      <button
                        onClick={() => openExternal(LINK_TEAM)}
                        className="w-full inline-flex items-center justify-start gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-left"
                      >
                        <ExternalLink size={16} />
                        오르카 구성원 확인하기
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 기존 SEAT 액션 카드 (원형 유지) */}
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

                    {/* SEAT 전용 전화 카드 (PACKAGE에서는 제거) */}
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
                  </>
                )}
              </div>
            </div>

            {/* Footer (좌측 '접수증 링크 복사' 토글 제거) */}
            <div className="flex items-center justify-end border-t border-gray-100 px-6 py-4">
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
                  <div className="text-sm font-semibold">{sheetTitle}</div>
                  <button
                    aria-label="close-picker"
                    className="rounded-full p-2 hover:bg-gray-50"
                    onClick={() => setPickerOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className={`grid ${isPackage ? "grid-cols-2" : "grid-cols-2"} gap-3`}>
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

                    {/* SEAT에서는 링크복사/이메일 유지, PACKAGE에서는 제거 */}
                    {!isPackage && (
                      <>
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
                      </>
                    )}
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
