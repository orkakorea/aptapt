import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  CalendarCheck2,
  FileDown,
  Link as LinkIcon,
  MessageSquare,
  PlayCircle,
  Phone,
  Copy,
  ExternalLink,
} from "lucide-react";

/** =========================================
 *  브랜드/스타일 상수
 *  ========================================= */
const BRAND = "#6F4BF2"; // COLOR_PRIMARY
const BRAND_LIGHT = "#EEE8FF";
const CARD_BG = "#F4F6FA";

/** =========================================
 *  타입
 *  ========================================= */
export type CompleteModalActions = {
  onViewQuote?: () => void;
  onCopyShareLink?: () => void;
  onBookMeeting?: () => void;
  onDownloadGuide?: () => void;
  shareUrl?: string;
  youtubeUrl?: string;
  faqUrl?: string;
  brochureUrl?: string;
  profilesUrl?: string;
  kakaoChannelUrl?: string;
};

export type CompleteModalData = {
  ticketId: string; // 예: ORKA-241023-1287
  createdAtISO?: string; // ISO 문자열이면 자동 포맷
  summary?: {
    aptCount?: number;
    expectedMonthlyKRW?: number; // VAT 별도 표기 전용
  };
  manager?: {
    name?: string; // 예: 김가람
    phone?: string; // 예: 010-1234-5678
    avatarUrl?: string;
  };
  // SLA/안내 카피 커스터마이즈
  slaText?: string; // 예: "영업시간 기준 1시간 내 연락"
  todayDeadlineText?: string; // 예: "오늘 15:00까지"
  actions?: CompleteModalActions;
};

export type CompleteModalMobileProps = {
  open: boolean;
  onClose: () => void;
  data: CompleteModalData;
  /** 확인 버튼 라벨 커스터마이즈 */
  confirmLabel?: string; // 기본: 확인
  /** 알림 수신 토글 영역 노출 여부 */
  showNotifyToggle?: boolean;
};

/** =========================================
 *  유틸
 *  ========================================= */
function formatKRW(n?: number) {
  if (typeof n !== "number") return "-";
  return "₩" + n.toLocaleString("ko-KR");
}
function formatDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // Asia/Seoul 기준 표시(런타임 로컬)
  const f = new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return f.format(d);
}

/** 스크롤 잠금(모바일 바텀시트 UX) */
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

/** =========================================
 *  모바일 완료 모달(바텀시트)
 *  ========================================= */
export default function CompleteModalMobile({
  open,
  onClose,
  data,
  confirmLabel = "확인",
  showNotifyToggle = false,
}: CompleteModalMobileProps) {
  useBodyScrollLock(open);

  const {
    ticketId,
    createdAtISO,
    summary,
    manager,
    slaText = "영업시간 기준 1시간 내 연락드려요.",
    todayDeadlineText = "오늘 15:00까지",
    actions,
  } = data || {};

  const createdAtText = createdAtISO ? formatDateTime(createdAtISO) : "";

  /** 외부 링크는 안전하게 새 창 */
  const openExternal = (url?: string) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /** 공유 링크 복사(UX 토스트는 페이지 공통 토스트 사용 가정) */
  const handleCopyShare = async () => {
    if (actions?.shareUrl) {
      try {
        await navigator.clipboard.writeText(actions.shareUrl);
        actions?.onCopyShareLink?.();
        // 페이지 공통 토스트가 있다면 여기서 호출
        // e.g., toast.success("링크가 복사됐어요");
      } catch {
        // toast.error("복사에 실패했어요");
      }
    } else {
      actions?.onCopyShareLink?.();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dim */}
          <motion.div
            key="dim"
            className="fixed inset-0 z-[99] bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            key="sheet"
            className="fixed inset-x-0 bottom-0 z-[100] rounded-t-2xl bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            role="dialog"
            aria-modal="true"
          >
            {/* Drag handle */}
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-200" />

            {/* 헤더 */}
            <div className="px-5 pt-4 pb-2 text-center">
              <div
                className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: BRAND_LIGHT }}
              >
                <CheckCircle2 size={28} color={BRAND} />
              </div>
              <h2 className="text-lg font-semibold">문의가 접수됐어요!</h2>
              <p className="mt-1 text-sm text-gray-500">
                {ticketId ? `접수번호 ${ticketId}` : null}
                {ticketId && createdAtText ? " · " : null}
                {createdAtText}
              </p>
              <p className="mt-3 text-sm">
                담당 <span className="font-medium">{manager?.name ?? "매니저"}</span>가 {todayDeadlineText}{" "}
                카카오/전화로 안내드릴게요.
                <br />
                담아주신 단지와 조건을 기준으로 <b>최적 할인·재고</b>를 확인 중입니다.
              </p>

              <p className="mt-1 text-xs text-gray-500">{slaText}</p>

              {showNotifyToggle && (
                <label className="mt-3 inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs">
                  <input type="checkbox" className="scale-110" />
                  카카오 알림으로 진행상황 받기
                </label>
              )}
            </div>

            {/* 요약 카드 */}
            <div className="px-5">
              <div className="rounded-xl p-4" style={{ background: CARD_BG }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">요약</p>
                    <p className="mt-0.5 text-sm font-medium">
                      {summary?.aptCount ?? 0}곳 담김
                      {typeof summary?.expectedMonthlyKRW === "number" && (
                        <>
                          {" · "}
                          예상 월액 <span className="font-semibold">{formatKRW(summary.expectedMonthlyKRW)}</span>
                          <span className="text-xs text-gray-500"> (VAT 별도)</span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={data.actions?.onViewQuote}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs"
                    >
                      견적 상세 보기
                    </button>
                    <button
                      onClick={handleCopyShare}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs"
                    >
                      <Copy size={14} />
                      공유
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 다음 절차 타임라인 */}
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
                      <b>데이터 검토</b> (5–10분) — 담은 단지 재고·할인 확인
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
                      <b>맞춤 견적 전송</b> (카카오/이메일) — {todayDeadlineText}
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
                      <b>미팅/확정</b> — 전자계약·세금계산서 발행
                    </div>
                  </li>
                </ol>
              </div>
            </div>

            {/* 액션(Primary/Secondary + 더보기) */}
            <div className="px-5">
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={actions?.onBookMeeting}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-white"
                  style={{ backgroundColor: BRAND }}
                >
                  상담 일정 잡기
                </button>
                <button
                  onClick={actions?.onDownloadGuide}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                >
                  <FileDown size={16} /> 제작 가이드 받기
                </button>
              </div>

              {/* 더보기 링크 행 */}
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <button
                  onClick={() => openExternal(actions?.youtubeUrl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <PlayCircle size={14} />
                  사례 영상
                </button>
                <button
                  onClick={() => openExternal(actions?.faqUrl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <ExternalLink size={14} />
                  자주 묻는 질문
                </button>
                <button
                  onClick={() => openExternal(actions?.brochureUrl)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2"
                >
                  <FileDown size={14} />
                  브로슈어
                </button>
              </div>
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
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-gray-600">카카오 채널</span>
                  <button
                    onClick={() => openExternal(actions?.kakaoChannelUrl)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5"
                  >
                    <MessageSquare size={14} />
                    @ORCA
                  </button>
                </div>
              </div>
            </div>

            {/* 확인 버튼(닫기) */}
            <div className="px-5 pt-4 pb-6">
              <button
                onClick={onClose}
                className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
              >
                {confirmLabel}
              </button>

              {/* 팀 프로필/링크 (선택) */}
              <div className="mt-4 text-center text-[11px] text-gray-500">
                우리 팀을 소개합니다{" "}
                <button onClick={() => openExternal(actions?.profilesUrl)} className="underline">
                  팀 프로필 보기
                </button>
              </div>

              {/* 공간 확보 */}
              <div className="h-2" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
