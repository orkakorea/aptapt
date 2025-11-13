// src/components/mobile/MobileInquirySheet.tsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** 종류: 구좌(T.O) / 패키지 */
export type InquiryKind = "SEAT" | "PACKAGE";

/** PC 버전과 호환되는 prefill */
export type InquiryPrefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null; // { months?, cartTotal?, items?: [{apt_name, product_name, months, item_total_won|total_won}] }
};
// ➕ 호환용 별칭(기존 코드가 { Prefill }를 import해도 동작)
export type Prefill = InquiryPrefill;

export default function MobileInquirySheet({
  open,
  mode,
  onClose,
  prefill,
  sourcePage,
  onSubmitted,
}: {
  open: boolean;
  mode: InquiryKind; // "SEAT" | "PACKAGE"
  onClose: () => void;
  prefill?: InquiryPrefill;
  sourcePage?: string;
  /** ✅ (수정) 완료 콜백에 '표시용 영수증 스냅샷'을 함께 전달 */
  onSubmitted?: (id: string, receiptSnapshot?: any) => void;
}) {
  /* =========================================================================
   * 스타일 토큰
   * ========================================================================= */
  const BRAND = "#6F4BF2";
  const PROGRESS_BG = "#E9E1FF";
  const PROGRESS_FG = "#7C3AED";

  type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사" | "기타";
  const [step, setStep] = useState<1 | 2>(1);

  // 1단계
  const [brand, setBrand] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hopeDate, setHopeDate] = useState("");

  // 2단계
  const [requestText, setRequestText] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const [policyOpen, setPolicyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /* 열고 닫힐 때 상태 리셋 */
  useEffect(() => {
    if (!open) {
      setStep(1);
      setBrand("");
      setCampaignType("");
      setManagerName("");
      setPhone("");
      setEmail("");
      setHopeDate("");
      setRequestText("");
      setPromoCode("");
      setAgreePrivacy(false);
      setSubmitting(false);
      setErrorMsg(null);
      setPolicyOpen(false);
    }
  }, [open]);

  /* 현재 페이지(소스 경로) */
  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/mobile";
  }, [sourcePage]);

  /* UTM 파라미터 수집 */
  function getUTM() {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    const o: Record<string, string> = {};
    let has = false;
    keys.forEach((k) => {
      const v = p.get(k);
      if (v) {
        o[k] = v;
        has = true;
      }
    });
    return has ? o : null;
  }

  /* 전화번호는 숫자만 보관 (테이블 CHECK: 9~12자리) */
  function setPhoneDigits(v: string) {
    setPhone(v.replace(/\D/g, ""));
  }
  const phoneOk = /^\d{9,12}$/.test(phone);

  /* 카트 스냅샷 합계 추출(표시용) */
  function pickCartTotal(snap: any): number | null {
    if (!snap) return null;
    const cand = [
      snap.cartTotal,
      snap.cart_total,
      snap.cartTotalWon,
      snap.cart_total_won,
      snap.grandTotal,
      snap.grand_total,
      snap.totalWon,
      snap.total_won,
      snap.total,
    ];
    for (const c of cand) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
    if (Array.isArray(snap.items)) {
      const s = snap.items.reduce((acc: number, it: any) => {
        const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      return s > 0 ? s : null;
    }
    return null;
  }

  /* 상단 요약 카드(좌측 상단) - SEAT 전용 */
  const seatSummary = useMemo(() => {
    if (mode !== "SEAT") return null;
    const snap: any = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
    const first = items[0];

    const aptName = items.length
      ? `${first?.apt_name ?? "-"}${items.length > 1 ? ` 외 ${items.length - 1}개 단지` : ""}`
      : prefill?.apt_name || "-";

    let productLabel = prefill?.product_name ?? prefill?.product_code ?? "-";
    if (items.length) {
      const names = new Set<string>();
      items.forEach((i) => {
        const key = i?.product_name ?? i?.product_code ?? "";
        if (key) names.add(String(key));
      });
      const firstName = first?.product_name ?? first?.product_code ?? "-";
      productLabel = names.size >= 2 ? `${firstName} 외` : firstName;
    }

    const monthsSet = new Set<number>();
    items.forEach((i) => {
      const n = Number(i?.months ?? 0);
      if (Number.isFinite(n) && n > 0) monthsSet.add(n);
    });
    if (monthsSet.size === 0 && Number.isFinite(Number(snap?.months))) {
      const m = Number(snap.months);
      if (m > 0) monthsSet.add(m);
    }
    const maxM = Array.from(monthsSet).reduce((mx, n) => (n > mx ? n : mx), 0);
    const monthsLabel = maxM > 0 ? `${maxM}개월${monthsSet.size >= 2 ? " 등" : ""}` : "-";

    const totalWon = pickCartTotal(snap);

    return { aptName, productLabel, monthsLabel, totalWon };
  }, [mode, prefill]);

  const canNext = !!(brand.trim() && campaignType && managerName.trim() && phoneOk);
  const submitDisabled = submitting || !agreePrivacy;

  /* 표시용: 전화 마스크 */
  function maskPhone(digits: string) {
    const s = (digits || "").replace(/\D/g, "");
    if (s.length <= 3) return s;
    if (s.length <= 7) return `${s.slice(0, 3)}-${s.slice(3)}`;
    return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`;
  }

  /* ✅ 완료모달에 바로 쓸 "표시용 스냅샷" 생성 */
  function buildReceiptSnapshot() {
    const snap = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];
    const first = items[0];

    const topAptLabel = items.length
      ? `${first?.apt_name ?? "-"}${items.length > 1 ? ` 외 ${items.length - 1}개 단지` : ""}`
      : prefill?.apt_name || "-";

    // months: snap.months 또는 items 내 최대 months
    const monthsSet = new Set<number>();
    items.forEach((i) => {
      const n = Number(i?.months ?? 0);
      if (Number.isFinite(n) && n > 0) monthsSet.add(n);
    });
    if (monthsSet.size === 0 && Number.isFinite(Number(snap?.months))) {
      const m = Number(snap.months);
      if (m > 0) monthsSet.add(m);
    }
    const months = monthsSet.size > 0 ? Array.from(monthsSet).reduce((mx, n) => (n > mx ? n : mx), 0) : undefined;

    return {
      summary: { topAptLabel },
      customer: {
        company: brand || null,
        name: managerName || null,
        phoneMasked: phone ? maskPhone(phone) : null,
        phone: phone || null,
        email: email || null,
      },
      form: {
        values: {
          campaign_type: campaignType || null,
          months: months ?? null,
          desiredDate: hopeDate || null,
          promoCode: promoCode || null,
          request_text: requestText || null,
        },
        cart_snapshot: snap || null,
      },
      meta: { step_ui: "mobile-2step" },
    };
  }

  /* =========================================================================
   * 제출: 반드시 RPC 사용 (RLS 우회)
   * ========================================================================= */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitDisabled) return;
    setErrorMsg(null);

    try {
      setSubmitting(true);

      const utm = getUTM();
      const extra = {
        brand: brand || null,
        campaign_type: campaignType || null,
        manager_name: managerName || null,
        hope_date: hopeDate || null,
        request_text: requestText || null,
        promo_code: promoCode || null,
        agree_privacy: agreePrivacy,
        step_ui: "mobile-2step",
      };

      const payload: any = {
        inquiry_kind: mode, // "SEAT" | "PACKAGE"
        // status는 기본 'new'
        customer_name: managerName || null,
        phone: phone || null, // 숫자만
        company: brand || null,
        email: email || null,
        memo: requestText || null,
        source_page: page,
        utm,
        // 구좌 전용 필드
        apt_id: mode === "SEAT" ? (prefill?.apt_id ?? null) : null,
        apt_name: mode === "SEAT" ? (prefill?.apt_name ?? null) : null,
        product_code: mode === "SEAT" ? (prefill?.product_code ?? null) : null,
        product_name: mode === "SEAT" ? (prefill?.product_name ?? null) : null,
        cart_snapshot: mode === "SEAT" ? (prefill?.cart_snapshot ?? null) : null,
        // 부가
        extra,
      };

      // ✅ 테이블 INSERT 금지. RPC만 사용!
      const { error } = await (supabase as any).rpc("submit_inquiry", {
        p_payload: payload,
      });

      if (error) throw error;

      // ✅ 상위로 '표시용 영수증 스냅샷' 함께 전달 (고객/문의 정보가 완료모달에 즉시 표시됨)
      const snapshot = buildReceiptSnapshot();
      onSubmitted?.("ok", snapshot);
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================================================================
   * 소형 UI 컴포넌트
   * ========================================================================= */
  const INPUT =
    "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-300 text-sm bg-white";
  const LABEL = "text-[13px] font-semibold text-gray-700 mb-1";
  const NOTE = "text-[12px] text-gray-500";

  const CampaignBtn = ({ value, label }: { value: CampaignType; label: string }) => (
    <button
      type="button"
      onClick={() => setCampaignType(value)}
      className={`h-12 rounded-xl border px-4 text-[14px] font-medium ${
        campaignType === value
          ? "border-violet-500 bg-violet-50 text-violet-700"
          : "border-gray-200 bg-white text-gray-800"
      }`}
    >
      {label}
    </button>
  );

  /* 헤더 문구: SEAT / PACKAGE 분기 */
  const isPackage = mode === "PACKAGE";
  const headerTitle = isPackage ? "시,군,구 등 단위 / 패키지문의" : "구좌(T.O) 문의";
  const headerDesc = isPackage
    ? "브랜드·캠페인유형·희망일 등을 알려주시면 빠르게 제안드립니다."
    : "*선택하신 단지/상품 정보를 포함해 접수됩니다.";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* DIM */}
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      {/* Bottom Half Sheet Panel */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center">
        <div
          className="relative w-[720px] max-w-[100vw] max-h-[86vh] rounded-t-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-start justify-between px-5 sm:px-6 py-4 bg-white border-b border-gray-100">
            <div>
              <div className="text-[18px] font-extrabold text-gray-900">{headerTitle}</div>
              <div className="text-[12px] text-gray-500 mt-1">{headerDesc}</div>
            </div>
            <button
              className="rounded-full p-2 hover:bg-gray-50"
              onClick={() => !submitting && onClose()}
              aria-label="close"
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* progress */}
          <div className="px-5 sm:px-6 pt-3 bg-white">
            <div className="mx-auto h-1.5 w-full rounded-full" style={{ backgroundColor: PROGRESS_BG }}>
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: step === 1 ? "50%" : "100%",
                  backgroundColor: PROGRESS_FG,
                }}
              />
            </div>
            <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-gray-200" />
          </div>

          {/* Body */}
          <div className="px-5 sm:px-6 py-4 overflow-auto" style={{ maxHeight: "calc(86vh - 112px)" }}>
            {/* 상단 문의 요약 */}
            {seatSummary && (
              <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <div className="text-sm font-semibold mb-2">문의 내용</div>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <div className="text-gray-500">단지명</div>
                    <div className="font-medium">{seatSummary.aptName}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">상품명</div>
                    <div className="font-medium">{seatSummary.productLabel}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">광고기간</div>
                    <div className="font-medium">{seatSummary.monthsLabel}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">예상 총광고료</div>
                    <div className="font-medium">
                      {typeof seatSummary.totalWon === "number" ? `${seatSummary.totalWon.toLocaleString()}원` : "-"}{" "}
                      <span className="text-gray-500">(VAT별도)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canNext) setStep(2);
                }}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 🔁 순서 변경: 캠페인 유형 먼저, 그 다음 브랜드명 */}
                  <div>
                    <div className={LABEL}>
                      캠페인유형 <span className="text-red-500">*</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <CampaignBtn value="기업" label="기업" />
                      <CampaignBtn value="공공" label="공공" />
                      <CampaignBtn value="병원" label="병원" />
                      <CampaignBtn value="소상공인" label="소상공인" />
                      <CampaignBtn value="광고대행사" label="광고대행사" />
                      <CampaignBtn value="기타" label="기타" />
                    </div>
                  </div>

                  <div>
                    <div className={LABEL}>
                      브랜드명 <span className="text-red-500">*</span>
                    </div>
                    <input
                      className={INPUT}
                      placeholder="오르카 코리아"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className={LABEL}>
                      담당자명 <span className="text-red-500">*</span>
                    </div>
                    <input
                      className={INPUT}
                      placeholder="박우주"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className={LABEL}>
                      연락처 <span className="text-red-500">*</span>
                    </div>
                    <input
                      className={INPUT}
                      inputMode="numeric"
                      placeholder="01012345678"
                      value={phone}
                      onChange={(e) => setPhoneDigits(e.target.value)}
                    />
                    {!phoneOk && phone.length > 0 && (
                      <div className="mt-1 text-[11px] text-red-600">숫자 9~12자리로 입력하세요.</div>
                    )}
                  </div>

                  <div>
                    <div className={LABEL}>이메일</div>
                    <input
                      className={INPUT}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <div className={LABEL}>광고 송출 예정(희망)일</div>
                    <input
                      type="date"
                      className={INPUT}
                      value={hopeDate}
                      onChange={(e) => setHopeDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="h-3" />

                {/* 하단 고정 CTA */}
                <div className="sticky bottom-0 left-0 right-0 bg-white pt-2">
                  <button
                    type="submit"
                    disabled={!canNext}
                    className={`w-full h-12 rounded-xl text-white font-semibold ${
                      canNext ? "bg-violet-600 hover:bg-violet-700" : "bg-violet-300 cursor-not-allowed"
                    }`}
                  >
                    다음
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <div className={LABEL}>요청사항</div>
                  <textarea
                    className={`${INPUT} h-32 resize-none`}
                    placeholder="궁금하신 내용을 자유롭게 작성해주세요."
                    value={requestText}
                    onChange={(e) => setRequestText(e.target.value)}
                  />
                </div>

                <div>
                  <div className={LABEL}>프로모션 코드</div>
                  <input
                    className={INPUT}
                    placeholder="예: ORCA2025"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      className="px-3 py-2 text-[12px] rounded-md border border-black bg-white hover:bg-gray-50"
                      onClick={() => setPolicyOpen(true)}
                    >
                      개인정보 수집·이용 정책 자세히보기
                    </button>

                    <label className="flex items-center gap-2 text-[12px] text-gray-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={agreePrivacy}
                        onChange={(e) => setAgreePrivacy(e.target.checked)}
                      />
                      개인정보 수집·이용 동의 <span className="text-red-500">*</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !agreePrivacy}
                    className={`rounded-xl px-5 py-2.5 text-white font-semibold leading-tight ${
                      submitting || !agreePrivacy
                        ? "bg-violet-300 cursor-not-allowed"
                        : "bg-violet-600 hover:bg-violet-700"
                    }`}
                    style={{ minWidth: 92 }}
                  >
                    <span className="block">문의</span>
                    <span className="block">접수</span>
                  </button>
                </div>

                {errorMsg && <div className="text-[13px] text-red-600">{errorMsg}</div>}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-12 rounded-xl bg-gray-100 text-gray-800 font-medium"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => !submitting && onClose()}
                    className="h-12 rounded-xl bg-black text-white font-semibold"
                  >
                    취소
                  </button>
                </div>

                <div className={`${NOTE} mt-1`}>※ 계약 시점의 운영사 정책에 따라 단가가 변경 될 수 있습니다.</div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* 개인정보 처리방침 모달 */}
      {policyOpen && (
        <div className="fixed inset-0 z-[1100]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPolicyOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[680px] max-w-[92vw] rounded-2xl bg-white shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="text-base font-bold">개인정보 수집·이용 정책</div>
                <button className="rounded-full p-2 hover:bg-gray-50" onClick={() => setPolicyOpen(false)}>
                  <svg width="22" height="22" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="px-6 py-5 max-h-[60vh] overflow-auto text-[13px] leading-6 text-gray-700">
                <p className="mb-3">오르카 코리아(이하 ‘회사’)는 아래와 같이 개인정보를 수집·이용합니다.</p>

                <ol className="list-decimal pl-5 space-y-3">
                  <li>
                    <p className="font-medium">이용목적</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>문의 접수, 견적/제안 제공, 캠페인 진행 관련 상담 및 고객응대</li>
                      <li>계약 체결·이행·정산, 분쟁 대응 및 민원 처리</li>
                      <li>서비스 품질 개선 및 기록 보존(법령 준수)</li>
                    </ul>
                  </li>

                  <li>
                    <p className="font-medium">수집항목</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        [필수] 이름, 연락처(전화), 이메일, 회사/브랜드명, 캠페인 기본정보(매체·기간·예산 등), 접수 시
                        자동 생성 정보(IP, 브라우저/디바이스 정보, 접수 일시)
                      </li>
                      <li>[선택] 직책/부서, 참고자료(파일/링크), 기타 전달사항</li>
                    </ul>
                  </li>

                  <li>
                    <p className="font-medium">보유·이용기간</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>문의 처리 완료 후 3년 보관 후 파기</li>
                      <li>관련 법령에서 별도 보존이 요구되는 경우 해당 기간 동안 보관</li>
                    </ul>
                  </li>

                  <li>
                    <p className="font-medium">제3자 제공</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>원칙적으로 제3자에게 제공하지 않습니다.</li>
                      <li>
                        단, 계약 체결 및 집행 과정에서 캠페인 수행을 위해 필요한 범위 내에서 매체사·협력사에 최소 항목을
                        제공할 수 있습니다(사전 고지 또는 별도 동의).
                      </li>
                    </ul>
                  </li>

                  <li>
                    <p className="font-medium">처리위탁</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        고객관리 시스템 운영/유지보수, 전산·보안, 알림 발송 등 서비스 제공을 위한 업무를 전문업체에
                        위탁할 수 있으며, 위탁계약 시 관련 법령을 준수합니다.
                      </li>
                    </ul>
                  </li>

                  <li>
                    <p className="font-medium">국외 이전</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>기본: 국외 이전 없음.</li>
                      <li>
                        (해당 시) 이전받는 자, 국가, 일시·방법, 이전 항목, 보유·이용기간을 사전 고지하고 별도 동의를
                        받습니다.
                      </li>
                    </ul>
                  </li>

                  <li>
                    <p className="font-medium">정보주체의 권리</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>이용자는 언제든지 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다.</li>
                      <li>문의: master@orka.co.kr / 031-1551-0810</li>
                    </ul>
                  </li>

                  <li>
                    <p className="font-medium">동의 거부 권리 및 불이익</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>
                        이용자는 개인정보 수집·이용에 대한 동의를 거부할 권리가 있으나, 필수항목 동의가 없을 경우 문의
                        접수가 제한될 수 있습니다.
                      </li>
                    </ul>
                  </li>
                </ol>

                <div className="mt-4 text-[12px] text-gray-500">
                  <span>시행일: 2025-11-08</span>
                  <span className="mx-2">|</span>
                  <span>버전: v1.2</span>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
                <button
                  className="rounded-xl px-5 py-3 text-white font-semibold bg-violet-600 hover:bg-violet-700"
                  onClick={() => setPolicyOpen(false)}
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
