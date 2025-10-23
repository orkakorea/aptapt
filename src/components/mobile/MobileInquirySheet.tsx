import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* =========================
 * 타입
 * ========================= */
export type InquiryKind = "SEAT" | "PACKAGE";
export type CampaignType = "기업" | "공공" | "병원" | "소상공인" | "광고대행사" | "기타";

export type Prefill = {
  apt_id?: string | null;
  apt_name?: string | null;
  product_code?: string | null;
  product_name?: string | null;
  /** 장바구니(또는 견적) 스냅샷: 자유 형태 */
  cart_snapshot?: any | null;
};

type Props = {
  open: boolean;
  mode: InquiryKind; // "SEAT" | "PACKAGE"
  onClose: () => void;
  prefill?: Prefill;
  sourcePage?: string;
  onSubmitted?: (rowId: string) => void;
};

/* =========================
 * 유틸
 * ========================= */
const INPUT =
  "w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-violet-400 text-[14px] bg-white";
const SMALL = "text-[12px]";
const LABEL = "text-[13px] font-semibold text-gray-700 mb-1";

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
  return !!(v && v.trim().length > 0);
}

function fmtWon(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "-";
  return `${Number(n).toLocaleString("ko-KR")}원`;
}

/** cart_snapshot에서 '총액'을 최대한 호환성 있게 추출 */
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
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    const sum = snap.items.reduce((acc: number, it: any) => {
      const n = Number(it?.itemTotalWon ?? it?.item_total_won ?? it?.totalWon ?? it?.total_won ?? 0);
      return acc + (isFinite(n) ? n : 0);
    }, 0);
    return sum > 0 ? sum : null;
  }
  return null;
}

/* =========================
 * 컴포넌트
 * ========================= */
export default function MobileInquirySheet({ open, mode, prefill, onClose, sourcePage, onSubmitted }: Props) {
  // 두 페이지(1 → 2)
  const [step, setStep] = useState<1 | 2>(1);

  // 공통 입력
  const [brand, setBrand] = useState("");
  const [campaignType, setCampaignType] = useState<CampaignType | "">("");
  const [managerName, setManagerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hopeDate, setHopeDate] = useState<string>("");

  // 2페이지 입력
  const [requestText, setRequestText] = useState("");
  const [promoCode, setPromoCode] = useState("");

  // 정책·동의 / 제출 상태
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const isSeat = mode === "SEAT";
  const titleText = isSeat ? "구좌(T.O) 문의" : "시·군·구 등 단위 / 패키지문의";
  const subtitleText = isSeat
    ? "선택하신 단지/상품 정보를 포함해 접수됩니다."
    : "브랜드·캠페인유형·희망일 등을 알려주시면 빠르게 제안드립니다.";

  const page = useMemo(() => {
    if (sourcePage) return sourcePage;
    if (typeof window !== "undefined") return window.location.pathname;
    return "/";
  }, [sourcePage]);

  // 시트 열림/닫힘에 따른 초기화
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
      setPolicyOpen(false);
      setSuccessOpen(false);
      setSubmitting(false);
      setErrorMsg(null);
      setOkMsg(null);
    }
  }, [open]);

  // 연락처 숫자만
  const onPhoneChange = (v: string) => {
    setPhone(v.replace(/\D/g, ""));
  };

  // 구좌문의 요약(2페이지 카드) – 훅 순서 고정 위해 useMemo로 미리 계산
  const seatSummary = useMemo(() => {
    const snap: any = prefill?.cart_snapshot || null;
    const items: any[] = Array.isArray(snap?.items) ? snap.items : [];

    const topApt = items[0]?.apt_name ?? prefill?.apt_name ?? "-";
    const aptCount = items.length > 0 ? items.length : prefill?.apt_name ? 1 : 0;
    const aptLabel = aptCount > 1 ? `${topApt} 외 ${aptCount - 1}개 단지` : topApt;

    const first = items[0] ?? null;
    const firstProduct =
      first?.product_name ?? first?.product_code ?? prefill?.product_name ?? prefill?.product_code ?? "-";

    const uniq = new Set<string>();
    if (items.length > 0) {
      items.forEach((i) => {
        const key = i?.product_name ?? i?.product_code ?? "";
        if (key) uniq.add(String(key));
      });
    } else {
      const key = prefill?.product_name ?? prefill?.product_code ?? "";
      if (key) uniq.add(String(key));
    }
    const productLabel = uniq.size >= 2 ? `${firstProduct} 외` : firstProduct;

    const monthSet = new Set<number>();
    let monthsMax = 0;
    if (items.length > 0) {
      items.forEach((i) => {
        const n = Number(i?.months ?? 0);
        if (isFinite(n) && n > 0) {
          monthSet.add(n);
          if (n > monthsMax) monthsMax = n;
        }
      });
    }
    const fallbackMonths = Number(snap?.months ?? 0);
    if (monthSet.size === 0 && isFinite(fallbackMonths) && fallbackMonths > 0) {
      monthSet.add(fallbackMonths);
      monthsMax = fallbackMonths;
    }
    const monthsLabel = monthsMax ? `${monthsMax}개월${monthSet.size >= 2 ? " 등" : ""}` : "-";

    const totalWon = pickCartTotal(snap);

    return { aptLabel, productLabel, monthsLabel, totalWon };
  }, [prefill]);

  // 제출
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setOkMsg(null);

    // 공통 필수값
    if (!required(brand)) return setErrorMsg("브랜드명을 입력해 주세요.");
    if (!required(campaignType)) return setErrorMsg("캠페인유형을 선택해 주세요.");
    if (!required(managerName)) return setErrorMsg("담당자명을 입력해 주세요.");
    if (!required(phone)) return setErrorMsg("연락처를 입력해 주세요.");
    if (!agreePrivacy) return setErrorMsg("개인정보 수집·이용 동의를 체크해 주세요.");

    try {
      setSubmitting(true);
      const utm = getUTM();

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
        customer_name: managerName || null,
        phone: phone || null,
        company: brand || null,
        email: email || null,
        memo: requestText || null,
        source_page: page,
        utm,
        apt_id: isSeat ? (prefill?.apt_id ?? null) : null,
        apt_name: isSeat ? (prefill?.apt_name ?? null) : null,
        product_code: isSeat ? (prefill?.product_code ?? null) : null,
        product_name: isSeat ? (prefill?.product_name ?? null) : null,
        cart_snapshot: isSeat ? (prefill?.cart_snapshot ?? null) : null,
        extra,
      };

      const { error } = await (supabase as any).from("inquiries").insert(payload);
      if (error) throw error;

      setOkMsg("접수가 완료되었습니다. 담당자가 곧 연락드리겠습니다.");
      setSuccessOpen(true);
      onSubmitted?.("ok");
    } catch (err: any) {
      setErrorMsg(err?.message || "제출 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const canNext = required(brand) && required(campaignType) && required(managerName) && required(phone);
  const submitDisabled = submitting || !agreePrivacy;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose()} />

      {/* 패널 */}
      <div className="absolute inset-x-0 bottom-0 top-0 sm:top-10 sm:bottom-auto sm:mx-auto sm:max-w-[720px] sm:rounded-2xl bg-white shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[15px] font-extrabold">{titleText}</div>
          <div className="text-[12px] text-gray-500 mt-1">{subtitleText}</div>

          {/* 진행바 */}
          <div className="mt-4 h-1.5 rounded-full bg-violet-100 overflow-hidden">
            <div className="h-full bg-violet-500 transition-all" style={{ width: step === 1 ? "50%" : "100%" }} />
          </div>
        </div>

        {/* 본문 */}
        <form onSubmit={handleSubmit} className="px-4 pb-5 overflow-y-auto max-h-[calc(100vh-110px)]">
          {step === 1 ? (
            <div className="space-y-4">
              {/* 브랜드명 */}
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

              {/* 캠페인유형: 선택 버튼 */}
              <div>
                <div className={LABEL}>
                  캠페인유형 <span className="text-red-500">*</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(["기업", "공공", "병원", "소상공인", "광고대행사", "기타"] as CampaignType[]).map((opt) => {
                    const active = campaignType === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setCampaignType(opt)}
                        className={`rounded-xl px-4 py-3 border text-[14px] ${
                          active
                            ? "border-violet-500 bg-violet-50 text-violet-700 font-semibold"
                            : "border-gray-200 bg-white text-gray-800"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 담당자명 */}
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

              {/* 연락처 */}
              <div>
                <div className={LABEL}>
                  연락처 <span className="text-red-500">*</span>
                </div>
                <input
                  className={INPUT}
                  inputMode="numeric"
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                />
              </div>

              {/* 이메일 */}
              <div>
                <div className={LABEL}>이메일</div>
                <input
                  className={INPUT}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* 희망일 */}
              <div>
                <div className={LABEL}>광고 송출 예정(희망)일</div>
                <input type="date" className={INPUT} value={hopeDate} onChange={(e) => setHopeDate(e.target.value)} />
              </div>

              {/* 다음 버튼 */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => setStep(2)}
                  className={`w-full rounded-xl py-3 text-white font-semibold ${
                    canNext ? "bg-violet-500" : "bg-violet-300 cursor-not-allowed"
                  }`}
                >
                  다음
                </button>
                {!canNext && (
                  <div className="mt-2 text-red-600 text-[12px]">
                    브랜드명·캠페인유형·담당자명·연락처를 입력해 주세요.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* (SEAT) 문의 요약 */}
              {isSeat && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-sm font-semibold mb-2">문의 내용</div>
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <div className="text-gray-500">단지명</div>
                      <div className="font-medium">{seatSummary.aptLabel}</div>
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
                        {fmtWon(seatSummary.totalWon)} <span className={SMALL}>(VAT별도)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 요청사항 */}
              <div>
                <div className={LABEL}>요청사항</div>
                <textarea
                  className={`${INPUT} h-28 resize-none`}
                  placeholder="관심 상품/예산/지역/기간 등을 적어주세요."
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                />
              </div>

              {/* 프로모션 코드 */}
              <div>
                <div className={LABEL}>프로모션 코드</div>
                <input
                  className={INPUT}
                  placeholder="예: ORCA2025"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
              </div>

              {/* 정책 보기 + 동의 */}
              <div className="flex items-center justify-between flex-wrap gap-3">
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

              {/* 메시지 */}
              {errorMsg && <div className="text-[13px] text-red-600">{errorMsg}</div>}
              {okMsg && <div className="text-[13px] text-emerald-600">{okMsg}</div>}

              {/* 제출/이전 */}
              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className={`w-full rounded-xl py-3 text-white font-semibold ${
                    submitDisabled ? "bg-violet-300 cursor-not-allowed" : "bg-violet-600 hover:bg-violet-700"
                  }`}
                >
                  {submitting ? "전송 중..." : "문의 접수"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-xl py-3 bg-gray-100 text-gray-800"
                >
                  이전
                </button>
              </div>
            </div>
          )}
        </form>

        {/* 우측 상단 닫기 */}
        <button
          className="absolute top-3 right-3 rounded-full p-2 hover:bg-gray-50"
          onClick={() => !submitting && onClose()}
          aria-label="close"
        >
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 정책 모달 */}
      {policyOpen && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPolicyOpen(false)} />
          <div className="relative z-[1101] w-[680px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="text-base font-bold">개인정보 수집·이용 정책</div>
              <button
                className="rounded-full p-2 hover:bg-gray-50"
                onClick={() => setPolicyOpen(false)}
                aria-label="close-policy"
              >
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 max-h-[60vh] overflow-auto text-[13px] leading-6 text-gray-700">
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
      )}

      {/* 완료 모달 */}
      {successOpen && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-[1201] w-[520px] max-w-[92vw] rounded-2xl bg-white shadow-2xl">
            <div className="flex justify-end p-4">
              <button
                className="rounded-full p-2 hover:bg-gray-50"
                onClick={() => {
                  setSuccessOpen(false);
                  onClose();
                }}
                aria-label="close-success"
              >
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="px-8 pb-8 -mt-6 flex flex-col items-center text-center">
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

              <div className="text-lg font-bold mb-2">
                {isSeat ? "구좌문의가 완료되었습니다." : "광고문의가 완료되었습니다."}
              </div>
              <div className="text-[15px] text-gray-700 leading-7">
                영업일 기준 1~2일 이내로 담당자가 배정되어
                <br />
                답변드릴 예정입니다.
              </div>

              <button
                className="mt-10 w-full rounded-xl px-5 py-3 text-white font-semibold bg-violet-600 hover:bg-violet-700"
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
    </div>
  );
}
