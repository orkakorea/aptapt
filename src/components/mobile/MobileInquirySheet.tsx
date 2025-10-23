// src/components/mobile/MobileInquirySheet.tsx
import React, { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/mobile/BottomSheet";
import { supabase } from "@/integrations/supabase/client";

/* =========================================================================
 * 타입
 * ========================================================================= */
export type InquiryKind = "SEAT" | "PACKAGE";
export type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사";

export type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  cart_snapshot?: any | null; // 카트 스냅샷(유연한 필드명 호환)
};

export type MobileInquirySheetProps = {
  open: boolean;
  mode: InquiryKind; // "SEAT" | "PACKAGE"
  onClose: () => void;
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;
};

/* =========================================================================
 * 스타일 토큰(모바일 스케일)
 * ========================================================================= */
const INPUT_BASE =
  "w-full h-12 rounded-xl border border-gray-200 px-4 outline-none focus:ring-2 focus:ring-violet-400 text-[14px] bg-white";
const LABEL = "text-[12px] font-semibold text-gray-700 mb-1";
const READ = "text-[12px] text-gray-500";

/* =========================================================================
 * 유틸
 * ========================================================================= */
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

function required(v?: string) {
  return v && v.trim().length > 0;
}

function fmtWon(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "-";
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

/** cart_snapshot에서 1탭 '총 비용' 값을 최대한 정확히 꺼내오기 (여러 필드명 호환) */
function pickCartTotal(snap: any): number | null {
  if (!snap) return null;
  const candidates = [
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
  for (const c of candidates) {
    const n = Number(c);
    if (isFinite(n) && n > 0) return n;
  }
  // items 합계(각 item의 총액 필드명도 다양하게 대응)
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    const sum = snap.items.reduce((acc: number, it: any) => {
      const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0);
      return acc + (isFinite(n) ? n : 0);
    }, 0);
    return sum > 0 ? sum : null;
  }
  return null;
}

/* =========================================================================
 * 컴포넌트
 * ========================================================================= */
export default function MobileInquirySheet({
  open,
  mode,
  prefill,
  onClose,
  sourcePage,
  onSubmitted,
}: MobileInquirySheetProps) {
  // 스텝(1: 기본정보, 2: 목적별+동의/제출)
  const [step, setStep] = useState<1 | 2>(1);

  // ===== 공통 입력 =====
  const [brand, setBrand] = useState(""); // 브랜드명(필수)
  const [campaignType, setCampaignType] = useState<CampaignType | "">(""); // 캠페인유형(필수)
  const [managerName, setManagerName] = useState(""); // 담당자명(필수)
  const [phone, setPhone] = useState(""); // 연락처(숫자만)
  const [email, setEmail] = useState(""); // 이메일(선택)
  const [hopeDate, setHopeDate] = useState<string>(""); // 광고 송출 예정(희망)일
  const [requestText, setRequestText] = useState(""); // 요청사항(선택)
  const [promoCode, setPromoCode] = useState(""); // 프로모션 코드(선택)

  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // 정책/완료 모달
  const [policyOpen, setPolicyOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  // 제출 상태
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // 페이지 정보
  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/";
  }, [sourcePage]);

  // 시트 닫힐 때 초기화
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
      setOkMsg(null);
      setPolicyOpen(false);
      setSuccessOpen(false);
    }
  }, [open]);

  // 연락처: 숫자만 허용
  function handlePhoneChange(v: string) {
    const digitsOnly = v.replace(/\D/g, "");
    setPhone(digitsOnly);
  }

  // ====== SEAT "문의 내용" 파생값 ======
  function deriveSeatSummary() {
    const snap: any = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];

    // 최상위 단지명
    const topAptName: string = items[0]?.apt_name ?? prefill?.apt_name ?? "-";

    // 단지 수
    const aptCount: number = items.length > 0 ? items.length : prefill?.apt_name ? 1 : 0;

    const aptLabel = aptCount > 1 ? `${topAptName} 외 ${aptCount - 1}개 단지` : topAptName;

    // 상품명 요약
    const firstItem = items[0] ?? null;
    const firstProduct =
      firstItem?.product_name ?? firstItem?.product_code ?? prefill?.product_name ?? prefill?.product_code ?? "-";

    const uniqueProducts = new Set<string>();
    if (items.length > 0) {
      items.forEach((i) => {
        const key = i?.product_name ?? i?.product_code ?? "";
        if (key) uniqueProducts.add(String(key));
      });
    } else {
      const key = prefill?.product_name ?? prefill?.product_code ?? "";
      if (key) uniqueProducts.add(String(key));
    }
    const productLabel = uniqueProducts.size >= 2 ? `${firstProduct} 외` : firstProduct;

    // 광고기간 요약(최댓값 + "등" 표기)
    const monthSet = new Set<number>();
    let monthsMaxFromItems = 0;
    if (items.length > 0) {
      items.forEach((i) => {
        const n = Number(i?.months ?? 0);
        if (isFinite(n) && n > 0) {
          monthSet.add(n);
          if (n > monthsMaxFromItems) monthsMaxFromItems = n;
        }
      });
    }
    const fallbackMonths = Number(snap?.months ?? 0);
    if (monthSet.size === 0 && isFinite(fallbackMonths) && fallbackMonths > 0) {
      monthSet.add(fallbackMonths);
      monthsMaxFromItems = fallbackMonths;
    }

    const months: number | null = monthsMaxFromItems > 0 ? monthsMaxFromItems : null;
    const monthsLabel = months ? `${months}개월${monthSet.size >= 2 ? " 등" : ""}` : "-";

    // 예상 총광고료: 1탭 총액과 100% 일치
    const totalWon: number | null = pickCartTotal(snap);

    return { aptLabel, productLabel, months, monthsLabel, totalWon };
  }

  // 스텝1 → 스텝2 이동 조건(필수값)
  const canGoNext =
    required(brand) && required(campaignType) && required(managerName) && required(phone) && !submitting;

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setOkMsg(null);

    // 공통 검증
    if (!required(brand)) return setErrorMsg("브랜드명을 입력해 주세요.");
    if (!required(campaignType)) return setErrorMsg("캠페인유형을 선택해 주세요.");
    if (!required(managerName)) return setErrorMsg("담당자명을 입력해 주세요.");
    if (!required(phone)) return setErrorMsg("연락처를 입력해 주세요.");
    if (!agreePrivacy) return setErrorMsg("개인정보 수집·이용 동의를 체크해 주세요.");

    try {
      setSubmitting(true);
      const utm = getUTM();
      const isSeat = mode === "SEAT";

      const extra: Record<string, any> = {
        brand: brand || null,
        campaign_type: campaignType || null,
        manager_name: managerName || null,
        hope_date: hopeDate || null,
        request_text: requestText || null,
        promo_code: promoCode || null,
        agree_privacy: agreePrivacy,
      };

      const payload: any = {
        inquiry_kind: mode,
        status: "new",
        // 기존 테이블 호환 필드 매핑 (company/memo는 내부적으로 brand/request 사용)
        customer_name: managerName || null,
        phone: phone || null,
        company: brand || null,
        email: email || null,
        memo: requestText || null,
        source_page: page,
        utm,
        // SEAT 전용 필드
        apt_id: isSeat ? (prefill?.apt_id ?? null) : null,
        apt_name: isSeat ? (prefill?.apt_name ?? null) : null,
        product_code: isSeat ? (prefill?.product_code ?? null) : null,
        product_name: isSeat ? (prefill?.product_name ?? null) : null,
        cart_snapshot: isSeat ? (prefill?.cart_snapshot ?? null) : null,
        // 신규 필드
        extra,
      };

      const { error } = await (supabase as any).from("inquiries").insert(payload);
      if (error) throw error;

      setOkMsg("접수가 완료되었습니다. 담당자가 곧 연락드리겠습니다.");
      onSubmitted?.("ok");
      setSuccessOpen(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled = submitting || !agreePrivacy;

  // 시트 높이(모바일): 거의 전체 높이
  const maxH = Math.max(420, Math.floor((typeof window !== "undefined" ? window.innerHeight : 800) * 0.92));
  const resetKey = `${open ? 1 : 0}-${mode}-${step}`;

  const title = mode === "SEAT" ? "구좌(T.O) 문의" : "시·군·구 동 단위 / 패키지문의";
  const subtitle =
    mode === "SEAT"
      ? "선택하신 단지/상품 정보를 포함해 접수됩니다."
      : "브랜드·캠페인유형·희망일 등을 알려주시면 빠르게 제안드립니다.";

  // Body: 스텝별 콘텐츠
  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <div className={LABEL}>
          브랜드명 <span className="text-red-500">*</span>
        </div>
        <input
          className={INPUT_BASE}
          placeholder="오르카 코리아"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
      </div>

      <div>
        <div className={LABEL}>
          캠페인유형 <span className="text-red-500">*</span>
        </div>
        {/* 세그먼트 스타일 셀렉트(모바일 터치 최적화) */}
        <div className="grid grid-cols-3 gap-2">
          {(["기업", "공공", "병원", "소상공인", "광고대행사"] as CampaignType[]).map((opt) => {
            const active = campaignType === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setCampaignType(opt)}
                className={`h-10 rounded-xl border text-[13px] ${
                  active ? "border-violet-600 text-violet-700 bg-violet-50" : "border-gray-200 text-gray-700 bg-white"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className={LABEL}>
          담당자명 <span className="text-red-500">*</span>
        </div>
        <input
          className={INPUT_BASE}
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
          className={INPUT_BASE}
          inputMode="numeric"
          placeholder="01012345678"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
        />
      </div>

      <div>
        <div className={LABEL}>이메일</div>
        <input
          className={INPUT_BASE}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <div className={LABEL}>광고 송출 예정(희망)일</div>
        <input type="date" className={INPUT_BASE} value={hopeDate} onChange={(e) => setHopeDate(e.target.value)} />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      {mode === "SEAT" &&
        (() => {
          const s = deriveSeatSummary();
          return (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-[13px] font-semibold mb-2">문의 내용</div>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className={READ}>단지명</span>
                  <span className="font-medium text-right ml-3">{s.aptLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={READ}>상품명</span>
                  <span className="font-medium text-right ml-3">{s.productLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={READ}>광고기간</span>
                  <span className="font-medium text-right ml-3">{s.monthsLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={READ}>예상 총광고료</span>
                  <span className="font-medium text-right ml-3">
                    {fmtWon(s.totalWon)} <span className="text-gray-500">(VAT별도)</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

      <div>
        <div className={LABEL}>요청사항</div>
        <textarea
          className={`${INPUT_BASE} h-28 resize-none`}
          placeholder={mode === "PACKAGE" ? "관심 상품/예산/지역/기간 등을 적어주세요." : "요청/메모를 적어주세요."}
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
        />
      </div>

      <div>
        <div className={LABEL}>프로모션 코드</div>
        <input
          className={INPUT_BASE}
          placeholder="예: ORKA2024"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
        />
      </div>

      {errorMsg && <div className="text-[12px] text-red-600">{errorMsg}</div>}
      {okMsg && <div className="text-[12px] text-emerald-600">{okMsg}</div>}

      {/* 동의 + 제출 */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="px-3 py-2 text-[12px] rounded-md border border-black bg-white hover:bg-gray-50 whitespace-nowrap"
          onClick={() => setPolicyOpen(true)}
        >
          개인정보 수집·이용 정책 자세히보기
        </button>

        <label className="flex items-center gap-2 text-[12px] text-gray-700 whitespace-nowrap">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 accent-[#6F4BF2]"
            checked={agreePrivacy}
            onChange={(e) => setAgreePrivacy(e.target.checked)}
          />
          개인정보 수집·이용 동의 <span className="text-red-500">*</span>
        </label>
      </div>
    </div>
  );

  return (
    <>
      <BottomSheet
        open={open}
        maxHeightPx={maxH}
        onClose={() => (!submitting ? onClose() : null)}
        resetScrollKey={resetKey}
      >
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[16px] font-bold">{title}</div>
              <div className="text-[12px] text-gray-500 mt-0.5">{subtitle}</div>
            </div>
            <button
              onClick={() => (!submitting ? onClose() : null)}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              aria-label="닫기"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* 스텝 표시 */}
          <div className="mt-3 grid grid-cols-2 gap-1">
            <div className={`h-1.5 rounded-full ${step >= 1 ? "bg-violet-600" : "bg-gray-200"}`} />
            <div className={`h-1.5 rounded-full ${step >= 2 ? "bg-violet-600" : "bg-gray-200"}`} />
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 py-4">{step === 1 ? renderStep1() : renderStep2()}</div>

        {/* 하단 고정 CTA */}
        <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100">
          <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canGoNext}
                className={`w-full h-12 rounded-xl text-white font-semibold ${
                  canGoNext ? "bg-violet-600 hover:bg-violet-700" : "bg-violet-300"
                }`}
              >
                다음
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit()}
                disabled={submitDisabled}
                className={`w-full h-12 rounded-xl text-white font-semibold ${
                  submitDisabled ? "bg-violet-300" : "bg-violet-600 hover:bg-violet-700"
                }`}
              >
                {submitting ? "전송 중..." : "문의 접수"}
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full h-10 mt-2 rounded-xl border border-gray-300 bg-white text-[13px] text-gray-700"
              >
                이전
              </button>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* == 정책 안내 (풀스크린 라이트 모달) == */}
      {policyOpen && (
        <div className="fixed inset-0 z-[1001]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPolicyOpen(false)} />
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="text-[15px] font-bold">개인정보 수집·이용 정책</div>
              <button
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                onClick={() => setPolicyOpen(false)}
                aria-label="close-policy"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-4 py-4 overflow-auto text-[13px] leading-6 text-gray-700">
              {/* 👉 실제 약관 전문으로 교체하세요 */}
              <p className="mb-3">
                오르카 코리아는 문의 접수 및 상담을 위해 최소한의 개인정보를 수집·이용하며, 목적 달성 후 지체 없이
                파기합니다. 수집 항목: 성명, 연락처, 이메일, 문의 내용 등. 보유·이용 기간: 문의 처리 완료 후 1년.
              </p>
              <p className="mb-3">
                필요한 경우 매체 운영사 등 협력사와의 상담/집행을 위해 최소한의 정보가 공유될 수 있습니다. 법령에 따른
                고지·동의 절차를 준수합니다.
              </p>
              <p>귀하는 동의를 거부할 권리가 있으며, 동의 거부 시 상담 제공이 제한될 수 있습니다.</p>
            </div>
            <div className="mt-auto px-4 py-3 border-t border-gray-100">
              <button
                className="w-full h-12 rounded-xl text-white font-semibold bg-violet-600 hover:bg-violet-700"
                onClick={() => setPolicyOpen(false)}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* == 완료 모달 (풀스크린 라이트) == */}
      {successOpen && (
        <div className="fixed inset-0 z-[1002]">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 bg-white flex flex-col">
            <div className="flex justify-end p-3">
              <button
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                onClick={() => {
                  setSuccessOpen(false);
                  onClose();
                }}
                aria-label="close-success"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-10 -mt-2 flex flex-col items-center text-center">
              {/* 아이콘 */}
              <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
                    fill="#7C3AED"
                    opacity="0.15"
                  />
                  <path d="M8 12h8M8 15h5M9 8h6" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              <div className="text-[16px] font-bold mb-2">
                {mode === "SEAT" ? "구좌문의가 완료되었습니다." : "광고문의가 완료되었습니다."}
              </div>
              <div className="text-[14px] text-gray-700 leading-7">
                영업일 기준 1~2일 이내로 담당자가 배정되어
                <br />
                답변드릴 예정입니다.
              </div>

              <button
                className="mt-10 w-full h-12 rounded-xl text-white font-semibold bg-violet-600 hover:bg-violet-700"
                onClick={() => {
                  setSuccessOpen(false);
                  onClose();
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
