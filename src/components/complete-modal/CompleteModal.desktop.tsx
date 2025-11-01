import React, { useMemo } from "react";
import type { CompleteModalProps, ReceiptData } from "./types";

/** ====== 유틸 ====== */
const fmtKST = (iso?: string) => {
  try {
    if (!iso) return "-";
    const d = new Date(iso);
    // KST(+9) 기준 표시
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(kst.getUTCDate()).padStart(2, "0");
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const mi = String(kst.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}. ${mm}. ${dd}. 오후 ${hh}:${mi} KST`;
  } catch {
    return iso || "-";
  }
};

const fmtWon = (n?: number | null) => (typeof n === "number" && isFinite(n) ? `${n.toLocaleString()}원` : "-");

/** PACKAGE 완료 모달 전용 이메일 마스킹(국문 요구사항)
 *  - 로컬파트 전체를 '**'로 대체 → '**@domain'
 */
function maskEmailForPackage(email?: string | null) {
  if (!email) return "-";
  const at = email.indexOf("@");
  if (at < 0) return "**";
  return `**${email.slice(at)}`;
}

/** 오른쪽 패널 – 라운드 버튼 */
function PillButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return <button {...rest} className={`w-full h-12 rounded-xl font-semibold ${className}`} />;
}

/** 오른쪽 패널 – 링크형 버튼 */
function LinkPill({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between w-full rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
    >
      <div className="flex items-center gap-2 text-sm">
        {/* link icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5"
            stroke="#6B7280"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 11a5 5 0 0 0-7.07 0L5.5 12.43a5 5 0 0 0 7.07 7.07L14 19"
            stroke="#6B7280"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-gray-800">{children}</span>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 18l6-6-6-6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/** 왼쪽 – 라벨/값 행 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] gap-4 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  );
}

/** 좌측 ‘고객 문의’ 카드 */
function CustomerCard({ data }: { data: ReceiptData }) {
  const isPackage = data.mode === "PACKAGE";
  const scopeLabel = isPackage ? (data.summary?.scopeLabel ?? "-") : "-";

  const desiredDate = data.form?.desiredDate || "-";
  const promotionCode = data.form?.promotionCode || "-";

  const emailForView = isPackage
    ? maskEmailForPackage((data as any)?.customer?.email) // 혹시 raw email이 있을 수도 있으니 우선 시도
    : ((data.customer as any)?.emailDomain ?? "-");

  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-800">고객 문의</div>
      <div className="px-5 py-2">
        <Row label="상호명">{data.customer?.company || "-"}</Row>
        <Row label="담당자">{data.customer?.name || "-"}</Row>
        <Row label="연락처">{data.customer?.phoneMasked || "-"}</Row>
        <Row label="이메일">{emailForView}</Row>
        <Row label="캠페인 유형">{data.customer?.campaignType || "-"}</Row>
        <Row label="광고 송출 예정(희망)일">{desiredDate}</Row>
        <Row label="프로모션코드">{promotionCode}</Row>
        <Row label="광고 범위">{scopeLabel}</Row>
      </div>

      {/* 문의내용 */}
      <div className="px-5 pt-2 pb-5">
        <div className="text-xs text-gray-500 mb-1">문의내용</div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 px-4 py-3 min-h-[44px]">
          {data.customer?.note ? data.customer.note : ""}
        </div>
      </div>
    </div>
  );
}

/** 오른쪽 – 다음 절차 카드 */
function NextStepsCard({ onSave }: { onSave?: () => void }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-800">다음 절차</div>
      <div className="px-5 py-3 space-y-4">
        {/* step 1 */}
        <div className="flex items-start gap-3">
          <div className="h-6 w-6 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-xs font-bold">
            1
          </div>
          <div className="text-sm text-gray-800">
            <div className="font-semibold">문의 내용 확인 (1~2일)</div>
            <div className="text-gray-500 text-[13px]">담당자가 운영사와 구좌 현황(수량/일정)을 빠르게 확인합니다.</div>
          </div>
        </div>
        {/* step 2 */}
        <div className="flex items-start gap-3">
          <div className="h-6 w-6 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-xs font-bold">
            2
          </div>
          <div className="text-sm text-gray-800">
            <div className="font-semibold">맞춤 견적 전달 (이메일,전화)</div>
            <div className="text-gray-500 text-[13px]">진행 가능 조건과 견적을 이메일/전화로 안내드립니다.</div>
          </div>
        </div>
        {/* step 3 */}
        <div className="flex items-start gap-3">
          <div className="h-6 w-6 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-xs font-bold">
            3
          </div>
          <div className="text-sm text-gray-800">
            <div className="font-semibold">상담/계약 (전자 계약)</div>
            <div className="text-gray-500 text-[13px]">일정 확정 후 소재 접수 → 송출 테스트 → 집행 시작.</div>
          </div>
        </div>
      </div>

      {/* 저장 버튼 (PNG 저장 우선) */}
      <div className="px-5 pb-5">
        <PillButton type="button" onClick={onSave} className="bg-violet-600 hover:bg-violet-700 text-white">
          문의 내용 저장
        </PillButton>
      </div>
    </div>
  );
}

/** 오른쪽 – 더 많은 정보 카드 */
function MoreInfoCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white">
      <div className="px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-800">더 많은 정보</div>
      <div className="px-5 py-4 space-y-3">
        <LinkPill href="https://www.youtube.com/@ORKA_KOREA">광고 소재 채널 바로가기</LinkPill>
        <LinkPill href="https://orka.co.kr/ELAVATOR_CONTENTS">제작 가이드 바로가기</LinkPill>
        <LinkPill href="https://orka.co.kr/orka_members">오르카 구성원 확인하기</LinkPill>
      </div>
    </div>
  );
}

/** ====== 메인 컴포넌트 ====== */
export function CompleteModalDesktop({ open, onClose, data, confirmLabel = "확인" }: CompleteModalProps) {
  if (!open) return null;

  const title = "문의가 접수됐어요!";
  const subtitle = useMemo(() => {
    const ticket = data?.ticketCode ? `접수번호 ${data.ticketCode}` : "";
    const when = data?.createdAtISO ? ` · ${fmtKST(data.createdAtISO)}` : "";
    return `${ticket}${when}`;
  }, [data]);

  // 캡처 버튼: 외부에서 주입된 actions 사용 (PNG 우선)
  const handleSave = () => {
    // PNG → 없으면 PDF로 폴백
    if (data?.actions?.onSaveImage) return data.actions.onSaveImage();
    if (data?.actions?.onSavePDF) return data.actions.onSavePDF();
  };

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* DIM */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute inset-0 overflow-y-auto">
        <div
          id="receipt-capture"
          className="relative w-[980px] max-w-[92vw] mx-auto my-10 rounded-2xl bg-white shadow-2xl border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {/* check icon */}
                <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="#059669"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="text-lg font-bold text-gray-900">{title}</div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-gray-50"
              aria-label="close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* 본문 */}
          <div className="grid grid-cols-[1fr_320px] gap-6 px-6 py-6">
            {/* 좌측 */}
            <div className="space-y-6">{data && <CustomerCard data={data as ReceiptData} />}</div>

            {/* 우측 */}
            <div className="space-y-6">
              <NextStepsCard onSave={handleSave} />
              <MoreInfoCard />
            </div>
          </div>

          {/* 하단 확인 */}
          <div className="px-6 py-5 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-6 rounded-xl bg-black text-white font-semibold hover:opacity-95"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** named + default 모두 제공 (index.tsx에서 어떤 방식이든 사용 가능) */
export default CompleteModalDesktop;
